// src/@types/express/index.d.ts
import { IUser } from '../../models/user'; // <-- Double-check this path and 'User' casing

export {}; // Ensures this file is treated as a module

declare global {
  namespace Express {
    // This interface merges with and extends Express's own User interface
    export interface User extends IUser {}

    // This augments the Express Request interface
    export interface Request {
      user?: User; // The user property will be of type Express.User, which now includes IUser properties
    }
  }
}