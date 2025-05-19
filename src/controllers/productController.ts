// src/controllers/productController.ts
import { Request, Response, NextFunction } from 'express';
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

export const createProduct = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
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

export const getSellerProducts = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
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

export const getProductById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

export const updateProduct = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
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

export const deleteProduct = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
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