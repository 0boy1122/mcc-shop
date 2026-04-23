const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const router = express.Router();

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "YOUR_GEMINI_API_KEY");

const PRODUCT_CONTEXT = `You are the MCC Shop AI assistant — a helpful, knowledgeable, and friendly shopping guide for The MCC Shop, Ghana's premier building materials, decor, home & office furniture, tools and equipment delivery service in Accra.

ABOUT MCC SHOP:
- Delivers to all of Accra (home, office, construction sites)
- Delivery modes: Bike (small items), Van (medium), Pickup truck (bulk/heavy)
- All prices are VAT inclusive, in GHS
- Orders placed via WhatsApp: +233 303 978 485
- Bulk discounts available above threshold quantities

CURRENT PRODUCTS:
1. Emulsion Paint (5 Gallon) — GHS 780 | Category: Paints | SKU: PNT-001 | Bulk: 5+ | Delivery: Van
2. Gloss Paint (1 Gallon) — GHS 220 | Category: Paints | SKU: PNT-002 | Bulk: 10+ | Delivery: Bike
3. Silicone Sealant (Tube) — GHS 38 | Category: Adhesives | SKU: ADH-001 | Bulk: 20+ | Delivery: Bike
4. Safety Helmet (Unit) — GHS 75 | Category: Safety | SKU: SAF-001 | Bulk: 10+ | Delivery: Bike
5. Trowel (Unit) — GHS 40 | Category: Tools | SKU: TLS-001 | Bulk: 20+ | Delivery: Bike
6. LED Bulb 12W — GHS 28 | Category: Electrical | SKU: ELE-001 | Bulk: 50+ | Delivery: Bike
7. Faucet (Unit) — GHS 160 | Category: Plumbing | SKU: PLM-001 | Bulk: 5+ | Delivery: Bike
8. Door Lock (Unit) — GHS 190 | Category: Hardware | SKU: HDR-001 | Bulk: 5+ | Delivery: Bike
9. Office Chair (Unit) — GHS 820 | Category: Office | SKU: OFF-001 | Bulk: 2+ | Delivery: Van
10. PVC Ceiling Panel (Length) — GHS 115 | Category: Panels | SKU: PAN-001 | Bulk: 50+ | Delivery: Pickup

ORDERING: Customers browse the site, then order via WhatsApp. No online payment — delivery fee is discussed on WhatsApp. There is no checkout flow on the site.

PERSONALITY: Be warm, helpful, concise. Speak like a knowledgeable Ghanaian shop assistant. Use GHS for currency. Keep responses short (2-4 sentences max unless listing products). Always encourage WhatsApp contact for final orders. If asked about products not in the catalogue, say the team can source them.`;

// POST /api/ai/chat
router.post("/chat", async (req, res, next) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid messages format" });
    }
    if (messages.length > 20) {
      return res.status(400).json({ error: "Too many messages in conversation" });
    }
    for (const msg of messages) {
      if (typeof msg.content !== "string" || msg.content.length > 2000) {
        return res.status(400).json({ error: "Message too long (max 2000 characters)" });
      }
    }

    // Configure the model
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: PRODUCT_CONTEXT
    });

    // Format history for Gemini (gemini uses role: "user" | "model")
    const history = messages.slice(0, -1).map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

    const latestMessage = messages[messages.length - 1].content;

    // Start a chat session
    const chat = model.startChat({ history });
    
    // Send the latest message
    const result = await chat.sendMessage(latestMessage);
    const reply = result.response.text();
    
    res.json({ reply });
  } catch (err) {
    console.error("AI Error:", err);
    res.status(500).json({ error: "Failed to generate AI response. Please try again." });
  }
});

module.exports = router;
