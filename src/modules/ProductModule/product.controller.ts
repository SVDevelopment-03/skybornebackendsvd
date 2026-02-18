import { Request, Response, NextFunction } from "express";
import ProductRepository from "./product.repository";
import { IProduct } from "./product.models";
import mongoose from "mongoose";
import { s3 } from "../../utils/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";

const productRepository = new ProductRepository();

export class ProductController {
  /**
   * Get all products with pagination and search
   */
  async getAllProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || "";
      const categoryId = (req.query.categoryId as string) || "";
      const inventoryId = (req.query.inventoryId as string) || "";
      const status = (req.query.status as string) || "";

      // Calculate skip
      const skip = (page - 1) * limit;

      // Build search query
      let query: any = {};

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ];
      }

      if (categoryId) {
        try {
          query.category = new mongoose.Types.ObjectId(categoryId);
        } catch {
          return res.status(400).json({
            success: false,
            message: "Invalid category ID format",
          });
        }
      }

      if (inventoryId) {
        try {
          query.sku = new mongoose.Types.ObjectId(inventoryId);
        } catch {
          return res.status(400).json({
            success: false,
            message: "Invalid inventory ID format",
          });
        }
      }

      if (status) {
        if (!["Published", "Draft"].includes(status)) {
          return res.status(400).json({
            success: false,
            message: "Status must be 'Published' or 'Draft'",
          });
        }
        query.status = status;
      }

      // Fetch products
      const products = await productRepository.searchModels({
        search,
        skip,
        limit,
        categoryId,
        inventoryId,
      });

      // Get total count for pagination info
      const totalCount = await productRepository.countDocuments(query);
      const totalPages = Math.ceil((totalCount as number) / limit);

      return res.json({
        success: true,
        data: {
          products,
          pagination: {
            currentPage: page,
            totalPages,
            totalCount,
            limit,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all published products (for storefront, no pagination)
   */
  async getAllPublishedProducts(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const products = await productRepository.getAllPublished();

      return res.json({
        success: true,
        data: products,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get product by ID
   */
  async getProductById(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId } = req.params;

      // Validate MongoDB ObjectId
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid product ID format",
        });
      }

      const product = await productRepository.getOneModel(productId);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      return res.json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create new product
   */
  // async createProduct(req: Request, res: Response, next: NextFunction) {
  //   try {
  //     const { name, sku, category, price, stock = 0, status = "Draft", image, description = "" } = req.body;

  //     // Validate required fields
  //     if (!name || !sku || !category || price === undefined || !image) {
  //       return res.status(400).json({
  //         success: false,
  //         message: "Name, SKU ID, category ID, price, and image are required",
  //       });
  //     }

  //     // Validate ObjectIds
  //     if (!mongoose.Types.ObjectId.isValid(sku)) {
  //       return res.status(400).json({
  //         success: false,
  //         message: "Invalid SKU (inventory) ID format",
  //       });
  //     }

  //     if (!mongoose.Types.ObjectId.isValid(category)) {
  //       return res.status(400).json({
  //         success: false,
  //         message: "Invalid category ID format",
  //       });
  //     }

  //     // Validate price
  //     if (typeof price !== "number" || price < 0) {
  //       return res.status(400).json({
  //         success: false,
  //         message: "Price must be a valid positive number",
  //       });
  //     }

  //     // Validate stock
  //     if (stock !== undefined) {
  //       if (!Number.isInteger(stock) || stock < 0) {
  //         return res.status(400).json({
  //           success: false,
  //           message: "Stock must be a valid non-negative integer",
  //         });
  //       }
  //     }

  //     // Validate status
  //     if (!["Published", "Draft"].includes(status)) {
  //       return res.status(400).json({
  //         success: false,
  //         message: "Status must be 'Published' or 'Draft'",
  //       });
  //     }

  //     // Check if SKU (inventory) already exists
  //     const existingSku = await productRepository.skuExists(sku);
  //     if (existingSku) {
  //       return res.status(409).json({
  //         success: false,
  //         message: "Product with this inventory/SKU already exists",
  //       });
  //     }

  //     const productData: Partial<IProduct> = {
  //       name: name.trim(),
  //       sku: new mongoose.Types.ObjectId(sku),
  //       category: new mongoose.Types.ObjectId(category),
  //       price: price ,
  //       stock: stock || 0,
  //       status: status as "Published" | "Draft",
  //       image: image.trim(),
  //       description: description.trim(),
  //     };

  //     const product = await productRepository.createModel(productData);

  //     // Populate before returning
  //     const populatedProduct = await productRepository.getOneModel(product._id.toString());

  //     return res.status(201).json({
  //       success: true,
  //       message: "Product created successfully",
  //       data: populatedProduct,
  //     });
  //   } catch (error) {
  //     next(error);
  //   }
  // }

 async createProduct(req: Request, res: Response, next: NextFunction) {
  try {
    console.log("REQ BODY:", req.body);

    const {
      name,
      sku,
      category,
      price,
      stock = 0,
      status = "Draft",
      description = "",
      imageBase64
    } = req.body;

    // Validate required fields
    if (!name || !sku || !category || price === undefined || !imageBase64) {
      return res.status(400).json({
        success: false,
        message: "Name, SKU, category, price, and image are required",
      });
    }

    // Validate category ID
    if (!mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({ success: false, message: "Invalid category ID" });
    }

    // Convert Base64 string to buffer
    const matches = imageBase64.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ success: false, message: "Invalid imageBase64 format" });
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, "base64");

    // AWS S3 upload
    const key = `products/${Date.now()}.${mimeType.split("/")[1]}`;
    await s3.send(new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }));

    const imageUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    // --- SKU conditional ObjectId ---
    let skuId: mongoose.Types.ObjectId;
    if (mongoose.Types.ObjectId.isValid(sku)) {
      skuId = new mongoose.Types.ObjectId(sku);
    } else {
      skuId = new mongoose.Types.ObjectId(); // generate new ObjectId if string
    }

    const productData: Partial<IProduct> = {
      name: name.trim(),
      sku: skuId,
      category: mongoose.Types.ObjectId.isValid(category) ? new mongoose.Types.ObjectId(category) : undefined,
      price: Number(price),
      stock: Number(stock),
      status: status as "Published" | "Draft",
      image: imageUrl,
      description: description.trim(),
    };

    const product = await productRepository.createModel(productData);
    const populatedProduct = await productRepository.getOneModel(product._id.toString());

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: populatedProduct,
    });
  } catch (error) {
    next(error);
  }
}


  /**
   * Update product
   */
  async updateProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId } = req.params;
      const { name, sku, category, price, stock, status, image, description } = req.body;

      // Validate MongoDB ObjectId
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid product ID format",
        });
      }

      // Validate input
      if (
        !name &&
        !sku &&
        !category &&
        price === undefined &&
        stock === undefined &&
        !status &&
        !image &&
        !description
      ) {
        return res.status(400).json({
          success: false,
          message: "At least one field is required for update",
        });
      }

      // Get current product
      const currentProduct: any = await productRepository.getOneModel(productId);

      if (!currentProduct) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      // Validate price if provided
      if (price !== undefined) {
        if (typeof price !== "number" || price < 0) {
          return res.status(400).json({
            success: false,
            message: "Price must be a valid positive number",
          });
        }
      }

      // Validate stock if provided
      if (stock !== undefined) {
        if (!Number.isInteger(stock) || stock < 0) {
          return res.status(400).json({
            success: false,
            message: "Stock must be a valid non-negative integer",
          });
        }
      }

      // Validate status if provided
      if (status && !["Published", "Draft"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Status must be 'Published' or 'Draft'",
        });
      }

      // Validate SKU ID if provided
      if (sku) {
        if (!mongoose.Types.ObjectId.isValid(sku)) {
          return res.status(400).json({
            success: false,
            message: "Invalid SKU (inventory) ID format",
          });
        }

        // Check for duplicate SKU if being updated
        const skuString = currentProduct.sku._id.toString();
        if (sku !== skuString) {
          const duplicateSku = await productRepository.skuExists(sku);
          if (duplicateSku) {
            return res.status(409).json({
              success: false,
              message: "Product with this inventory/SKU already exists",
            });
          }
        }
      }

      // Validate category ID if provided
      if (category) {
        if (!mongoose.Types.ObjectId.isValid(category)) {
          return res.status(400).json({
            success: false,
            message: "Invalid category ID format",
          });
        }
      }

      // Build update payload
      const updateData: Partial<IProduct> = {};
      if (name) updateData.name = name.trim();
      if (sku) updateData.sku = new mongoose.Types.ObjectId(sku);
      if (category) updateData.category = new mongoose.Types.ObjectId(category);
      if (price !== undefined) updateData.price = parseFloat(price);
      if (stock !== undefined) updateData.stock = stock;
      if (status) updateData.status = status as "Published" | "Draft";
      if (image) updateData.image = image.trim();
      if (description !== undefined) updateData.description = description.trim();

      const updatedProduct = await productRepository.updateModel(productId, updateData);

      return res.json({
        success: true,
        message: "Product updated successfully",
        data: updatedProduct,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update product status only
   */
  async updateProductStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId } = req.params;
      const { status } = req.body;

      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid product ID format",
        });
      }

      if (!status) {
        return res.status(400).json({
          success: false,
          message: "Status is required",
        });
      }

      if (!["Published", "Draft"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Status must be 'Published' or 'Draft'",
        });
      }

      const product = await productRepository.updateModel(productId, {
        status: status as "Published" | "Draft",
      } as Partial<IProduct>);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      return res.json({
        success: true,
        message: `Product status updated to ${status}`,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete product
   */
  async deleteProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid product ID format",
        });
      }

      const product = await productRepository.getOneModel(productId);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      await productRepository.deleteModel(productId);

      return res.json({
        success: true,
        message: "Product deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get products by category ID
   */
  async getProductsByCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { categoryId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID format",
        });
      }

      const products = await productRepository.getByCategory(categoryId);

      return res.json({
        success: true,
        data: products,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get products by inventory (SKU) ID
   */
  async getProductsBySku(req: Request, res: Response, next: NextFunction) {
    try {
      const { inventoryId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(inventoryId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid inventory ID format",
        });
      }

      const products = await productRepository.getBySku(inventoryId);

      return res.json({
        success: true,
        data: products,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get products by status
   */
  async getProductsByStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = req.params;

      if (!["Published", "Draft"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Status must be 'Published' or 'Draft'",
        });
      }

      const products = await productRepository.getByStatus(
        status as "Published" | "Draft"
      );

      return res.json({
        success: true,
        data: products,
      });
    } catch (error) {
      next(error);
    }
  }

    /**
   * Get products image upload url 
   */
  // async getProductImageUploadUrl(req: Request, res: Response) {
  //   const { fileName, fileType } = req.query;

  //   if (!fileName || !fileType) {
  //     return res.status(400).json({ message: "fileName & fileType required" });
  //   }

  //   // ✅ products folder + unique name
  //   const key = `products/${Date.now()}-${fileName}`;

  //   const uploadUrl = await getUploadUrl(
  //     key,
  //     fileType as string
  //   );

  //   return res.json({ uploadUrl });
  // }
}