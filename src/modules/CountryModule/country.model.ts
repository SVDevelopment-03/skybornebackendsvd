import mongoose from "mongoose";

export interface ICountry {
  _id: mongoose.Types.ObjectId;
  name: string;
  code: string;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

const countrySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    }
  },
  {
    timestamps: true,
  }

  );

  export default mongoose.model<ICountry>("Country", countrySchema);
  