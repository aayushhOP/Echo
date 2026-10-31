import { Schema, model, Document } from "mongoose";

export interface IUserPreferences {
  soundEnabled: boolean;
  theme: string;
  notifications: boolean;
}

export interface IUser extends Document {
  clerkId: string;
  email: string;
  username: string;
  avatarUrl?: string;
  status?: string;
  bio?: string;
  phone?: string;
  isOnline: boolean;
  lastSeen: Date;
  preferences?: IUserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    clerkId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    username: { type: String, required: true, trim: true },
    avatarUrl: { type: String, default: "" },
    status: { type: String, default: "Hey there! I'm using Echo" },
    bio: { type: String, default: "" },
    phone: { type: String, default: "" },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    preferences: {
      soundEnabled: { type: Boolean, default: true },
      theme: { type: String, default: "synthwave-dark" },
      notifications: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

export default model<IUser>("User", userSchema);
