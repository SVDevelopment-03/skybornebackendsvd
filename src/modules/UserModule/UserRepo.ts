import RepositoryAbstract from "../../abstracts/RepositoryAbstract";
import { IUser } from "./interface/userInterface";
import User from "../UserModule/models/User";


export default class UserRepository extends RepositoryAbstract<IUser> {
  constructor() {
    super(User, "User");
  }
}