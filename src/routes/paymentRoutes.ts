// src/routes/paymentRoutes.ts
import express from 'express';
import passport from 'passport';
import { createStripeCheckoutSession } from '../controllers/paymentController';

const router = express.Router();

// Protect this route - only logged-in users can create payment sessions
router.post(
    '/create-checkout-session',
    passport.authenticate('jwt', { session: false }),
    createStripeCheckoutSession
);

// Webhook route will be added on Day 15 - it will NOT be JWT protected
// as it's called by Stripe, not a user.

export default router;