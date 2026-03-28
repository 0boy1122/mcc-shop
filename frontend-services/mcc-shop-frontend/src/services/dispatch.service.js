// src/services/dispatch.service.js
// ─────────────────────────────────────────────────────
// Rider app: accept orders, send GPS, upload proof
// ─────────────────────────────────────────────────────
import { apiRequest, BASE_URL } from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DispatchService = {
  // Get available orders to pick up
  getAvailableOrders: async () => {
    return await apiRequest("/dispatch/available");
  },

  // Accept an order
  acceptOrder: async (orderId) => {
    return await apiRequest(`/dispatch/accept/${orderId}`, {
      method: "POST",
    });
  },

  // Send current GPS location
  updateLocation: async ({ lat, lng, orderId }) => {
    return await apiRequest("/dispatch/location", {
      method: "PATCH",
      body: JSON.stringify({ lat, lng, orderId }),
    });
  },

  // Upload delivery proof photo
  uploadProof: async (orderId, photoUri) => {
    const token = await AsyncStorage.getItem("mcc_token");

    const formData = new FormData();
    formData.append("proof", {
      uri: photoUri,
      type: "image/jpeg",
      name: `proof-${orderId}.jpg`,
    });

    const response = await fetch(`${BASE_URL}/dispatch/proof/${orderId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Upload failed");
    return data;
  },

  // Toggle online / offline
  setAvailability: async (status) => {
    return await apiRequest("/dispatch/availability", {
      method: "PATCH",
      body: JSON.stringify({ status }), // "ONLINE" or "OFFLINE"
    });
  },
};

export default DispatchService;
