import { ConsultationController } from "./ConsultationController";
import { consultationSchema } from "./ConsultationRequest";

export const ConsultationRoute = [
  {
    path: "/consultation",
    request: consultationSchema,
    action: ConsultationController.createConsultation,
    method: "post",
  },
  {
    path: "/consultation",
    request: null,
    action: ConsultationController.getConsultation,
    method: "post",
  },
];
