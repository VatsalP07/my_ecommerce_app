// src/models/Order.ts
import mongoose, { Schema, Document, Types } from 'mongoose';
import { IProduct } from './Product'; // For type reference
import { IUser } from './user';     // For type reference

// Interface for a single item within an order
export interface IOrderItem { // This will be a subdocument, not a top-level model
  product: Types.ObjectId; // Reference to the Product document ID
  name: string;           // Denormalized product name
  quantity: number;
  price: number;          // Price of the product at the time of order
  image?: string;         // Denormalized product image
}

// Interface for the Order document
export interface IOrder extends Document {
  user: Types.ObjectId | IUser; // Reference to the User document or populated user
  orderItems: IOrderItem[];
  shippingAddress: {
    address: string;
    city: string;
    postalCode: string;
    country: string;
  };
  paymentMethod: string; // e.g., 'Stripe', 'PayPal', 'Simulated'
  paymentResult?: { // Optional: details from payment gateway
    id?: string;
    status?: string;
    update_time?: string;
    email_address?: string;
  };
  itemsPrice: number; // Sum of (item.price * item.quantity)
  taxPrice: number;
  shippingPrice: number;
  totalPrice: number; // Grand total
  orderStatus: 'Pending' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';
  isPaid: boolean;
  paidAt?: Date;
  isDelivered: boolean;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema: Schema<IOrderItem> = new Schema({
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true }, // Price at the time of order
  image: { type: String }, // Optional, first image of the product
}, { _id: false }); // Typically subdocuments for order items don't need their own _id unless you need to reference them individually often

const OrderSchema: Schema<IOrder> = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    orderItems: [OrderItemSchema],
    shippingAddress: {
      address: { type: String, required: true },
      city: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    paymentMethod: { type: String, required: true, default: 'Simulated' },
    paymentResult: { // Store payment gateway response if any
      id: String,
      status: String,
      update_time: String,
      email_address: String,
    },
    itemsPrice: { type: Number, required: true, default: 0.0 },
    taxPrice: { type: Number, required: true, default: 0.0 },
    shippingPrice: { type: Number, required: true, default: 0.0 },
    totalPrice: { type: Number, required: true, default: 0.0 },
    orderStatus: {
        type: String,
        required: true,
        enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
        default: 'Pending',
    },
    isPaid: { type: Boolean, required: true, default: false },
    paidAt: { type: Date },
    isDelivered: { type: Boolean, required: true, default: false },
    deliveredAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

const Order = mongoose.model<IOrder>('Order', OrderSchema);

export default Order;