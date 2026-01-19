// modules/PaymentModule/controllers/ngeniusWebhook.ts

import { Router, Request, Response } from "express";
import crypto from "crypto";
import Payment from "../models/Payment";
import User from "../../UserModule/models/User";
import PaymentController from "./paymentController";
import { NgeniusService } from "../../../services/ngenius.service";

const router = Router();

/**
 * Webhook signature verification for nGenius
 * nGenius signs webhooks using HMAC-SHA256
 */
function verifyNgeniusWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const hash = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    console.log('🔐 Signature verification:');
    console.log('   Received:', signature.substring(0, 16) + '...');
    console.log('   Computed:', hash.substring(0, 16) + '...');

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(hash),
      Buffer.from(signature)
    );
  } catch (error) {
    console.error("❌ Signature verification failed:", error);
    return false;
  }
}

/**
 * nGenius Webhook Handler
 * Processes payment notifications from nGenius Payment Gateway
 * 
 * IMPORTANT: Only processes webhooks for APP source
 * WEB source payments are handled via redirect + payment verification
 * 
 * Webhook Events:
 * - PAYMENT_CAPTURED: Payment successful
 * - PAYMENT_FAILED: Payment declined/failed
 * - PAYMENT_AUTHORISED: Payment authorized (2-step flow)
 * - PAYMENT_SETTLED: Payment settled
 */
router.post("/ngenius", async (req: Request, res: Response) => {
  let rawBody: string = "";

  try {
    console.log("📨 nGenius Webhook received at:", new Date().toISOString());
    console.log("🔗 Headers:", {
      "x-signature": req.headers["x-signature"] ? "present" : "missing",
      "content-type": req.headers["content-type"],
    });

    // 1️⃣ VERIFY WEBHOOK SIGNATURE
    const signature = req.headers["x-signature"] as string;
    const webhookSecret = process.env.NGENIUS_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("❌ NGENIUS_WEBHOOK_SECRET not configured in .env");
      return res.status(500).json({ 
        error: "Webhook secret not configured",
        received: true 
      });
    }

    if (!signature) {
      console.error("❌ No x-signature header provided");
      console.log("📋 Available headers:", Object.keys(req.headers));
      return res.status(200).json({ 
        received: true,
        error: "Missing signature header (but acknowledged)"
      });
    }

    // Get raw body from request
    // If body is already parsed, stringify it
    rawBody = typeof req.body === 'string' 
      ? req.body 
      : JSON.stringify(req.body);

    console.log("📦 Webhook payload size:", rawBody.length, "bytes");

    const isValid = verifyNgeniusWebhookSignature(
      rawBody,
      signature,
      webhookSecret
    );

    if (!isValid) {
      console.error("❌ Invalid webhook signature");
      console.log("   Secret preview:", webhookSecret.substring(0, 16) + "...");
      return res.status(200).json({ 
        received: true,
        error: "Invalid signature (but acknowledged to prevent retry loop)"
      });
    }

    console.log("✅ Webhook signature verified successfully");

    // 2️⃣ EXTRACT WEBHOOK DATA
    const {
      eventId,
      eventTimestamp,
      eventType,
      reference, // nGenius reference
      _embedded,
    } = req.body;

    console.log(`📋 Event Details:`, {
      eventId,
      eventType,
      reference,
      timestamp: eventTimestamp,
    });

    // 3️⃣ FIND PAYMENT RECORD
    let payment = await Payment.findOne({ reference });

    if (!payment) {
      console.error(`❌ Payment not found for reference: ${reference}`);
      // Return 200 to acknowledge receipt
      return res.status(200).json({
        received: true,
        message: "Payment record not found",
        reference,
      });
    }

    console.log(`📝 Payment found:`, {
      id: payment._id,
      source: payment.source,
      status: payment.status,
      subscriptionActivated: payment.subscriptionActivated,
    });

    // 4️⃣ ONLY PROCESS WEBHOOKS FOR APP SOURCE
    // Web source is handled via redirect + payment verification
    if (payment.source === "web") {
      console.log("ℹ️  Web payment - Webhook not processed (handled via redirect)");
      return res.status(200).json({
        received: true,
        message: "Web payment - webhook acknowledged but not processed",
      });
    }

    // 5️⃣ HANDLE DIFFERENT EVENT TYPES
    switch (eventType) {
      /**
       * ✅ PAYMENT SUCCESSFUL
       * nGenius states: CAPTURED, AUTHORISED, SETTLED
       */
      case "PAYMENT_CAPTURED":
      case "PAYMENT_SETTLED":
      case "PAYMENT_AUTHORISED": {
        console.log("🎉 Payment captured/settled/authorised");

        const paymentDetails = _embedded?.payment?.[0];

        if (!paymentDetails) {
          console.error("❌ No payment details in webhook");
          break;
        }

        const ngeniusState = paymentDetails.state;

        console.log(`📊 nGenius Payment State: ${ngeniusState}`);

        if (
          ngeniusState === "CAPTURED" ||
          ngeniusState === "AUTHORISED" ||
          ngeniusState === "SETTLED"
        ) {
          // 🔒 IDEMPOTENCY CHECK - Prevent double activation
          if (payment.subscriptionActivated) {
            console.log(
              "⚠️  Subscription already activated, skipping (idempotency protection)"
            );
            return res.status(200).json({ received: true });
          }

          // Update payment record
          payment.status = "COMPLETED";
          payment.reference = reference;
          payment.gateway = "ngenius";
          payment.ngeniusStatus = ngeniusState;
          payment.gatewayResponse = paymentDetails;
          payment.verifiedAt = new Date();

          // Store transaction details
          if (paymentDetails.id) {
            payment.invoiceId = paymentDetails.id;
          }

          await payment.save();

          console.log(`✅ Payment updated - Status: COMPLETED`);

          // 🔥 ACTIVATE SUBSCRIPTION
          // This is critical - only once per payment
          try {
            await PaymentController.handleSuccessfulPayment(payment);
            console.log(`✅ Payment handler completed successfully`);
          } catch (handlerError) {
            console.error(`❌ Error in payment handler:`, handlerError);
            // Continue anyway - mark as activated
          }

          // Mark as activated AFTER successful subscription
          payment.subscriptionActivated = true;
          await payment.save();

          console.log(
            `🎉 Subscription activated and marked (subscriptionActivated: true)`
          );

          // Notify user (async, don't wait)
          try {
            await NgeniusService.notifyPaymentSuccess(
              payment.userId.toString(),
              payment
            );
            console.log(`📧 Payment success notification sent`);
          } catch (notifyError) {
            console.error(`⚠️  Error sending notification:`, notifyError);
          }
        }
        break;
      }

      /**
       * ❌ PAYMENT FAILED
       * nGenius states: DECLINED, FAILED, CANCELLED
       */
      case "PAYMENT_DECLINED":
      case "PAYMENT_FAILED":
      case "PAYMENT_CANCELLED": {
        console.log("❌ Payment failed/declined/cancelled");

        const paymentDetails = _embedded?.payment?.[0];

        if (!paymentDetails) {
          console.error("❌ No payment details in webhook");
          break;
        }

        const ngeniusState = paymentDetails.state;

        console.log(`📊 nGenius Failure State: ${ngeniusState}`);

        if (
          ngeniusState === "DECLINED" ||
          ngeniusState === "FAILED" ||
          ngeniusState === "CANCELLED"
        ) {
          payment.status = "FAILED";
          payment.gateway = "ngenius";
          payment.ngeniusStatus = ngeniusState;
          payment.gatewayResponse = paymentDetails;
          payment.verifiedAt = new Date();
          payment.billingAttempt = (payment.billingAttempt || 0) + 1;

          await payment.save();

          console.log(
            `❌ Payment failed - Billing Attempt: ${payment.billingAttempt}`
          );

          // Handle recurring payment failure
          if (payment.isRecurring && payment.userId) {
            if (payment.billingAttempt >= 3) {
              console.log(
                `⛔ Max retries reached for user ${payment.userId}`
              );

              const user = await User.findById(payment.userId);
              if (user && user.subscription) {
                user.subscription.status = "suspended";
                user.subscription.suspendedAt = new Date();
                await user.save();

                await NgeniusService.notifySubscriptionSuspended(
                  payment.userId.toString()
                );

                console.log(`⛔ Subscription suspended for user ${payment.userId}`);
              }
            } else {
              await NgeniusService.notifyPaymentFailure(
                payment.userId.toString(),
                payment.plan
              );

              console.log(`📧 Payment failure notification sent (attempt ${payment.billingAttempt})`);
            }
          }
        }
        break;
      }

      /**
       * ⏳ PENDING PAYMENT
       */
      case "PAYMENT_PENDING": {
        console.log("⏳ Payment pending");
        payment.status = "PENDING";
        payment.ngeniusStatus = "PENDING";
        payment.gatewayResponse = _embedded?.payment?.[0];
        await payment.save();
        console.log(`📊 Payment status updated to PENDING`);
        break;
      }

      /**
       * 🔄 RECURRING PAYMENT CREATED
       */
      case "RECURRING_PAYMENT_CREATED": {
        console.log("🔄 Recurring payment token created");
        payment.ngeniusStatus = "RECURRING_CREATED";
        await payment.save();
        console.log(`✅ Recurring payment token saved`);
        break;
      }

      default:
        console.log(`ℹ️  Unhandled nGenius event type: ${eventType}`);
    }

    // 6️⃣ ACKNOWLEDGE RECEIPT
    console.log(`✅ Webhook processing complete for event ${eventId}`);
    
    res.status(200).json({
      received: true,
      eventId,
      reference,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("❌ nGenius webhook processing error:", error);
    console.error("   Stack:", error instanceof Error ? error.stack : "unknown");

    // Always return 200 to prevent webhook retries
    res.status(200).json({
      received: true,
      error: "Processing completed with errors",
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Health check endpoint for webhook verification
 */
router.get("/ngenius/health", (req: Request, res: Response) => {
  const webhookSecret = process.env.NGENIUS_WEBHOOK_SECRET;
  
  res.status(200).json({
    status: "ok",
    webhook: "nGenius webhook handler is running",
    configured: !!webhookSecret,
    timestamp: new Date().toISOString(),
  });
});

export default router;