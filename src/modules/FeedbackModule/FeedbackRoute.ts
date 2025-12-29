import FeedbackController from "./FeedbackController";
import { createFeedbackValidationSchema } from "./FeedbackRequest";

export const FeedbackRoute = [
  {
    path: "/feedback",
    request: null,
    action: FeedbackController.getAllFeedback,
    method: "get",
  },
  {
    path: "/trainer-feedback",
    request: null,
    action: FeedbackController.getAllTrainerFeedback,
    method: "get",
  },
  {
    path: "/feedback",
    request: createFeedbackValidationSchema,
    action: FeedbackController.createFeedback,
    method: "post",
  },
];
