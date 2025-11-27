import ServiceRepository from "../repository/ServiceRepository";

const _serviceRepo = new ServiceRepository();

export default class ServiceServices {
  async getAllServices(payload: Partial<any>) {
    return _serviceRepo.getAllModels(payload);
  }
}
