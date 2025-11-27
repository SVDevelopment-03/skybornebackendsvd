import { Document } from "mongoose";

export interface IPlan {
  name: string;
  description?: string;
  features: string[];
  image: string;
  price?: number;
  isActive: boolean;
  order: number;
  uuid:string;
}

export interface IPlanDocument extends IPlan, Document {}
