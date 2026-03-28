const express = require("express");
const prisma = require("../lib/prisma");
const { authenticate, authorize } = require("../middleware/auth.middleware");

const router = express.Router();

// GET /api/products  – list all published products (with optional filters)
router.get("/", async (req, res, next) => {
  try {
    const { category, search, dispatch, limit = 50, offset = 0 } = req.query;

    const where = { isPublished: true };
    if (category) where.category = { equals: category, mode: "insensitive" };
    if (dispatch) where.dispatchMode = dispatch.toUpperCase();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { skuCode: { contains: search, mode: "insensitive" } },
        { category: { contains: search, mode: "insensitive" } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        take: Number(limit),
        skip: Number(offset),
        orderBy: [{ mvpPriority: "desc" }, { name: "asc" }],
      }),
      prisma.product.count({ where }),
    ]);

    res.json({ products, total, limit: Number(limit), offset: Number(offset) });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/categories  – list all unique categories
router.get("/categories", async (req, res, next) => {
  try {
    const categories = await prisma.product.findMany({
      where: { isPublished: true },
      select: { category: true },
      distinct: ["category"],
    });
    res.json({ categories: categories.map((c) => c.category) });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:id  – single product
router.get("/:id", async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
    });
    if (!product || !product.isPublished) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({ product });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
