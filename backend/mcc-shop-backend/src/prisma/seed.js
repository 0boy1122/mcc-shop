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
      email: "customer@test.com",
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
      dispatchMode: "VAN",
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
      dispatchMode: "BIKE",
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
      dispatchMode: "BIKE",
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
      dispatchMode: "BIKE",
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
      dispatchMode: "BIKE",
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
      dispatchMode: "BIKE",
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
      dispatchMode: "BIKE",
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
      dispatchMode: "BIKE",
      mvpPriority: true,
    },
    {
      skuCode: "OFF-001",
      name: "Office Chair",
      category: "Office",
      unitSize: "Unit",
      costPrice: 650,
      sellingPrice: 820,
      bulkThreshold: 2,
      dispatchMode: "VAN",
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
      dispatchMode: "PICKUP",
      mvpPriority: true,
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { skuCode: product.skuCode },
      update: {},
      create: {
        ...product,
        stockQty: 100,
        vatIncluded: true,
        isPublished: true,
        images: "",
      },
    });
  }

  console.log("✅ Seeding complete!");
  console.log("   Admin:    phone=0200000001  password=admin123");
  console.log("   Customer: phone=0200000002  password=customer123");
  console.log("   Rider:    phone=0200000003  password=rider123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
