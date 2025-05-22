// src/routes/cartRoutes.ts
import express, { Router } from 'express'; // Removed RequestHandler from here as asyncHandler handles it
import passport from 'passport'; // For protecting routes
import asyncHandler from 'express-async-handler'; // Import the utility
import {
    getCart,
    addItemToCart,
    updateCartItem,
    removeCartItem,
    clearCart
} from '../controllers/cartController';
// Assuming AuthenticatedRequest is defined in cartController or a shared type file
// and your controller functions expect it.

const router: Router = express.Router();

// All cart routes are protected.
// passport.authenticate returns a RequestHandler, so this is fine.
router.use(passport.authenticate('jwt', { session: false }));


router.get('/', asyncHandler(getCart as any));

// POST /api/v1/cart/items - Add item to cart
router.post('/items', asyncHandler(addItemToCart as any));

// PUT /api/v1/cart/items/:cartItemId - Update cart item quantity
router.put('/items/:cartItemId', asyncHandler(updateCartItem as any));

// DELETE /api/v1/cart/items/:cartItemId - Remove item from cart
router.delete('/items/:cartItemId', asyncHandler(removeCartItem as any));

// DELETE /api/v1/cart - Clear all items from user's cart
router.delete('/', asyncHandler(clearCart as any));

export default router;