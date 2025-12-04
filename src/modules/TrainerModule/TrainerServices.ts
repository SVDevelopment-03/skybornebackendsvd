import CoachRepository from "./TrainerRepository";

const _trainerRepo = new CoachRepository();

export default class CoachServices {
  async getAll(payload: Partial<any>) {
    return _trainerRepo.getAllModels(payload);
  }
}
