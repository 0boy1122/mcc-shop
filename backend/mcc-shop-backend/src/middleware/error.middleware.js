const errorHandler = (err, req, res, next) => {
  console.error("❌ Error:", err.message);

  if (err.name === "PrismaClientKnownRequestError") {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Record already exists" });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Record not found" });
    }
  }

  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ error: "Invalid token" });
  }

  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
};

module.exports = { errorHandler };
