import validateData from "../../../utils/validation.utils";
import PaymentController from "../controllers/paymentController";
import { paymentWebhookController } from "../controllers/paymentWebhookController";
import { CreatePaymentOrderSchema } from "../requests/createPayment";
import {
  GetPaymentStatusSchema,
  GetVerifyStatusSchema,
} from "../requests/getPaymentStatus";

export const PaymentApiRoutes = [
  {
    path: "/payment/create-order",
    request: null,
    action: PaymentController.createPaymentOrder,
    method: "post",
  },
  {
    path: "/payment/webhook",
    request: null,
    action: paymentWebhookController,
    method: "post",
  },
  {
    path: "/payment/status/:orderRef",
    action: PaymentController.getPaymentStatus,
    request: validateData(GetPaymentStatusSchema),
    method: "get",
  },
  {
    path: "/payment/verify-payment",
    action: PaymentController.verifyPayment,
    request: null,
    method: "post",
  },

  {
    path: "/payment/history/:userId",
    action: PaymentController.getPaymentHistory,
    request: null,
    method: "get",
  },
  {
    path: "/payment/stats/:userId",
    action: PaymentController.getPaymentStats,
    request: null,
    method: "get",
  },

{
    path: "/payment/admin/all",
    action: PaymentController.getAllPayments,
    request: null,
    method: "get",
  },
  {
    path: "/payment/admin/stats",
    action: PaymentController.getAdminPaymentStats,
    request: null,
    method: "get",
  },
];
