import {
  ConflictError,
  InternalServerError,
  NotFoundError,
} from "./../handlers/httpError.handler";
import { Document } from "mongodb";
import { Model, Error, FilterQuery } from "mongoose";
import { logger } from "../utils/winston.utils";

export interface IPagination {
  page?: number;
  limit?: number;
  sort?: object | string;
  offset?: number;
  pagination?: boolean;
  customFind?: string;
  populate?: string;
  pagingOptions?: object;
}

export default class RepositoryAbstract<T extends Document> {
  protected model: Model<T>;
  private modelName: string;

  constructor(model: Model<T>, modelName: string) {
    this.model = model;
    this.modelName = modelName;
  }

  async getAllModels(payload: Partial<T>) {
    return this.model
      .find(payload)
      .then((data) => data)
      .catch((err) => this.handleErrorMessage(err));
  }

  async countDocuments(payload: FilterQuery<T> = {}) {
    return this.model
      .countDocuments(payload)
      .then((data) => data)
      .catch((err) => this.handleErrorMessage(err));
  }

  async createModel(payload: Partial<T>) {
    const newModel = new this.model(payload);

    return newModel
      .save()
      .then((data) => data)
      .catch((err) => this.handleErrorMessage(err));
  }

  async getOneModel(uuid: string) {
    return this.model
      .findOne({ uuid })
      .orFail()
      .then((data) => data)
      .catch((err) => this.handleErrorMessage(err));
  }

  async updateModel(uuid: string, payload: Partial<T>) {
    return this.model
      .findOneAndUpdate({ uuid }, { ...payload }, { new: true })
      .orFail()
      .then((data) => data)
      .catch((err) => this.handleErrorMessage(err));
  }

  async deleteModel(uuid: string) {
    return this.model
      .findOneAndDelete({ uuid })
      .orFail()
      .then((data) => data)
      .catch((err) => this.handleErrorMessage(err));
  }

  async searchModel(payload: Partial<T>) {
    return this.model
      .findOne(payload)
      .then((data) => data)
      .catch((err) => this.handleErrorMessage(err));
  }

  async searchModels(payload: Partial<T>) {
    return this.model
      .find(payload)
      .then((data) => data)
      .catch((err) => this.handleErrorMessage(err));
  }

  protected handleErrorMessage(err: Error) {
    if (err instanceof Error.DocumentNotFoundError)
      throw new NotFoundError(`${this.modelName} not found`);

    if (typeof err === "string") throw new InternalServerError(err);

    const mongoError = JSON.parse(JSON.stringify(err));
    if (mongoError.code === 11000) {
      throw new ConflictError(
        `${Object.keys(mongoError.keyValue)[0]} is taken`
      );
    }

    if (err.message.includes("validation failed")) {
      throw new Error(err.message);
    }

    logger.error(
      `Error occurred while processing ${this.modelName.toLowerCase()}:`,
      err
    );
    throw new InternalServerError(
      `Unknown error occurred while processing ${this.modelName.toLowerCase()}`
    );
  }

  async getModelCountByDateRange(dateFilter: object) {
    const result = await this.model.aggregate([
      {
        $match: {
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
        },
      },
      { $count: "count" },
    ]);
    return result[0]?.count || 0;
  }
}
