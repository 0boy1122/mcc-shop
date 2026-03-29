require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

const authRoutes = require("./routes/auth.routes");
const productRoutes = require("./routes/product.routes");
const orderRoutes = require("./routes/order.routes");
const paymentRoutes = require("./routes/payment.routes");
const dispatchRoutes = require("./routes/dispatch.routes");
const adminRoutes = require("./routes/admin.routes");
const aiRoutes = require("./routes/ai.routes");
const { errorHandler } = require("./middleware/error.middleware");

const app = express();
const server = http.createServer(app);

// ── Socket.io for real-time rider tracking ────────────
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL, methods: ["GET", "POST"] },
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // Rider sends GPS update → broadcast to customer watching their order
  socket.on("rider:location", ({ orderId, lat, lng }) => {
    io.to(`order:${orderId}`).emit("rider:location", { lat, lng });
  });

  // Customer joins a room to track their order
  socket.on("track:order", (orderId) => {
    socket.join(`order:${orderId}`);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

// Make io accessible in route handlers
app.set("io", io);

// ── Middleware ─────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Relax for static HTML testing
}));
app.use(cors({ origin: true, credentials: true }));
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend and images from the 'public' folder
app.use(express.static(path.join(__dirname, "../public")));

// ── Routes ─────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/dispatch", dispatchRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/ai", aiRoutes);

// ── Health check ───────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", app: "MCC Shop API", time: new Date() });
});

// ── 404 ────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ── Error handler ──────────────────────────────────────
app.use(errorHandler);

// ── Start server ───────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n🚀 MCC Shop API running on port ${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health: http://localhost:${PORT}/health\n`);
});
