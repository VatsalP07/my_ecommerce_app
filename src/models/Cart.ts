// src/models/Cart.ts
import mongoose, { Schema, Document, Types } from 'mongoose';
import { IProduct } from './Product'; // Assuming Product model is in Product.ts

// Interface for a single item within the cart
export interface ICartItem extends Document { // Making ICartItem a sub-document, not a top-level model
  product: Types.ObjectId | IProduct; // Reference to the Product document or populated product
  quantity: number;
  price: number; // Price of the product at the time it was added to cart (snapshot)
  name: string; // Denormalized product name for easier display in cart
  image?: string; // Denormalized product image for easier display
}

// Interface for the Cart document

export interface ICart extends Document {
  user: Types.ObjectId; // Reference to the User document
  items: ICartItem[];
  totalPrice?: number; // Calculated dynamically or stored
  totalQuantity?: number; // Calculated dynamically or stored
  createdAt: Date;
  updatedAt: Date;
}

const CartItemSchema: Schema<ICartItem> = new Schema({
  product: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity cannot be less than 1.'],
    default: 1,
  },
  price: { // Store the price at the time of adding to cart
    type: Number,
    required: true,
  },
  name: { // Denormalized from product for convenience
      type: String,
      required: true
  },
  image: { // Denormalized from product for convenience (first image typically)
      type: String
  }
}, { _id: true }); // Ensure subdocuments get an _id, useful for identifying items

const CartSchema: Schema<ICart> = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // Each user should have only one active cart
    },
    items: [CartItemSchema], // Array of cart items
    // totalPrice and totalQuantity can be virtuals or calculated on save/update
  },
  {
    timestamps: true,
  }
);

// Optional: Virtual for total price (calculated on demand)
CartSchema.virtual('totalPrice').get(function (this: ICart) {
  return this.items.reduce((total, item) => {
    return total + item.quantity * item.price;
  }, 0);
});

// Optional: Virtual for total quantity (calculated on demand)
CartSchema.virtual('totalQuantity').get(function (this: ICart) {
  return this.items.reduce((total, item) => {
    return total + item.quantity;
  }, 0);
});

// To include virtuals when converting to JSON (e.g., for API responses)
CartSchema.set('toObject', { virtuals: true });
CartSchema.set('toJSON', { virtuals: true });


const Cart = mongoose.model<ICart>('Cart', CartSchema);
// We don't create a separate model for CartItem as it's a subdocument of Cart
// export const CartItem = mongoose.model<ICartItem>('CartItem', CartItemSchema); // Not needed

export default Cart;