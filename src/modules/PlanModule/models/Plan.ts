import mongoose, { Schema } from "mongoose";
import { IPlanDocument } from "../interfaces/plan.interface";
import { v4 as uuidv4 } from "uuid";

const PlanSchema = new Schema<IPlanDocument>(
  {
    uuid: {
      type: String,
      default: uuidv4, // auto-generate UUID
      unique: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    features: {
      type: [String],
      required: true,
    },

    image: {
      type: String,
      required: true,
    },

    price: {
      type: Number,
      default: 0, // optional
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    order: {
      type: Number,
      default: 1,
    },
  },
  { timestamps: true }
);

const PlanModel = mongoose.model("Plan", PlanSchema);

export default PlanModel;
