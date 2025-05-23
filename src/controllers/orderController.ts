// src/controllers/orderController.ts
import { Request, Response, NextFunction } from 'express';
import Order, { IOrder, IOrderItem } from '../models/Order';
import Product, { IProduct } from '../models/Product';
import Cart from '../models/Cart'; // Removed { ICart } as it's not directly used here, Cart model is enough
import { IUser } from '../models/user';
import mongoose from 'mongoose';


interface AuthenticatedRequest extends Request {
  user?: IUser;
}

// POST /api/v1/orders - Create a new order
export const createOrder = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            res.status(401).json({ message: 'User not authenticated' });
            return;
        }

        const {
            orderItems,
            shippingAddress,
            paymentMethod,
        } = req.body;

        if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
            res.status(400).json({ message: 'No order items provided or invalid format.' });
            return;
        }
        if (!shippingAddress || !shippingAddress.address || !shippingAddress.city || !shippingAddress.postalCode || !shippingAddress.country) {
            res.status(400).json({ message: 'Shipping address is incomplete.' });
            return;
        }
        if (!paymentMethod) {
            res.status(400).json({ message: 'Payment method is required.' });
            return;
        }

        const detailedOrderItems: IOrderItem[] = [];
        let calculatedItemsPrice = 0;

        // const session = await mongoose.startSession();
        // session.startTransaction();

        try {
            for (const item of orderItems) {
                // Basic validation for item structure
                if (!item.productId || typeof item.quantity !== 'number' || item.quantity < 1) {
                    // await session.abortTransaction();
                    // session.endSession();
                    res.status(400).json({ message: `Invalid item data for productId: ${item.productId}` });
                    return;
                }

                const product: IProduct | null = await Product.findById(item.productId);
                if (!product) {
                    // await session.abortTransaction();
                    // session.endSession();
                    res.status(404).json({ message: `Product with ID ${item.productId} not found.` });
                    return;
                }
                if (product.stock < item.quantity) {
                    // await session.abortTransaction();
                    // session.endSession();
                    res.status(400).json({ message: `Not enough stock for ${product.name}. Available: ${product.stock}` });
                    return;
                }

                product.stock -= item.quantity;
                await product.save(); // { session }

                detailedOrderItems.push({
                    product: product._id,
                    name: product.name,
                    quantity: item.quantity,
                    price: product.price,
                    image: product.imageKeys && product.imageKeys.length > 0 ? product.imageKeys[0] : undefined,
                });
                calculatedItemsPrice += product.price * item.quantity;
            }

            const taxPrice = Number((0.1 * calculatedItemsPrice).toFixed(2));
            const shippingPrice = calculatedItemsPrice > 100 ? 0 : 10;
            const totalPrice = Number((calculatedItemsPrice + taxPrice + shippingPrice).toFixed(2));

            const order = new Order({
                user: userId,
                orderItems: detailedOrderItems,
                shippingAddress,
                paymentMethod,
                itemsPrice: calculatedItemsPrice,
                taxPrice,
                shippingPrice,
                totalPrice,
                orderStatus: 'Pending',
                isPaid: false,
            });

            const createdOrder = await order.save(); // { session }
            await Cart.findOneAndUpdate({ user: userId }, { $set: { items: [] } }); // { session }

            // await session.commitTransaction();
            // session.endSession();

            res.status(201).json(createdOrder);

        } catch (error) { // Inner try-catch for transaction/processing logic
            // await session.abortTransaction();
            // session.endSession();
            console.error("Error during order creation process:", error);
            next(error); // Pass to global error handler
        }

    } catch (error) { // Outer try-catch for initial setup or unexpected issues
        next(error); // Pass to global error handler
    }
};

// GET /api/v1/orders - Get orders for the logged-in user
export const getUserOrders = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            res.status(401).json({ message: 'User not authenticated' });
            return;
        }

        const orders = await Order.find({ user: userId }).sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        next(error);
    }
};

// GET /api/v1/orders/:id - Get a specific order by ID (for the logged-in user)
export const getOrderById = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            res.status(401).json({ message: 'User not authenticated' });
            return;
        }

        const orderId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            res.status(400).json({ message: 'Invalid order ID format.' });
            return;
        }

        const order = await Order.findOne({ _id: orderId, user: userId })
                                 .populate('user', 'name email');

        if (!order) {
            res.status(404).json({ message: 'Order not found or you do not have permission to view it.' });
            return;
        }
        res.json(order);
    } catch (error) {
        next(error);
    }
};


// --- Admin Routes ---

// GET /api/v1/admin/orders - Admin gets all orders
export const getAllOrdersAdmin = async (
    req: AuthenticatedRequest, // Still AuthenticatedRequest as admin is also a user
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Role check is handled by 'authorize' middleware, no need to check req.user.roles here
        const orders = await Order.find({})
                                .populate('user', 'name email')
                                .sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        next(error);
    }
};

// PUT /api/v1/admin/orders/:id/status - Admin updates order status
export const updateOrderStatusAdmin = async (
    req: AuthenticatedRequest, // Still AuthenticatedRequest
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const orderId = req.params.id;
        const { orderStatus } = req.body;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            res.status(400).json({ message: 'Invalid order ID format.' });
            return;
        }
        if (!orderStatus || !['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].includes(orderStatus)) {
            res.status(400).json({ message: 'Invalid order status provided.' });
            return;
        }

        const order = await Order.findById(orderId);
        if (!order) {
            res.status(404).json({ message: 'Order not found.' });
            return;
        }

        order.orderStatus = orderStatus as IOrder['orderStatus'];
        if (orderStatus === 'Delivered') {
            order.isDelivered = true;
            order.deliveredAt = new Date();
        } else if (orderStatus !== 'Delivered' && order.isDelivered) { // Reset if changed from Delivered
            order.isDelivered = false;
            order.deliveredAt = undefined;
        }
        // Similarly, you might update isPaid/paidAt if 'Paid' was a status or from payment gateway

        const updatedOrder = await order.save();
        res.json(updatedOrder);

    } catch (error) {
        next(error);
    }
};