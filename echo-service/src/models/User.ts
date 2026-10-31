import { Schema, model, Document, Types, Model } from "mongoose";

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
  blockedUsers: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserModel extends Model<IUser> {
  isBlockedRelationship(userA: string | Types.ObjectId, userB: string | Types.ObjectId): Promise<boolean>;
}

const userSchema = new Schema<IUser, IUserModel>(
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
    blockedUsers: [{ type: Schema.Types.ObjectId, ref: "User", default: [] }],
  },
  { timestamps: true }
);

userSchema.statics.isBlockedRelationship = async function (
  userA: string | Types.ObjectId,
  userB: string | Types.ObjectId
): Promise<boolean> {
  const queryConditions: any[] = [];
  if (typeof userA === "string" && userA.match(/^[0-9a-fA-F]{24}$/)) {
    queryConditions.push({ _id: new Types.ObjectId(userA) });
  } else if (userA instanceof Types.ObjectId) {
    queryConditions.push({ _id: userA });
  } else {
    queryConditions.push({ clerkId: userA });
  }

  if (typeof userB === "string" && userB.match(/^[0-9a-fA-F]{24}$/)) {
    queryConditions.push({ _id: new Types.ObjectId(userB) });
  } else if (userB instanceof Types.ObjectId) {
    queryConditions.push({ _id: userB });
  } else {
    queryConditions.push({ clerkId: userB });
  }

  const users = await this.find({ $or: queryConditions }).select("_id clerkId blockedUsers");
  
  const docA = users.find(
    (u) =>
      u._id.toString() === userA.toString() ||
      (typeof userA === "string" && u.clerkId === userA)
  );
  const docB = users.find(
    (u) =>
      u._id.toString() === userB.toString() ||
      (typeof userB === "string" && u.clerkId === userB)
  );

  if (!docA || !docB) return false;

  const aBlockedB = docA.blockedUsers?.some((id) => id.toString() === docB._id.toString()) ?? false;
  const bBlockedA = docB.blockedUsers?.some((id) => id.toString() === docA._id.toString()) ?? false;

  return aBlockedB || bBlockedA;
};

export default model<IUser, IUserModel>("User", userSchema);
