const errorHandler = (err, req, res, next) => {
  console.error("❌ Error:", err.message);

  if (err.name === "PrismaClientKnownRequestError") {
    if (err.code === "P2002") return res.status(409).json({ error: "Record already exists" });
    if (err.code === "P2025") return res.status(404).json({ error: "Record not found" });
  }

  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ error: "Invalid token" });
  }

  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "CORS: origin not allowed" });
  }

  const isProd = process.env.NODE_ENV === "production";
  res.status(err.status || 500).json({
    error: isProd ? "Internal server error" : (err.message || "Internal server error"),
  });
};

module.exports = { errorHandler };
