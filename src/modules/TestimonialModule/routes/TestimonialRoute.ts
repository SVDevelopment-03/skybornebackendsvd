import TestimonialController from "../controllers/TestimonialController";

export const TestimonialRoute = [
  {
    path: "/testimonials",
    request: null,
    action: TestimonialController.getAllPlans,
    method: "get",
  },
];
