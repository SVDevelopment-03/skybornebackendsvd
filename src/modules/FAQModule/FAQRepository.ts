import RepositoryAbstract from "../../abstracts/RepositoryAbstract";
import { IFaq } from "./FAQInterface";
import FAQModel from "./FAQModel";

export default class FAQRepository extends RepositoryAbstract<IFaq> {
  constructor() {
    super(FAQModel, "Faq");
  }
}
