import PlanController from "../controllers/PlanController";

export const PlanRoute = [
  {
    path: "/plans",
    request: null,
    action: PlanController.getAllPlans,
    method: "get",
  },
];
