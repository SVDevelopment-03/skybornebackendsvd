import express, { Request } from "express";
import { MethodNotAllowedError } from "../handlers/httpError.handler";
import appApiRoutes from "./list";
import { catchErrors } from "../handlers/routeError.handler";
import validateData from "../utils/validation.utils";
import { verifyAccessToken } from "../middlewares/verifyToken.middleware";

const router = express.Router();

function methodNotAllow(req: Request) {
  const method = req.method;
  throw new MethodNotAllowedError(
    "You are not allow to use " + method + " for this route"
  );
}
const publicApi = ["/about-us", "/services", "/plans", "/testimonials", "/faq"];

appApiRoutes?.map(({ path, request, method, action }: any) => {
  const isPublicRoute = publicApi.includes(path);

  const middlewares = isPublicRoute
    ? validateData(request)
    : [verifyAccessToken, validateData(request)];

  switch (method) {
    case "get":
      router
        .route(path)
        .get(middlewares, catchErrors(action))
        .all(methodNotAllow);
      break;

    case "post":
      router
        .route(path)
        .post(middlewares, catchErrors(action))
        .all(methodNotAllow);
      break;

    case "put":
      router
        .route(path)
        .put(middlewares, catchErrors(action))
        .all(methodNotAllow);
      break;

    case "delete":
      router
        .route(path)
        .delete(middlewares, catchErrors(action))
        .all(methodNotAllow);
      break;

    default:
      break;
  }
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// router.stack.forEach(function(r:any){
//   if (r.route && r.route.path){
//     console.log(r.route.path)
//   }
// })

export default router;
