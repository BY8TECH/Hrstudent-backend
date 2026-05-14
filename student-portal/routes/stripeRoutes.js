const express = require("express");
const router = express.Router();
const stripeController = require("../controllers/stripeController");
const { protect } = require("../middlewares/auth");

// Standard route for creating payment intent
router.post("/create-payment-intent", protect, stripeController.createPaymentIntent);

// Webhook route (should be used without 'protect' as it comes from Stripe)
// Note: This uses req.rawBody captured in server.js for signature verification
router.post("/webhook", stripeController.handleWebhook);

module.exports = router;
