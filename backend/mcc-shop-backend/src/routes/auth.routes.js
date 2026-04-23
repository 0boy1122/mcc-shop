const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const prisma = require("../lib/prisma");
const { authenticate } = require("../middleware/auth.middleware");

const router = express.Router();

const generateToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

// POST /api/auth/register
router.post("/register", async (req, res, next) => {
  try {
    const { name, phone, email, password } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({ error: "Name, phone and password are required" });
    }
    if (typeof name !== "string" || name.length > 100) {
      return res.status(400).json({ error: "Invalid name" });
    }
    if (typeof phone !== "string" || !/^\+?[\d\s\-]{7,20}$/.test(phone)) {
      return res.status(400).json({ error: "Invalid phone number" });
    }
    if (typeof password !== "string" || password.length < 6 || password.length > 128) {
      return res.status(400).json({ error: "Password must be 6–128 characters" });
    }

    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) return res.status(409).json({ error: "Phone number already registered" });

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, phone, email: email || null, password: hashed, role: "CUSTOMER" },
      select: { id: true, name: true, phone: true, email: true, role: true },
    });

    const token = generateToken({ userId: user.id, role: user.role });
    res.status(201).json({ user, token });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post("/login", async (req, res, next) => {
  try {
    const { phone, password, role } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: "Phone and password are required" });
    }

    // Staff login (ADMIN or RIDER)
    if (role === "ADMIN" || role === "RIDER") {
      const expectedPassword = role === "ADMIN"
        ? process.env.ADMIN_PASSWORD
        : process.env.RIDER_PASSWORD;

      if (!expectedPassword) {
        return res.status(500).json({ error: "Login not configured. Contact administrator." });
      }

      // Timing-safe comparison prevents timing attacks
      let match = false;
      try {
        match = crypto.timingSafeEqual(
          Buffer.from(String(password)),
          Buffer.from(String(expectedPassword))
        );
      } catch {
        match = false; // different lengths — definitely wrong
      }

      if (!match) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const staffUser = {
        id: `${role.toLowerCase()}-${phone}`,
        name: role === "ADMIN" ? "Admin" : "Rider",
        phone,
        role,
        email: null,
      };

      // Include role in JWT so auth middleware can reconstruct staff user without DB
      const token = generateToken({
        userId: staffUser.id,
        role: staffUser.role,
        name: staffUser.name,
        phone: staffUser.phone,
      });

      return res.json({ user: staffUser, token });
    }

    // Customer login
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      // Constant-time fake compare to prevent phone enumeration via timing
      await bcrypt.compare(password, "$2a$12$fakehashfakehashfakehashfakehashfakehash");
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = generateToken({ userId: user.id, role: user.role });
    const { password: _, ...safeUser } = user;
    res.json({ user: safeUser, token });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get("/me", authenticate, async (req, res) => {
  const { password: _, ...safeUser } = req.user;
  res.json({ user: safeUser });
});

// POST /api/auth/logout
router.post("/logout", authenticate, (req, res) => {
  res.json({ message: "Logged out successfully" });
});

module.exports = router;
