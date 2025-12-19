import { UserController } from "./controllers/userController";

export const UserRoute = [
  {
    path: "/me",
    request: null,
    action: UserController.me,
    method: "get",
  },
   {
    path: "/dashboardStats",
    request: null,
    action: UserController.GetDashboardStats,
    method: "get",
  },
     {
    path: "/update-profile",
    request: null,
    action: UserController.updateProfile,
    method: "put",
  },
];
