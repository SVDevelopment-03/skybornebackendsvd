import { Document, Types } from "mongoose";

export interface IService {
  title: string;
  description: string;
  image: string;
  isActive: boolean;
  order: number;
  uuid: string;
}

export interface IServiceDocument extends IService, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
