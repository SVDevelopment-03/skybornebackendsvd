import TestimonialRepository from "../Repository/TestimonialRepository";
const _testimonialRepo = new TestimonialRepository();

export default class TestimonialServices {
  async getAllPlans(payload: Partial<any>) {
    return _testimonialRepo.getAllModels(payload);
  }
}
