import validateData from "../../../utils/validation.utils";
import PaymentController from "../controllers/paymentController";
import { paymentWebhookController } from "../controllers/paymentWebhookController";
import { AppleIAPController } from "../controllers/appleIAPController";
import PlanProductController from '../controllers/planProduct.controller';
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
    path: "/payment/create-native-order",
    request: null,
    action: PaymentController.createNativePaymentOrder,
    method: "post",
  },
  {
    path: "/payment/upgrade-order",
    request: null,
    action: PaymentController.upgradePlanOrder,
    method: "post",
  },
  {
    path: "/payment/create-native-upgrade-order",
    request: null,
    action: PaymentController.createNativeUpgradeOrder,
    method: "post",
  },
  {
    path: "/payment/verify-mobile",
    request: null,
    action: PaymentController.verifyMobilePayment,
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
    path: "/payment/admin/recurring-failures",
    action: PaymentController.getAllRecurringPaymentFailures,
    request: null,
    method: "get",
  },
  {
  path: "/payment/admin/export",
  request: null,
  action: PaymentController.exportPaymentsCSV,
  method: "get",
},
  {
    path: "/subscription/:userId/cancel",
    action: PaymentController.cancelSubscription,
    request: null,
    method: "post",
    roles: ["admin"],
  },
  {
    path: "/subscription/:userId/status",
    action: PaymentController.updateCancelSubscriptionStatus,
    request: null,
    method: "patch",
    roles: ["admin"],
  },
  {
    path: "/payment/admin/stats",
    action: PaymentController.getAdminPaymentStats,
    request: null,
    method: "get",
  },
  {
    path: "/payment/card-details",
    action: PaymentController.getCardDetails,
    request: null,
    method: "get",
  },
  {
    path: "/payment/card-portal-session",
    action: PaymentController.createCardPortalSession,
    request: null,
    method: "post",
  },
  {
    path: "/payment/create-card-setup-intent",
    action: PaymentController.createCardSetupIntent,
    request: null,
    method: "post",
  },
  {
    path: "/payment/confirm-card-setup-intent",
    action: PaymentController.confirmCardSetupIntent,
    request: null,
    method: "post",
  },
  {
    path: "/payment/stripe-portal-return",
    action: PaymentController.stripePortalReturn,
    request: null,
    method: "get",
  },
  {
    path: "/payment/stripe-checkout-return",
    action: PaymentController.stripeCheckoutReturn,
    request: null,
    method: "get",
  },
  // ✅ APPLE IN-APP PURCHASE ROUTES
  {
    path: "/payment/apple-iap/validate-receipt",
    action: AppleIAPController.validateAppleReceipt,
    request: null,
    method: "post",
  },
  {
    path: "/payment/apple-iap/restore-purchases",
    action: AppleIAPController.restoreApplePurchases,
    request: null,
    method: "post",
  },
  {
    path: "/payment/apple-iap/products",
    action: AppleIAPController.getAppleProducts,
    request: null,
    method: "get",
  },
  // Plan product management (dynamic product mapping)
  {
    path: '/plans',
    action: PlanProductController.getPlans,
    request: null,
    method: 'get',
  },
  {
    path: '/plans',
    action: PlanProductController.upsertPlan,
    request: null,
    method: 'post',
  },
];
