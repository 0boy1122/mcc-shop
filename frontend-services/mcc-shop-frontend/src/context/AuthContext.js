// src/context/AuthContext.js
// ─────────────────────────────────────────────────────
// Wrap your app in <AuthProvider> so any screen can call
// useAuth() to get the current user and login/logout
// ─────────────────────────────────────────────────────
import React, { createContext, useContext, useEffect, useState } from "react";
import AuthService from "../services/auth.service";
import SocketService from "../services/socket.service";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On app start, check if user is already logged in
  useEffect(() => {
    const init = async () => {
      try {
        const localUser = await AuthService.getLocalUser();
        if (localUser) {
          setUser(localUser);
          SocketService.connect();
        }
      } catch (e) {
        console.error("Auth init error", e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const login = async (credentials) => {
    const data = await AuthService.login(credentials);
    setUser(data.user);
    SocketService.connect();
    return data;
  };

  const register = async (details) => {
    const data = await AuthService.register(details);
    setUser(data.user);
    SocketService.connect();
    return data;
  };

  const logout = async () => {
    await AuthService.logout();
    SocketService.disconnect();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Use this hook in any screen: const { user, login, logout } = useAuth();
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};
