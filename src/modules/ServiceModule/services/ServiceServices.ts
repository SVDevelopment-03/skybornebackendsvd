import ServiceRepository from "../repository/ServiceRepository";

const _serviceRepo = new ServiceRepository();

export default class ServiceServices {
  async getAllServices(payload: Partial<any>) {
    return _serviceRepo.getAllModels(payload);
  }

  async getActiveServices() {
    return _serviceRepo.getAllModels({ isActive: true });
  }

  async createService(payload: any) {
    return _serviceRepo.createModel(payload);
  }

  async updateService(serviceId: string, payload: any) {
    return _serviceRepo.updateModel(serviceId, payload);
  }

  async updateServiceStatus(serviceId: string, isActive: boolean) {
    return _serviceRepo.updateModel(serviceId, { isActive });
  }

  async deleteService(serviceId: string) {
    return _serviceRepo.deleteModel(serviceId);
  }
}
