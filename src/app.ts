// src/app.ts
import express, { Express, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'path'; 
import mongoose from 'mongoose';
import productRoutes from './routes/productRoutes';
import passport from './config/passport'; // Your Passport configuration
import authRoutes from './routes/authRoutes';
import cartRoutes from './routes/cartRoutes';
import orderRoutes from './routes/orderRoutes';

// Import other routes as you create them:
// import productRoutes from './routes/productRoutes';

dotenv.config(); // Load environment variables

const app: Express = express();
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGODB_URI;

// --- Core Middleware ---
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request bodies

// --- Passport Authentication Middleware ---
app.use(passport.initialize());

  app.use(express.static(path.join(__dirname, '..', 'frontend')));


// --- MongoDB Connection ---
const connectDB = async () => {
  if (!mongoUri) {
    console.error('FATAL ERROR: MONGODB_URI is not defined in .env file');
    process.exit(1); // Exit if DB URI is missing
  }
  try {
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected...');
  } catch (err: any) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1); // Exit on connection failure
  }
};
connectDB();

// --- API Routes ---
app.get('/api/v1', (req: Request, res: Response) => {
  res.send('E-commerce API is running!');
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/orders', orderRoutes);

// Mount other application routes here:
// app.use('/api/v1/products', productRoutes);

// --- 404 Not Found Handler ---
// This should be after all your valid routes
app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({ message: `Resource not found at ${req.originalUrl}` });
});

// --- Global Error Handler ---
// Must be defined AFTER all other app.use() and routes.
// Must have 4 arguments to be recognized by Express as an error-handling middleware.
app.use((err: any, req: Request, res: Response, next: NextFunction): void => {
  console.error("--- Global Error Handler ---");
  console.error("Error Message:", err.message);
  if (err.stack && process.env.NODE_ENV === 'development') {
    console.error("Stack Trace:", err.stack);
  }

  let statusCode = err.status || err.statusCode || 500;
  let responseBody: { message: string; errors?: any; field?: string; path?: string; value?: any } = {
    message: err.message || 'An unexpected internal server error occurred.',
  };

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    responseBody.message = "Validation Failed";
    responseBody.errors = Object.values(err.errors).map((el: any) => ({
      field: el.path,
      message: el.message,
    }));
    res.status(statusCode).json(responseBody);
    return;
  }

  // Mongoose Duplicate Key Error (e.g., unique email constraint)
  if (err.code && err.code === 11000) {
    statusCode = 409; // Conflict
    const field = Object.keys(err.keyValue)[0];
    responseBody.message = `An account with that ${field} already exists.`;
    responseBody.field = field;
    res.status(statusCode).json(responseBody);
    return;
  }

  // Mongoose CastError (e.g., invalid ObjectId format for :id params)
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 400;
    responseBody.message = `Invalid ID format for resource: ${err.value}`;
    responseBody.path = err.path;
    responseBody.value = err.value;
    res.status(statusCode).json(responseBody);
    return;
  }

  // JWT Authentication Errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401; // Unauthorized
    responseBody.message = 'Invalid token. Please log in again.';
    res.status(statusCode).json(responseBody);
    return;
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401; // Unauthorized
    responseBody.message = 'Your session has expired. Please log in again.';
    res.status(statusCode).json(responseBody);
    return;
  }

  // If a custom error has a status code (e.g., from a service layer)
  if (err.status || err.statusCode) {
    // statusCode is already set from err.status or err.statusCode
    // responseBody.message is already set from err.message
    res.status(statusCode).json(responseBody);
    return;
  }

  // Default to 500 Internal Server Error for unhandled errors
  res.status(statusCode).json(responseBody);
});

// --- Start the Server ---
app.listen(port, () => {
  console.log(`[Server]: Server is running at http://localhost:${port}`);
});