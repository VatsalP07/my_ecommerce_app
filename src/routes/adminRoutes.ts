// src/routes/adminRoutes.ts
import express from 'express';
import passport from 'passport';
import { authorize } from '../middleware/authorize'; // Your role auth middleware
import {
    adminGetAllUsers,
    adminUpdateUserRole,
    adminGetAllOrders,
    adminGetOrderById,
    adminUpdateOrderStatus
} from '../controllers/adminController'; // We'll create this controller

const router = express.Router();

// Protect all admin routes
router.use(passport.authenticate('jwt', { session: false }));
router.use(authorize(['admin'])); // Only admins can access these

// User Management
router.get('/users', adminGetAllUsers);
router.put('/users/:userId/role', adminUpdateUserRole);

// Order Management
router.get('/orders', adminGetAllOrders);
router.get('/orders/:orderId', adminGetOrderById);
router.put('/orders/:orderId/status', adminUpdateOrderStatus);

export default router;