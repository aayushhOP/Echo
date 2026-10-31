import { Schema, model, Document, Types } from "mongoose";

export interface IReaction {
  emoji: string;
  users: Types.ObjectId[];
}

export interface IMessageRecipient {
  userId: Types.ObjectId;
  readAt?: Date;
  deliveredAt?: Date;
}

export interface IMessage extends Document {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  content: string;
  type: "text" | "image" | "file";
  mediaUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  reactions: IReaction[];
  replyTo?: Types.ObjectId | null;
  readBy: Types.ObjectId[];
  deliveredTo?: {
    userId: Types.ObjectId;
    deliveredAt: Date;
  }[];
  isDroppedDueToBlock?: boolean;
  status: "sent" | "delivered" | "read";
  createdAt: Date;
  updatedAt: Date;
}

const reactionSchema = new Schema<IReaction>(
  {
    emoji: { type: String, required: true },
    users: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { _id: false }
);

const messageSchema = new Schema<IMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, default: "" },
    type: { type: String, enum: ["text", "image", "file"], default: "text" },
    mediaUrl: { type: String, default: null },
    fileName: { type: String, default: null },
    fileSize: { type: Number, default: null },
    reactions: { type: [reactionSchema], default: [] },
    replyTo: { type: Schema.Types.ObjectId, ref: "Message", default: null },
    readBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    deliveredTo: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        deliveredAt: { type: Date, default: Date.now },
      },
    ],
    isDroppedDueToBlock: { type: Boolean, default: false },
    status: { type: String, enum: ["sent", "delivered", "read"], default: "sent", index: true },
  },
  { timestamps: true }
);

// Required index — do not omit
messageSchema.index({ conversationId: 1, createdAt: -1 });

export default model<IMessage>("Message", messageSchema);
