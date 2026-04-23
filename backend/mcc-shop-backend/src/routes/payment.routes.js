const express = require("express");
const crypto = require("crypto");
const prisma = require("../lib/prisma");
const { authenticate } = require("../middleware/auth.middleware");

const router = express.Router();

// POST /api/payments/initiate
router.post("/initiate", authenticate, async (req, res, next) => {
  try {
    const { orderId, method, momoPhone } = req.body;

    if (!orderId || !method) {
      return res.status(400).json({ error: "orderId and method are required" });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.userId !== req.user.id) return res.status(403).json({ error: "Access denied" });

    const existingPayment = await prisma.payment.findUnique({ where: { orderId } });
    if (existingPayment && existingPayment.status === "SUCCESS") {
      return res.status(409).json({ error: "Order already paid" });
    }

    let paymentData = {};

    if (method === "MOMO") {
      const paystackRes = await fetch("https://api.paystack.co/charge", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: req.user.email || `${req.user.phone}@mccshop.com`,
          amount: Math.round(order.total * 100),
          currency: "GHS",
          mobile_money: {
            phone: momoPhone || req.user.phone,
            provider: "mtn",
          },
        }),
      });
      const paystackData = await paystackRes.json();
      paymentData = { reference: paystackData.data?.reference, checkoutUrl: null, provider: "paystack" };
    } else if (method === "CARD") {
      const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "ghs",
            product_data: { name: `MCC Shop Order #${orderId.slice(0, 8)}` },
            unit_amount: Math.round(order.total * 100),
          },
          quantity: 1,
        }],
        mode: "payment",
        success_url: `${process.env.CLIENT_URL}/orders/${orderId}?paid=true`,
        cancel_url: `${process.env.CLIENT_URL}/orders/${orderId}?paid=false`,
        metadata: { orderId },
      });
      paymentData = { reference: session.id, checkoutUrl: session.url, provider: "stripe" };
    } else {
      return res.status(400).json({ error: "Invalid payment method. Use MOMO or CARD" });
    }

    const payment = await prisma.payment.upsert({
      where: { orderId },
      update: { method, reference: paymentData.reference, momoPhone },
      create: { orderId, method, status: "PENDING", amount: order.total, reference: paymentData.reference, momoPhone },
    });

    res.json({ payment, ...paymentData });
  } catch (err) {
    next(err);
  }
});

// POST /api/payments/webhook
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res, next) => {
  try {
    // ── Paystack Webhook ─────────────────────────────────
    if (req.headers["x-paystack-signature"]) {
      const secret = process.env.PAYSTACK_SECRET_KEY;
      if (!secret) return res.sendStatus(500);

      // Verify HMAC-SHA512 signature — prevents anyone faking a payment confirmation
      const expected = crypto
        .createHmac("sha512", secret)
        .update(req.body)
        .digest("hex");

      if (req.headers["x-paystack-signature"] !== expected) {
        return res.status(401).send("Invalid signature");
      }

      const event = JSON.parse(req.body);
      if (event.event === "charge.success") {
        const reference = event.data?.reference;
        if (!reference) return res.sendStatus(400);
        await prisma.payment.update({ where: { reference }, data: { status: "SUCCESS" } });
        const payment = await prisma.payment.findUnique({ where: { reference } });
        if (payment) {
          await prisma.order.update({ where: { id: payment.orderId }, data: { status: "CONFIRMED" } });
        }
      }
      return res.sendStatus(200);
    }

    // ── Stripe Webhook ───────────────────────────────────
    if (req.headers["stripe-signature"]) {
      const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
      const event = stripe.webhooks.constructEvent(
        req.body,
        req.headers["stripe-signature"],
        process.env.STRIPE_WEBHOOK_SECRET
      );
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const orderId = session.metadata.orderId;
        await prisma.payment.update({ where: { reference: session.id }, data: { status: "SUCCESS" } });
        await prisma.order.update({ where: { id: orderId }, data: { status: "CONFIRMED" } });
      }
      return res.sendStatus(200);
    }

    res.sendStatus(400);
  } catch (err) {
    next(err);
  }
});

// GET /api/payments/:orderId  — owner or admin only
router.get("/:orderId", authenticate, async (req, res, next) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { orderId: req.params.orderId },
      include: { order: { select: { userId: true } } },
    });
    if (!payment) return res.status(404).json({ error: "Payment not found" });

    if (req.user.role === "CUSTOMER" && payment.order.userId !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { order: _, ...safePayment } = payment;
    res.json({ payment: safePayment });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
