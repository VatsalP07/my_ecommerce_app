// src/app.ts
import express, { Express, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import http from 'http'; // Import Node.js http module
import { Server as SocketIOServer, Socket } from 'socket.io'; // Import Socket.IO Server

// Configs
import passportConfig from './config/passport'; // Your Passport configuration

// Routes
import authRoutes from './routes/authRoutes';
import productRoutes from './routes/productRoutes';
import cartRoutes from './routes/cartRoutes';
import orderRoutes from './routes/orderRoutes';

dotenv.config(); // Load environment variables

const app: Express = express();
const port = process.env.PORT || 5001; // Default to 5001 for consistency
const mongoUri = process.env.MONGODB_URI;

// --- Create HTTP server and integrate Socket.IO ---
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
    cors: {
        origin: `http://localhost:${port}`, // Allow connections from where frontend is served
        methods: ["GET", "POST"],
    }
});

// --- Core Middleware ---
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request bodies

// --- Passport Authentication Middleware ---
app.use(passportConfig.initialize()); // Use the imported passport directly

// --- MongoDB Connection ---
const connectDB = async () => {
  if (!mongoUri) {
    console.error('FATAL ERROR: MONGODB_URI is not defined in .env file');
    process.exit(1);
  }
  try {
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected...');
  } catch (err: any) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};
connectDB();

// --- Socket.IO Connection Logic ---
io.on('connection', (socket: Socket) => {
    console.log(`[Socket.IO]: New client connected: ${socket.id}`);

    // Example: Listen for a custom event from client
    socket.on('clientMessage', (data) => {
        console.log(`[Socket.IO]: Message from client ${socket.id}:`, data);
        io.emit('serverMessage', `Server received: ${data.message} from ${socket.id}`);
    });

    socket.on('disconnect', () => {
        console.log(`[Socket.IO]: Client disconnected: ${socket.id}`);
    });
});

// --- Serve Frontend Static Files ---
// This assumes your 'frontend' directory is at the project root,
// and this 'app.ts' (when compiled to 'dist/app.js') is one level down in 'dist'.
const frontendPath = path.join(__dirname, '..', 'frontend');

// Serve specific asset folders first
app.use('/js', express.static(path.join(frontendPath, 'js')));
app.use('/css', express.static(path.join(frontendPath, 'css')));
// Potentially other asset folders like /images if you have them in frontend

// --- API Routes ---
// These should come AFTER specific static asset serving but BEFORE general static file serving for HTML
app.get('/api/v1', (req: Request, res: Response) => {
  res.send('E-commerce API is running with Socket.IO!');
});
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/orders', orderRoutes);

// --- Serve HTML files and handle client-side routing ---
// This serves index.html for the root and any other non-API, non-asset path.
// It relies on your frontend (or simple HTML links) to handle different pages.
app.get('*', (req: Request, res: Response, next: NextFunction) => {
    // If the request is for an API route that wasn't matched above,
    // it shouldn't be served index.html. Let it fall through to the 404 handler.
    if (req.path.startsWith('/api/')) {
        return next(); // Pass to the 404 handler for API routes
    }
    // For any other GET request, serve an HTML file if it exists, otherwise index.html
    const requestedHtmlFile = path.join(frontendPath, req.path.endsWith('.html') ? req.path : `${req.path}.html`);
    const defaultHtmlFile = path.join(frontendPath, 'index.html');

    // Try to serve specific HTML file, otherwise serve index.html
    // This is a simplified way; a real SPA would handle this differently on the client.
    res.sendFile(requestedHtmlFile, (err) => {
        if (err) {
            res.sendFile(defaultHtmlFile);
        }
    });
});


// --- 404 Not Found Handler (for API routes that fell through) ---
app.use((req: Request, res: Response, next: NextFunction) => {
  // This will only be reached if no API route matched and it wasn't a file served by express.static or the catch-all GET
  res.status(404).json({ message: `API Endpoint not found at ${req.originalUrl}` });
});

// --- Global Error Handler ---
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

  if (err.name === 'ValidationError') {
    statusCode = 400;
    responseBody.message = "Validation Failed";
    responseBody.errors = Object.values(err.errors).map((el: any) => ({
      field: el.path,
      message: el.message,
    }));
  } else if (err.code && err.code === 11000) {
    statusCode = 409; // Conflict
    const field = Object.keys(err.keyValue)[0];
    responseBody.message = `An account with that ${field} already exists.`;
    responseBody.field = field;
  } else if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 400;
    responseBody.message = `Invalid ID format for resource: ${err.value}`;
    responseBody.path = err.path;
    responseBody.value = err.value;
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    responseBody.message = 'Invalid token. Please log in again.';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    responseBody.message = 'Your session has expired. Please log in again.';
  } else if (err.status || err.statusCode) {
    // statusCode is already set
  } else {
    // For unhandled errors not fitting above categories
    statusCode = 500;
  }

  res.status(statusCode).json(responseBody);
});

// --- Start the Server ---
// Use httpServer.listen for Socket.IO integration
httpServer.listen(port, () => {
  console.log(`[Server]: HTTP Server with Socket.IO is running at http://localhost:${port}`);
  console.log(`Frontend should be accessible at http://localhost:${port}`);
});

// Export io instance for use in other modules (e.g., controllers)
export { io };