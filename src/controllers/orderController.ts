// src/controllers/orderController.ts
import { Request, Response, NextFunction } from 'express';
import Order, { IOrder, IOrderItem } from '../models/Order';
import Product, { IProduct } from '../models/Product';
import Cart from '../models/Cart';
import { IUser } from '../models/user'; // Corrected import path assuming User.ts
import mongoose from 'mongoose';
import { io } from '../app'; // Import the exported io instance

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
            orderItems: clientOrderItems, // Renamed to avoid conflict with detailedOrderItems
            shippingAddress,
            paymentMethod,
        } = req.body;

        if (!clientOrderItems || !Array.isArray(clientOrderItems) || clientOrderItems.length === 0) {
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
        const productsToUpdateStock: { product: IProduct, quantityChange: number }[] = [];

        // Optional: Start a MongoDB transaction for atomicity
        // const session = await mongoose.startSession();
        // session.startTransaction();

        try {
            for (const item of clientOrderItems) {
                if (!item.productId || typeof item.quantity !== 'number' || item.quantity < 1) {
                    // await session.abortTransaction(); session.endSession();
                    res.status(400).json({ message: `Invalid item data for productId: ${item.productId}` });
                    return;
                }

                const product: IProduct | null = await Product.findById(item.productId); // .session(session) if using transactions
                if (!product) {
                    // await session.abortTransaction(); session.endSession();
                    res.status(404).json({ message: `Product with ID ${item.productId} not found.` });
                    return;
                }
                if (product.stock < item.quantity) {
                    // await session.abortTransaction(); session.endSession();
                    res.status(400).json({ message: `Not enough stock for ${product.name}. Available: ${product.stock}` });
                    return;
                }

                // Don't save product stock yet, do it after order is saved or in a transaction
                productsToUpdateStock.push({ product, quantityChange: -item.quantity });

                detailedOrderItems.push({
                    product: product._id,
                    name: product.name,
                    quantity: item.quantity,
                    price: product.price, // Price at time of order
                    image: product.imageKeys && product.imageKeys.length > 0 ? product.imageKeys[0] : undefined,
                });
                calculatedItemsPrice += product.price * item.quantity;
            }

            const taxPrice = Number((0.1 * calculatedItemsPrice).toFixed(2)); // Example tax
            const shippingPrice = calculatedItemsPrice > 100 ? 0 : 10; // Example shipping
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
                orderStatus: 'Pending', // Initial status
                isPaid: false, // Assuming payment is processed separately or simulated
            });

            const createdOrder = await order.save(); // { session }

            // --- Update product stock and emit Socket.IO events for each stock change ---
            for (const { product, quantityChange } of productsToUpdateStock) {
                product.stock += quantityChange; // product.stock -= item.quantity
                if (product.stock < 0) product.stock = 0; // Ensure stock doesn't go negative
                await product.save(); // { session }

                // Emit stock update event via Socket.IO
                io.emit('stockUpdate', {
                    productId: product._id.toString(),
                    newStock: product.stock,
                });
                console.log(`[Socket.IO]: Emitted stockUpdate for ${product._id}, new stock: ${product.stock}`);
            }

            // Clear the user's cart after successful order creation
            await Cart.findOneAndUpdate({ user: userId }, { $set: { items: [] } }); // { session }

            
            // --- Emit Socket.IO event for the new order ---
           if (createdOrder && createdOrder._id) {
            // --- Emit Socket.IO event for the new order ---
                io.emit('newOrderCreated', {
                orderId: createdOrder._id.toString(), // Now TypeScript knows _id exists
                userName: req.user?.name || 'Someone',
                productName: createdOrder.orderItems[0]?.name,
                message: `${req.user?.name || 'A customer'} just placed an order!`
            });
            console.log(`[Socket.IO]: Emitted newOrderCreated for order ${createdOrder._id.toString()}`);
            } else {
            console.error("Order was saved but _id is missing, which should not happen.");
            // Handle this unlikely scenario, perhaps don't emit the event or log a critical error
            }

            // await session.commitTransaction();
            // session.endSession();

            res.status(201).json(createdOrder);

        } catch (error) { // Inner try-catch for processing logic
            // if (session.inTransaction()) {
            //     await session.abortTransaction();
            // }
            // session.endSession();
            console.error("Error during order creation processing:", error);
            // Ensure the error is passed to the global error handler to avoid hanging requests
            return next(error); // Changed from next(error) to return next(error) to ensure no further code exec.
        }

    } catch (error) { // Outer try-catch
        next(error);
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
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const orders = await Order.find({})
                                .populate('user', 'name email') // Populate user details
                                .sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        next(error);
    }
};

// PUT /api/v1/admin/orders/:id/status - Admin updates order status
export const updateOrderStatusAdmin = async (
    req: AuthenticatedRequest,
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
        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
        if (!orderStatus || !validStatuses.includes(orderStatus)) {
            res.status(400).json({ message: `Invalid order status. Must be one of: ${validStatuses.join(', ')}` });
            return;
        }

        const order = await Order.findById(orderId);
        if (!order) {
            res.status(404).json({ message: 'Order not found.' });
            return;
        }

        const previousStatus = order.orderStatus;
        order.orderStatus = orderStatus as IOrder['orderStatus'];

        if (orderStatus === 'Delivered') {
            order.isDelivered = true;
            order.deliveredAt = new Date();
        } else if (previousStatus === 'Delivered' && orderStatus !== 'Delivered') {
            // If moving away from Delivered status, reset delivery fields
            order.isDelivered = false;
            order.deliveredAt = undefined;
        }

        // Future: Emit order status update event via Socket.IO
        // io.emit('orderStatusUpdate', { orderId: order._id, newStatus: order.orderStatus, userId: order.user });
        // console.log(`[Socket.IO]: Emitted orderStatusUpdate for order ${order._id} to status ${order.orderStatus}`);


        const updatedOrder = await order.save();
        res.json(updatedOrder);

    } catch (error) {
        next(error);
    }
};