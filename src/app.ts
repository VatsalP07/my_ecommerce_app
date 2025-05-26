// src/app.ts
import express, { Express, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'path'; // Node.js path module for working with file and directory paths
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

// --- Load Environment Variables ---
dotenv.config();

const app: Express = express();
const port = process.env.PORT || 5001; // Default to 5001 for consistency
const mongoUri = process.env.MONGODB_URI;

// --- Create HTTP server and integrate Socket.IO ---
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
    cors: {
        origin: `http://localhost:${port}`, // Allow Socket.IO connections from the same origin
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

    // --- Chat Logic from Day 11 ---
    socket.on('joinChat', () => {
        console.log(`[Socket.IO]: Client ${socket.id} joined chat.`);
        socket.emit('chatMessage', { sender: 'Admin', text: 'Hello! How can I help you today?' });
    });

    socket.on('sendChatMessage', (message: { text: string }) => {
        console.log(`[Socket.IO]: Message from ${socket.id}: ${message.text}`);
        socket.emit('chatMessage', { sender: 'You', text: message.text });
        setTimeout(() => {
            socket.emit('chatMessage', { sender: 'Admin', text: `Thanks for your message! An admin will review: "${message.text.substring(0,20)}..."` });
        }, 1500);
    });
    // --- End Chat Logic ---

    // Example: Listen for a generic client message (if needed for other purposes)
    socket.on('clientMessage', (data) => {
        console.log(`[Socket.IO]: Generic message from client ${socket.id}:`, data);
        // io.emit('serverMessage', `Server received generic: ${data.message} from ${socket.id}`);
    });

    socket.on('disconnect', () => {
        console.log(`[Socket.IO]: Client disconnected: ${socket.id}`);
    });
});

// --- Serve Frontend Static Files ---
// Define the path to your 'frontend' directory.
const frontendPath = path.join(__dirname, '..', 'frontend');

// Serve specific asset folders like 'css', 'js' directly.
app.use('/css', express.static(path.join(frontendPath, 'css')));
app.use('/js', express.static(path.join(frontendPath, 'js')));
// Example: if you have an 'admin/js' folder compiled from 'admin/ts':
app.use('/admin/js', express.static(path.join(frontendPath, 'admin', 'js')));
// If you have an 'images' folder in 'frontend' for static images (not product images from S3):
// app.use('/images', express.static(path.join(frontendPath, 'images')));


// --- API Routes ---
// These should come AFTER specific static asset serving but BEFORE general static file serving for HTML
app.get('/api/v1', (req: Request, res: Response) => {
  res.send('E-commerce API is running with Socket.IO and serving frontend!');
});
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/orders', orderRoutes);

// --- Serve HTML files and handle client-side routing "like" behavior ---
app.get('*', (req: Request, res: Response, next: NextFunction) => {
    // If the request path starts with `/api/`, it's an API call that wasn't matched by earlier API routes.
    if (req.path.startsWith('/api/')) {
        return next(); // Pass to the 404 handler for APIs
    }

    // Construct the full path to the potentially requested HTML file.
    let potentialFile = req.path;
    if (potentialFile.endsWith('/')) {
        potentialFile += 'index.html'; // Serve index.html for directory requests like /admin/
    }
    if (!potentialFile.includes('.')) { // If no extension, assume .html
        potentialFile += '.html';
    }

    const requestedFile = path.join(frontendPath, potentialFile);
    const defaultHtmlFile = path.join(frontendPath, 'index.html');

    res.sendFile(requestedFile, (err) => {
        if (err) {
            // If specific file not found, try to serve index.html from the root frontend folder
            // This is a common fallback for SPAs or to handle "clean URLs"
            res.sendFile(defaultHtmlFile, (defaultErr) => {
                if (defaultErr) {
                    // If even index.html is not found (major issue), send a simple 404 text
                    // Or, you could have a very basic 404.html in your frontend root
                    res.status(404).send('Content not found.');
                }
            });
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
  console.error("Error Name:", err.name);
  console.error("Error Message:", err.message);
  if (err.stack && process.env.NODE_ENV === 'development') {
    console.error("Stack Trace:", err.stack);
  }
  if(err.keyValue) console.error("Duplicate Key Value:", err.keyValue);
  if(err.errors) console.error("Validation Errors:", JSON.stringify(err.errors, null, 2));


  let statusCode = err.status || err.statusCode || 500;
  let responseBody: { message: string; errors?: any; field?: string; path?: string; value?: any, name?: string } = {
    message: err.message || 'An unexpected internal server error occurred.',
    name: err.name // Include error name for better client-side differentiation if needed
  };

  if (err.name === 'ValidationError') {
    statusCode = 400; // Bad Request
    responseBody.message = "Validation Failed";
    responseBody.errors = Object.values(err.errors).map((el: any) => ({
      field: el.path,
      message: el.message,
    }));
  } else if (err.code && err.code === 11000) { // MongoDB duplicate key error
    statusCode = 409; // Conflict
    const field = Object.keys(err.keyValue)[0];
    responseBody.message = `An account with that ${field} already exists.`;
    responseBody.field = field;
  } else if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 400; // Bad Request
    responseBody.message = `Invalid ID format for resource: ${err.value}`;
    responseBody.path = err.path;
    responseBody.value = err.value;
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401; // Unauthorized
    responseBody.message = 'Invalid token. Please log in again.';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401; // Unauthorized
    responseBody.message = 'Your session has expired. Please log in again.';
  } else if (err.name === 'MulterError') { // Specific error from Multer (file uploads)
    statusCode = 400; // Bad Request
    responseBody.message = `File upload error: ${err.message}`;
    if (err.code) responseBody.field = err.field; // Multer sometimes provides a field name
  }
  // If statusCode was set on the error object directly (e.g., by custom error classes)
  else if (err.status || err.statusCode) {
    // statusCode is already set from the error object
  }
  // For other unhandled errors, default to 500
  else {
    statusCode = 500;
  }

  // Ensure status code is a valid HTTP status
  if (statusCode < 100 || statusCode > 599) {
    console.error(`[Error Handler]: Invalid statusCode ${statusCode} generated for error. Defaulting to 500.`);
    statusCode = 500;
  }

  res.status(statusCode).json(responseBody);
});

// --- Start the Server ---
// Use httpServer.listen for Socket.IO integration
httpServer.listen(port, () => {
  console.log(`[Server]: HTTP Server with Socket.IO is running at http://localhost:${port}`);
  console.log(`Frontend should be accessible directly at http://localhost:${port}`);
});

// Export io instance for use in other modules (e.g., controllers)
export { io };