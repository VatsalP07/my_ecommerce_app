// src/controllers/orderController.ts
import { Request, Response, NextFunction } from 'express';
import Order, { IOrder, IOrderItem } from '../models/Order';
import Product, { IProduct } from '../models/Product';
import Cart from '../models/Cart';
import { IUser } from '../models/user'; // Corrected path assuming User.ts is in models/
import mongoose from 'mongoose';
import { io } from '../app';

interface AuthenticatedRequest extends Request {
  user?: IUser;
}

// POST /api/v1/orders - Create a new order (for a logged-in user)
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
            orderItems: clientOrderItems, // Expecting this from client if not using cart directly
            shippingAddress,
            paymentMethod,
        } = req.body;

        // Validate clientOrderItems, shippingAddress, paymentMethod
        if (!clientOrderItems || !Array.isArray(clientOrderItems) || clientOrderItems.length === 0) {
            res.status(400).json({ message: 'No order items provided or invalid format.' });
            return;
        }
        // Consider more robust validation for shippingAddress structure
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
        const productsToUpdateStock: { productDoc: IProduct, quantityToDecrement: number }[] = [];

        for (const item of clientOrderItems) {
            if (!item.productId || typeof item.quantity !== 'number' || item.quantity < 1) {
                res.status(400).json({ message: `Invalid item data for productId: ${item.productId}` });
                return;
            }

            const product: IProduct | null = await Product.findById(item.productId);
            if (!product) {
                res.status(404).json({ message: `Product with ID ${item.productId} not found.` });
                return;
            }
            if (product.stock < item.quantity) {
                res.status(400).json({ message: `Not enough stock for ${product.name}. Available: ${product.stock}` });
                return;
            }

            productsToUpdateStock.push({ productDoc: product, quantityToDecrement: item.quantity });

            detailedOrderItems.push({
                product: product._id,
                name: product.name,
                quantity: item.quantity,
                price: product.price, // Using current product price when creating order
                image: product.imageKeys && product.imageKeys.length > 0 ? product.imageKeys[0] : undefined,
            } as IOrderItem);
            calculatedItemsPrice += product.price * item.quantity;
        }

        // Simplified tax and shipping for example
        const taxPrice = Number((0.1 * calculatedItemsPrice).toFixed(2)); // 10% tax
        const shippingPrice = calculatedItemsPrice > 100 ? 0 : 10; // Free shipping over $100
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
            status: 'Pending Payment', // Default status
            isPaid: false, // Default not paid
        });

        const createdOrder = await order.save();

        // Update stock for each product
        for (const { productDoc, quantityToDecrement } of productsToUpdateStock) {
            productDoc.stock -= quantityToDecrement;
            if (productDoc.stock < 0) productDoc.stock = 0; // Ensure stock doesn't go negative
            await productDoc.save();

            // Emit stock update via Socket.IO
            io.emit('stockUpdate', {
                productId: productDoc._id.toString(),
                newStock: productDoc.stock,
            });
            console.log(`[Socket.IO]: Emitted stockUpdate for ${productDoc._id}, new stock: ${productDoc.stock}`);
        }

        // Clear the user's cart after order creation
        // Assuming createOrder takes items from req.body and not directly from a persisted Cart model.
        // If createOrder was supposed to use items from a Cart model, you'd fetch and clear that.
        // For now, if clientOrderItems are passed in req.body, cart clearing logic might be on client-side
        // or handled if you were fetching cart from DB here.
        // If you want to clear a persisted cart from DB:
        await Cart.findOneAndUpdate({ user: userId }, { $set: { items: [] } });
        console.log(`Cart cleared for user ${userId}`);


        // Emit new order created event
        if (createdOrder && createdOrder._id) {
            io.emit('newOrderCreated', {
                orderId: createdOrder._id.toString(),
                userName: req.user?.name || 'Someone',
                productName: createdOrder.orderItems[0]?.name || 'an item',
                message: `${req.user?.name || 'A customer'} just placed an order!`
            });
            console.log(`[Socket.IO]: Emitted newOrderCreated for order ${createdOrder._id.toString()}`);
        }

        res.status(201).json(createdOrder);

    } catch (error) {
        console.error("Error in createOrder handler:", error);
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
        // Consider adding pagination for user orders if a user can have many
        const orders = await Order.find({ user: userId })
                                .sort({ createdAt: -1 })
                                .populate('orderItems.product', 'name imageKeys'); // Populate some product details

        res.json({ message: 'User orders fetched successfully', data: orders });
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
                                 .populate('user', 'name email') // User who placed order
                                 .populate('orderItems.product'); // Populate full product details for user's order view

        if (!order) {
            res.status(404).json({ message: 'Order not found or you do not have permission to view it.' });
            return;
        }
        res.json({ message: 'Order details fetched successfully', data: order });
    } catch (error) {
        next(error);
    }
};

// PUT /api/v1/orders/:orderId/pay - Mark an order as paid (simulated payment confirmation by user)
export const markOrderAsPaid = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { orderId } = req.params;
        const userId = req.user?._id;

        if (!userId) {
            return res.status(401).json({ message: 'User not authenticated.' });
        }
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ message: 'Invalid order ID.' });
        }

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        // Ensure the user owns this order
        if (order.user.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Not authorized to update this order payment status.' });
        }

        // Check if order is already paid or in a non-payable state
        if (order.status !== 'Pending Payment') {
            return res.status(400).json({ message: `Order is not pending payment. Current status: ${order.status}` });
        }

        order.isPaid = true; // Ensure your IOrder interface and OrderSchema have 'isPaid' (boolean)
        order.paidAt = new Date(); // Ensure your IOrder interface and OrderSchema have 'paidAt' (Date)
        order.status = 'Processing'; // Update status after successful "payment"

        await order.save();

        // Optional: Emit a Socket.IO event to the user and/or admin
        if (io) {
            // You'd need a way to get the user's socket ID if you want to send only to them
            // For now, just an example log or a general admin event
            console.log(`Order ${order._id} marked as paid by user ${userId}`);
            // io.to(userSocketId).emit('orderUpdate', { orderId: order._id, status: order.status, isPaid: true });
        }

        res.json({ message: 'Order payment confirmed and is now processing.', data: order });
    } catch (error) {
        next(error);
    }
};