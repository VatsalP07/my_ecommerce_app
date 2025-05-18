// src/models/Product.ts
import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  sellerId: Types.ObjectId; // Reference to the User who is the seller
  imageKeys: string[]; // Array of S3 keys or image URLs
  averageRating?: number; // Optional, can be calculated
  numReviews?: number; // Optional
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema: Schema<IProduct> = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      min: [0, 'Price cannot be negative'],
    },
    category: {
      type: String,
      required: [true, 'Product category is required'],
      trim: true,
      // Consider using an enum if you have predefined categories
      // enum: ['Electronics', 'Books', 'Clothing', 'Home Goods']
    },
    stock: {
      type: Number,
      required: [true, 'Product stock quantity is required'],
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'User', // This creates a reference to the User model
      required: [true, 'Seller ID is required'],
    },
    imageKeys: {
      type: [String], // Store S3 keys or full URLs
      default: [],
    },
    averageRating: {
        type: Number,
        min: [0, 'Rating must be at least 0'],
        max: [5, 'Rating must be at most 5'],
        default: 0,
    },
    numReviews: {
        type: Number,
        default: 0,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
  }
);

// Optional: Create an index for sellerId if you often query products by seller
ProductSchema.index({ sellerId: 1 });
// Optional: Create an index for category for faster filtering
ProductSchema.index({ category: 1 });
// Optional: Text index for searching (we'll configure Atlas Search later for better results)
// ProductSchema.index({ name: 'text', description: 'text' });


const Product = mongoose.model<IProduct>('Product', ProductSchema);

export default Product;