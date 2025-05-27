// src/models/Order.ts
import mongoose, { Schema, Document, Types } from 'mongoose';
import { IProduct } from './Product'; // Assuming IProduct is your product interface

// This is the interface for the items within an order
export interface IOrderItem {
    _id?: Types.ObjectId; // Mongoose adds this automatically to subdocuments
    name: string;
    quantity: number;
    image?: string; // Optional image URL
    price: number;   // Price of the product at the time of order
    product: Types.ObjectId | IProduct; // Reference to the Product document or populated product
}

// This is the main Order interface
export interface IOrder extends Document { // Extend Mongoose Document
    user: Types.ObjectId; // User who placed the order
    orderItems: IOrderItem[];
    shippingAddress: {
        address: string;
        city: string;
        postalCode: string;
        country: string;
    };
    paymentMethod: string;
    paymentResult?: { // Optional: if you store payment gateway response details
        id: string;
        status: string;
        update_time: string;
        email_address: string;
    };
    itemsPrice: number;  // Sum of (item.price * item.quantity)
    taxPrice: number;
    shippingPrice: number;
    totalPrice: number;
    isPaid: boolean;
    paidAt?: Date;       // Optional: timestamp when payment was confirmed
    isDelivered: boolean;
    deliveredAt?: Date;  // Optional: timestamp when order was delivered
    shippedAt?: Date;    // Timestamp when order was shipped
    status: string;      // Overall status of the order
    createdAt: Date;     // Added by timestamps: true
    updatedAt: Date;     // Added by timestamps: true
}

const OrderItemSchema: Schema<IOrderItem> = new Schema({ // No need to extend Document for sub-schemas
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    image: { type: String },
    price: { type: Number, required: true },
    product: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
    },
}, { _id: true }); // Ensure subdocuments get an _id

const OrderSchema: Schema<IOrder> = new Schema<IOrder>( // Specify IOrder here
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        orderItems: [OrderItemSchema],
        shippingAddress: {
            address: { type: String, required: true },
            city: { type: String, required: true },
            postalCode: { type: String, required: true },
            country: { type: String, required: true },
        },
        paymentMethod: { type: String, required: true },
        paymentResult: { // Optional
            id: { type: String },
            status: { type: String },
            update_time: { type: String },
            email_address: { type: String },
        },
        itemsPrice: { type: Number, required: true, default: 0.0 },
        taxPrice: { type: Number, required: true, default: 0.0 },
        shippingPrice: { type: Number, required: true, default: 0.0 },
        totalPrice: { type: Number, required: true, default: 0.0 },
        isPaid: { type: Boolean, required: true, default: false },
        paidAt: { type: Date },
        isDelivered: { type: Boolean, required: true, default: false },
        deliveredAt: { type: Date },
        shippedAt: { type: Date }, // Added field
        status: {                 // Correct field name
            type: String,
            required: true,
            enum: ['Pending Payment', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Failed'],
            default: 'Pending Payment',
        },
    },
    {
        timestamps: true, // Automatically adds createdAt and updatedAt
    }
);

const Order = mongoose.model<IOrder>('Order', OrderSchema);

export default Order;