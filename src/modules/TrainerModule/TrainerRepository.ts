import CoachesModel, { ICoach } from './TrainerModel';
import RepositoryAbstract from "../../abstracts/RepositoryAbstract";

export default class CoachRepository extends RepositoryAbstract<ICoach> {
  constructor() {
    super(CoachesModel, "Coach");
  }
}
