// src/controllers/paymentController.ts
import { Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import Order, { IOrder } from '../models/Order';    // Your Order model
import Product from '../models/Product';  // For stock updates
import Cart from '../models/Cart';        // For clearing the cart
import { IUser } from '../models/user';   // Assuming your User model file is 'user.ts'
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { io } from '../app'; // For Socket.IO notifications

dotenv.config();

// --- Stripe Client Initialization ---
// Ensure STRIPE_SECRET_KEY is in your .env file
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
    console.error("FATAL ERROR: STRIPE_SECRET_KEY is not defined in .env. Stripe functionality will fail.");
    // Consider throwing an error or exiting if critical for app operation
}
const stripe = new Stripe(stripeSecretKey!, { // The '!' asserts stripeSecretKey is defined (after the check)
    apiVersion: '2025-05-28.basil', // Use the Stripe API version expected by the Stripe types.
    // You can also add telemetry: false if you want to disable Stripe's telemetry
    // typescriptStrict: true, // Recommended for better type checking with Stripe
});


// --- Authenticated Request Interface (if not globally defined) ---
interface AuthenticatedRequest extends Request {
  user?: IUser; // Assuming IUser is your Mongoose user document interface
}


// --- 1. Create Stripe Checkout Session ---
// Called by your frontend when the user is ready to pay for an order.
export const createStripeCheckoutSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?._id;
        const userEmail = req.user?.email;

        if (!userId || !userEmail) {
            return res.status(401).json({ message: 'User not authenticated or email missing.' });
        }

        const { orderId } = req.body;
        if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ message: 'Valid Order ID is required from request body.' });
        }

        // Fetch the order from your database
        const order = await Order.findById(orderId) as (IOrder & { _id: mongoose.Types.ObjectId }) | null; // Type assertion

        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }
        // Authorization: Ensure the logged-in user owns this order
        if (order.user.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'You are not authorized to pay for this order.' });
        }
        // Sanity Check: Ensure order is in the correct state for payment
        if (order.isPaid || order.status !== 'Pending Payment') {
            return res.status(400).json({ message: `Order cannot be paid. Status: ${order.status}, Paid: ${order.isPaid}` });
        }

        // Prepare line items for Stripe Checkout
        const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = order.orderItems.map(item => ({
            price_data: {
                currency: 'usd', // Or your store's default currency
                product_data: {
                    name: item.name,
                    images: item.image ? [item.image] : [], // Stripe expects an array of image URLs
                    // description: item.description, // Optional
                },
                unit_amount: Math.round(item.price * 100), // Price in smallest currency unit (e.g., cents)
            },
            quantity: item.quantity,
        }));
        
        // Add shipping as a line item if applicable
        if (order.shippingPrice > 0) {
            line_items.push({
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: 'Shipping',
                        images: [], // Stripe types require 'images' even if empty
                    },
                    unit_amount: Math.round(order.shippingPrice * 100),
                },
                quantity: 1,
            });
        }

 const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5001'; // Fallback for safety

        const successUrl = `${frontendBaseUrl}/order-success.html?session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${frontendBaseUrl}/order-cancelled.html?order_id=${order._id.toString()}`;

        console.log('[PaymentController] Using Success URL:', successUrl);
        console.log('[PaymentController] Using Cancel URL:', cancelUrl);
        // --- END OF CORRECTION ---

        // Create a Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: line_items,
            mode: 'payment',
            customer_email: userEmail,
            metadata: {
                orderId: order._id.toString(),
                userId: userId.toString(),
            },
            client_reference_id: order._id.toString(), 
            success_url: successUrl, // Use the corrected variable
            cancel_url: cancelUrl,   // Use the corrected variable
        });

        // ... (save session IDs to order, send response to frontend) ...
        order.stripeCheckoutSessionId = session.id;
        if (session.payment_intent && typeof session.payment_intent === 'string') {
            order.stripePaymentIntentId = session.payment_intent;
        }
        await order.save();

        res.json({ sessionId: session.id });

    } catch (error) {
        console.error("Stripe Checkout Session creation error:", error);
        next(error);
    }
};

// --- 2. Handle Stripe Webhooks ---
// This endpoint is called by Stripe, not by your frontend or users directly.
// It MUST NOT have JWT authentication.
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeWebhookSecret) {
    console.error("FATAL ERROR: STRIPE_WEBHOOK_SECRET is not defined in .env. Webhook verification will fail. App may be insecure or fail to process payments.");
}

export const handleStripeWebhook = async (req: Request, res: Response, next: NextFunction) => {
    if (!stripeWebhookSecret) {
        console.error("Stripe webhook secret is not configured. Cannot process webhook.");
        return res.status(500).send("Webhook secret not configured on server.");
    }

    const signature = req.headers['stripe-signature'] as string;
    let event: Stripe.Event;

    try {
        // Verify the event came from Stripe and is not tampered with.
        // req.body MUST be the raw request body buffer for this to work.
        // Your app.ts needs 'express.raw({type: 'application/json'})' for this route.
        event = stripe.webhooks.constructEvent(req.body, signature, stripeWebhookSecret);
    } catch (err: any) {
        console.error(`❌ Webhook signature verification failed. Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`); // Invalid signature
    }

    console.log(`[Stripe Webhook]: Received Event ID: ${event.id}, Type: ${event.type}`);

    // Handle specific event types
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object as Stripe.Checkout.Session;
            console.log(`[Stripe Webhook]: Processing 'checkout.session.completed' for Session ID: ${session.id}`);
            
            if (!session.metadata || !session.metadata.orderId) {
                console.warn('[Stripe Webhook]: Crucial metadata (orderId) missing in checkout.session.completed event.', session.metadata);
                return res.status(400).json({ error: 'Missing orderId in webhook metadata.' }); // Bad request, can't process
            }

            const orderId = session.metadata.orderId;
            const userIdFromMetadata = session.metadata.userId; // Optional: if you passed it

            // Fulfill the purchase (update DB, decrement stock, clear cart, send notifications)
            try {
                const order = await Order.findById(orderId) as (IOrder & { _id: mongoose.Types.ObjectId }) | null;

                if (!order) {
                    console.warn(`[Stripe Webhook]: Order ${orderId} not found in database for session ${session.id}.`);
                    // Still return 200 to Stripe, as this is not a Stripe issue, but log it for investigation.
                    return res.status(200).json({ received: true, warning: 'Order not found in DB.' });
                }

                // Idempotency: Check if this payment/order has already been processed
                if (order.isPaid || order.status !== 'Pending Payment') {
                    console.log(`[Stripe Webhook]: Order ${orderId} (Session ${session.id}) was already processed or not in 'Pending Payment' state. Status: ${order.status}, isPaid: ${order.isPaid}. No action taken.`);
                    return res.status(200).json({ received: true, message: 'Order already processed.' });
                }

                // Update Order in your Database
                order.isPaid = true;
                order.paidAt = new Date();
                order.status = 'Processing'; // Or 'Paid', depending on your desired flow
                if (session.payment_intent && typeof session.payment_intent === 'string') {
                    order.stripePaymentIntentId = session.payment_intent;
                }
                order.stripeCheckoutSessionId = session.id; // Ensure this is also stored
                // You could also store session.customer_details.email, session.payment_status etc. in order.paymentResult

                await order.save();
                console.log(`[Stripe Webhook]: Order ${orderId} updated to status '${order.status}' and marked as paid.`);

                // Decrement Product Stock
                for (const item of order.orderItems) {
                    try {
                        await Product.findByIdAndUpdate(item.product, { // item.product is an ObjectId
                            $inc: { stock: -item.quantity },
                        });
                        console.log(`[Stripe Webhook]: Stock decremented for product ${item.product} by ${item.quantity}.`);
                    } catch (stockError: any) {
                        console.error(`[Stripe Webhook]: Error decrementing stock for product ${item.product} in order ${orderId}:`, stockError.message);
                        // This is a critical issue. You might need a reconciliation process.
                        // For now, we continue, but in production, this needs careful handling.
                    }
                }

                // Clear User's Cart
                if (order.user) {
                    await Cart.deleteOne({ user: order.user });
                    console.log(`[Stripe Webhook]: Cart cleared for user ${order.user}.`);
                }

                // Send Real-time Notification to User via Socket.IO
                if (io) {
                    const userSpecificEvent = `user-${order.user.toString()}-orderUpdate`;
                    io.emit(userSpecificEvent, { // Or io.to(userSocketId).emit(...)
                        orderId: order._id.toString(),
                        status: order.status,
                        isPaid: order.isPaid,
                        message: `Your order #${order._id.toString()} has been successfully paid and is now processing.`
                    });
                    // A general notification for admin or other listeners
                    io.emit('orderPaymentSuccess', {
                        orderId: order._id.toString(),
                        userId: order.user.toString(),
                        message: `Payment for order #${order._id.toString()} was successful!`
                    });
                    console.log(`[Socket.IO via Webhook]: Emitted order payment success for order ${order._id}`);
                }

            } catch (dbError: any) {
                console.error(`[Stripe Webhook]: Database or internal processing error for order ${orderId} (Session ${session.id}):`, dbError.message);
                // Return 500 to indicate to Stripe that processing failed and it should retry (if it's a retryable error).
                return res.status(500).json({ error: 'Internal server error while processing webhook.' });
            }
            break;

        case 'payment_intent.payment_failed':
            const paymentIntentFailed = event.data.object as Stripe.PaymentIntent;
            console.log(`[Stripe Webhook]: 'payment_intent.payment_failed' for PI ID: ${paymentIntentFailed.id}. Reason: ${paymentIntentFailed.last_payment_error?.message}`);
            // Retrieve orderId from metadata if you set it on PaymentIntent creation (usually set on Checkout Session)
            const orderIdFromFailedPI = paymentIntentFailed.metadata.orderId;
            if (orderIdFromFailedPI) {
                try {
                    const order = await Order.findById(orderIdFromFailedPI) as (IOrder & { _id: mongoose.Types.ObjectId }) | null;
                    if (order && order.status === 'Pending Payment') { // Only update if still pending
                        order.status = 'Failed'; // Set a 'Failed' status
                        await order.save();
                        console.log(`[Stripe Webhook]: Order ${orderIdFromFailedPI} status updated to 'Failed'.`);
                        // Notify user via Socket.IO
                        if (io) {
                            const userSpecificEvent = `user-${order.user.toString()}-orderUpdate`;
                            io.emit(userSpecificEvent, {
                                orderId: order._id.toString(),
                                status: order.status,
                                message: `Payment for your order #${order._id.toString()} failed. Reason: ${paymentIntentFailed.last_payment_error?.message || 'Unknown error'}`
                            });
                        }
                    }
                } catch (dbError: any) {
                    console.error(`[Stripe Webhook]: DB Error updating order ${orderIdFromFailedPI} to 'Failed':`, dbError.message);
                }
            }
            break;

        // ... potentially handle other events like 'checkout.session.async_payment_failed', 'charge.refunded', etc.

        default:
            console.log(`[Stripe Webhook]: Unhandled event type: ${event.type}`);
    }

    // Acknowledge receipt of the event to Stripe successfully
    res.status(200).json({ received: true });
};
