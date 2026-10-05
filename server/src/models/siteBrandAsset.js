import { Schema, model, models } from 'mongoose';

const SiteBrandAssetSchema = new Schema({
  slot: { type: String, enum: ['primary', 'light'], required: true, unique: true, index: true },
  mimeType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], required: true },
  data: { type: Buffer, required: true },
  size: { type: Number, required: true, min: 1 },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

export const SiteBrandAsset = models.SiteBrandAsset || model('SiteBrandAsset', SiteBrandAssetSchema);
