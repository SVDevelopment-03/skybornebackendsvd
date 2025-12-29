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
    path: "/feedback",
    request: createFeedbackValidationSchema,
    action: FeedbackController.createFeedback,
    method: "post",
  },

   {
    path: "/feedback/user/:userId",
    request: null,
    action: FeedbackController.getUserFeedback,
    method: "get",
  },
];
