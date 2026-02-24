import express from "express";
import Stripe from "stripe";
import Payment from "../models/Payment";
import User from "../../UserModule/models/User";
import PaymentController from "./paymentController";

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);

const getSubscriptionId = (invoice: Stripe.Invoice): string | null => {
  const subscription = (invoice as any).subscription;
  if (!subscription) return null;
  return typeof subscription === "string" ? subscription : subscription.id;
};

const getInvoiceAmount = (invoice: Stripe.Invoice): number => {
  const amountInMinor = invoice.amount_paid || invoice.amount_due || 0;
  const currency = (invoice.currency || "usd").toLowerCase();
  if (ZERO_DECIMAL_CURRENCIES.has(currency)) return amountInMinor;
  return amountInMinor / 100;
};

const getInvoicePaymentReference = (invoice: Stripe.Invoice): string => {
  const paymentIntent = (invoice as any).payment_intent;
  if (paymentIntent) return String(paymentIntent);
  return `inv_${invoice.id}`;
};

/**
 * Stripe Webhook (RAW BODY REQUIRED)
 */
router.post(
  "/",
  express.raw({ type: "application/json" }),
  async (req, res) => {

    const sig = req.headers["stripe-signature"] as string;
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error("❌ Stripe signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        /**
         * ✅ MAIN EVENT — Subscription Activation
         */

        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const { orderRef } = session.metadata || {};
          if (!orderRef) break;

          const payment = await Payment.findOne({ orderRef });
          if (!payment) break;

          // 🔒 STRONG IDEMPOTENCY
          // if (payment.subscriptionActivated) break;

          payment.status = "COMPLETED";
          
          payment.reference = session.id;
          payment.subscriptionId = session.subscription as string;
          payment.invoiceId = session.invoice as string;
          payment.gateway = "stripe";
          payment.gatewayResponse = session;
          payment.verifiedAt = new Date();

          await payment.save();
          // if (payment?.source == "web" || !payment?.source) break;

          // 🔥 SINGLE SOURCE OF BUSINESS LOGIC
          await PaymentController.handleSuccessfulPayment(payment);

          break;
        }

        /**


           * ✅ RECURRING SUBSCRIPTION CHARGE SUCCESS
         */
        case "invoice.payment_succeeded": {
          const invoice = event.data.object as Stripe.Invoice;
          const billingReason = invoice.billing_reason || "";
          const isRecurringCycle = billingReason === "subscription_cycle";
          if (!isRecurringCycle) break;

          const subscriptionId = getSubscriptionId(invoice);
          if (!subscriptionId || !invoice.id) break;

          // Webhook idempotency for retries
          const existingInvoicePayment = await Payment.findOne({
            invoiceId: invoice.id,
            gateway: "stripe",
          });
          if (existingInvoicePayment) break;

          const basePayment = await Payment.findOne({
            gateway: "stripe",
            subscriptionId,
          }).sort({ createdAt: -1 });

          const user =
            (basePayment?.userId
              ? await User.findById(basePayment.userId)
              : await User.findOne({ stripeSubscriptionId: subscriptionId }));

          if (!user) break;

          const paidLocalAmount = getInvoiceAmount(invoice);
          const amount =
            basePayment?.localAmount && basePayment.localAmount > 0
              ? Number(
                  ((paidLocalAmount * (basePayment.amount || 0)) /
                    basePayment.localAmount).toFixed(2),
                )
              : paidLocalAmount;

          const recurringPayment = await Payment.create({
            userId: user._id,
            orderRef: `STRIPE-REC-${invoice.id}`,
            reference: getInvoicePaymentReference(invoice),
            amount,
            localAmount: paidLocalAmount,
            plan: basePayment?.plan || user.plan || "unknown",
            currency: (invoice.currency || basePayment?.currency || "USD")
              .toUpperCase(),
            status: "COMPLETED",
            gateway: "stripe",
            billingType: basePayment?.billingType || user.billingType || "monthly",
            invoiceId: invoice.id,
            source: basePayment?.source || "web",
            isRecurring: true,
            recurringCycle: new Date().toISOString().slice(0, 7),
            verifiedAt: new Date(),
            gatewayResponse: invoice,
          });

          // Re-apply subscription benefits for each successful recurring cycle
          await PaymentController.handleSuccessfulPayment(recurringPayment);

          // Keep user subscription dates synced with Stripe invoice period
          const periodEnd =
            invoice.lines?.data?.[0]?.period?.end ||
            (invoice as any).period_end;
          if (periodEnd) {
            await User.findByIdAndUpdate(user._id, {
              "subscription.status": "active",
              "subscription.endDate": new Date(Number(periodEnd) * 1000),
            });
          }

          break;
        }      /**
         * ⚠️ RECURRING PAYMENT FAILED
         */
        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          const subscriptionId = getSubscriptionId(invoice);
          if (!subscriptionId) break;

          const payment = await Payment.findOne({
            gateway: "stripe",
            subscriptionId,
          });
          if (!payment) break;

          payment.status = "FAILED";
          payment.billingAttempt = (payment.billingAttempt || 0) + 1;
          payment.gatewayResponse = invoice;
          await payment.save();

          await User.findByIdAndUpdate(payment.userId, {
            "subscription.status": "suspended",
            "subscription.suspendedAt": new Date(),
          });

          break;
        }

        default:
          console.log("ℹ️ Unhandled Stripe event.");
      }

      res.status(200).json({ received: true });
    } catch (err) {
      console.error("❌ Stripe webhook processing error:", err);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  },
);

export default router;
