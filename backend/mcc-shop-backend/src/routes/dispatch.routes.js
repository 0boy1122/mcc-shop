const express = require("express");
const prisma = require("../lib/prisma");
const multer = require("multer");
const path = require("path");
const { authenticate, authorize } = require("../middleware/auth.middleware");

const router = express.Router();

// File upload config for delivery proof
const storage = multer.diskStorage({
  destination: "uploads/proofs/",
  filename: (req, file, cb) => {
    cb(null, `proof-${Date.now()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/dispatch/available  – pending orders for riders to pick up
router.get("/available", authenticate, authorize("RIDER"), async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { status: "CONFIRMED", riderId: null },
      include: {
        items: { include: { product: { select: { name: true, dispatchMode: true } } } },
        user: { select: { name: true, phone: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

// POST /api/dispatch/accept/:orderId  – rider accepts an order
router.post("/accept/:orderId", authenticate, authorize("RIDER"), async (req, res, next) => {
  try {
    const rider = await prisma.rider.findUnique({ where: { userId: req.user.id } });
    if (!rider) return res.status(404).json({ error: "Rider profile not found" });

    const order = await prisma.order.findUnique({ where: { id: req.params.orderId } });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.riderId) return res.status(409).json({ error: "Order already assigned" });

    const [updatedOrder] = await prisma.$transaction([
      prisma.order.update({
        where: { id: req.params.orderId },
        data: { riderId: rider.id, status: "DISPATCHED" },
      }),
      prisma.rider.update({
        where: { id: rider.id },
        data: { status: "ON_DELIVERY" },
      }),
      prisma.dispatchLog.create({
        data: { orderId: req.params.orderId, riderId: rider.id },
      }),
    ]);

    // Notify customer in real-time
    const io = req.app.get("io");
    io.to(`order:${req.params.orderId}`).emit("order:status", {
      orderId: req.params.orderId,
      status: "DISPATCHED",
      rider: { name: req.user.name, phone: req.user.phone },
    });

    res.json({ order: updatedOrder });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/dispatch/location  – rider sends live GPS coordinates
router.patch("/location", authenticate, authorize("RIDER"), async (req, res, next) => {
  try {
    const { lat, lng, orderId } = req.body;

    const rider = await prisma.rider.update({
      where: { userId: req.user.id },
      data: { currentLat: lat, currentLng: lng },
    });

    // Broadcast to customer tracking this order
    if (orderId) {
      const io = req.app.get("io");
      io.to(`order:${orderId}`).emit("rider:location", { lat, lng });
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/dispatch/proof/:orderId  – upload delivery photo/signature
router.post(
  "/proof/:orderId",
  authenticate,
  authorize("RIDER"),
  upload.single("proof"),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const proofUrl = `/uploads/proofs/${req.file.filename}`;

      await prisma.dispatchLog.update({
        where: { orderId: req.params.orderId },
        data: { proofPhotoUrl: proofUrl, deliveredAt: new Date() },
      });

      const rider = await prisma.rider.findUnique({ where: { userId: req.user.id } });

      await prisma.$transaction([
        prisma.order.update({
          where: { id: req.params.orderId },
          data: { status: "DELIVERED" },
        }),
        prisma.rider.update({
          where: { id: rider.id },
          data: { status: "ONLINE", totalTrips: { increment: 1 } },
        }),
      ]);

      const io = req.app.get("io");
      io.to(`order:${req.params.orderId}`).emit("order:status", {
        orderId: req.params.orderId,
        status: "DELIVERED",
        proofUrl,
      });

      res.json({ ok: true, proofUrl });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/dispatch/availability  – rider toggles online/offline
router.patch("/availability", authenticate, authorize("RIDER"), async (req, res, next) => {
  try {
    const { status } = req.body; // ONLINE or OFFLINE
    const rider = await prisma.rider.update({
      where: { userId: req.user.id },
      data: { status },
    });
    res.json({ rider });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
