    // src/controllers/adminController.ts
    import { Request, Response, NextFunction } from 'express';
    import User, { IUser } from '../models/user';
    import Order, { IOrder } from '../models/Order';
    import mongoose from 'mongoose';

    // --- User Management ---
    export const adminGetAllUsers = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const users = await User.find({}).select('-password').sort({ createdAt: -1 }); // Exclude passwords
            res.json({ message: 'Users fetched successfully', data: users });
        } catch (error) {
            next(error);
        }
    };

    export const adminUpdateUserRole = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { userId } = req.params;
            const { roles } = req.body; // Expecting roles to be an array e.g., ["customer", "seller"]

            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(400).json({ message: 'Invalid user ID.' });
            }
            if (!Array.isArray(roles) || !roles.every(role => ['customer', 'seller', 'admin'].includes(role))) {
                return res.status(400).json({ message: 'Invalid roles array provided.' });
            }

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ message: 'User not found.' });
            }

            user.roles = roles;
            await user.save();
            const userToReturn = user.toObject();
            delete userToReturn.password;
            res.json({ message: 'User role updated successfully.', data: userToReturn });
        } catch (error) {
            next(error);
        }
    };

    // --- Order Management ---
    export const adminGetAllOrders = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // Add pagination later if needed
            const orders = await Order.find({})
                .populate('user', 'name email') // Populate user who placed order
                .sort({ createdAt: -1 });
            res.json({ message: 'Orders fetched successfully', data: orders });
        } catch (error) {
            next(error);
        }
    };

    export const adminGetOrderById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { orderId } = req.params;
            if (!mongoose.Types.ObjectId.isValid(orderId)) {
                return res.status(400).json({ message: 'Invalid order ID.' });
            }
            const order = await Order.findById(orderId)
                .populate('user', 'name email')
                .populate('orderItems.product', 'name'); // Populate product name in order items
            
            if (!order) {
                return res.status(404).json({ message: 'Order not found.' });
            }
            res.json({ message: 'Order details fetched successfully', data: order });
        } catch (error) {
            next(error);
        }
    };

    // src/controllers/adminController.ts
    // ...
    export const adminUpdateOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { orderId } = req.params;
            const { status } = req.body;

            // ... (validations for orderId and status) ...

            const order = await Order.findById(orderId) as IOrder | null; // Assert type here

            if (!order) {
                return res.status(404).json({ message: 'Order not found.' });
            }

            order.status = status; // Now TypeScript should be happy
            if (status === 'Delivered' && !order.deliveredAt) {
                order.deliveredAt = new Date();
            }
            // Add shippedAt to your IOrder interface if you haven't already
            if (status === 'Shipped' && !(order as any).shippedAt) { // Use 'as any' if shippedAt is optional and might not exist
                (order as any).shippedAt = new Date();
            }


            await order.save();
            res.json({ message: `Order status updated to ${status}.`, data: order });
        } catch (error) {
            next(error);
        }
    };