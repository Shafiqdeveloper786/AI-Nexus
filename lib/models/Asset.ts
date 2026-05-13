import mongoose, { Schema, Model } from "mongoose";

export interface IAssetBase {
  userEmail:   string;
  type:        "image" | "resume" | "code";
  prompt?:     string;
  tool:        string;
  llmModel?:   string;     // renamed from 'model' to avoid Mongoose conflict
  content:     string;
  contentType: string;
  metadata:    Record<string, unknown>;
  chatId?:     string;
  createdAt:   Date;
  updatedAt:   Date;
}

const AssetSchema = new Schema<IAssetBase>(
  {
    userEmail:   { type: String, required: true, lowercase: true, index: true },
    type:        { type: String, enum: ["image", "resume", "code"], required: true },
    prompt:      { type: String, maxlength: 1000 },
    tool:        { type: String, default: "image" },
    llmModel:    { type: String },
    content:     { type: String, required: true },
    contentType: { type: String, default: "image/png" },
    metadata:    { type: Schema.Types.Mixed, default: {} },
    chatId:      { type: String },
  },
  { timestamps: true }
);

AssetSchema.index({ userEmail: 1, type: 1, createdAt: -1 });

export const Asset: Model<IAssetBase> =
  mongoose.models.Asset ?? mongoose.model<IAssetBase>("Asset", AssetSchema);
