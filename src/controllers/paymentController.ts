// src/controllers/paymentController.ts
import { Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import Order, { IOrder } from '../models/Order'; // Your Order model
import { IUser } from '../models/user';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-05-28.basil', // Use the required API version
});

interface AuthenticatedRequest extends Request {
  user?: IUser;
}

export const createStripeCheckoutSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?._id;
        const userEmail = req.user?.email; // Stripe needs customer email
        const { orderId } = req.body;

        if (!userId || !userEmail) {
            return res.status(401).json({ message: 'User not authenticated or email missing.' });
        }
        if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ message: 'Valid Order ID is required.' });
        }

        const order = await Order.findById(orderId) as (IOrder & { _id: mongoose.Types.ObjectId }) | null;

        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }
        if (order.user.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'You are not authorized to pay for this order.' });
        }
        if (order.isPaid || order.status !== 'Pending Payment') {
            return res.status(400).json({ message: `Order cannot be paid. Status: ${order.status}, Paid: ${order.isPaid}` });
        }

        const line_items = order.orderItems.map(item => ({
            price_data: {
                currency: 'usd', // Or your desired currency
                product_data: {
                    name: item.name,
                    images: item.image ? [item.image] : [],
                    // description: item.description, // Optional
                },
                unit_amount: Math.round(item.price * 100), // Price in cents
            },
            quantity: item.quantity,
        }));
        
        // Add shipping as a line item if applicable and you want to show it on Stripe Checkout
        if (order.shippingPrice > 0) {
            line_items.push({
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: 'Shipping',
                        images: [], // Required by Stripe type
                    },
                    unit_amount: Math.round(order.shippingPrice * 100),
                },
                quantity: 1,
            });
        }
        // Note: Stripe also supports shipping rates if you configure them in Stripe dashboard.
        // For simplicity here, adding shipping as a line item.
        // Ensure (total of line_items * quantity) + shipping line item matches order.totalPrice

        // Ensure total amount matches. This is a basic check.
        // const calculatedStripeTotal = line_items.reduce((sum, item) => sum + item.price_data.unit_amount * item.quantity, 0);
        // if (calculatedStripeTotal !== Math.round(order.totalPrice * 100)) {
        //     console.error(`Price mismatch: Order total ${order.totalPrice * 100}, Stripe calculated ${calculatedStripeTotal}`);
        //     return res.status(500).json({ message: 'Price calculation mismatch for Stripe session.' });
        // }


        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: line_items,
            mode: 'payment',
            customer_email: userEmail, // Pre-fill customer email
            // To link payment to your order, pass orderId in metadata
            // This is crucial for the webhook to identify the order
            metadata: {
                orderId: order._id.toString(),
                userId: userId.toString(),
            },
            // Client reference ID can also be used if preferred over metadata for some lookups
            client_reference_id: order._id.toString(), 
            success_url: `${process.env.FRONTEND_URL || 'http://localhost:5001'}/order-success?session_id={CHECKOUT_SESSION_ID}`, // Your success page
            cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5001'}/order-cancelled?order_id=${order._id.toString()}`,   // Your cancel page
        });

        // Save the Stripe Checkout Session ID to your order for reference
        order.stripeCheckoutSessionId = session.id;
        if (session.payment_intent && typeof session.payment_intent === 'string') { // If payment intent is directly available
            order.stripePaymentIntentId = session.payment_intent;
        }
        await order.save();

        res.json({ sessionId: session.id }); // Send session ID to frontend

    } catch (error) {
        console.error("Stripe session creation error:", error);
        next(error);
    }
};