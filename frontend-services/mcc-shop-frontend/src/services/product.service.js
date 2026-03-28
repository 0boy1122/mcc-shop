// src/services/product.service.js
// ─────────────────────────────────────────────────────
// Fetch products, categories, and search
// ─────────────────────────────────────────────────────
import { apiRequest } from "./api";

const ProductService = {
  // Get all published products
  // Optional filters: { category, search, dispatch, limit, offset }
  getAll: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.category) params.append("category", filters.category);
    if (filters.search)   params.append("search", filters.search);
    if (filters.dispatch) params.append("dispatch", filters.dispatch);
    if (filters.limit)    params.append("limit", filters.limit);
    if (filters.offset)   params.append("offset", filters.offset);

    const query = params.toString() ? `?${params.toString()}` : "";
    return await apiRequest(`/products${query}`);
  },

  // Get a single product by ID
  getById: async (id) => {
    return await apiRequest(`/products/${id}`);
  },

  // Get all categories (Paints, Electrical, Plumbing, etc.)
  getCategories: async () => {
    return await apiRequest("/products/categories");
  },

  // Search products by name or SKU
  search: async (query) => {
    return await apiRequest(`/products?search=${encodeURIComponent(query)}`);
  },
};

export default ProductService;
