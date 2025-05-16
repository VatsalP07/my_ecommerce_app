import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose'; 

// Load environment variables from .env file
dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGODB_URI;


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
const connectDB = async () => {
  if (!mongoUri) {
    console.error('Error: MONGODB_URI is not defined in .env file');
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

app.get('/api/v1', (req: Request, res: Response) => {
  res.send('E-commerce API is running! Version 1 & DB Connected (hopefully!)');
});

app.listen(port, () => {
  console.log(`[Server]: Server is running at http://localhost:${port}`);
});