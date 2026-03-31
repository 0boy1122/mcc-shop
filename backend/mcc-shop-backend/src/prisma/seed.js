const prisma = require("../lib/prisma");
const bcrypt = require("bcryptjs");

async function main() {
  console.log("🌱 Seeding MCC Shop database...");

  // --- Admin user ---
  const adminPassword = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { phone: "0200000001" },
    update: {},
    create: {
      name: "MCC Admin",
      phone: "0200000001",
      email: "admin@mccshop.com",
      password: adminPassword,
      role: "ADMIN",
    },
  });

  // --- Test customer ---
  const customerPassword = await bcrypt.hash("customer123", 10);
  await prisma.user.upsert({
    where: { phone: "0200000002" },
    update: {},
    create: {
      name: "Test Customer",
      phone: "0200000002",
      email: "client@test.com",
      password: customerPassword,
      role: "CUSTOMER",
    },
  });

  // --- Test rider ---
  const riderPassword = await bcrypt.hash("rider123", 10);
  const riderUser = await prisma.user.upsert({
    where: { phone: "0200000003" },
    update: {},
    create: {
      name: "Test Rider",
      phone: "0200000003",
      email: "rider@test.com",
      password: riderPassword,
      role: "RIDER",
    },
  });
  await prisma.rider.upsert({
    where: { userId: riderUser.id },
    update: {},
    create: { userId: riderUser.id },
  });

  // --- Products from MCC MVP Catalogue ---
  const products = [
    {
      skuCode: "PNT-001",
      name: "Emulsion Paint",
      category: "Paints",
      unitSize: "5 Gallon",
      costPrice: 650,
      sellingPrice: 780,
      bulkThreshold: 5,
      bulkPrice: 750,
      stockQty: 30,
      lowStockAlert: 5,
      dispatchMode: "VAN",
      images: "/emulsion_paint.png",
      isPublished: true,
      mvpPriority: true,
    },
    {
      skuCode: "PNT-002",
      name: "Gloss Paint",
      category: "Paints",
      unitSize: "1 Gallon",
      costPrice: 180,
      sellingPrice: 220,
      bulkThreshold: 10,
      bulkPrice: 210,
      stockQty: 50,
      lowStockAlert: 10,
      dispatchMode: "BIKE",
      images: "/oil_paint.png",
      isPublished: true,
      mvpPriority: true,
    },
    {
      skuCode: "ADH-001",
      name: "Silicone Sealant",
      category: "Adhesives",
      unitSize: "Tube",
      costPrice: 28,
      sellingPrice: 38,
      bulkThreshold: 20,
      bulkPrice: 35,
      stockQty: 100,
      lowStockAlert: 20,
      dispatchMode: "BIKE",
      images: "/silicon_sealant.png",
      isPublished: true,
      mvpPriority: true,
    },
    {
      skuCode: "SAF-001",
      name: "Safety Helmet",
      category: "Safety",
      unitSize: "Unit",
      costPrice: 55,
      sellingPrice: 75,
      bulkThreshold: 10,
      bulkPrice: 70,
      stockQty: 40,
      lowStockAlert: 8,
      dispatchMode: "BIKE",
      images: "/helmet.png",
      isPublished: true,
      mvpPriority: true,
    },
    {
      skuCode: "TLS-001",
      name: "Trowel",
      category: "Tools",
      unitSize: "Unit",
      costPrice: 25,
      sellingPrice: 40,
      bulkThreshold: 20,
      bulkPrice: 36,
      stockQty: 60,
      lowStockAlert: 10,
      dispatchMode: "BIKE",
      images: "/trowel.png",
      isPublished: true,
      mvpPriority: true,
    },
    {
      skuCode: "ELE-001",
      name: "LED Bulb",
      category: "Electrical",
      unitSize: "12W",
      costPrice: 18,
      sellingPrice: 28,
      bulkThreshold: 50,
      bulkPrice: 25,
      stockQty: 200,
      lowStockAlert: 30,
      dispatchMode: "BIKE",
      images: "/led_bulb.png",
      isPublished: true,
      mvpPriority: true,
    },
    {
      skuCode: "PLM-001",
      name: "Faucet",
      category: "Plumbing",
      unitSize: "Unit",
      costPrice: 120,
      sellingPrice: 160,
      bulkThreshold: 5,
      bulkPrice: 150,
      stockQty: 25,
      lowStockAlert: 5,
      dispatchMode: "BIKE",
      images: "/faucet.png",
      isPublished: true,
      mvpPriority: true,
    },
    {
      skuCode: "HDR-001",
      name: "Door Lock",
      category: "Hardware",
      unitSize: "Unit",
      costPrice: 140,
      sellingPrice: 190,
      bulkThreshold: 5,
      bulkPrice: 180,
      stockQty: 30,
      lowStockAlert: 5,
      dispatchMode: "BIKE",
      images: "/locks.png",
      isPublished: true,
      mvpPriority: true,
    },
    {
      skuCode: "OFF-001",
      name: "Home Chair",
      category: "Office",
      unitSize: "Unit",
      costPrice: 650,
      sellingPrice: 820,
      bulkThreshold: 2,
      bulkPrice: 790,
      stockQty: 15,
      lowStockAlert: 3,
      dispatchMode: "VAN",
      images: "/office_chairs.jpeg",
      isPublished: true,
      mvpPriority: true,
    },
    {
      skuCode: "PAN-001",
      name: "PVC Ceiling Panel",
      category: "Panels",
      unitSize: "Length",
      costPrice: 85,
      sellingPrice: 115,
      bulkThreshold: 50,
      bulkPrice: 108,
      stockQty: 500,
      lowStockAlert: 50,
      dispatchMode: "PICKUP",
      images: "/ceiling_panel.jpeg",
      isPublished: true,
      mvpPriority: true,
    },
    {
      skuCode: "PNT-EMU-IVORY",
      name: "MCC Ivory Premium Emulsion Paint",
      brand: "MCC",
      category: "Paints",
      subCategory: "Emulsion Paint",
      unitSize: "20 Litres",
      costPrice: 180,
      sellingPrice: 220,
      bulkThreshold: 5,
      bulkPrice: 210,
      stockQty: 50,
      lowStockAlert: 10,
      dispatchMode: "VAN",
      isFragile: false,
      isHazardous: false,
      images: "/mcc_ivory_paint.png",
      isPublished: true,
      mvpPriority: true,
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { skuCode: product.skuCode },
      update: product,
      create: product,
    });
  }

  console.log("✅ Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error: ", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
