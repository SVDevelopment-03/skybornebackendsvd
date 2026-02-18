// sku ke liye Inventory import kar lo agar available ho
import mongoose from "mongoose";
import { Query } from "mongoose";

export interface IProduct {
  _id: mongoose.Types.ObjectId;
  name: string;
  category?: mongoose.Types.ObjectId; 
  sku: mongoose.Types.ObjectId;
  price: number;
  stock: number;
  status: "Published" | "Draft";
  image: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    // Reference to Inventory schema for SKU
    sku: {
      type: mongoose.Schema.Types.ObjectId,
      // ref: "Inventory",
      required: false,
      unique: true,
      index: true,
    },
    // Reference to Category schema
    category: {
      type: mongoose.Schema.Types.ObjectId,
      // ref: "Category",
      required: false,
      index: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: (v: number) => !isNaN(v) && v >= 0,
        message: "Price must be a valid positive number",
      },
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: {
        validator: (v: number) => Number.isInteger(v) && v >= 0,
        message: "Stock must be a valid non-negative integer",
      },
    },
    status: {
      type: String,
      enum: ["Published", "Draft"],
      default: "Draft",
      index: true,
    },
    image: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

// Populate ko temporarily hata do
// productSchema.pre<Query<any, any>>(/^find/, function (next) {
//   this.populate({ path: "category", select: "name _id" })
//       .populate({ path: "sku", select: "sku code _id" });
//   next();
// });

export default mongoose.model<IProduct>("Product", productSchema);
