// src/routes/orderRoutes.ts
import express from 'express';
import passport from 'passport';
import { authorize } from '../middleware/authorize'; // Your role authorization middleware
import {
    createOrder,
    getUserOrders,
    getOrderById,
    getAllOrdersAdmin,
    updateOrderStatusAdmin
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
    getOrderById
);


// --- Admin Routes ---
router.get(
    '/admin/all', // Differentiate admin route clearly
    passport.authenticate('jwt', { session: false }),
    authorize(['admin']),
    getAllOrdersAdmin
);

router.put(
    '/admin/:id/status',
    passport.authenticate('jwt', { session: false }),
    authorize(['admin']),
    updateOrderStatusAdmin
);


export default router;