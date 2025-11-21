import express from "express";
import { AuthController } from "../modules/AuthModule/controllers/AuthController";
import validateData from "../utils/validation.utils";
import RegisterValidationSchema from "../modules/AuthModule/requests/signupRequest";
import sendOtpValidation, {
  verifyOtpValidation,
} from "../modules/AuthModule/requests/otpRequest";

const authApiRouter = express.Router();

const routes = [
  {
    name: "/signup",
    middleware: validateData(RegisterValidationSchema),
    action: AuthController.signup,
    method: "post",
  },
  {
    name: "/send-otp",
    middleware: validateData(sendOtpValidation),
    action: AuthController.sendOTP,
    method: "post",
  },
  {
    name: "/verify-otp",
    middleware: validateData(verifyOtpValidation),
    action: AuthController.verifyOTP,
    method: "post",
  },
];

routes.map((route) => {
  const middlewares = route?.middleware ?? [];

  switch (route.method) {
    case "get":
      authApiRouter.route(route.name).get(middlewares, route.action);
      break;

    case "post":
      authApiRouter.route(route.name).post(middlewares, route.action);
      break;
  }
});

export default authApiRouter;
