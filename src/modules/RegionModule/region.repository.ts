import RepositoryAbstract from "../../abstracts/RepositoryAbstract";
import regionModel, { IRegion } from "./region.model";

export default class RegionRepository extends RepositoryAbstract<IRegion> {
  constructor() {
    super(regionModel, "Region");
  }

  /**
   * Get all active regions (for dropdown/selector purposes)
   */
  async getAllActiveRegions() {
    return this.model
      .find({ status: "active" })
      .sort({ createdAt: 1 })
      .then((data) => data)
      .catch((err) => this.handleErrorMessage(err));
  }
}