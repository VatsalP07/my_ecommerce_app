// src/routes/productRoutes.ts
import express from 'express';
import { RequestHandler } from 'express';
import passport from 'passport';
import { authorize } from '../middleware/authorize';
import { upload } from '../middleware/upload'; // Your multer config
import {
    createProduct,
    getSellerProducts,
    getProductById,
    updateProduct,
    deleteProduct,
    getAllProducts,
    searchProducts,
} from '../controllers/productController';

const router = express.Router();


// --- GET /api/v1/products (List all products - Public, with Pagination) ---
router.get('/', getAllProducts); // Mounted at the root of /api/v1/products

router.get('/search', searchProducts);
// --- POST /api/v1/products (Create a new product - Seller) ---
// Using upload.array('productImages', 5) to accept up to 5 images under the field name 'productImages'
router.post(
    '/',
    passport.authenticate('jwt', { session: false }),
    authorize(['seller', 'admin']), // Sellers or Admins can create products
    upload.array('productImages', 5), // Multer middleware for file uploads (max 5 files)
    createProduct
);

// --- GET /api/v1/products/seller (Get products for the logged-in seller) ---
router.get(
    '/seller',
    passport.authenticate('jwt', { session: false }),
    authorize(['seller', 'admin']), // Only sellers or admins can see their product list this way
    getSellerProducts
);


// --- GET /api/v1/products/:id (Get a single product - Public) ---
// No auth needed for public viewing of a product
router.get('/:id', getProductById);


// --- PUT /api/v1/products/:id (Update a product - Seller or Admin) ---
router.put(
    '/:id',
    passport.authenticate('jwt', { session: false }),
    authorize(['seller', 'admin']), // Ensure only product owner or admin can update
    // If you want to handle image updates here, add upload middleware:
    // upload.array('newProductImages', 5),
    updateProduct
);

// --- DELETE /api/v1/products/:id (Delete a product - Seller or Admin) ---
router.delete(
    '/:id',
    passport.authenticate('jwt', { session: false }),
    authorize(['seller', 'admin']), // Ensure only product owner or admin can delete
    deleteProduct
);

export default router;