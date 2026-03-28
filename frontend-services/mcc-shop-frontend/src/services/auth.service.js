// src/services/auth.service.js
// ─────────────────────────────────────────────────────
// All authentication calls: register, login, logout, me
// ─────────────────────────────────────────────────────
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest } from "./api";

const AuthService = {
  // Register a new customer
  register: async ({ name, phone, email, password }) => {
    const data = await apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, phone, email, password }),
    });
    // Save token automatically after register
    await AsyncStorage.setItem("mcc_token", data.token);
    await AsyncStorage.setItem("mcc_user", JSON.stringify(data.user));
    return data;
  },

  // Login with phone + password
  login: async ({ phone, password }) => {
    const data = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ phone, password }),
    });
    await AsyncStorage.setItem("mcc_token", data.token);
    await AsyncStorage.setItem("mcc_user", JSON.stringify(data.user));
    return data;
  },

  // Logout — clears local storage
  logout: async () => {
    await AsyncStorage.multiRemove(["mcc_token", "mcc_user"]);
  },

  // Get currently logged-in user from API
  getMe: async () => {
    return await apiRequest("/auth/me");
  },

  // Get user from local storage (no network call)
  getLocalUser: async () => {
    const user = await AsyncStorage.getItem("mcc_user");
    return user ? JSON.parse(user) : null;
  },

  // Check if a token exists locally
  isLoggedIn: async () => {
    const token = await AsyncStorage.getItem("mcc_token");
    return !!token;
  },
};

export default AuthService;
