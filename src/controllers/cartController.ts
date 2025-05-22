// src/controllers/cartController.ts
import { Request, Response, NextFunction } from 'express';
import Cart, { ICart, ICartItem } from '../models/Cart';
import Product, { IProduct } from '../models/Product'; // For fetching product details
import { IUser } from '../models/user';
import mongoose from 'mongoose';


interface AuthenticatedRequest extends Request {
  user?: IUser; // User object from Passport.js
}

// Helper to get or create a cart for a user
const getOrCreateCart = async (userId: mongoose.Types.ObjectId): Promise<ICart> => {
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
        cart = await Cart.create({ user: userId, items: [] });
    }
    return cart;
};

// GET /api/v1/cart - Get user's cart
export const getCart = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?._id;
        if (!userId) return res.status(401).json({ message: 'User not authenticated' });

        const cart = await Cart.findOne({ user: userId }).populate({
            path: 'items.product', // Populate the product details within each cart item
            model: 'Product', // Explicitly specify the model name
            select: 'name price imageKeys stock category' // Select specific fields from Product
        });

        if (!cart) {
            // If no cart, return an empty cart structure for consistency
            return res.json({
                message: 'Cart is empty',
                data: { user: userId, items: [], totalPrice: 0, totalQuantity: 0 }
            });
        }
        res.json({ message: 'Cart fetched successfully', data: cart });
    } catch (error) {
        next(error);
    }
};

// POST /api/v1/cart/items - Add item to cart
export const addItemToCart = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?._id;
        if (!userId) return res.status(401).json({ message: 'User not authenticated' });

        const { productId, quantity = 1 } = req.body; // quantity defaults to 1

        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: 'Valid Product ID is required.' });
        }
        if (typeof quantity !== 'number' || quantity < 1) {
            return res.status(400).json({ message: 'Quantity must be a positive number.' });
        }

        const product: IProduct | null = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }
        if (product.stock < quantity) {
            return res.status(400).json({ message: `Not enough stock for ${product.name}. Available: ${product.stock}` });
        }

        const cart = await getOrCreateCart(userId);

        const existingItemIndex = cart.items.findIndex(
            (item) => (item.product as mongoose.Types.ObjectId).equals(productId)
        );

        if (existingItemIndex > -1) {
            // Product already in cart, update quantity
            cart.items[existingItemIndex].quantity += quantity;
            // Optionally, update price if it changed - but generally cart price is fixed at add
            // cart.items[existingItemIndex].price = product.price;
        } else {
            // Product not in cart, add new item
            cart.items.push({
                product: product._id,
                quantity: quantity,
                price: product.price, // Store current price
                name: product.name,   // Denormalize name
                image: product.imageKeys && product.imageKeys.length > 0 ? product.imageKeys[0] : undefined // Denormalize first image
            } as ICartItem); // Cast to ICartItem (as subdocument, _id will be added by Mongoose)
        }

        await cart.save();
        // Repopulate after save to get updated virtuals and populated product details
        const populatedCart = await Cart.findById(cart._id).populate('items.product', 'name price imageKeys stock category');
        res.status(200).json({ message: 'Item added to cart', data: populatedCart });

    } catch (error) {
        next(error);
    }
};


// PUT /api/v1/cart/items/:cartItemId - Update item quantity in cart
export const updateCartItem = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?._id;
        if (!userId) return res.status(401).json({ message: 'User not authenticated' });

        const { cartItemId } = req.params;
        const { quantity } = req.body;

        if (!mongoose.Types.ObjectId.isValid(cartItemId)) {
             return res.status(400).json({ message: 'Invalid cart item ID.' });
        }
        if (typeof quantity !== 'number' || quantity < 1) {
            return res.status(400).json({ message: 'Quantity must be a positive number.' });
        }

        const cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found.' });
        }

        const itemToUpdate = cart.items.find(item => item._id?.toString() === cartItemId);
        if (!itemToUpdate) {
            return res.status(404).json({ message: 'Item not found in cart.' });
        }

        // Check product stock before updating quantity
        const product: IProduct | null = await Product.findById(itemToUpdate.product);
        if (!product) {
            return res.status(404).json({ message: 'Associated product not found. Cannot update quantity.'});
        }
        if (product.stock < quantity) {
            return res.status(400).json({ message: `Not enough stock for ${product.name}. Available: ${product.stock}`});
        }

        itemToUpdate.quantity = quantity;
        await cart.save();
        const populatedCart = await Cart.findById(cart._id).populate('items.product', 'name price imageKeys stock category');
        res.json({ message: 'Cart item updated', data: populatedCart });

    } catch (error) {
        next(error);
    }
};

// DELETE /api/v1/cart/items/:cartItemId - Remove item from cart
export const removeCartItem = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?._id;
        if (!userId) return res.status(401).json({ message: 'User not authenticated' });

        const { cartItemId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(cartItemId)) {
             return res.status(400).json({ message: 'Invalid cart item ID.' });
        }

        const cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found.' });
        }

        const itemIndexToRemove = cart.items.findIndex(item => item._id?.toString() === cartItemId);
        if (itemIndexToRemove === -1) {
            return res.status(404).json({ message: 'Item not found in cart.' });
        }

        // Remove the item from the array
        cart.items.splice(itemIndexToRemove, 1);

        await cart.save();
        const populatedCart = await Cart.findById(cart._id).populate('items.product', 'name price imageKeys stock category');
        res.json({ message: 'Item removed from cart', data: populatedCart });

    } catch (error) {
        next(error);
    }
};

// DELETE /api/v1/cart - Clear all items from cart
export const clearCart = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?._id;
        if (!userId) return res.status(401).json({ message: 'User not authenticated' });

        const cart = await Cart.findOne({ user: userId });
        if (!cart) {
            // If cart doesn't exist, it's already "clear" from user's perspective
            return res.json({ message: 'Cart is already empty.', data: { user: userId, items: [], totalPrice: 0, totalQuantity: 0 } });
        }

        cart.items = []; // Empty the items array
        await cart.save();
        // No need to populate if items array is empty
        res.json({ message: 'Cart cleared successfully', data: cart });

    } catch (error) {
        next(error);
    }
};