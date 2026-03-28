// src/services/payment.service.js
// ─────────────────────────────────────────────────────
// Initiate MoMo or card payments, check payment status
// ─────────────────────────────────────────────────────
import { apiRequest } from "./api";
import { Linking } from "react-native";

const PaymentService = {
  // Pay with Mobile Money (MTN MoMo, Vodafone, AirtelTigo)
  payWithMoMo: async ({ orderId, momoPhone }) => {
    return await apiRequest("/payments/initiate", {
      method: "POST",
      body: JSON.stringify({ orderId, method: "MOMO", momoPhone }),
    });
    // After this, the customer gets a prompt on their phone to approve
  },

  // Pay with card — opens Stripe checkout in browser
  payWithCard: async ({ orderId }) => {
    const data = await apiRequest("/payments/initiate", {
      method: "POST",
      body: JSON.stringify({ orderId, method: "CARD" }),
    });
    // Open Stripe checkout URL in the device browser
    if (data.checkoutUrl) {
      await Linking.openURL(data.checkoutUrl);
    }
    return data;
  },

  // Check payment status for an order
  getStatus: async (orderId) => {
    return await apiRequest(`/payments/${orderId}`);
  },
};

export default PaymentService;
