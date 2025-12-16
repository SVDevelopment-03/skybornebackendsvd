import { Request, Response, NextFunction } from "express";
import CountryRepository from "./country.repository";
import { ICountry } from "./country.model"; 
const countryRepository = new CountryRepository();


export class CountryController {


// Get all countries with pagination
  async getAllCountries(req: Request, res: Response, next: NextFunction) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";

    // Calculate skip
    const skip = (page - 1) * limit;

    // Fetch countries with search, pagination, and sorting
    const countries = await countryRepository.searchModels({
      search,
      skip,
      limit,
    });

    // Get total count for pagination info
    const totalCount = await countryRepository.countDocuments(
      search
        ? {
            $or: [
              { name: { $regex: search, $options: "i" } },
              { code: { $regex: search, $options: "i" } },
            ],
          }
        : {}
    );

    const totalPages = Math.ceil(totalCount as number / limit);

    return res.json({
      success: true,
      data: {
        countries,
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
  }

  // Create new country with duplicate prevention
  async createCountry(req: Request, res: Response, next: NextFunction) {
    const { name, code, status = "active" } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: "Country name and code are required",
      });
    }

    // Check if country already exists by name
    const existingByName = await countryRepository.searchModel({
      name: { $regex: `^${name}$`, $options: "i" },
    } );

    if (existingByName) {
      return res.status(409).json({
        success: false,
        message: "Country name already exists",
      });
    }

    // Check if country already exists by code
    const existingByCode = await countryRepository.searchModel({
      code: code.toUpperCase(),
    } as Partial<ICountry>);

    if (existingByCode) {
      return res.status(409).json({
        success: false,
        message: "Country code already exists",
      });
    }

    const countryData: Partial<ICountry> = {
      name,
      code: code.toUpperCase(),
      status: status as "active" | "inactive",
    };

    const country = await countryRepository.createModel(countryData);

    return res.status(201).json({
      success: true,
      message: "Country created successfully",
      data: country,
    });
  }

  // Get country by ID
  async getCountryById(req: Request, res: Response, next: NextFunction) {
    const { countryId } = req.params;

    const country = await countryRepository.getOneModel(countryId);

    return res.json({
      success: true,
      data: country,
    });
  }

  // Update country (full update with duplicate prevention)
  async updateCountry(req: Request, res: Response, next: NextFunction) {
    const { countryId } = req.params;
    const { name, code, status } = req.body;

    // Validate input
    if (!name && !code && !status) {
      return res.status(400).json({
        success: false,
        message: "At least one field (name, code, or status) is required",
      });
    }

    // Validate status if provided
    if (status && !["active", "inactive"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'active' or 'inactive'",
      });
    }

    // Get current country
    const currentCountry :any= await countryRepository.getOneModel(countryId);

    // Check for duplicate name if being updated
    if (name && name !== currentCountry.name) {
      const duplicateName = await countryRepository.searchModel({
        name: { $regex: `^${name}$`, $options: "i" },
        _id: { $ne: countryId },
      } as any);

      if (duplicateName) {
        return res.status(409).json({
          success: false,
          message: "Country name already exists",
        });
      }
    }

    // Check for duplicate code if being updated
    if (code && code.toUpperCase() !== currentCountry.code) {
      const duplicateCode = await countryRepository.searchModel({
        code: code.toUpperCase(),
        _id: { $ne: countryId },
      } as any);

      if (duplicateCode) {
        return res.status(409).json({
          success: false,
          message: "Country code already exists",
        });
      }
    }

    // Build update payload
    const updateData: Partial<ICountry> = {};
    if (name) updateData.name = name;
    if (code) updateData.code = code.toUpperCase();
    if (status) updateData.status = status as "active" | "inactive";

    const updatedCountry = await countryRepository.updateModel(
      countryId,
      updateData
    );

    return res.json({
      success: true,
      message: "Country updated successfully",
      data: updatedCountry,
    });
  }

  // Update country status only
  async updateCountryStatus(req: Request, res: Response, next: NextFunction) {
    const { countryId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'active' or 'inactive'",
      });
    }

    const country = await countryRepository.updateModel(countryId, {
      status: status as "active" | "inactive",
    } as Partial<ICountry>);

    return res.json({
      success: true,
      message: `Country status updated to ${status}`,
      data: country,
    });
  }

  // Delete country
  async deleteCountry(req: Request, res: Response, next: NextFunction) {
    const { countryId } = req.params;

    await countryRepository.deleteModel(countryId);

    return res.json({
      success: true,
      message: "Country deleted successfully",
    });
  }

}