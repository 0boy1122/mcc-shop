const express = require("express");
const prisma = require("../lib/prisma");
const { authenticate, authorize } = require("../middleware/auth.middleware");

const router = express.Router();
const bcrypt = require("bcryptjs");

// POST /api/orders/guest  – place an order as a guest
router.post("/guest", async (req, res, next) => {
  try {
    const { name, phone, items, deliveryAddress, deliveryLat, deliveryLng, vehicleType, notes } = req.body;

    if (!name || !phone || !items || items.length === 0) {
      return res.status(400).json({ error: "Name, phone, and at least one item are required" });
    }

    // Lookup or Create User
    let user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      const hashed = await bcrypt.hash(phone, 10); // default password is phone number
      user = await prisma.user.create({
        data: { name, phone, password: hashed, role: "CUSTOMER" },
      });
    }

    // Validate Items by skuCode
    const skus = items.map((i) => i.productId);
    const products = await prisma.product.findMany({ where: { skuCode: { in: skus } } });

    let subtotal = 0;
    const orderItems = items.map((item) => {
      const product = products.find((p) => p.skuCode === item.productId);
      if (!product) throw { status: 404, message: `Product ${item.productId} not found` };
      if (product.stockQty < item.quantity) throw { status: 400, message: `Insufficient stock for ${product.name}` };

      const isBulk = product.bulkThreshold > 0 && item.quantity >= product.bulkThreshold;
      const unitPrice = isBulk && product.bulkPrice ? product.bulkPrice : product.sellingPrice;
      const totalPrice = unitPrice * item.quantity;
      subtotal += totalPrice;

      return {
        productId: product.id,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
      };
    });

    const deliveryFee = 0; // Or calculate based on map distance API later
    const total = subtotal + deliveryFee;

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          userId: user.id,
          deliveryAddress,
          deliveryLat,
          deliveryLng,
          vehicleType: vehicleType || "BIKE",
          deliveryFee,
          subtotal,
          total,
          notes,
          items: { create: orderItems },
        },
        include: { items: { include: { product: true } }, user: { select: { name: true, phone: true } } },
      });

      for (const item of orderItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { decrement: item.quantity } },
        });
      }
      return newOrder;
    });

    // Notify connected admins/riders instantly over Socket.io using the global app instance
    const io = req.app.get("io");
    if(io) io.emit("order:new", order);

    res.status(201).json({ order, message: "Order placed successfully!" });
  } catch (err) {
    if(err.status) res.status(err.status).json({ error: err.message });
    else next(err);
  }
});

// POST /api/orders  – place an order
router.post("/", authenticate, async (req, res, next) => {
  try {
    const { items, deliveryAddress, deliveryLat, deliveryLng, vehicleType, deliveryFee, notes, scheduledAt } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Order must have at least one item" });
    }

    // Fetch all products and validate stock
    const productIds = items.map((i) => i.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });

    let subtotal = 0;
    const orderItems = items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) throw { status: 404, message: `Product ${item.productId} not found` };
      if (product.stockQty < item.quantity) throw { status: 400, message: `Insufficient stock for ${product.name}` };

      const isBulk = product.bulkThreshold > 0 && item.quantity >= product.bulkThreshold;
      const unitPrice = isBulk && product.bulkPrice ? product.bulkPrice : product.sellingPrice;
      const totalPrice = unitPrice * item.quantity;
      subtotal += totalPrice;

      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
      };
    });

    const total = subtotal + (deliveryFee || 0);

    // Create order with items in a transaction
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          userId: req.user.id,
          deliveryAddress,
          deliveryLat,
          deliveryLng,
          vehicleType: vehicleType || "BIKE",
          deliveryFee: deliveryFee || 0,
          subtotal,
          total,
          notes,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
          items: { create: orderItems },
        },
        include: { items: { include: { product: true } } },
      });

      // Decrement stock
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { decrement: item.quantity } },
        });
      }

      return newOrder;
    });

    res.status(201).json({ order });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders  – get my orders (customer) or all orders (admin/rider)
router.get("/", authenticate, async (req, res, next) => {
  try {
    const where = req.user.role === "CUSTOMER" ? { userId: req.user.id } : {};
    if (req.query.status) where.status = req.query.status;

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: { include: { product: true } },
        payment: true,
        rider: { include: { user: { select: { name: true, phone: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/:id  – track a single order
router.get("/:id", authenticate, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: { include: { product: true } },
        payment: true,
        dispatchLog: true,
        rider: {
          include: {
            user: { select: { name: true, phone: true } },
          },
        },
      },
    });

    if (!order) return res.status(404).json({ error: "Order not found" });

    // Customers can only see their own orders
    if (req.user.role === "CUSTOMER" && order.userId !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({ order });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/orders/:id/status  – update order status (admin or rider)
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

    // Notify via Socket.io
    const io = req.app.get("io");
    io.to(`order:${order.id}`).emit("order:status", { orderId: order.id, status });

    res.json({ order });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
