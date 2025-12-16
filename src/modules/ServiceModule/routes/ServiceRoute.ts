import ServiceController from "../controllers/ServiceController";

export const ServiceRoute = [
    // UPDATE STATUS (isActive) - Must be before generic :serviceId routes
  {
    path: "/services/:serviceId/status",
    request: null,
    action: ServiceController.updateServiceStatus,
    method: "patch",
  },
  // CREATE SERVICE
  {
    path: "/services",
    request: null,
    action: ServiceController.createService,
    method: "post",
  },

  // GET ALL SERVICES (Admin)
  {
    path: "/services",
    request: null,
    action: ServiceController.getAllServices,
    method: "get",
  },

  // GET ONLY ACTIVE SERVICES (Public / Frontend)
  {
    path: "/services/active",
    request: null,
    action: ServiceController.getActiveServices,
    method: "get",
  },



  // UPDATE SERVICE
  {
    path: "/services/:serviceId",
    request: null,
    action: ServiceController.updateService,
    method: "put",
  },

  // DELETE SERVICE
  {
    path: "/services/:serviceId",
    request: null,
    action: ServiceController.deleteService,
    method: "delete",
  },
];