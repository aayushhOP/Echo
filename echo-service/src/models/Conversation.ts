import { Schema, model, Document, Types } from "mongoose";

export interface IConversation extends Document {
  type: "direct" | "group";
  groupName?: string;
  groupAvatar?: string;
  participants: Types.ObjectId[];
  admins?: Types.ObjectId[];
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
    groupAvatar: { type: String, default: "" },
    participants: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
    admins: [{ type: Schema.Types.ObjectId, ref: "User" }],
    lastMessage: { type: Schema.Types.ObjectId, ref: "Message" },
    pinnedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    mutedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

export default model<IConversation>("Conversation", conversationSchema);
