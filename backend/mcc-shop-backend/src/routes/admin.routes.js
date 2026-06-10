const express = require("express");
const prisma = require("../lib/prisma");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();
const uploadDir = path.join(__dirname, "../../uploads/products");
fs.mkdirSync(uploadDir, { recursive: true });

// ── Image Upload Setup ─────────────────────────────
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(new Error("Only image files are allowed (jpeg, png, webp, gif)"));
  },
});

async function storeProductImage(file) {
  const ext = path.extname(file.originalname) || ".jpg";
  const filename = `prod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = require("@vercel/blob");
    const blob = await put(`products/${filename}`, file.buffer, {
      access: "public",
      contentType: file.mimetype,
    });
    return blob.url;
  }

  const filepath = path.join(uploadDir, filename);
  await fs.promises.writeFile(filepath, file.buffer);
  return `/uploads/products/${filename}`;
}

// POST /api/admin/products/upload – upload an image
router.post("/products/upload", authenticate, authorize("ADMIN"), upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const url = await storeProductImage(req.file);
    res.json({ url });
  } catch (err) {
    next(err);
  }
});

// All admin routes require authentication + ADMIN role
router.use(authenticate, authorize("ADMIN"));

// ── Products ─────────────────────────────────────────

const PRODUCT_FIELDS = [
  "skuCode", "name", "brand", "category", "subCategory", "unitSize",
  "costPrice", "sellingPrice", "vatIncluded", "bulkThreshold", "bulkPrice",
  "stockQty", "lowStockAlert", "dispatchMode", "isFragile", "isHazardous",
  "images", "notes", "isPublished", "mvpPriority",
];

function pickProductFields(body) {
  const data = {};
  for (const key of PRODUCT_FIELDS) {
    if (key in body) data[key] = body[key];
  }

  const toBool = (value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return ["true", "1", "yes", "on"].includes(value.toLowerCase());
    return Boolean(value);
  };

  for (const key of ["costPrice", "sellingPrice", "bulkPrice"]) {
    if (key in data && data[key] !== null && data[key] !== "") data[key] = Number(data[key]);
    if (data[key] === "") data[key] = null;
  }
  for (const key of ["bulkThreshold", "stockQty", "lowStockAlert"]) {
    if (key in data && data[key] !== null && data[key] !== "") data[key] = parseInt(data[key], 10);
  }
  for (const key of ["vatIncluded", "isFragile", "isHazardous", "isPublished", "mvpPriority"]) {
    if (key in data) data[key] = toBool(data[key]);
  }
  if (!data.costPrice && data.costPrice !== 0) data.costPrice = 0;
  if (!data.unitSize) data.unitSize = "Unit";
  if (!data.dispatchMode) data.dispatchMode = "BIKE";
  return data;
}

// POST /api/admin/products  – create new product
router.post("/products", async (req, res, next) => {
  try {
    const product = await prisma.product.create({ data: pickProductFields(req.body) });
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
      data: pickProductFields(req.body),
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

// PATCH /api/admin/products/:id/publish  – toggle publish status
router.patch("/products/:id/publish", async (req, res, next) => {
  try {
    const current = await prisma.product.findUnique({ where: { id: req.params.id }, select: { isPublished: true } });
    if (!current) return res.status(404).json({ error: "Product not found" });
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { isPublished: !current.isPublished },
    });
    res.json({ product, published: product.isPublished });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/products/:id/stock  – set or adjust stock quantity
// Body: { op: "set"|"adjust", qty: number, reason?: string }
router.patch("/products/:id/stock", async (req, res, next) => {
  try {
    const { op, qty, reason } = req.body;
    if (!["set", "adjust"].includes(op)) {
      return res.status(400).json({ error: "op must be 'set' or 'adjust'" });
    }
    const parsedQty = parseInt(qty);
    if (isNaN(parsedQty)) return res.status(400).json({ error: "qty must be a number" });

    const current = await prisma.product.findUnique({ where: { id: req.params.id }, select: { stockQty: true, name: true } });
    if (!current) return res.status(404).json({ error: "Product not found" });

    const newQty = op === "set" ? Math.max(0, parsedQty) : Math.max(0, current.stockQty + parsedQty);
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { stockQty: newQty },
    });
    res.json({
      product,
      stockUpdate: { op, previous: current.stockQty, change: newQty - current.stockQty, current: newQty, reason: reason || null },
    });
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

router.get("/products/:id", async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json({ product });
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
      if (from) {
        const d = new Date(from);
        if (isNaN(d.getTime())) return res.status(400).json({ error: "Invalid 'from' date" });
        where.createdAt.gte = d;
      }
      if (to) {
        const d = new Date(to);
        if (isNaN(d.getTime())) return res.status(400).json({ error: "Invalid 'to' date" });
        where.createdAt.lte = d;
      }
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

// PATCH /api/admin/orders/:id/status  – update order status + auto-deduct stock on CONFIRMED
router.patch("/orders/:id/status", async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ["CONFIRMED", "DISPATCHED", "DELIVERED", "CANCELLED"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
    }

    const existing = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });
    if (!existing) return res.status(404).json({ error: "Order not found" });

    // Prevent going backwards (e.g. DELIVERED → PENDING)
    const statusRank = { PENDING: 0, CONFIRMED: 1, DISPATCHED: 2, DELIVERED: 3, CANCELLED: 4 };
    if (statusRank[status] < statusRank[existing.status] && status !== "CANCELLED") {
      return res.status(400).json({ error: `Cannot move order from ${existing.status} back to ${status}` });
    }

    const order = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({ where: { id: req.params.id }, data: { status } });

      // On CANCELLED: restore stock that was deducted when order was placed
      if (status === "CANCELLED" && existing.status === "PENDING") {
        for (const item of existing.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQty: { increment: item.quantity } },
          });
        }
      }
      return updated;
    });

    const io = req.app.get("io");
    if (io) io.to(`order:${order.id}`).emit("order:status", { orderId: order.id, status });

    res.json({ order });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/orders/:id/rider  – assign a rider to an order
router.patch("/orders/:id/rider", async (req, res, next) => {
  try {
    const { riderId } = req.body;
    if (!riderId) return res.status(400).json({ error: "riderId is required" });

    const rider = await prisma.rider.findUnique({ where: { id: riderId } });
    if (!rider) return res.status(404).json({ error: "Rider not found" });

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { riderId, status: "DISPATCHED" },
      include: { rider: { include: { user: { select: { name: true, phone: true } } } } },
    });
    res.json({ order });
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
        where: { isPublished: true },
        select: { name: true, skuCode: true, stockQty: true, lowStockAlert: true },
      }).then(products => products.filter(p => p.stockQty <= (p.lowStockAlert ?? 10))),
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
