const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");
const { authenticate } = require("../middleware/auth.middleware");

const router = express.Router();

const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

// POST /api/auth/register
router.post("/register", async (req, res, next) => {
  try {
    const { name, phone, email, password } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({ error: "Name, phone and password are required" });
    }

    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) return res.status(409).json({ error: "Phone number already registered" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, phone, email, password: hashed, role: "CUSTOMER" },
      select: { id: true, name: true, phone: true, email: true, role: true },
    });

    const token = generateToken(user.id);
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

    // Check if this is a staff login attempt (ADMIN or RIDER)
    if (role && (role === "ADMIN" || role === "RIDER")) {
      const adminPassword = process.env.ADMIN_PASSWORD;
      const riderPassword = process.env.RIDER_PASSWORD;
      const expectedPassword = role === "ADMIN" ? adminPassword : riderPassword;

      if (!expectedPassword) {
        console.error(`${role}_PASSWORD not configured in environment`);
        return res.status(500).json({ error: `${role} login not configured. Contact the administrator.` });
      }

      if (password === expectedPassword) {
        const staffUser = {
          id: `${role.toLowerCase()}-${phone}`,
          name: role === "ADMIN" ? "Admin" : "Rider",
          phone: phone,
          role: role,
          email: null
        };

        const token = generateToken(staffUser.id);
        console.log(`Staff login successful: ${role} with phone ${phone}`);
        return res.json({ user: staffUser, token });
      } else {
        console.warn(`Staff login failed: Incorrect password for ${role} with phone ${phone}`);
        return res.status(401).json({ error: "Invalid credentials" });
      }
    }

    // Regular customer login flow
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
        console.warn(`Login failed: Phone ${phone} not found`);
        return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
        console.warn(`Login failed: Incorrect password for ${phone}`);
        return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = generateToken(user.id);
    const { password: _, ...safeUser } = user;
    console.log(`Login successful for ${phone}`);
    res.json({ user: safeUser, token });
  } catch (err) {
    console.error('Login system error:', err);
    next(err);
  }
});

// GET /api/auth/me
router.get("/me", authenticate, async (req, res) => {
  const { password: _, ...safeUser } = req.user;
  res.json({ user: safeUser });
});

// POST /api/auth/logout  (client just drops the token, but good for audit)
router.post("/logout", authenticate, (req, res) => {
  res.json({ message: "Logged out successfully" });
});

module.exports = router;
