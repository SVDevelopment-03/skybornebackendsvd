import TrainerController from "./TrainerController";
import {
  createTrainerSchema,
  updateTrainerSchema,
  getTrainerByIdSchema,
  deleteTrainerSchema,
  getTrainersSchema,
} from "./TrainerValidators";
const trainerController = new TrainerController();


interface RouteConfig {
  path: string;
  request: any;
  action: (req: any, res: any) => Promise<any>;
  method: "get" | "post" | "put" | "delete";
}
export const TrainerRoute: RouteConfig[] = [
  {
    path: "/trainers",
    request: getTrainersSchema,
    action: trainerController.getAll,
    method: "get",
  },
   {
    path: "/active-trainers",
    request: getTrainersSchema,
    action: trainerController.getAllActive,
    method: "get",
  },
  {
    path: "/trainers/:id",
    request: getTrainerByIdSchema,
    action: trainerController.getById,
    method: "get",
  },
  {
    path: "/create-trainer",
    request: createTrainerSchema,
    action: trainerController.create,
    method: "post",
  },
  {
    path: "/update-trainer/:id",
    request: updateTrainerSchema,
    action: trainerController.update,
    method: "put",
  },
  {
    path: "/delete-trainer/:id",
    request: deleteTrainerSchema,
    action: trainerController.delete,
    method: "delete",
  },
  {
    path: "/trainer/stats",
    request: null,
    action: TrainerController.GetTrainerStats,
    method: "get",
  },
  {
    path: "/trainer/earnings",
    request: null,
    action: TrainerController.GetTrainerEarnings,
    method: "get",
  },
  {
    path: "/trainer/student-growth",
    request: null,
    action: TrainerController.GetStudentGrowth,
    method: "get",
  },
  {
    path: "/trainer/sessions-attendance",
    request: null,
    action: TrainerController.GetSessionsAttendance,
    method: "get",
  },
  {
    path: "/trainer/top-services",
    request: null,
    action: TrainerController.GetTopServices,
    method: "get",
  },
];