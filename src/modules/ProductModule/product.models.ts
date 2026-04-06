  import mongoose from "mongoose";

  export interface IProduct {
    _id: mongoose.Types.ObjectId;
    name: string;
    category?: mongoose.Types.ObjectId;
    price: number;
    stock?: number;
    status: "active" | "inactive";
    image: string;
    description?: string;
    specifications?: Array<{ label: string; value: string }>;
    shippingInfo?: string;
    reviews?: Array<{
      name?: string;
      rating?: number;
      comment?: string;
      createdAt?: Date;
    }>;
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
      category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "EcomCategory",
        required: false,
        index: true,
      },
      price: {
        type: Number,
        required: true,
        min: 1,
        validate: {
          validator: (v: number) => !isNaN(v) && v >= 1,
          message: "Price must be at least $1",
        },
      },
      stock: {
        type: Number,
        default: 0,
        min: 0,
        validate: {
          validator: (v: number) => Number.isInteger(v) && v >= 0,
          message: "Stock must be a non-negative integer",
        },
      },
    
      status: {
        type: String,
        enum: ["active", "inactive"],
        default: "inactive",
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
      specifications: {
        type: [
          {
            label: { type: String, trim: true },
            value: { type: String, trim: true },
          },
        ],
        default: [],
      },
      shippingInfo: {
        type: String,
        trim: true,
        default: "",
      },
      reviews: {
        type: [
          {
            name: { type: String, trim: true },
            rating: { type: Number, min: 0, max: 5 },
            comment: { type: String, trim: true },
            createdAt: { type: Date, default: Date.now },
          },
        ],
        default: [],
      },
    },
    { timestamps: true }
  );

  export default mongoose.model<IProduct>("Product", productSchema);
