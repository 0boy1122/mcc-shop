// src/services/order.service.js
// ─────────────────────────────────────────────────────
// Place orders, track orders, list order history
// ─────────────────────────────────────────────────────
import { apiRequest } from "./api";

const OrderService = {
  // Place a new order
  // items = [{ productId, quantity }]
  placeOrder: async ({ items, deliveryAddress, deliveryLat, deliveryLng, vehicleType, deliveryFee, notes, scheduledAt }) => {
    return await apiRequest("/orders", {
      method: "POST",
      body: JSON.stringify({
        items,
        deliveryAddress,
        deliveryLat,
        deliveryLng,
        vehicleType,
        deliveryFee,
        notes,
        scheduledAt,
      }),
    });
  },

  // Get all my orders (optionally filter by status)
  getMyOrders: async (status) => {
    const query = status ? `?status=${status}` : "";
    return await apiRequest(`/orders${query}`);
  },

  // Track a specific order by ID
  getById: async (id) => {
    return await apiRequest(`/orders/${id}`);
  },

  // Update order status (admin/rider only)
  updateStatus: async (id, status) => {
    return await apiRequest(`/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },
};

export default OrderService;
