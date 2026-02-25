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
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw",
  "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
]);

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const getSubscriptionId = (invoice: Stripe.Invoice): string | null => {
  // Stripe API v2 (2025+): subscription nested under parent.subscription_details
  const parent = (invoice as any).parent;
  if (parent?.subscription_details?.subscription) {
    const sub = parent.subscription_details.subscription;
    return typeof sub === "string" ? sub : sub.id;
  }
  // Legacy fallback
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

const getInvoiceTransactionId = (invoice: Stripe.Invoice): string | null => {
  // Stripe API v2 (2025+): payment_intent lives on line items, not top-level
  const lines = (invoice as any).lines?.data;
  if (lines?.length > 0) {
    for (const line of lines) {
      const pi = line.payment_intent;
      if (pi) return typeof pi === "string" ? pi : pi.id;
    }
  }
  // Legacy fallback: top-level payment_intent
  const paymentIntent = (invoice as any).payment_intent;
  if (paymentIntent) {
    return typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id;
  }
  // Legacy fallback: top-level charge
  const charge = (invoice as any).charge;
  if (charge) {
    return typeof charge === "string" ? charge : charge.id;
  }
  return null;
};

const getInvoicePaymentReference = (invoice: Stripe.Invoice): string => {
  const txn = getInvoiceTransactionId(invoice);
  if (txn) return txn;
  return `inv_${invoice.id}`;
};

const getCheckoutTransactionId = (
  session: Stripe.Checkout.Session,
): string | null => {
  const paymentIntent = session.payment_intent;
  if (!paymentIntent) return null;
  return typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id;
};

// ─── WEBHOOK ROUTER ───────────────────────────────────────────────────────────

router.post(
  "/",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      console.log("🔔 Stripe webhook received:", {
        eventId: event.id,
        type: event.type,
        livemode: event.livemode,
      });
    } catch (err: any) {
      console.error("❌ Stripe signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {

        // ── Subscription Activation ───────────────────────────────────────
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const { orderRef } = session.metadata || {};
          console.log("📦 checkout.session.completed:", {
            eventId: event.id,
            orderRef,
            sessionId: session.id,
            subscriptionId: session.subscription || null,
            invoiceId: session.invoice || null,
          });

          if (!orderRef) {
            console.warn("⚠️ Missing orderRef in checkout session metadata");
            break;
          }

          const payment = await Payment.findOne({ orderRef });
          if (!payment) {
            console.warn("⚠️ Payment not found for orderRef:", orderRef);
            break;
          }

          payment.status = "COMPLETED";
          const transactionId = getCheckoutTransactionId(session) || session.id;

          payment.reference = session.id;
          payment.subscriptionId = session.subscription as string;
          payment.transactionId = transactionId;
          payment.paymentIntentId = transactionId || payment.paymentIntentId;
          payment.invoiceId = session.invoice as string;
          payment.gateway = "stripe";
          payment.gatewayResponse = session;
          payment.verifiedAt = new Date();

          await payment.save();
          console.log("✅ Payment updated from checkout session:", {
            paymentId: String(payment._id),
            orderRef: payment.orderRef,
            subscriptionId: payment.subscriptionId,
            transactionId: payment.transactionId,
            status: payment.status,
          });

          await PaymentController.handleSuccessfulPayment(payment);
          console.log("🚀 Subscription activation handler executed:", {
            paymentId: String(payment._id),
            orderRef: payment.orderRef,
          });

          break;
        }

        // ── Recurring Subscription Charge Success ─────────────────────────
        case "invoice.payment_succeeded": {
          const invoice = event.data.object as Stripe.Invoice;
          const billingReason = invoice.billing_reason || "";
          const isRecurringCycle = billingReason === "subscription_cycle";

          console.log("🧾 invoice.payment_succeeded:", {
            eventId: event.id,
            invoiceId: invoice.id,
            billingReason,
            isRecurringCycle,
          });

          if (!isRecurringCycle) {
            console.log("ℹ️ Skipping non-recurring invoice.payment_succeeded");
            break;
          }

          const subscriptionId = getSubscriptionId(invoice);
          if (!subscriptionId || !invoice.id) {
            console.warn("⚠️ Missing subscriptionId or invoice.id in succeeded invoice");
            break;
          }

          const transactionId = getInvoiceTransactionId(invoice);

          // Idempotency: skip if already recorded
          const existingInvoicePayment = await Payment.findOne({
            invoiceId: invoice.id,
            gateway: "stripe",
          });
          if (existingInvoicePayment) {
            console.log("ℹ️ Duplicate recurring invoice webhook ignored:", {
              invoiceId: invoice.id,
              existingPaymentId: String(existingInvoicePayment._id),
            });
            break;
          }

          const basePayment = await Payment.findOne({
            gateway: "stripe",
            subscriptionId,
          }).sort({ createdAt: -1 });

          console.log("🔎 Base payment lookup:", {
            subscriptionId,
            found: Boolean(basePayment),
            basePaymentId: basePayment?._id?.toString() || null,
          });

          const user = basePayment?.userId
            ? await User.findById(basePayment.userId)
            : await User.findOne({ stripeSubscriptionId: subscriptionId });

          if (!user) {
            console.warn("⚠️ User not found for recurring invoice:", {
              subscriptionId,
              invoiceId: invoice.id,
            });
            break;
          }

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
            currency: (invoice.currency || basePayment?.currency || "USD").toUpperCase(),
            status: "COMPLETED",
            gateway: "stripe",
            billingType: basePayment?.billingType || user.billingType || "monthly",
            invoiceId: invoice.id,
            subscriptionId,
            transactionId: transactionId || undefined,
            paymentIntentId: transactionId || undefined,
            source: basePayment?.source || "web",
            isRecurring: true,
            recurringCycle: new Date().toISOString().slice(0, 7),
            verifiedAt: new Date(),
            gatewayResponse: invoice,
          });

          console.log("✅ Recurring payment created:", {
            paymentId: String(recurringPayment._id),
            invoiceId: invoice.id,
            subscriptionId,
            transactionId,
            amount: recurringPayment.amount,
            currency: recurringPayment.currency,
          });

          await PaymentController.handleSuccessfulPayment(recurringPayment);
          console.log("🚀 Recurring subscription handler executed:", {
            paymentId: String(recurringPayment._id),
            userId: String(user._id),
          });

          const periodEnd =
            invoice.lines?.data?.[0]?.period?.end ||
            (invoice as any).period_end;

          if (periodEnd) {
            await User.findByIdAndUpdate(user._id, {
              "subscription.status": "active",
              "subscription.endDate": new Date(Number(periodEnd) * 1000),
            });
            console.log("📅 User subscription endDate updated:", {
              userId: user._id.toString(),
              periodEndUnix: Number(periodEnd),
            });
          }

          break;
        }

        // ── Recurring Payment Failed ───────────────────────────────────────
        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          const subscriptionId = getSubscriptionId(invoice);
          const transactionId = getInvoiceTransactionId(invoice);

          console.log("❌ invoice.payment_failed:", {
            eventId: event.id,
            invoiceId: invoice.id,
            subscriptionId,
            transactionId,
            billingReason: invoice.billing_reason || null,
          });

          if (!subscriptionId) {
            console.warn("⚠️ Missing subscriptionId in failed invoice");
            break;
          }

          const payment = await Payment.findOne({
            gateway: "stripe",
            subscriptionId,
          });

          if (!payment) {
            console.warn("⚠️ No base payment found for failed invoice:", {
              subscriptionId,
              invoiceId: invoice.id,
            });
            break;
          }

          payment.status = "FAILED";
          payment.transactionId = transactionId || payment.transactionId;
          payment.billingAttempt = (payment.billingAttempt || 0) + 1;
          payment.gatewayResponse = invoice;
          await payment.save();

          console.log("🛑 Payment marked FAILED:", {
            paymentId: String(payment._id),
            orderRef: payment.orderRef,
            billingAttempt: payment.billingAttempt,
            subscriptionId: payment.subscriptionId,
          });

          await User.findByIdAndUpdate(payment.userId, {
            "subscription.status": "suspended",
            "subscription.suspendedAt": new Date(),
          });

          console.log("👤 User subscription suspended:", {
            userId: payment.userId.toString(),
          });

          break;
        }

        default:
          console.log("ℹ️ Unhandled Stripe event:", {
            eventId: event.id,
            type: event.type,
          });
      }

      console.log("✅ Stripe webhook processed:", {
        eventId: event.id,
        type: event.type,
      });
      res.status(200).json({ received: true });
    } catch (err) {
      console.error("❌ Stripe webhook processing error:", err);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  },
);

export default router;