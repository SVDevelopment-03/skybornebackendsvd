//============================================================================
// Backend: TrainerService.ts
// ============================================================================
import CoachRepository from "./TrainerRepository";
import CoachModel from "./TrainerModel";

const _trainerRepo = new CoachRepository();

export default class CoachServices {
  async getAll(payload: {
    search?: string;
    skip: number;
    limit: number;
    filter:string
  }) {
    const trainers = await _trainerRepo.searchModels(payload);
    const total = await _trainerRepo.countDocuments(
      payload.search
        ? {
            $or: [
              { name: { $regex: payload.search, $options: "i" } },
              { specialization: { $regex: payload.search, $options: "i" } },
            ],
          }
        : {}
    );
    return { trainers, total };
  }

// ============================================================================
// TrainerServices.ts - Corrected getAllActive method
// ============================================================================


// Service method
  async getAllActive(payload: {
    search?: string;
    skip: number;
    limit: number;
    filter:string;
    isActive?:boolean
  }) {
    payload.isActive = true;
    const trainers = await _trainerRepo.searchModels(payload);
    const total = await _trainerRepo.countDocuments(
      payload.search
        ? {
            $or: [
              { name: { $regex: payload.search, $options: "i" } },
              { specialization: { $regex: payload.search, $options: "i" } },
            ],
          }
        : {}
    );
    return { trainers, total };
  }



  async getById(id: string) {
    return _trainerRepo.getOneModel(id);
  }

  async create(data: any) {
    return _trainerRepo.createModel(data);
  }

  async update(id: string, data: any) {
    return _trainerRepo.updateModel(id, data);
  }

  async delete(id: string) {
    return _trainerRepo.deleteModel(id);
  }
}
