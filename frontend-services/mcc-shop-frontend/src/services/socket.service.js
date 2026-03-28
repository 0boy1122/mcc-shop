// src/services/socket.service.js
// ─────────────────────────────────────────────────────
// Real-time connection for order tracking & rider GPS
// Install: npm install socket.io-client
// ─────────────────────────────────────────────────────
import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:5000";
// ↑ Change to your deployed URL when live

let socket = null;

const SocketService = {
  // Connect to the backend socket server
  connect: () => {
    if (socket?.connected) return socket;
    socket = io(SOCKET_URL, { transports: ["websocket"] });

    socket.on("connect", () => console.log("🔌 Socket connected"));
    socket.on("disconnect", () => console.log("🔌 Socket disconnected"));

    return socket;
  },

  // Customer: start tracking an order (join the order's room)
  trackOrder: (orderId) => {
    socket?.emit("track:order", orderId);
  },

  // Customer: listen for rider GPS updates
  onRiderLocation: (callback) => {
    socket?.on("rider:location", callback);
    // callback receives: { lat, lng }
  },

  // Customer & Rider: listen for order status changes
  onOrderStatus: (callback) => {
    socket?.on("order:status", callback);
    // callback receives: { orderId, status, rider? }
  },

  // Rider: send GPS location update
  sendLocation: ({ orderId, lat, lng }) => {
    socket?.emit("rider:location", { orderId, lat, lng });
  },

  // Remove listeners (call in useEffect cleanup)
  removeListeners: () => {
    socket?.off("rider:location");
    socket?.off("order:status");
  },

  // Disconnect (call on logout)
  disconnect: () => {
    socket?.disconnect();
    socket = null;
  },
};

export default SocketService;
