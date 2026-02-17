import ProductModel, { IProduct } from "./product.models";
import mongoose from "mongoose";

interface SearchOptions {
  search?: string;
  skip?: number;
  limit?: number;
  categoryId?: string;
  inventoryId?: string;
}

class ProductRepository {
  /**
   * Create a new product
   */
  async createModel(data: Partial<IProduct>): Promise<IProduct> {
    const product = new ProductModel(data);
    return await product.save();
  }

  /**
   * Get all products with pagination and search
   */
  async searchModels(options: SearchOptions): Promise<IProduct[]> {
    const { search = "", skip = 0, limit = 10, categoryId, inventoryId } = options;

    const query: any = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (categoryId) {
      query.category = new mongoose.Types.ObjectId(categoryId);
    }

    if (inventoryId) {
      query.sku = new mongoose.Types.ObjectId(inventoryId);
    }

    return await ProductModel.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate({
        path: "category",
        select: "name _id",
      })
      .populate({
        path: "sku",
        select: "sku code _id",
      })
      .exec();
  }

  /**
   * Search for a single product
   */
  async searchModel(query: any): Promise<IProduct | null> {
    return await ProductModel.findOne(query)
      .populate({
        path: "category",
        select: "name _id",
      })
      .populate({
        path: "sku",
        select: "sku code _id",
      })
      .exec();
  }

  /**
   * Get total count of documents matching criteria
   */
  async countDocuments(query: any = {}): Promise<number> {
    return await ProductModel.countDocuments(query).exec();
  }

  /**
   * Get product by ID
   */
  async getOneModel(id: string): Promise<IProduct | null> {
    return await ProductModel.findById(id)
      .populate({
        path: "category",
        select: "name _id",
      })
      .populate({
        path: "sku",
        select: "sku code _id",
      })
      .exec();
  }

  /**
   * Update product
   */
  async updateModel(
    id: string,
    data: Partial<IProduct>
  ): Promise<IProduct | null> {
    return await ProductModel.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    })
      .populate({
        path: "category",
        select: "name _id",
      })
      .populate({
        path: "sku",
        select: "sku code _id",
      })
      .exec();
  }

  /**
   * Delete product
   */
  async deleteModel(id: string): Promise<void> {
    await ProductModel.findByIdAndDelete(id).exec();
  }

  /**
   * Get all products by status
   */
  async getByStatus(status: "Published" | "Draft"): Promise<IProduct[]> {
    return await ProductModel.find({ status })
      .sort({ createdAt: -1 })
      .populate({
        path: "category",
        select: "name _id",
      })
      .populate({
        path: "sku",
        select: "sku code _id",
      })
      .exec();
  }

  /**
   * Get products by category ID
   */
  async getByCategory(categoryId: string): Promise<IProduct[]> {
    return await ProductModel.find({
      category: new mongoose.Types.ObjectId(categoryId),
    })
      .sort({ createdAt: -1 })
      .populate({
        path: "category",
        select: "name _id",
      })
      .populate({
        path: "sku",
        select: "sku code _id",
      })
      .exec();
  }

  /**
   * Get products by inventory (SKU) ID
   */
  async getBySku(inventoryId: string): Promise<IProduct[]> {
    return await ProductModel.find({
      sku: new mongoose.Types.ObjectId(inventoryId),
    })
      .sort({ createdAt: -1 })
      .populate({
        path: "category",
        select: "name _id",
      })
      .populate({
        path: "sku",
        select: "sku code _id",
      })
      .exec();
  }

  /**
   * Get all published products (for storefront)
   */
  async getAllPublished(): Promise<IProduct[]> {
    return await ProductModel.find({ status: "Published" })
      .sort({ createdAt: -1 })
      .populate({
        path: "category",
        select: "name _id",
      })
      .populate({
        path: "sku",
        select: "sku code _id",
      })
      .exec();
  }

  /**
   * Check if SKU inventory exists
   */
  async skuExists(skuId: string): Promise<boolean> {
    const count = await ProductModel.countDocuments({
      sku: new mongoose.Types.ObjectId(skuId),
    }).exec();
    return count > 0;
  }

  /**
   * Check if category exists
   */
  async categoryExists(categoryId: string): Promise<boolean> {
    const count = await ProductModel.countDocuments({
      category: new mongoose.Types.ObjectId(categoryId),
    }).exec();
    return count > 0;
  }

  /**
   * Bulk update products
   */
  async updateMany(
    query: any,
    updateData: Partial<IProduct>
  ): Promise<{ modifiedCount: number }> {
    const result = await ProductModel.updateMany(query, updateData).exec();
    return { modifiedCount: result.modifiedCount };
  }

  /**
   * Get product with populated references
   */
  async getWithPopulate(id: string): Promise<IProduct | null> {
    return await ProductModel.findById(id)
      .populate({
        path: "category",
        select: "name description _id",
      })
      .populate({
        path: "sku",
        select: "sku code status _id",
      })
      .exec();
  }
}

export default ProductRepository;