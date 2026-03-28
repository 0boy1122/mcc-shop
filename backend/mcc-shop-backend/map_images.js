const prisma = require('./src/lib/prisma');

async function updateProductImages() {
  const mapping = {
    'PNT-001': 'emulsion paint.png',
    'PNT-002': 'oil paint.png',
    'ADH-001': 'silicon sealant.png',
    'SAF-001': 'helmet.png',
    'TLS-001': 'trowel.png',
    'ELE-001': 'led buld.png',
    'PLM-001': 'faucet.png',
    'HDR-001': 'locks.png',
    'OFF-001': 'office chairs.jpeg',
    'PAN-001': 'ancona-pvc-ceiling-panels-single-white-matte-122467-p.jpg.jpeg'
  };

  for (const [sku, img] of Object.entries(mapping)) {
    const url = `/uploads/products/${encodeURIComponent(img)}`;
    try {
      await prisma.product.updateMany({
        where: { skuCode: sku },
        data: { images: url }
      });
      console.log(`Updated ${sku} with image ${img}`);
    } catch (err) {
      console.error(`Failed to update ${sku}:`, err);
    }
  }
}

updateProductImages()
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1); });
