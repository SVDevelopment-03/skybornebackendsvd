import { FAQRoute } from "../modules/FAQModule/FAQRoute";
import { MeetingRoute } from "../modules/MeetingModule/MeetingRoute";
import { PaymentApiRoutes } from "../modules/PaymentModule/routes/paymentRoutes";
import { PlanRoute } from "../modules/PlanModule/routes/PlanRoutes";
import { ServiceRoute } from "../modules/ServiceModule/routes/ServiceRoute";
import { TestimonialRoute } from "../modules/TestimonialModule/routes/TestimonialRoute";
const appApiRoutes: any = [
  ...PaymentApiRoutes,
  ...ServiceRoute,
  ...PlanRoute,
  ...TestimonialRoute,
  ...FAQRoute,
  ...MeetingRoute
];

export default appApiRoutes;
