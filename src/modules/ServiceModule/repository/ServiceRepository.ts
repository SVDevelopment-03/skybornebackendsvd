import RepositoryAbstract from "../../../abstracts/RepositoryAbstract";
import { IServiceDocument } from "../interfaces/service.interface";
import ServiceModel from "../models/Service";

export default class ServiceRepository extends RepositoryAbstract<IServiceDocument> {
  constructor() {
    super(ServiceModel, "Service");
  }
}
