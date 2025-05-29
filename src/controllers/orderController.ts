// src/controllers/orderController.ts
import { Request, Response, NextFunction } from 'express';
import Order, { IOrder, IOrderItem } from '../models/Order'; // Assuming IOrderItem is also exported or defined
import Product, { IProduct } from '../models/Product';
import Cart, { ICart } from '../models/Cart';
import { IUser } from '../models/user';
import { io } from '../app'; // For Socket.IO notifications
import mongoose from 'mongoose';

// Augment Express Request type if you haven't globally
interface AuthenticatedRequest extends Request {
  user?: IUser; // User object from Passport.js
}

// --- CREATE NEW ORDER ---
export const createOrder = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    console.log('[OrderCtrl - createOrder] Received request to create order.'); // 1.
    console.log('[OrderCtrl - createOrder] req.user ID:', req.user?._id); // 2.
    console.log('[OrderCtrl - createOrder] req.body RAW:', JSON.stringify(req.body, null, 2)); // 3.

    const { orderItems, shippingAddress, paymentMethod } = req.body;

    console.log('[OrderCtrl - createOrder] Extracted orderItems from req.body:', JSON.stringify(orderItems, null, 2)); // 4.

    if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
        console.error('[OrderCtrl - createOrder] Validation Error: No order items provided or invalid format.'); // 5.
        return res.status(400).json({ message: 'No order items provided or invalid format.' });
    }

    try {
        const userId = req.user?._id;
        if (!userId) {
            console.error('[OrderCtrl - createOrder] Auth Error: User ID not found on authenticated request.'); // 6.
            return res.status(401).json({ message: 'User not authenticated for creating order.' });
        }

        const itemsToSave: Partial<IOrderItem>[] = []; // Use Partial if IOrderItem has non-optional fields set by DB
        let calculatedItemsPrice = 0;

        for (const clientItem of orderItems) {
            console.log('[OrderCtrl - createOrder] Processing clientItem from payload:', JSON.stringify(clientItem, null, 2)); // 7.
            
            const productIdFromClient = clientItem.product; // This is what the frontend sends as 'product'
            console.log(`[OrderCtrl - createOrder] productIdFromClient for item "${clientItem.name || 'N/A'}":`, productIdFromClient); // 8.

            if (!productIdFromClient || !mongoose.Types.ObjectId.isValid(productIdFromClient)) {
                console.error(`[OrderCtrl - createOrder] Invalid or missing product ID in clientItem: '${productIdFromClient}'. Item details:`, JSON.stringify(clientItem)); // 9.
                return res.status(400).json({ message: `Invalid item data for productId: ${productIdFromClient}` });
            }

            const productDoc = await Product.findById(productIdFromClient);
            if (!productDoc) {
                console.error(`[OrderCtrl - createOrder] Product not found in DB for ID: ${productIdFromClient}. Client item name: "${clientItem.name || 'N/A'}"`); // 10.
                return res.status(404).json({ message: `Product not found: ${clientItem.name || productIdFromClient}` });
            }

            if (productDoc.stock < clientItem.quantity) {
                console.error(`[OrderCtrl - createOrder] Not enough stock for product ${productDoc.name} (ID: ${productIdFromClient}). Requested: ${clientItem.quantity}, Available: ${productDoc.stock}`); // 11.
                return res.status(400).json({ message: `Not enough stock for ${productDoc.name}. Available: ${productDoc.stock}` });
            }

            itemsToSave.push({
                name: productDoc.name,
                quantity: clientItem.quantity,
                image: productDoc.imageKeys && productDoc.imageKeys.length > 0 ? productDoc.imageKeys[0] : clientItem.image, // Prefer DB image
                price: productDoc.price, // CRITICAL: Use current price from DB for security and consistency
                product: productDoc._id, // Use the validated ObjectId from the fetched productDoc
            });
            calculatedItemsPrice += productDoc.price * clientItem.quantity;
            console.log(`[OrderCtrl - createOrder] Item processed and added to itemsToSave. Product: ${productDoc.name}, Qty: ${clientItem.quantity}, Price from DB: ${productDoc.price}`); // 12.
        }
        console.log('[OrderCtrl - createOrder] All items processed for itemsToSave:', JSON.stringify(itemsToSave, null, 2)); // 13.

        const shippingPrice = req.body.shippingPrice || 0; // Get from req.body or default/calculate
        const taxPrice = req.body.taxPrice || 0;          // Get from req.body or default/calculate
        const totalPrice = calculatedItemsPrice + shippingPrice + taxPrice;

        const order = new Order({
            user: userId,
            orderItems: itemsToSave,
            shippingAddress: shippingAddress || { address: 'N/A', city: 'N/A', postalCode: 'N/A', country: 'N/A' }, // Ensure defaults if not provided
            paymentMethod: paymentMethod || 'Not Specified',
            itemsPrice: calculatedItemsPrice,
            taxPrice,
            shippingPrice,
            totalPrice,
            status: 'Pending Payment' // Initial status
        });

        const createdOrder = await order.save();
        console.log('[OrderCtrl - createOrder] Order saved successfully to DB. Order ID:', createdOrder._id); // 14.

        // Decrement stock for each product in the order
        for (const item of createdOrder.orderItems) {
            // item.product here is the ObjectId stored in the order item
            const productToUpdate = await Product.findById(item.product);
            if (productToUpdate) {
                const newStock = productToUpdate.stock - item.quantity;
                await Product.findByIdAndUpdate(item.product, {
                    $set: { stock: newStock >= 0 ? newStock : 0 } // Ensure stock doesn't go negative
                });
                // Emit stock update event
                io.emit('stockUpdate', {
                    productId: productToUpdate._id.toString(),
                    newStock: newStock >= 0 ? newStock : 0,
                });
            }
        }
        console.log('[OrderCtrl - createOrder] Stock decremented for ordered items.'); // 15.

        // Clear the user's cart after successful order creation
        await Cart.deleteOne({ user: userId });
        console.log('[OrderCtrl - createOrder] User cart cleared for user ID:', userId); // 16.

        // Emit Socket.IO event for the new order
        io.emit('newOrderCreated', {
            orderId: createdOrder._id,
            userName: req.user?.name || 'A customer',
            total: createdOrder.totalPrice,
            productName: createdOrder.orderItems[0]?.name || 'items', // Example: first product name
            message: `${req.user?.name || 'Someone'} just placed an order for ${createdOrder.orderItems[0]?.name || 'an item'}!`
        });
        console.log('[OrderCtrl - createOrder] newOrderCreated Socket.IO event emitted.'); // 17.

        res.status(201).json({ message: 'Order created successfully', data: createdOrder });

    } catch (error) {
        console.error('[OrderCtrl - createOrder] CATCH BLOCK ERROR:', error); // 18.
        next(error); // Pass to global error handler
    }
};


// --- GET USER'S ORDERS ---
export const getUserOrders = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({ message: 'User not authenticated.' });
        }
        const orders = await Order.find({ user: userId }).sort({ createdAt: -1 });
        res.json({ message: 'Orders fetched successfully', data: orders });
    } catch (error) {
        next(error);
    }
};

// --- GET A SINGLE ORDER (for the user who owns it or admin) ---
export const getOrderByIdForUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const orderId = req.params.orderId;
        const userId = req.user?._id;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ message: 'Invalid order ID format.' });
        }
        if (!userId) {
            return res.status(401).json({ message: 'User not authenticated.' });
        }

        const order = await Order.findById(orderId)
            .populate('user', 'name email') // Populate user details
            .populate('orderItems.product', 'name price imageKeys'); // Populate some product details within orderItems

        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        // Check if the logged-in user is the owner of the order (or an admin - add admin check if needed)
        if (order.user._id.toString() !== userId.toString() /* && !req.user.roles.includes('admin') */ ) {
            return res.status(403).json({ message: 'Not authorized to view this order.' });
        }

        res.json({ message: 'Order details fetched successfully', data: order });
    } catch (error) {
        next(error);
    }
};

// --- MARK ORDER AS PAID (SIMULATED PAYMENT CONFIRMATION by User) ---
export const markOrderAsPaid = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { orderId } = req.params;
        const userId = req.user?._id;

        console.log(`[OrderCtrl - markOrderAsPaid] Attempting to mark order ${orderId} as paid for user ${userId}`);

        if (!userId) {
            return res.status(401).json({ message: 'User not authenticated.' });
        }
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ message: 'Invalid order ID.' });
        }

        const order = await Order.findById(orderId);

        if (!order) {
            console.log(`[OrderCtrl - markOrderAsPaid] Order ${orderId} not found.`);
            return res.status(404).json({ message: 'Order not found.' });
        }

        if (order.user.toString() !== userId.toString()) {
            console.log(`[OrderCtrl - markOrderAsPaid] User ${userId} not authorized for order ${orderId} (owner: ${order.user.toString()}).`);
            return res.status(403).json({ message: 'Not authorized to update this order payment status.' });
        }

        if (order.status !== 'Pending Payment') {
            console.log(`[OrderCtrl - markOrderAsPaid] Order ${orderId} is not 'Pending Payment'. Current status: ${order.status}`);
            return res.status(400).json({ message: `Order is not pending payment. Current status: ${order.status}` });
        }

        order.isPaid = true;
        order.paidAt = new Date();
        order.status = 'Processing'; // Or 'Paid', then admin changes to 'Processing'

        const updatedOrder = await order.save();
        console.log(`[OrderCtrl - markOrderAsPaid] Order ${orderId} successfully updated to paid. Status: ${updatedOrder.status}`);

        // Emit Socket.IO event to user and/or admin
        // io.to(userId.toString()).emit('orderUpdate', { orderId: updatedOrder._id, status: updatedOrder.status, isPaid: true });
        // io.to('admin_room').emit('orderUpdate', { orderId: updatedOrder._id, userId: updatedOrder.user });

        res.json({ message: 'Order payment confirmed and is now processing.', data: updatedOrder });
    } catch (error) {
        console.error(`[OrderCtrl - markOrderAsPaid] CATCH BLOCK ERROR for order ${req.params.orderId}:`, error);
        next(error);
    }
};
