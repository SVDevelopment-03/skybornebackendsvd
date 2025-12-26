import { AdminRoutes } from "../modules/AdminModule/admin.route";
import { ConsultationRoute } from "../modules/ConsultationModule/ConsultationRoute";
import { CountryRoute } from "../modules/CountryModule/country.route";
import { FAQRoute } from "../modules/FAQModule/FAQRoute";
import { FeedbackRoute } from "../modules/FeedbackModule/FeedbackRoute";
import { MeetingRoute } from "../modules/MeetingModule/MeetingRoute";
import { NewsLetterRoute } from "../modules/NewsLetterModule.ts/NewsLetterRoute";
import { PaymentApiRoutes } from "../modules/PaymentModule/routes/paymentRoutes";
import { PlanRoute } from "../modules/PlanModule/routes/PlanRoutes";
import { RegionRoute } from "../modules/RegionModule/region.routes";
import { ServiceRoute } from "../modules/ServiceModule/routes/ServiceRoute";
import { TestimonialRoute } from "../modules/TestimonialModule/routes/TestimonialRoute";
import { TrainerRoute } from "../modules/TrainerModule/TrainerRoute";
import { UserRoute } from "../modules/UserModule/UserRoute";
const appApiRoutes: any = [
  ...PaymentApiRoutes,
  ...ServiceRoute,
  ...PlanRoute,
  ...TestimonialRoute,
  ...FAQRoute,
  ...MeetingRoute,
  ...ConsultationRoute,
  ...NewsLetterRoute,
  ...TrainerRoute,
  ...UserRoute,
  ...CountryRoute,
  ...AdminRoutes,
  ...RegionRoute,
  ...FeedbackRoute,
];

export default appApiRoutes;
