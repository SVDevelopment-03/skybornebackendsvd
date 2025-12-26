import RepositoryAbstract from "../../abstracts/RepositoryAbstract";
import { Feedback, IFeedback } from "./FeedbackModel";


export default class FeedbackRepository extends RepositoryAbstract<IFeedback> {
  constructor() {
    super(Feedback, "Feedback");
  }
}
