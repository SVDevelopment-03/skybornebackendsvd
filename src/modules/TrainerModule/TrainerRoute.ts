import CoachController from "./TrainerController";

export const TrainerRoute = [
  {
    path: "/trainers",
    request: null,
    action: CoachController.getAll,
    method: "get",
  },
];
