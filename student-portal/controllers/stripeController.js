const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const User = require("../models/User");
const Course = require("../models/Course");
const CourseCategory = require("../models/CourseCategory");
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
            amount: Math.round(amount * 100), // convert INR to Paisa (smallest unit)
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

        // Use more explicit response method for production debugging
        const responseData = {
            success: true,
            clientSecret: paymentIntent.client_secret,
            id: paymentIntent.id
        };

        res.setHeader("X-Response-Source", "StripeController-Direct");
        res.setHeader("Content-Type", "application/json");
        
        return res.status(200).send(JSON.stringify(responseData));
    } catch (error) {
        console.error("Stripe Error:", error);
        
        const errorResponse = { 
            success: false, 
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        };

        res.setHeader("Content-Type", "application/json");
        return res.status(500).send(JSON.stringify(errorResponse));
    }
};

/**
 * POST /api/stripe/webhook
 * Handle Stripe webhooks (e.g. payment_intent.succeeded)
 */
exports.handleWebhook = async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
        console.error("⚠️  CRITICAL: STRIPE_WEBHOOK_SECRET is missing in .env/Render. Webhook will fail verification.");
    }

    try {
        const stripe = getStripe();
        
        // Use rawBody if available (set by server.js), else fallback to body
        const payload = req.rawBody || req.body;
        
        event = stripe.webhooks.constructEvent(
            payload,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error(`❌ Stripe Webhook Signature Verification Failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object;
        const { userId, courseId } = paymentIntent.metadata;
        
        // Stripe amount is in cents/paisa. Convert back to INR.
        const amountInINR = paymentIntent.amount / 100;

        // Update database (e.g. create/update Payment record)
        try {
            console.log(`💰 [Stripe Webhook] Success received for intent: ${paymentIntent.id}`);
            console.log(`👤 User: ${userId}, Course: ${courseId}, Amount: ${amountInINR} INR`);
            
            // Ensure userId is valid
            if (!userId) {
                console.error("❌ Stripe Webhook Error: No userId found in metadata");
                return res.status(400).send("No userId in metadata");
            }

            let payment = await Payment.findOne({ userId: new mongoose.Types.ObjectId(userId) });
            console.log(payment ? `✅ Found existing payment record for user ${userId}` : `ℹ️ No existing payment record for user ${userId}. Creating new...`);
            
            if (!payment) {
                // Fetch course info to set totalFees
                let course = await Course.findById(new mongoose.Types.ObjectId(courseId));
                if (!course) course = await CourseCategory.findById(new mongoose.Types.ObjectId(courseId));
                
                const totalFees = course ? (course.amount || course.fees || 0) : 0;
                const courseTitle = course ? (course.title || course.name) : "Course";
                
                const duration = 90; // Default duration in days
                const endDate = new Date();
                endDate.setDate(endDate.getDate() + duration);
                
                const nextInstallment = new Date();
                nextInstallment.setDate(nextInstallment.getDate() + 30);

                payment = new Payment({
                    userId,
                    courseId,
                    totalFees,
                    paidAmount: amountInINR,
                    remainingAmount: Math.max(0, totalFees - amountInINR),
                    durationInDays: duration,
                    endDate,
                    nextInstallmentDate: nextInstallment,
                    transactions: []
                });
            } else {
                // Subsequent payment
                payment.paidAmount += amountInINR;
                payment.remainingAmount = Math.max(0, payment.totalFees - payment.paidAmount);
                
                // Update next installment date
                const nextInstallment = new Date();
                nextInstallment.setDate(nextInstallment.getDate() + 30);
                payment.nextInstallmentDate = nextInstallment;
            }

            // Add the transaction record
            payment.transactions.push({
                amount: amountInINR,
                method: "online",
                type: "Online Payment (Stripe)",
                receiptId: `STRIPE-${paymentIntent.id.slice(-6).toUpperCase()}`,
                status: "success",
                date: new Date()
            });

            // Update Status
            if (payment.remainingAmount <= 0) {
                payment.status = "paid";
            } else {
                payment.status = "partial";
            }

            await payment.save();
            console.log(`✅ Database successfully updated for user ${userId}`);
            
        } catch (dbErr) {
            console.error("❌ Database update error after Stripe payment:", dbErr);
        }
    }

    res.json({ received: true });
};
