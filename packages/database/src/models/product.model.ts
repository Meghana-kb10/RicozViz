import mongoose, { Schema, Document, Model } from 'mongoose';
import { COLLECTIONS } from '../collections/collections';

export interface IProductDocument extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  price: number;
  category: string;
  inStock: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProductDocument>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    inStock: {
      type: Boolean,
      default: true
    }
  },
  {
    collection: COLLECTIONS.PRODUCTS,
    timestamps: true,
    versionKey: false
  }
);

export const ProductModel: Model<IProductDocument> =
  (mongoose.models.Product as Model<IProductDocument>) ||
  mongoose.model<IProductDocument>('Product', ProductSchema);
