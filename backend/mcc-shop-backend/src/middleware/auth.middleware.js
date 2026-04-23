const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Staff tokens include role in payload — reconstruct without DB lookup
    if (decoded.role === "ADMIN" || decoded.role === "RIDER") {
      req.user = {
        id: decoded.userId,
        name: decoded.name || decoded.role,
        phone: decoded.phone || null,
        email: null,
        role: decoded.role,
      };
      return next();
    }

    // Customer tokens — verify user still exists in DB
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(401).json({ error: "User not found" });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    next();
  };
};

module.exports = { authenticate, authorize };
