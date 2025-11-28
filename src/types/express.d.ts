import {
  UserRole,
  AuthProvider,
} from "../modules/UserModule/interface/userInterface";

declare global {
  namespace Express {
    interface UserPayload {
      id: string;
      email: string;
      role: UserRole;
    }

    interface Request {
      user?: UserPayload;
    }
  }
}
