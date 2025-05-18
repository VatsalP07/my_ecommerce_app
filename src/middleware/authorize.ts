// src/middleware/authorize.ts
import { Request, Response, NextFunction } from 'express';
import { IUser } from '../models/user'; // Path seems correct as per other files

export const authorize = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => { // Explicitly set return type to void
    console.log('Authorize middleware called. Raw req.user:', req.user);

    if (!req.user || typeof (req.user as any).roles === 'undefined' || !Array.isArray((req.user as any).roles)) {
      console.error('Authentication issue: req.user is missing, not an IUser, or roles are malformed.', req.user);
      // Ensure you return after sending the response
      res.status(401).json({ message: 'Authentication required or user data is invalid.' });
      return; 
    }

    const authenticatedUser = req.user as IUser;
    const userRoles = authenticatedUser.roles;
    const hasRequiredRole = userRoles.some(role => allowedRoles.includes(role));

    if (hasRequiredRole) {
      next();
    } else {
      // Ensure you return after sending the response
      res.status(403).json({
        message: `Forbidden. You do not have the required permissions. Allowed roles: ${allowedRoles.join(', ')}`,
      });
      return; 
    }
  };
};