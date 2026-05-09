const express = require("express");
const router = express.Router();
const stripeController = require("../controllers/stripeController");
const { protect } = require("../middlewares/auth");

// Standard route for creating payment intent
router.post("/create-payment-intent", protect, stripeController.createPaymentIntent);

// Webhook route (should be used without 'protect' as it comes from Stripe)
// Note: This requires express.raw() for signature verification in server.js
router.post("/webhook", express.raw({ type: "application/json" }), stripeController.handleWebhook);

module.exports = router;
