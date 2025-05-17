// src/routes/authRoutes.ts
import express, { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
// Make sure the casing matches your file system: User.ts likely means 'User'
import User, { IUser } from '../models/user'; // Corrected casing assuming User.ts

const router: Router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_dev_only';

// --- POST /api/v1/auth/register ---
// Define the handler function separately
const registerHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, email, password, roles } = req.body;

    // Basic validation
    if (!name || !email || !password) {
      // Send response and then return to exit the function
      res.status(400).json({ message: 'Name, email, and password are required.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters long.' });
      return;
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ message: 'User already exists with this email.' });
      return;
    }

    const user = new User({
      name,
      email,
      password,
      roles: roles || ['customer'],
    });

    await user.save();

    const userToReturn = user.toObject();
    delete userToReturn.password;

    res.status(201).json({ message: 'User registered successfully', user: userToReturn });
    // No explicit return needed here as res.json() sends the response
  } catch (error) {
    next(error); // Pass error to the global error handler
  }
};

router.post('/register', registerHandler); // This should now work

// --- POST /api/v1/auth/login ---
router.post('/login', (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('local', { session: false }, (err: any, user: IUser | false, info: any) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.status(401).json({ message: info?.message || 'Login failed. Please check your credentials.' });
    }

    // It's good practice to ensure user._id exists before using it.
    // While IUser from Mongoose should have it, a defensive check doesn't hurt.
    if (!user._id) {
        // This would indicate an unexpected issue with the user object from passport
        console.error('User authenticated but _id is missing:', user);
        return res.status(500).json({ message: 'Authentication error: User ID missing.' });
    }

    const payload = {
      sub: user._id.toString(), // Ensure _id is a string for JWT standard practice
      email: user.email,
      roles: user.roles,
    };

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: '1d',
    });

    // Make sure the user object sent back doesn't contain sensitive info like password
    // The user object from passport's local strategy callback should already have password removed
    // If not, explicitly create a safe user object:
    const safeUser = {
        _id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
    };

    return res.json({ message: 'Login successful', token: `Bearer ${token}`, user: safeUser });
  })(req, res, next);
});

// --- GET /api/v1/auth/profile (Protected Route Example) ---
router.get(
    '/profile',
    passport.authenticate('jwt', { session: false }),
    (req: Request, res: Response) => {
        // req.user is populated by passport.

        // If IUser is directly from Mongoose Document, it might have methods/extra properties.
        // It's often good to explicitly cast or create a plain object if needed.
        const userProfile = req.user as IUser; // Assuming req.user is IUser

        // You might want to create a DTO (Data Transfer Object) or pick properties
        const safeProfile = {
            _id: userProfile._id,
            name: userProfile.name,
            email: userProfile.email,
            roles: userProfile.roles,
            createdAt: userProfile.createdAt,
            updatedAt: userProfile.updatedAt
        };

        res.json({
            message: 'You made it to the secure profile route!',
            user: safeProfile,
        });
    }
);

export default router;