import express from "express";
import Stripe from "stripe";
import { EcomStripeService } from "../services/EcomStripe.service"; 
import EcomPayment from "../modules/EcomPaymentModule/Ecompayment.model";

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover" as any,
});

// ⚠️ IMPORTANT: Use a SEPARATE webhook secret for ecom
// Set STRIPE_ECOM_WEBHOOK_SECRET in your .env
const webhookSecret = process.env.STRIPE_ECOM_WEBHOOK_SECRET!;

/**
 * POST /webhooks/ecom-stripe
 * Handles Stripe events for ECOM product purchases ONLY.
 * Completely separate from subscription webhook at /webhooks/stripe
 */


router.post(
  "/",
  async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    let event: Stripe.Event;



    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

      console.log("aaaa", event);
      
    } catch (err: any) {
      console.error("❌ [EcomWebhook] Signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {

        /**
         * ✅ MAIN EVENT — One-time payment completed
         * This only fires for mode: "payment" sessions (ecom),
         * not mode: "subscription" sessions (handled by other webhook)
         */
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;

          // ── Guard: only process ecom sessions ────────────────────────────
          if (session.metadata?.type !== "ecom") {
            console.log("ℹ️ [EcomWebhook] Skipping non-ecom session");
            break;
          }

          // ── Guard: only paid sessions ─────────────────────────────────────
          if (session.payment_status !== "paid") {
            console.log("ℹ️ [EcomWebhook] Session not paid yet, skipping");
            break;
          }

          // ── Idempotency: skip if already processed ────────────────────────
          const existing = await EcomPayment.findOne({
            orderRef: session.metadata?.orderRef,
          });
          if (existing && existing.status === "succeeded") {
            console.log("ℹ️ [EcomWebhook] Already processed:", session.metadata?.orderRef);
            break;
          }

          console.log("🔵 [EcomWebhook] Fulfilling order:", session.metadata?.orderRef);
          await EcomStripeService.fulfillEcomOrder(session.id);

          break;
        }

        /**
         * ⚠️ Payment failed (e.g. card declined on checkout)
         */
        case "payment_intent.payment_failed": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;

          // Only update ecom payments
          await EcomPayment.findOneAndUpdate(
            { stripePaymentIntentId: paymentIntent.id },
            { status: "failed" }
          );

          console.log("⚠️ [EcomWebhook] Payment failed:", paymentIntent.id);
          break;
        }

        default:
          console.log("ℹ️ [EcomWebhook] Unhandled event:", event.type);
      }

      return res.status(200).json({ received: true });
    } catch (err: any) {
      console.error("❌ [EcomWebhook] Processing error:", err.message);
      return res.status(500).json({ error: "Webhook processing failed" });
    }
  }
);

export default router;