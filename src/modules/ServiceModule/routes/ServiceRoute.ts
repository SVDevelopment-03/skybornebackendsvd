import ServiceController from "../controllers/ServiceController";

export const ServiceRoute = [
  {
    path: "/services",
    request: null,
    action: ServiceController.getAllServices,
    method: "get",
  },
];
