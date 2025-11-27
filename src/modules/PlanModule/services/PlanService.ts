import PlanRepository from "../repository/PlanRepository";

const _planRepo = new PlanRepository();

export default class PlanServices {
  async getAllPlans(payload: Partial<any>) {
    return _planRepo.getAllModels(payload);
  }
}
