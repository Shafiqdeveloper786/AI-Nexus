import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUserProfile extends Document {
  email: string;
  name: string;
  image?: string;
  credits: number;
  subscription: "free" | "pro" | "enterprise";
  subscriptionEndsAt?: Date;
  totalChats: number;
  totalTokens: number;
  /* 24-hour rolling limits for image + resume generation */
  dailyImageCount:  number;
  dailyResumeCount: number;
  dailyLimitResetAt?: Date;
  isDeleting?:  boolean;
  deletionDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserProfileSchema = new Schema<IUserProfile>(
  {
    email:             { type: String, required: true, unique: true, lowercase: true, trim: true },
    name:              { type: String, required: true, trim: true },
    image:             { type: String },
    credits:           { type: Number, default: 40_000, min: 0 },
    subscription:      { type: String, enum: ["free", "pro", "enterprise"], default: "free" },
    subscriptionEndsAt: { type: Date },
    totalChats:        { type: Number, default: 0 },
    totalTokens:       { type: Number, default: 0 },
    dailyImageCount:   { type: Number, default: 0 },
    dailyResumeCount:  { type: Number, default: 0 },
    dailyLimitResetAt: { type: Date },
    /* Soft-delete (30-day retention) */
    isDeleting:        { type: Boolean, default: false },
    deletionDate:      { type: Date },
  },
  { timestamps: true }
);

UserProfileSchema.index({ email: 1 });

UserProfileSchema.statics.findOrCreate = async function (
  email: string,
  name?: string
): Promise<IUserProfile> {
  let profile = await this.findOne({ email });
  if (!profile) {
    profile = await this.create({ email, name: name ?? email.split("@")[0] });
  }
  return profile;
};

export const UserProfile: Model<IUserProfile> =
  mongoose.models.UserProfile ??
  mongoose.model<IUserProfile>("UserProfile", UserProfileSchema);
