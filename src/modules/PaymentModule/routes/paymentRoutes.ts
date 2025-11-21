import validateData from "../../../utils/validation.utils";
import PaymentController from "../controllers/paymentController";
import { paymentWebhookController } from "../controllers/paymentWebhookController";
import { CreatePaymentOrderSchema } from "../requests/createPayment";
import { GetPaymentStatusSchema } from "../requests/getPaymentStatus";

export const PaymentApiRoutes = [
  {
    name: "/payment/create-order",
    middleware: validateData(CreatePaymentOrderSchema),
    action: PaymentController.createPaymentOrder,
    method: "post",
  },
  {
    name: "/payment/webhook",
    middleware: null,
    action: paymentWebhookController,
    method: "post",
  },
  {
    name: "/payment/status/:orderRef",
    action: PaymentController.getPaymentStatus,
    middleware: validateData(GetPaymentStatusSchema),
    method: "get",
  },
];
