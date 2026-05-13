import mongoose, { Schema, Model, Types } from "mongoose";

export type ChatTool = "chat" | "code" | "image" | "resume" | "sql";

export interface IMessage {
  _id?: Types.ObjectId;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: Date;
}

/* ── Use a plain object type (not extending Document) to avoid
      the reserved `model` method conflict on Mongoose Document ── */
export interface IChatBase {
  userEmail:  string;
  title:      string;
  tool:       ChatTool;
  llmModel:   string;       // renamed from 'model' to avoid Mongoose conflict
  messages:   IMessage[];
  tokenCount: number;
  createdAt:  Date;
  updatedAt:  Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    role:      { type: String, enum: ["user", "assistant", "system"], required: true },
    content:   { type: String, required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: true }
);

const ChatSchema = new Schema<IChatBase>(
  {
    userEmail:  { type: String, required: true, lowercase: true, trim: true, index: true },
    title:      { type: String, required: true, maxlength: 100 },
    tool:       { type: String, enum: ["chat", "code", "image", "resume", "sql"], default: "chat" },
    llmModel:   { type: String, default: "llama3" },
    messages:   { type: [MessageSchema], default: [] },
    tokenCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ChatSchema.index({ userEmail: 1, updatedAt: -1 });

export const Chat: Model<IChatBase> =
  mongoose.models.Chat ?? mongoose.model<IChatBase>("Chat", ChatSchema);
