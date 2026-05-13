const Payment = require("../models/Payment");
const User = require("../models/User");
const Course = require("../models/Course");
const Stripe = require("stripe");


// Lazy initialization of Stripe to prevent crash if key is missing during startup
// NOTE: Stripe v22+ requires `new Stripe(key)` — the old factory syntax is broken in v22
const getStripe = () => {
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes("xxxx")) {
        throw new Error("Stripe API key is missing or invalid in .env file.");
    }
    return new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2023-10-16", // Use a known stable API version
    });
};

/**
 * POST /api/stripe/create-payment-intent
 * Create a Stripe Payment Intent for course enrollment
 */
exports.createPaymentIntent = async (req, res) => {
    console.log("Stripe: Received create-payment-intent request");
    console.log("Request Body:", JSON.stringify(req.body));
    
    try {
        const stripe = getStripe();
        const { amount, productName, userId, courseId } = req.body;

        if (!amount || !userId || !courseId) {
            console.log("Stripe: Missing required fields", { amount, userId, courseId });
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        console.log(`Stripe: Creating PaymentIntent for ${amount} INR, Product: ${productName}`);

        // Create a PaymentIntent with the order amount and currency
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount, // amount in cents/paisa
            currency: "inr", // default to INR for this project
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                userId,
                courseId,
                productName
            }
        });

        console.log("Stripe: PaymentIntent created successfully:", paymentIntent.id);
        console.log("Stripe: Client Secret available:", paymentIntent.client_secret ? "Yes" : "No");

        return res.status(200).json({
            success: true,
            clientSecret: paymentIntent.client_secret,
            id: paymentIntent.id
        });
    } catch (error) {
        console.error("Stripe Error:", error);
        return res.status(500).json({ 
            success: false, 
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

/**
 * POST /api/stripe/webhook
 * Handle Stripe webhooks (e.g. payment_intent.succeeded)
 */
exports.handleWebhook = async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
        const stripe = getStripe();
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object;
        const { userId, courseId } = paymentIntent.metadata;

        // Update database (e.g. create/update Payment record)
        try {
            // Logic to record the successful payment
            console.log(`💰 Payment succeeded for user ${userId} and course ${courseId}`);
            
            // You can call your existing payment logic here or update a separate OnlinePayment model
        } catch (dbErr) {
            console.error("Database update error after payment:", dbErr);
        }
    }

    res.json({ received: true });
};
