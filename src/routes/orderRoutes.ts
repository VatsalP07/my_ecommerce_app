// src/routes/orderRoutes.ts
import express from 'express';
import passport from 'passport';
import { authorize } from '../middleware/authorize'; // Your role authorization middleware
import {
    createOrder,
    getUserOrders,
getOrderByIdForUser,
    markOrderAsPaid
} from '../controllers/orderController';

const router = express.Router();

// --- User Routes (Authenticated) ---
router.post(
    '/',
    passport.authenticate('jwt', { session: false }),
    createOrder
);

router.get(
    '/',
    passport.authenticate('jwt', { session: false }),
    getUserOrders
);

router.get(
    '/:id',
    passport.authenticate('jwt', { session: false }),
    getOrderByIdForUser
);


router.put(
    '/:orderId/pay', 
     passport.authenticate('jwt', { session: false }),
    markOrderAsPaid);

export default router;
