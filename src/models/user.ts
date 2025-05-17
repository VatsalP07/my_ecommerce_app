import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';


export interface IUser extends Document {
  name: string;
  email: string;
  password?: string; 
  roles: string[];
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema: Schema<IUser> = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true, 
      trim: true,
      lowercase: true,
      match: [/.+\@.+\..+/, 'Please fill a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters long'],
      select: false, 
    },
    roles: {
      type: [String],
      default: ['customer'], 
      enum: ['customer', 'seller', 'admin'], 
    },
  },
  {
    timestamps: true, 
  }
);


UserSchema.pre<IUser>('save', async function (next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.password) {
    return false; 
  }
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model<IUser>('User', UserSchema);

export default User;