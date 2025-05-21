// src/controllers/productController.ts
import { Request, Response, NextFunction,RequestHandler } from 'express';
import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand, ObjectCannedACL } from '@aws-sdk/client-s3';
// import { getSignedUrl } from "@aws-sdk/s3-request-presigner"; // Not used in current code, can remove if not planned
import { v4 as uuidv4 } from 'uuid';
import Product, { IProduct } from '../models/Product';
import { IUser } from '../models/user';
import { s3Client } from '../config/s3Client';

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
    const fileKey = `products/${uuidv4()}-${file.originalname.replace(/\s+/g, '-')}`; // Sanitize filename

    const params = {
        Bucket: S3_BUCKET_NAME,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: ObjectCannedACL.public_read, // Uncomment if your bucket allows public ACLs and you want direct public URLs
    };

    await s3Client.send(new PutObjectCommand(params));
    // If using public-read ACL:
    return `https://${S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;
    // If bucket is private, return just fileKey and generate pre-signed URLs elsewhere
    // return fileKey;
};

export const createProduct: RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { name, description, price, category, stock } = req.body;
        const sellerId = req.user?._id;

        if (!sellerId) {
            // Use return to ensure no further code in try block executes
            res.status(400).json({ message: 'Seller ID not found. User may not be authenticated correctly.' });
            return;
        }

        let uploadedImageUrls: string[] = [];

        const filesToProcess = req.files ? (Array.isArray(req.files) ? req.files : []) : (req.file ? [req.file] : []);

        if (filesToProcess.length > 0) {
            for (const file of filesToProcess) {
                const imageUrl = await uploadFileToS3(file);
                uploadedImageUrls.push(imageUrl);
            }
        }

        const product = new Product({
            name,
            description,
            price,
            category,
            stock,
            sellerId,
            imageKeys: uploadedImageUrls, // Assuming imageKeys store URLs now
        });

        await product.save();
        res.status(201).json(product);
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

export const updateProduct:RequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
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

        const { name, description, price, category, stock } = req.body;
        if (name !== undefined) product.name = name;
        if (description !== undefined) product.description = description;
        if (price !== undefined) product.price = price;
        if (category !== undefined) product.category = category;
        if (stock !== undefined) product.stock = stock;

        // TODO: Handle image updates
        const updatedProduct = await product.save();
        res.json(updatedProduct);
    } catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            res.status(400).json({ message: 'Invalid product ID format' });
            return;
        }
        next(error);
    }
};

export const deleteProduct : RequestHandler= async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
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

        if (S3_BUCKET_NAME && product.imageKeys && product.imageKeys.length > 0) {
            for (const imageUrl of product.imageKeys) {
                try {
                    const urlParts = new URL(imageUrl); // Make sure this is robust
                    const key = decodeURIComponent(urlParts.pathname.substring(1)); // decode URI component

                    if (key) {
                        const deleteParams = { Bucket: S3_BUCKET_NAME, Key: key };
                        await s3Client.send(new DeleteObjectCommand(deleteParams));
                        console.log(`Successfully deleted ${key} from S3`);
                    }
                } catch (s3Error) {
                    console.error(`Error processing S3 deletion for image ${imageUrl}:`, s3Error);
                }
            }
        }

        await product.deleteOne();
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        if (error instanceof Error && error.name === 'CastError') {
            res.status(400).json({ message: 'Invalid product ID format' });
            return;
        }
        next(error);
    }
};


// --- GET /api/v1/products (List all products with pagination - Public) ---
export const getAllProducts : RequestHandler= async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10; // Default limit to 10 items per page
        const skip = (page - 1) * limit;

        // Optional: Add filtering criteria here later (e.g., by category, inStock: true)
        const queryConditions = {}; // e.g., { stock: { $gt: 0 } } for in-stock items

        const products = await Product.find(queryConditions)
            .populate('sellerId', 'name') // Populate seller's name
            .sort({ createdAt: -1 })     // Sort by newest first
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

// --- GET /api/v1/products/search (Search products with pagination) ---
export const searchProducts: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const query = req.query.q as string; // The search term
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        if (!query) {
            res.status(400).json({ message: 'Search query (q) is required.' });
            return
        }

        // Construct the aggregation pipeline
        const aggregationPipeline = [
            {
                $search: {
                    index: 'product_search_index', // The name of your Atlas Search index
                    text: {
                        query: query,
                        path: ['name', 'description', 'category'], // Fields to search in
                        fuzzy: { // Optional: allow for some misspellings
                            maxEdits: 1, // Max 1 character difference
                            prefixLength: 2 // Don't apply fuzzy search to first 2 chars
                        }
                    },
                    // Optional: Highlighting (adds a 'highlights' field to documents)
                    // highlight: {
                    //     path: ['name', 'description']
                    // }
                },
            },
            // Optional: Add a $project stage if you want to shape the output or add score
            // {
            //     $project: {
            //         _id: 1, name: 1, description: 1, price: 1, category: 1,
            //         stock: 1, sellerId: 1, imageKeys: 1, createdAt: 1, updatedAt: 1,
            //         score: { $meta: "searchScore" } // Adds the relevance score
            //     }
            // },
            // {
            //     $sort: { score: { $meta: "searchScore" } } // Sort by relevance score
            // },
            {
                $lookup: { // Populate sellerId after search
                    from: 'users', // The name of the users collection
                    localField: 'sellerId',
                    foreignField: '_id',
                    as: 'sellerInfo'
                }
            },
            {
                $unwind: { // Unwind the sellerInfo array (should only be one seller)
                    path: '$sellerInfo',
                    preserveNullAndEmptyArrays: true // Keep product if seller not found (edge case)
                }
            },
            {
                $project: { // Define final output shape, select seller fields
                    _id: 1, name: 1, description: 1, price: 1, category: 1,
                    stock: 1, imageKeys: 1, createdAt: 1, updatedAt: 1,
                    numReviews: 1, averageRating: 1, // Keep existing fields
                    sellerId: { // Re-shape sellerId to include only name
                        _id: '$sellerInfo._id',
                        name: '$sellerInfo.name',
                    },
                    // score: { $meta: "searchScore" } // If you projected score earlier
                    // highlights: 1 // If you enabled highlighting
                }
            },
            {
                $facet: { // For pagination with aggregation
                    paginatedResults: [{ $skip: skip }, { $limit: limit }],
                    totalCount: [{ $count: 'count' }],
                },
            },
        ];

        const results = await Product.aggregate(aggregationPipeline);

        const products = results[0].paginatedResults;
        const totalProducts = results[0].totalCount[0] ? results[0].totalCount[0].count : 0;
        const totalPages = Math.ceil(totalProducts / limit);

        res.json({
            message: 'Search results fetched successfully',
            data: products,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalProducts: totalProducts,
                pageSize: limit,
            },
            // query: query // Optionally return the query term
        });

    } catch (error) {
        next(error);
    }
};

