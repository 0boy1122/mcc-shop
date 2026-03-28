// src/services/api.js
// ─────────────────────────────────────────────────────
// Base API client for MCC Shop
// Change BASE_URL to your deployed backend URL when you go live
// ─────────────────────────────────────────────────────
import AsyncStorage from "@react-native-async-storage/async-storage";

export const BASE_URL = "http://localhost:5000/api";
// ↑ When deployed, change to e.g. "https://mccshop-api.onrender.com/api"

// Core fetch wrapper — attaches token automatically
export const apiRequest = async (endpoint, options = {}) => {
  const token = await AsyncStorage.getItem("mcc_token");

  const config = {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong");
  }

  return data;
};
