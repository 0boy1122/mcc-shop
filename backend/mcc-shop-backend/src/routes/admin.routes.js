const express = require("express");
const prisma = require("../lib/prisma");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const multer = require("multer");
const path = require("path");

const router = express.Router();

// ── Image Upload Setup ─────────────────────────────
const storage = multer.diskStorage({
  destination: "uploads/products/",
  filename: (req, file, cb) => {
    cb(null, `prod-${Date.now()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ 
    storage, 
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit for mobile phone photos
});

// POST /api/admin/products/upload – upload an image
router.post("/products/upload", authenticate, authorize("ADMIN"), upload.single("image"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const url = `/uploads/products/${req.file.filename}`;
    res.json({ url });
});

// All admin routes require authentication + ADMIN role
router.use(authenticate, authorize("ADMIN"));

// ── Products ─────────────────────────────────────────

// POST /api/admin/products  – create new product
router.post("/products", async (req, res, next) => {
  try {
    const product = await prisma.product.create({ data: req.body });
    res.status(201).json({ product });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/products/:id  – update product
router.put("/products/:id", async (req, res, next) => {
  try {
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ product });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/products/:id  – unpublish product
router.delete("/products/:id", async (req, res, next) => {
  try {
    await prisma.product.update({
      where: { id: req.params.id },
      data: { isPublished: false },
    });
    res.json({ message: "Product unpublished" });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/products  – all products including unpublished
router.get("/products", async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json({ products });
  } catch (err) {
    next(err);
  }
});

// ── Orders ───────────────────────────────────────────

// GET /api/admin/orders  – all orders with filters
router.get("/orders", async (req, res, next) => {
  try {
    const { status, from, to } = req.query;
    const where = {};
    if (status) where.status = status;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        user: { select: { name: true, phone: true } },
        items: { include: { product: { select: { name: true, skuCode: true } } } },
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

// ── Analytics ────────────────────────────────────────

// GET /api/admin/analytics  – dashboard stats
router.get("/analytics", async (req, res, next) => {
  try {
    const [
      totalOrders,
      totalRevenue,
      pendingOrders,
      deliveredOrders,
      lowStockProducts,
      totalUsers,
      totalRiders,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.aggregate({ _sum: { total: true }, where: { status: "DELIVERED" } }),
      prisma.order.count({ where: { status: "PENDING" } }),
      prisma.order.count({ where: { status: "DELIVERED" } }),
      prisma.product.findMany({
        where: { stockQty: { lte: 10 } },
        select: { name: true, skuCode: true, stockQty: true, lowStockAlert: true },
      }),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.rider.count(),
    ]);

    // Revenue by category
    const categoryRevenue = await prisma.orderItem.groupBy({
      by: ["productId"],
      _sum: { totalPrice: true },
    });

    res.json({
      totalOrders,
      totalRevenue: totalRevenue._sum.total || 0,
      pendingOrders,
      deliveredOrders,
      totalUsers,
      totalRiders,
      lowStockProducts,
    });
  } catch (err) {
    next(err);
  }
});

// ── Users ────────────────────────────────────────────

// GET /api/admin/users  – all users
router.get("/users", async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, phone: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/riders  – create a rider account
router.post("/riders", async (req, res, next) => {
  try {
    const bcrypt = require("bcryptjs");
    const { name, phone, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name, phone, password: hashed, role: "RIDER" },
    });
    const rider = await prisma.rider.create({ data: { userId: user.id } });

    res.status(201).json({ user: { id: user.id, name, phone, role: "RIDER" }, rider });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
