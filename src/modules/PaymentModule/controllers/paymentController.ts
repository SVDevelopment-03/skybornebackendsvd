import { Request, Response } from "express";
import { NgeniusService } from "../../../services/ngenius.service";
import Payment from "../models/Payment";
import User from "../../UserModule/models/User";
import { PLAN_CONFIG } from "../../../config/planConfig";
import { PlanType } from "../../UserModule/interface/userInterface";
import { addWelcomeEmailJob } from "../../../services/queues/emailQueue";
import { addInvoiceEmailJob } from "../../../services/queues/invoiceEmailQueue";
import { generateInvoicePDF } from "../../../services/invoiceService";
import { v4 as uuidv4 } from "uuid";

export default class PaymentController {
  /**
   * Initialize recurring payment system (call this in your app startup)
   */
  static initRecurringPayments() {
    NgeniusService.initRecurringPaymentCron();
  }

  /**
   * Create initial payment order (first-time or manual payment)
   */
  static async createPaymentOrder(req: Request, res: Response) {
    try {
      let { amount, currency = "USD", userId, plan } = req.body;

      // Validation
      if (!userId || !plan) {
        return res.status(400).json({
          success: false,
          message: "userId and plan are required",
        });
      }

      // Convert USD to AED if needed
      if (currency === "USD") {
        const rate = await getUsdToAedRate();
        amount = Number((amount * rate).toFixed(2));
        currency = "AED";
      }

      console.log(
        `💳 Creating payment order - Amount: ${amount} ${currency}, Plan: ${plan}`
      );

      // const { orderRef, paymentLink, reference } =
      //   await NgeniusService.createOrder(amount, currency, userId, plan);

      const { orderRef, paymentLink, reference } =
        await NgeniusService.createOrder(0.03, currency, userId, plan);

      // The order is already saved in NgeniusService.createOrder

      return res.status(200).json({
        success: true,
        orderRef,
        reference,
        paymentLink,
        message: "Payment order created successfully",
      });
    } catch (err) {
      console.error("❌ Payment order error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to create payment order",
      });
    }
  }

  /**
   * Get payment status
   */
  static async getPaymentStatus(req: Request, res: Response) {
    try {
      const { orderRef } = req.params;

      const payment = await Payment.findOne({ orderRef });

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: "Payment not found",
        });
      }

      return res.status(200).json({
        success: true,
        status: payment.status,
        orderRef: payment.orderRef,
        isRecurring: payment.isRecurring,
        recurringCycle: payment.recurringCycle,
      });
    } catch (err) {
      console.error("❌ Error getting payment status:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to get payment status",
      });
    }
  }

  /**
   * Verify payment and activate subscription
   * Called after user completes payment on nGenius hosted page
   */
  static async verifyPayment(req: Request, res: Response, next: any) {
    try {
      const { orderRef, reference } = req.body;

      if (!orderRef) {
        return res.status(400).json({
          success: false,
          error: "Order reference is required",
        });
      }

      // Step 1: Find payment in database
      let payment = await Payment.findOne({ orderRef });

      if (!payment) {
        return res.status(404).json({
          success: false,
          error: "Payment record not found",
        });
      }

      console.log(`✅ Payment found: ${payment._id}`);

      // Step 2: Fetch order status from nGenius
      let orderStatus: any = {};
      let ngeniusStatus = "PENDING";

      const refToCheck = reference || payment.reference;

      if (refToCheck) {
        try {
          orderStatus = await NgeniusService.getOrderStatus(refToCheck);

          if (
            orderStatus?._embedded?.payment &&
            orderStatus._embedded.payment.length > 0
          ) {
            const paymentData = orderStatus._embedded.payment[0];
            ngeniusStatus = paymentData.state;
          } else {
            ngeniusStatus = orderStatus?.status || "PENDING";
            console.log(
              "⚠️ No payment in order, using order status:",
              ngeniusStatus
            );
          }

          console.log("✅ Order Status from nGenius:", ngeniusStatus);
        } catch (error) {
          console.error("❌ Error fetching order status:", error);
          ngeniusStatus = "PENDING";
        }
      }

      // Step 3: Map nGenius status to payment status
      let paymentStatus = "PENDING";

      if (
        ngeniusStatus === "CAPTURED" ||
        ngeniusStatus === "AUTHORISED" ||
        ngeniusStatus === "SETTLED"
      ) {
        paymentStatus = "COMPLETED";
      } else if (ngeniusStatus === "DECLINED" || ngeniusStatus === "FAILED") {
        paymentStatus = "FAILED";
      } else if (ngeniusStatus === "CANCELLED") {
        paymentStatus = "CANCELLED";
      }

      // Step 4: Update payment in database
      payment = await Payment.findOneAndUpdate(
        { orderRef },
        {
          status: paymentStatus,
          ngeniusStatus,
          reference: refToCheck,
          gatewayResponse: orderStatus,
          verifiedAt: new Date(),
        },
        { new: true }
      );

      console.log(`✅ Payment updated - Status: ${paymentStatus}`);

      // Step 5: Activate subscription if payment successful
      const isSuccessful = paymentStatus === "COMPLETED";

      if (isSuccessful) {
        try {
          console.log(
            `🎉 Payment successful! Activating subscription for user: ${payment?.userId}`
          );

          const user = await User.findById(payment?.userId);

          if (!user) {
            console.error("❌ User not found:", payment?.userId);
          } else {
            const plan = payment?.plan as PlanType;
            const credits = PLAN_CONFIG[plan];

            // Activate subscription
            user.classCredits = credits;
            user.subscription = {
              startDate: new Date(),
              endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
              status: "active", // This will trigger automatic monthly charges
            };
            user.plan = plan;
            user.onboardingCompleted = true;

            await user.save();

            console.log(
              `✅ Subscription activated - Next billing: ${user.subscription.endDate}`
            );

             // ========== NEW: Generate and Queue Invoice ==========
          const invoiceId = `INV-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;

          try {
            console.log(`📄 Generating invoice: ${invoiceId}`);

            const invoicePDF = await generateInvoicePDF({
              invoiceId,
              orderRef: payment!.orderRef,
              userId: user._id.toString(),
              userEmail: user.email,
              userName: user.firstName + " " + user.lastName,
              plan: plan.charAt(0).toUpperCase() + plan.slice(1),
              amount: payment!.amount,
              currency: payment!.currency,
              date: new Date(),
              subscriptionEndDate:new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              paymentMethod: "nGenius Payment Gateway",
            });

            console.log(`✅ Invoice PDF generated successfully`);

            // Convert PDF buffer to base64 for queue
            const invoicePDFBase64 = invoicePDF.toString("base64");

            // Queue invoice email
            addInvoiceEmailJob(
              {
                invoiceId,
                orderRef: payment?.orderRef as string,
                userId: user._id.toString(),
                email: user.email,
                userName: user.firstName + " " + user.lastName,
                plan: plan,
                amount: payment!.amount,
                currency: payment!.currency,
                date: new Date(), // Will be serialized to ISO string in queue
                subscriptionEndDate:new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Will be serialized to ISO string in queue
                paymentMethod: "nGenius Payment Gateway",
              },
              invoicePDFBase64
            ).catch((err) => console.error("❌ Invoice queue add failed:", err));

            // Save invoice ID to payment record
            if(payment)
            payment.invoiceId = invoiceId;
            await payment?.save();

          } catch (invoiceErr) {
            console.error("❌ Error generating/sending invoice:", invoiceErr);
            // Continue with welcome email even if invoice fails
          }


            addWelcomeEmailJob({
              userId: user._id.toString(),
              email: user.email,
              firstName: user.firstName,
              plan: user.plan,
              subscriptionStartDate: user.subscription.startDate as Date,
              subscriptionEndDate: user.subscription.endDate as Date,
            }).catch((err) => console.error("❌ Queue add failed:", err));
          }
        } catch (err) {
          console.error("❌ Error activating subscription:", err);
          next(err);
        }
      }

      // Step 6: Return response
      return res.status(isSuccessful ? 200 : 400).json({
        success: isSuccessful,
        orderRef: payment?.orderRef,
        reference: payment?.reference,
        amount: payment?.amount,
        currency: payment?.currency,
        status: payment?.status,
        plan: payment?.plan,
        message: isSuccessful
          ? "✅ Payment successful! Subscription activated. Monthly billing will begin."
          : `❌ Payment ${paymentStatus.toLowerCase()}`,
      });
    } catch (error) {
      console.error("❌ Verify Payment Error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to verify payment",
      });
    }
  }

  /**
   * Cancel recurring subscription
   */
  static async cancelSubscription(req: Request, res: Response) {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "userId is required",
        });
      }

      await NgeniusService.cancelRecurringSubscription(userId);

      return res.status(200).json({
        success: true,
        message: "Subscription cancelled successfully",
      });
    } catch (err) {
      console.error("❌ Error cancelling subscription:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to cancel subscription",
      });
    }
  }

  /**
   * Get subscription status
   */
  static async getSubscriptionStatus(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId).select("subscription plan");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const isActive =
        user.subscription?.status === "active" &&
        user.subscription!.endDate &&
        user.subscription.endDate > new Date();

      return res.status(200).json({
        success: true,
        subscription: {
          status: user.subscription?.status,
          startDate: user.subscription?.startDate,
          endDate: user.subscription?.endDate,
          isActive,
          plan: user.plan,
          daysRemaining: isActive
            ? Math.ceil(
                ((user?.subscription?.endDate?.getTime?.() ?? 0) - Date.now()) /
                  (1000 * 60 * 60 * 24)
              )
            : 0,
        },
      });
    } catch (err) {
      console.error("❌ Error getting subscription status:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to get subscription status",
      });
    }
  }
}

async function getUsdToAedRate() {
  try {
    const res = await fetch(
      "https://api.frankfurter.app/latest?amount=1&from=USD&to=AED"
    );
    const data = await res.json();
    return data.rates?.AED || 3.6725;
  } catch (error) {
    console.error("Error fetching exchange rate:", error);
    return 3.6725; // Fallback rate
  }
}
