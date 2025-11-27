import FAQRepository from "./FAQRepository";

const _faqRepo = new FAQRepository();

export default class FAQServices {
  async getAll(payload: Partial<any>) {
    return _faqRepo.getAllModels(payload);
  }
}
