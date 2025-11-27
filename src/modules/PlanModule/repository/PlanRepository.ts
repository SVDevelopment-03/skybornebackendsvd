import RepositoryAbstract from "../../../abstracts/RepositoryAbstract";
import { IPlanDocument } from "../interfaces/plan.interface";
import PlanModel from "../models/Plan";

export default class PlanRepository extends RepositoryAbstract<IPlanDocument> {
  constructor() {
    super(PlanModel, "Plan");
  }
}
