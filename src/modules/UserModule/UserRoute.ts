import { UserController } from "./controllers/userController";

export const UserRoute = [
  {
    path: "/me",
    request: null,
    action: UserController.me,
    method: "get",
  },
];
