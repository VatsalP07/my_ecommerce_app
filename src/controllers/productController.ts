// src/controllers/productController.ts
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { PutObjectCommand, DeleteObjectCommand, ObjectCannedACL } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import Product, { IProduct } from '../models/Product';
import { IUser } from '../models/user'; // Corrected import path assuming User.ts is in models
import { s3Client } from '../config/s3Client';
import { io } from '../app'; // Import the shared Socket.IO instance

interface AuthenticatedRequest extends Request {
    user?: IUser;
    files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
    file?: Express.Multer.File;
}

const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;

const uploadFileToS3 = async (file: Express.Multer.File): Promise<string> => {
    if (!S3_BUCKET_NAME) {
        throw new Error('S3_BUCKET_NAME is not defined in .env');
    }
    const fileKey = `products/${uuidv4()}-${file.originalname.replace(/\s+/g, '-')}`;

    const params = {
        Bucket: S3_BUCKET_NAME,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: ObjectCannedACL.public_read,
    };

    await s3Client.send(new PutObjectCommand(params));
    return `https://${S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;
};


const deleteFileFromS3 = async (imageUrl: string): Promise<void> => {
    if (!S3_BUCKET_NAME) {
        console.warn('S3_BUCKET_NAME not defined, cannot delete from S3.');
        return; // Or throw new Error('S3_BUCKET_NAME is not defined');
    }
    try {
        const urlParts = new URL(imageUrl);
        // S3 keys should not have a leading slash when used with the SDK's Key parameter
        const key = decodeURIComponent(urlParts.pathname.substring(1)); 
        if (key) {
            const deleteParams = { Bucket: S3_BUCKET_NAME, Key: key };
            await s3Client.send(new DeleteObjectCommand(deleteParams));
            console.log(`Successfully deleted ${key} from S3`);
        }
    } catch (s3Error: any) { // Catch specific error if possible
        console.error(`Error deleting image ${imageUrl} from S3. Key: ${new URL(imageUrl).pathname.substring(1)}. Error:`, s3Error.message || s3Error);
        // Decide if you want to throw this error or just log it and continue
        // For example, if an image was already deleted or URL is malformed, you might not want to fail the whole update.
        // throw s3Error; // Uncomment to make S3 deletion failure stop the update
    }
};

export const createProduct: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { name, description, price, category, stock } = req.body;
        const sellerId = req.user?._id;

        if (!sellerId) {
            res.status(400).json({ message: 'Seller ID not found. User may not be authenticated correctly.' });
            return;
        }

        let uploadedImageUrls: string[] = [];
        const filesToProcess = req.files ? (Array.isArray(req.files) ? req.files : []) : (req.file ? [req.file] : []);

        if (filesToProcess.length > 0) {
            // Using Promise.all for concurrent uploads
            uploadedImageUrls = await Promise.all(
                filesToProcess.map(file => uploadFileToS3(file))
            );
        }

        const product = new Product({
            name,
            description,
            price,
            category,
            stock,
            sellerId,
            imageKeys: uploadedImageUrls,
        });

        const savedProduct = await product.save();

        // Emit stock update for newly created product (if initial stock > 0)
        // This could be debated - often new products just appear.
        // But if you want the frontend to react to ANY stock appearing, you can emit.
        // For now, let's assume the main stock update event is for *changes* to existing stock.
        // If you *do* want to emit here:
        // if (savedProduct.stock > 0) {
        //     io.emit('stockUpdate', {
        //         productId: savedProduct._id.toString(),
        //         newStock: savedProduct.stock,
        //     });
        //     console.log(`[Socket.IO]: Emitted stockUpdate for new product ${savedProduct._id}, stock: ${savedProduct.stock}`);
        // }


        res.status(201).json(savedProduct);
    } catch (error) {
        next(error);
    }
};

export const getSellerProducts: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const sellerId = req.user?._id;
        if (!sellerId) {
            res.status(401).json({ message: 'User not authenticated' });
            return;
        }
        const products = await Product.find({ sellerId: sellerId }).sort({ createdAt: -1 });
        res.json(products);
    } catch (error) {
        next(error);
    }
};

export const getProductById: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const product = await Product.findById(req.params.id).populate('sellerId', 'name email');
        if (!product) {
            res.status(404).json({ message: 'Product not found' });
            return;
        }
        res.json(product);
    } catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            res.status(400).json({ message: 'Invalid product ID format' });
            return;
        }
        next(error);
    }
};

export const updateProduct: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const productId = req.params.id;
        const sellerId = req.user?._id;
        const userRoles = req.user?.roles || [];

        const product = await Product.findById(productId);

        if (!product) {
            res.status(404).json({ message: 'Product not found' });
            return;
        }

        if (product.sellerId.toString() !== sellerId?.toString() && !userRoles.includes('admin')) {
            res.status(403).json({ message: 'Forbidden: You can only update your own products.' });
            return;
        }

        // Text fields from req.body (populated by multer if form-data)
        const { name, description, price, category, stock } = req.body;
        let stockActuallyChanged = false;

        // Update text fields
        if (name !== undefined) product.name = name;
        if (description !== undefined) product.description = description;
        if (price !== undefined) product.price = Number(price);
        if (category !== undefined) product.category = category;
        if (stock !== undefined) {
            const newStock = Number(stock);
            if (!isNaN(newStock) && product.stock !== newStock) {
                product.stock = newStock;
                stockActuallyChanged = true;
            }
        }

        // Handle image updates
        // 'req.files' will be an array if using upload.array('productImages', ...) on the route
        const newImageFiles = req.files as Express.Multer.File[] | undefined;

        if (newImageFiles && newImageFiles.length > 0) {
            // 1. Delete old images from S3
            if (product.imageKeys && product.imageKeys.length > 0) {
                await Promise.all(product.imageKeys.map(imageUrl => deleteFileFromS3(imageUrl)));
            }

            // 2. Upload new images to S3
            const newImageUrls = await Promise.all(
                newImageFiles.map(file => uploadFileToS3(file))
            );

            // 3. Update product.imageKeys
            product.imageKeys = newImageUrls;
        }
        // If no new files are uploaded, product.imageKeys remains unchanged.
        // If you want to allow *deleting all images*, you'd need a separate mechanism
        // (e.g., a specific field in FormData like 'clearImages=true').

        const updatedProduct = await product.save(); // Save all changes (text and/or images)

        if (stockActuallyChanged) {
            io.emit('stockUpdate', {
                productId: updatedProduct._id.toString(),
                newStock: updatedProduct.stock,
            });
            console.log(`[Socket.IO]: Emitted stockUpdate for ${updatedProduct._id}, new stock: ${updatedProduct.stock}`);
        }

        res.json(updatedProduct);
    } catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            res.status(400).json({ message: 'Invalid product ID format' });
            return;
        }
        next(error);
    }
};


export const deleteProduct: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const productId = req.params.id;
        const sellerId = req.user?._id;
        const userRoles = req.user?.roles || [];

        const product = await Product.findById(productId);

        if (!product) {
            res.status(404).json({ message: 'Product not found' });
            return;
        }

        if (product.sellerId.toString() !== sellerId?.toString() && !userRoles.includes('admin')) {
            res.status(403).json({ message: 'Forbidden: You can only delete your own products.' });
            return;
        }

        const stockBeforeDelete = product.stock; // Get stock before deleting

        if (S3_BUCKET_NAME && product.imageKeys && product.imageKeys.length > 0) {
            await Promise.all(product.imageKeys.map(async (imageUrl) => {
                try {
                    const urlParts = new URL(imageUrl);
                    const key = decodeURIComponent(urlParts.pathname.substring(1));
                    if (key) {
                        const deleteParams = { Bucket: S3_BUCKET_NAME, Key: key };
                        await s3Client.send(new DeleteObjectCommand(deleteParams));
                        console.log(`Successfully deleted ${key} from S3`);
                    }
                } catch (s3Error) {
                    console.error(`Error processing S3 deletion for image ${imageUrl}:`, s3Error);
                }
            }));
        }

        await product.deleteOne();

        // Emit a stock update event, setting stock to 0 as the product is gone
        // This helps UIs remove or mark the product as unavailable immediately
        if (stockBeforeDelete > 0) { // Only emit if there was stock to begin with
             io.emit('stockUpdate', {
                productId: productId.toString(), // Use productId as product._id is no longer valid
                newStock: 0, // Product is deleted, so effective stock is 0
             });
             console.log(`[Socket.IO]: Emitted stockUpdate (product delete) for ${productId}, new stock: 0`);
        }


        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            res.status(400).json({ message: 'Invalid product ID format' });
            return;
        }
        next(error);
    }
};

export const getAllProducts: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
    // ... (no changes to getAllProducts needed for this specific request) ...
    // (Keep your existing implementation)
    try {
        const pageQuery = req.query.page as string;
        const limitQuery = req.query.limit as string;
        const categoryQuery = req.query.category as string; // Get category from query

        const page = parseInt(pageQuery) || 1;
        const limit = parseInt(limitQuery) || 10;
        const skip = (page - 1) * limit;

        const queryConditions: any = {}; 

        if (categoryQuery) {
            // Case-insensitive match for the category name
            // Using a regex for a partial match at the beginning of the string, case-insensitive.
            // If you want an exact match (still case-insensitive), use:
            // queryConditions.category = { $regex: new RegExp(`^${categoryQuery}$`, 'i') };
            queryConditions.category = { $regex: categoryQuery, $options: 'i' };
            console.log(`[ProductController] Filtering by category: ${categoryQuery}`);
        }
        
        const products = await Product.find(queryConditions)
            .populate('sellerId', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalProducts = await Product.countDocuments(queryConditions);
        const totalPages = Math.ceil(totalProducts / limit);

        res.json({
            message: 'Products fetched successfully',
            data: products,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalProducts: totalProducts,
                pageSize: limit,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const searchProducts: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
    // ... (no changes to searchProducts needed for this specific request) ...
    // (Keep your existing implementation)
    try {
        const query = req.query.q as string;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        if (!query) {
            res.status(400).json({ message: 'Search query (q) is required.' });
            return
        }

        const aggregationPipeline: any[] = [ // Added 'any[]' for simplicity, can be more specific
            {
                $search: {
                    index: 'product_search_index',
                    text: { query: query, path: ['name', 'description', 'category'], fuzzy: { maxEdits: 1, prefixLength: 2 } }
                },
            },
            { $lookup: { from: 'users', localField: 'sellerId', foreignField: '_id', as: 'sellerInfo' } },
            { $unwind: { path: '$sellerInfo', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 1, name: 1, description: 1, price: 1, category: 1, stock: 1, imageKeys: 1,
                    createdAt: 1, updatedAt: 1, numReviews: 1, averageRating: 1,
                    sellerId: { _id: '$sellerInfo._id', name: '$sellerInfo.name' },
                }
            },
            { $facet: { paginatedResults: [{ $skip: skip }, { $limit: limit }], totalCount: [{ $count: 'count' }] } },
        ];

        const results = await Product.aggregate(aggregationPipeline);
        const products = results[0].paginatedResults;
        const totalProducts = results[0].totalCount[0] ? results[0].totalCount[0].count : 0;
        const totalPages = Math.ceil(totalProducts / limit);

        res.json({
            message: 'Search results fetched successfully',
            data: products,
            pagination: { currentPage: page, totalPages: totalPages, totalProducts: totalProducts, pageSize: limit, },
        });
    } catch (error) {
        next(error);
    }
};