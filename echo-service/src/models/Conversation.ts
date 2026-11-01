import { Schema, model, Document, Types } from "mongoose";

export interface IGroupParticipant {
  userId: Types.ObjectId;
  role: "admin" | "member";
  joinedAt: Date;
}

export interface IPastParticipant {
  userId: Types.ObjectId;
  leftAt: Date;
  reason: "left" | "removed";
}

export interface IGroupSettings {
  onlyAdminsMessage: boolean;
  onlyAdminsEditInfo: boolean;
  onlyAdminsAddMembers: boolean;
  requireAdminApproval: boolean;
}

export interface IConversation extends Document {
  type: "direct" | "group";
  groupName?: string;
  name?: string;
  description?: string;
  groupAvatar?: string;
  avatarUrl?: string;
  creatorId?: Types.ObjectId;
  participants: Types.ObjectId[];
  admins?: Types.ObjectId[];
  groupParticipants?: IGroupParticipant[];
  pastParticipants?: IPastParticipant[];
  pendingRequests?: Types.ObjectId[];
  inviteToken?: string;
  settings?: IGroupSettings;
  lastMessage?: Types.ObjectId;
  pinnedBy?: Types.ObjectId[];
  mutedBy?: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    type: { type: String, enum: ["direct", "group"], required: true },
    groupName: { type: String },
    name: { type: String },
    description: { type: String, default: "" },
    groupAvatar: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },
    creatorId: { type: Schema.Types.ObjectId, ref: "User" },
    participants: [{ type: Schema.Types.ObjectId, ref: "User", index: true }],
    admins: [{ type: Schema.Types.ObjectId, ref: "User" }],
    groupParticipants: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        role: { type: String, enum: ["admin", "member"], default: "member" },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    pastParticipants: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        leftAt: { type: Date, default: Date.now },
        reason: { type: String, enum: ["left", "removed"], default: "left" },
      },
    ],
    pendingRequests: [{ type: Schema.Types.ObjectId, ref: "User" }],
    inviteToken: { type: String, unique: true, sparse: true },
    settings: {
      onlyAdminsMessage: { type: Boolean, default: false },
      onlyAdminsEditInfo: { type: Boolean, default: false },
      onlyAdminsAddMembers: { type: Boolean, default: false },
      requireAdminApproval: { type: Boolean, default: false },
    },
    lastMessage: { type: Schema.Types.ObjectId, ref: "Message" },
    pinnedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    mutedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

export default model<IConversation>("Conversation", conversationSchema);
