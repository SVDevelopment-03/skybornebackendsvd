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

/**
 * Stripe Webhook (RAW BODY REQUIRED)
 */
router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    console.log("webhook triggered");

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

          console.log("stripe webhook", session?.metadata);
          const { orderRef } = session.metadata || {};
          console.log("this is the order ref:- ", orderRef);
          if (!orderRef) break;

          const payment = await Payment.findOne({ orderRef });
          console.log("this is the payment:- ", payment);
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

          console.log("payment", payment);

          await payment.save();

          if (payment?.source == "web" || !payment?.source) break;

          // 🔥 SINGLE SOURCE OF BUSINESS LOGIC
          await PaymentController.handleSuccessfulPayment(payment);

          break;
        }

        /**
         * ⚠️ RECURRING PAYMENT FAILED
         */
        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;

          // ✅ Stripe typings workaround
          const subscriptionId =
            typeof (invoice as any).subscription === "string"
              ? (invoice as any).subscription
              : (invoice as any).subscription?.id;

          if (!subscriptionId) break;

          const payment = await Payment.findOne({ subscriptionId });
          if (!payment) break;

          payment.status = "FAILED";
          payment.billingAttempt = (payment.billingAttempt || 0) + 1;
          payment.gatewayResponse = invoice;

          await payment.save();

          if (payment.userId) {
            await User.findByIdAndUpdate(payment.userId, {
              "subscription.status": "suspended",
              "subscription.suspendedAt": new Date(),
            });
          }

          break;
        }

        default:
          console.log("ℹ️ Unhandled Stripe event:", event.type);
      }

      res.status(200).json({ received: true });
    } catch (err) {
      console.error("❌ Stripe webhook processing error:", err);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  },
);

export default router;
