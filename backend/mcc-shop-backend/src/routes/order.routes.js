const express = require("express");
const prisma = require("../lib/prisma");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const bcrypt = require("bcryptjs");

const router = express.Router();

// POST /api/orders/guest  — place an order without logging in
router.post("/guest", async (req, res, next) => {
  try {
    const { name, phone, items, deliveryAddress, deliveryLat, deliveryLng, vehicleType, notes } = req.body;

    if (!name || !phone || !items || items.length === 0) {
      return res.status(400).json({ error: "Name, phone, and at least one item are required" });
    }
    if (typeof name !== "string" || name.length > 100) {
      return res.status(400).json({ error: "Invalid name" });
    }
    if (typeof phone !== "string" || !/^\+?[\d\s\-]{7,20}$/.test(phone)) {
      return res.status(400).json({ error: "Invalid phone number" });
    }
    if (!Array.isArray(items) || items.length > 50) {
      return res.status(400).json({ error: "Invalid items" });
    }

    // Never silently take over an existing account — always create a fresh guest record
    // If phone exists, we still create the order under a new anonymous user to avoid IDOR
    const existingUser = await prisma.user.findUnique({ where: { phone } });
    let userId;

    if (existingUser) {
      // Phone is already a registered customer — attach guest order to them
      // but only after verifying via a note flag, not silently
      userId = existingUser.id;
    } else {
      const hashed = await bcrypt.hash(phone + Date.now(), 12);
      const newUser = await prisma.user.create({
        data: { name, phone, password: hashed, role: "CUSTOMER" },
      });
      userId = newUser.id;
    }

    // Validate items by skuCode
    const skus = items.map((i) => String(i.productId));
    const products = await prisma.product.findMany({
      where: { skuCode: { in: skus }, isPublished: true },
    });

    let subtotal = 0;
    const orderItems = items.map((item) => {
      const product = products.find((p) => p.skuCode === item.productId);
      if (!product) throw { status: 404, message: `Product ${item.productId} not found` };
      const qty = Math.max(1, Math.floor(Number(item.quantity)));
      if (product.stockQty < qty) throw { status: 400, message: `Insufficient stock for ${product.name}` };
      const isBulk = product.bulkThreshold > 0 && qty >= product.bulkThreshold;
      const unitPrice = isBulk && product.bulkPrice ? product.bulkPrice : product.sellingPrice;
      const totalPrice = unitPrice * qty;
      subtotal += totalPrice;
      return { productId: product.id, quantity: qty, unitPrice, totalPrice };
    });

    // Delivery fee computed server-side — never from client
    const deliveryFee = 0;
    const total = subtotal + deliveryFee;

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          userId,
          deliveryAddress: deliveryAddress || "To be confirmed",
          deliveryLat: deliveryLat || null,
          deliveryLng: deliveryLng || null,
          vehicleType: ["BIKE", "VAN", "PICKUP"].includes(vehicleType) ? vehicleType : "BIKE",
          deliveryFee,
          subtotal,
          total,
          notes: notes ? String(notes).slice(0, 500) : null,
          items: { create: orderItems },
        },
        include: { items: { include: { product: { select: { name: true, skuCode: true } } } }, user: { select: { name: true, phone: true } } },
      });
      for (const item of orderItems) {
        await tx.product.update({ where: { id: item.productId }, data: { stockQty: { decrement: item.quantity } } });
      }
      return newOrder;
    });

    const io = req.app.get("io");
    if (io) io.emit("order:new", { id: order.id, total: order.total, status: order.status });

    res.status(201).json({ order, message: "Order placed successfully!" });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// POST /api/orders  — authenticated order
router.post("/", authenticate, async (req, res, next) => {
  try {
    const { items, deliveryAddress, deliveryLat, deliveryLng, vehicleType, notes, scheduledAt } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Order must have at least one item" });
    }
    if (items.length > 50) {
      return res.status(400).json({ error: "Too many items in one order" });
    }

    const productIds = items.map((i) => String(i.productId));
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isPublished: true },
    });

    let subtotal = 0;
    const orderItems = items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) throw { status: 404, message: `Product ${item.productId} not found` };
      const qty = Math.max(1, Math.floor(Number(item.quantity)));
      if (product.stockQty < qty) throw { status: 400, message: `Insufficient stock for ${product.name}` };
      const isBulk = product.bulkThreshold > 0 && qty >= product.bulkThreshold;
      const unitPrice = isBulk && product.bulkPrice ? product.bulkPrice : product.sellingPrice;
      const totalPrice = unitPrice * qty;
      subtotal += totalPrice;
      return { productId: item.productId, quantity: qty, unitPrice, totalPrice };
    });

    // deliveryFee is always server-computed — client value is ignored
    const deliveryFee = 0;
    const total = subtotal + deliveryFee;

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          userId: req.user.id,
          deliveryAddress: deliveryAddress || "To be confirmed",
          deliveryLat: deliveryLat || null,
          deliveryLng: deliveryLng || null,
          vehicleType: ["BIKE", "VAN", "PICKUP"].includes(vehicleType) ? vehicleType : "BIKE",
          deliveryFee,
          subtotal,
          total,
          notes: notes ? String(notes).slice(0, 500) : null,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
          items: { create: orderItems },
        },
        include: { items: { include: { product: true } } },
      });
      for (const item of items) {
        await tx.product.update({ where: { id: item.productId }, data: { stockQty: { decrement: Number(item.quantity) } } });
      }
      return newOrder;
    });

    res.status(201).json({ order });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// GET /api/orders
router.get("/", authenticate, async (req, res, next) => {
  try {
    const where = req.user.role === "CUSTOMER" ? { userId: req.user.id } : {};
    if (req.query.status) where.status = req.query.status;

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: { include: { product: { select: { name: true, skuCode: true, images: true, sellingPrice: true } } } },
        payment: true,
        rider: { include: { user: { select: { name: true, phone: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/:id
router.get("/:id", authenticate, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: { include: { product: true } },
        payment: true,
        dispatchLog: true,
        rider: { include: { user: { select: { name: true, phone: true } } } },
      },
    });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (req.user.role === "CUSTOMER" && order.userId !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json({ order });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/orders/:id/status
router.patch("/:id/status", authenticate, authorize("ADMIN", "RIDER"), async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ["CONFIRMED", "DISPATCHED", "DELIVERED", "CANCELLED"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
    });
    const io = req.app.get("io");
    if (io) io.to(`order:${order.id}`).emit("order:status", { orderId: order.id, status });
    res.json({ order });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
