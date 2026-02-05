// modules/PaymentModule/controllers/PaymentController.ts

import { Request, Response } from "express";
import { NgeniusService } from "../../../services/ngenius.service";
import { StripeService } from "../services/stripe.service";
import Payment from "../models/Payment";
import User from "../../UserModule/models/User";
import { PLAN_CONFIG } from "../../../config/planConfig";
import { PlanType } from "../../UserModule/interface/userInterface";
import { addWelcomeEmailJob } from "../../../services/queues/emailQueue";
import { addInvoiceEmailJob } from "../../../services/queues/invoiceEmailQueue";
import { generateInvoicePDF } from "../../../services/invoiceService";
import { v4 as uuidv4 } from "uuid";
import {
  getPreferredGateway,
  isGatewaySupported,
} from "../../../config/paymentGatewayConfig";
import { getIO } from "../../../config/socket";
import CancelSubscriptionModel from "../../CancelSubscriptionModule/CancelSubscriptionModel";

type PreferedType = "stripe" | "ngenius";

export default class PaymentController {
  /**
   * Initialize both payment gateways
   */
  static initPaymentSystems() {
    NgeniusService.initRecurringPaymentCron();
    StripeService.initialize();
    StripeService.initRecurringPaymentCron();
  }

/**
   * Create payment order with automatic gateway selection
   * For Stripe: Returns checkoutUrl for direct redirect
   * For nGenius: Returns paymentLink for redirect
   * Supports both monthly and yearly billing
   */
  // static async createPaymentOrder(req: Request, res: Response) {
  //   try {
  //     let { amount, currency = "USD", userId, plan, source } = req.body;
  //     //    amount = 0.011
  //     const paymentSource = source === "app" ? "app" : "web";
  //     const userAmount = amount;

  //     // Validation
  //     if (!userId || !plan) {
  //       return res.status(400).json({
  //         success: false,
  //         message: "userId and plan are required",
  //       });
  //     }

  //     const user = await User.findById(userId);
  //     if (!user) {
  //       return res.status(404).json({
  //         success: false,
  //         message: "User not found",
  //       });
  //     }

  //     // Determine preferred gateway based on country
  //     const countryCode = user.country || user.countryCode;
  //     const preferredGateway =
  //       paymentSource == "app" ? "stripe" : getPreferredGateway(countryCode);
  //     // const preferredGateway: PreferedType = "stripe";

  //     if (preferredGateway === "ngenius" && currency === "USD") {
  //       const rate = await getUsdToAedRate();
  //       amount = Number((amount * rate).toFixed(2));
  //       currency = "AED";
  //     }

  //     let paymentData: any;

  //     if (preferredGateway === "ngenius") {
  //       paymentData = await NgeniusService.createOrder(
  //         amount,
  //         currency,
  //         userId,
  //         plan,
  //         userAmount,
  //       );
  //     } else if (preferredGateway === "stripe") {
  //       // For Stripe: Create checkout session (redirect method)
  //       paymentData = await StripeService.createCheckoutSession(
  //         userId,
  //         amount,
  //         currency,
  //         plan,
  //         userAmount,
  //         paymentSource,
  //       );
  //       // Return paymentLink for compatibility with frontend
  //       paymentData.paymentLink = paymentData.checkoutUrl;
  //     } else {
  //       return res.status(400).json({
  //         success: false,
  //         message: "No suitable payment gateway found for your country",
  //       });
  //     }

  //     // Update user with gateway preference
  //     user.gateway = preferredGateway;
  //     user.lastPaymentGateway = preferredGateway;
  //     await user.save();

  //     return res.status(200).json({
  //       success: true,
  //       gateway: preferredGateway,
  //       ...paymentData,
  //       message: "Payment order created successfully",
  //     });
  //   } catch (err) {
  //     console.error("❌ Payment order error:", err);
  //     return res.status(500).json({
  //       success: false,
  //       message: "Failed to create payment order",
  //     });
  //   }
  // }

  static async createPaymentOrder(req: Request, res: Response) {
    try {
      let { amount, currency = "USD", userId, plan, source, billingType = "monthly" } = req.body;
      
      const paymentSource = source === "app" ? "app" : "web";
      const userAmount = amount;

      // Validation
      if (!userId || !plan) {
        return res.status(400).json({
          success: false,
          message: "userId and plan are required",
        });
      }

      // Validate billingType
      if (!["monthly", "yearly"].includes(billingType)) {
        return res.status(400).json({
          success: false,
          message: "billingType must be 'monthly' or 'yearly'",
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Determine preferred gateway based on country
      const countryCode = user.country || user.countryCode;
      const preferredGateway =
        paymentSource == "app" ? "stripe" : getPreferredGateway(countryCode);

      // Apply currency conversion for nGenius if needed
      if (preferredGateway === "ngenius" && currency === "USD") {
        const rate = await getUsdToAedRate();
        amount = Number((amount * rate).toFixed(2));
        currency = "AED";
      }

      let paymentData: any;

      if (preferredGateway === "ngenius") {
        // For nGenius, convert USD to AED if needed
        if (currency === "USD") {
          const rate = await getUsdToAedRate();
          amount = Number((amount * rate).toFixed(2));
          currency = "AED";
        }

        paymentData = await NgeniusService.createOrder(
          amount,
          currency,
          userId,
          plan,
          userAmount,
          billingType, // Pass billing type to nGenius service
        );
      } else if (preferredGateway === "stripe") {
        // For Stripe: Create checkout session (redirect method)
        // Pass billingType to calculate correct pricing
        paymentData = await StripeService.createCheckoutSession(
          userId,
          amount,
          currency,
          plan,
          userAmount,
          paymentSource,
          billingType, // Pass billing type
        );

        // Add paymentLink for frontend compatibility
        paymentData.paymentLink = paymentData.checkoutUrl;

        // console.log("✅ Stripe payment created:", {
        //   orderRef: paymentData.orderRef,
        //   originalAmount: `${userAmount} ${currency}`,
        //   localAmount: `${paymentData.amount} ${paymentData.currency}`,
        // });
      } else {
        return res.status(400).json({
          success: false,
          message: "No suitable payment gateway found for your country",
        });
      }

      // Update user with gateway preference and billing type
      user.gateway = preferredGateway;
      user.lastPaymentGateway = preferredGateway;
      user.billingType = billingType; // Store user's billing type preference
      await user.save();

      return res.status(200).json({
        success: true,
        gateway: preferredGateway,
        billingType,
        ...paymentData,
        message: "Payment order created successfully",
      });
    } catch (err) {
      console.error("❌ Payment order error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to create payment order",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  /**
   * Enhanced verifyStripeCheckout for mobile
   */
  static async verifyStripeCheckout(req: Request, res: Response) {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: "Session ID is required",
        });
      }

      // Get session details from Stripe
      const session = await StripeService.getCheckoutSession(sessionId);

      if (session.payment_status === "paid") {
        // Get or create payment record
        let payment = await Payment.findOne({
          reference: sessionId,
        });

        if (!payment) {
          // Create payment record if it doesn't exist (shouldn't happen normally)
          const metadata = session.metadata as any;
          payment = await Payment.create({
            userId: metadata?.userId,
            orderRef: metadata?.orderRef,
            reference: sessionId,
            amount: metadata?.userAmount || (session.amount_total || 0) / 100,
            localAmount: (session.amount_total || 0) / 100,
            currency: session.currency?.toUpperCase() || "USD",
            plan: metadata?.plan,
            status: "COMPLETED",
            gateway: "stripe",
            paymentIntentId: sessionId,
            gatewayResponse: session,
            verifiedAt: new Date(),
          });
        } else {
          // Update existing payment
          payment.status = "COMPLETED";
          payment.gatewayResponse = session;
          payment.verifiedAt = new Date();
          await payment.save();
        }

        return res.status(200).json({
          success: true,
          message: "✅ Payment verified!",
          status: "SUCCESS",
          orderRef: payment.orderRef,
          amount: payment.amount,
          currency: payment.currency,
          plan: payment.plan,
          gateway: "stripe",
        });
      } else if (session.payment_status === "unpaid") {
        return res.status(200).json({
          success: false,
          message: "Payment is still processing",
          status: "PENDING",
          gateway: "stripe",
        });
      } else {
        return res.status(200).json({
          success: false,
          message: "Payment was not completed",
          status: "FAILED",
          gateway: "stripe",
        });
      }
    } catch (error: any) {
      console.error("❌ Stripe checkout verification error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to verify Stripe payment",
        details: error.message,
      });
    }
  }

  /**
   * Get payment status (works with both gateways)
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
        gateway: payment.gateway,
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
   * Verify payment - routes to appropriate gateway handler
   * Works for both nGenius and Stripe
   */
  static async verifyPayment(req: Request, res: Response, next: any) {
    try {
      const { orderRef, paymentIntentId } = req.body;

      // console.log("this is the paymentintentId:-", paymentIntentId);
      if (paymentIntentId) {
        // ✅ Stripe
        return PaymentController.verifyStripePayment(req, res, next);
      }

      if (orderRef) {
        // ✅ nGenius
        return PaymentController.verifyNgeniusPayment(req, res, next);
      }

      return res.status(400).json({
        success: false,
        error: "orderRef or paymentIntentId is required",
      });
    } catch (error) {
      console.error("❌ Verify Payment Error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to verify payment",
      });
    }
  }
  static async me(req: Request, res: Response) {
    try {
      const userId = req?.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      const user = await User.findById(userId).select("-password");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.json({
        success: true,
        user,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || "Error fetching user profile",
      });
    }
  }

  /**
   * Enhanced verifyNgeniusPayment for mobile
   */
  private static async verifyNgeniusPayment(
    req: Request,
    res: Response,
    next?: any,
  ) {
    try {
      const { orderRef, reference } = req.body;

      if (!orderRef && !reference) {
        return res.status(400).json({
          success: false,
          error: "Order reference is required",
        });
      }

      let payment = await Payment.findOne({
        $or: [{ orderRef }, { reference }],
      });

      if (!payment) {
        return res.status(404).json({
          success: false,
          error: "Payment record not found",
        });
      }

      // Check if already verified
      if (payment.status === "COMPLETED" || payment.subscriptionActivated) {
        return res.status(200).json({
          success: true,
          message: "✅ Payment already verified",
          status: "SUCCESS",
          orderRef: payment.orderRef,
          amount: payment.amount,
          currency: payment.currency,
          plan: payment.plan,
          gateway: "ngenius",
        });
      }

      // Fetch current status from nGenius
      const refToCheck = reference || payment.reference;
      let ngeniusStatus = "PENDING";
      let orderStatus: any = {};

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
          }

        } catch (error) {
          console.error("❌ Error fetching order status:", error);
          ngeniusStatus = "PENDING";
        }
      }

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

      // Update payment
      payment = await Payment.findOneAndUpdate(
        { _id: payment._id },
        {
          status: paymentStatus,
          ngeniusStatus,
          reference: refToCheck,
          gatewayResponse: orderStatus,
          verifiedAt: new Date(),
        },
        { new: true },
      );

      // For mobile, return immediately with status
      // Subscription will be activated by a separate cron job or webhook
      return res.status(200).json({
        success: paymentStatus === "COMPLETED",
        message:
          paymentStatus === "COMPLETED"
            ? "✅ Payment verified!"
            : `Payment ${paymentStatus}`,
        status: paymentStatus,
        orderRef: payment?.orderRef,
        amount: payment?.amount,
        currency: payment?.currency,
        plan: payment?.plan,
        gateway: "ngenius",
      });
    } catch (error: any) {
      console.error("❌ nGenius Verification Error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to verify nGenius payment",
        details: error.message,
      });
    }
  }
  /**
   * Verify Stripe payment - UPDATED TO PREVENT DUPLICATE ACTIVATION
   */
  private static async verifyStripePayment(
    req: Request,
    res: Response,
    next: any,
  ) {
    try {
      const { paymentIntentId } = req.body;

      if (!paymentIntentId) {
        return res.status(400).json({
          success: false,
          error: "Payment intent ID (sessionId) is required",
        });
      }

      let payment = await Payment.findOne({
        reference: paymentIntentId, // session ID is stored in reference
      });

      if (!payment) {
        return res.status(404).json({
          success: false,
          error: "Payment record not found",
        });
      }

      // ✅ FIX: Check if subscription was already activated (subscription status field)
      // This prevents double activation even if payment is marked COMPLETED
      if (payment.subscriptionActivated) {
        return res.status(200).json({
          success: true,
          message: "✅ Payment already processed",
          gateway: payment.gateway,
          orderRef: payment.orderRef,
          status: payment.status,
          plan: payment.plan,
        });
      }

      // Retrieve the session from Stripe
      const session = await StripeService.getCheckoutSession(paymentIntentId);

      let paymentStatus = "PENDING";

      if (session.payment_status === "paid") {
        paymentStatus = "COMPLETED";
      } else if (session.payment_status === "unpaid") {
        paymentStatus = "FAILED";
      }

      const subscriptionId = session.subscription as string | null;

      // ✅ FIX: Mark that subscription is about to be activated
      // This flag prevents activateSubscription from being called twice
      payment = await Payment.findOneAndUpdate(
        { _id: payment._id },
        {
          subscriptionId: subscriptionId || payment.subscriptionId,
          status: paymentStatus,
          subscriptionActivated: true, // ✅ NEW: Flag set BEFORE activation
          gatewayResponse: session,
          verifiedAt: new Date(),
        },
        { new: true },
      );

      return this.activateSubscription(
        payment,
        paymentStatus === "COMPLETED",
        res,
        next,
      );
    } catch (error) {
      console.error("❌ Stripe Verification Error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to verify payment",
      });
    }
  }

  public static async handleSuccessfulPayment(payment: any) {
    return this.activateSubscription(payment, true, null as any, () => {});
  }

/**
   * Activate subscription for both gateways
   * Updates user plan, subscription, classCredits, and totalClassCredits
   * Handles both monthly and yearly billing
   * Only called once per payment flow
   */
  private static async activateSubscription(
    payment: any,
    isSuccessful: boolean,
    res: Response,
    next: any,
  ) {
    try {
      if (isSuccessful) {
        const user = await User.findById(payment?.userId);

        if (!user) {
          console.error("❌ User not found:", payment?.userId);
        } else {
          const plan = payment?.plan as PlanType;
          const billingType = payment?.billingType || "monthly";
          
          // Get base monthly credits
          let newCredits = PLAN_CONFIG[plan];

          // ✅ If yearly billing, multiply credits by 12
          if (billingType === "yearly") {
            newCredits = {
              yoga: (newCredits?.yoga || 0) * 12,
              zumba: (newCredits?.zumba || 0) * 12,
              specialty: (newCredits?.specialty || 0) * 12,
            };
          }

          // Check if user has an existing active plan
          const hasExistingPlan =
            user.plan && user.subscription?.status === "active";

          // Update classCredits
          if (hasExistingPlan) {
            user.classCredits = addCredits(user.classCredits, newCredits);
          } else {
            user.classCredits = newCredits;
          }

          user.overAllclassCredits = addCredits(
            user.overAllclassCredits,
            newCredits,
          );

          // Calculate new totalClassCredits (cumulative total)
          const totalNewCredits =
            (newCredits?.yoga || 0) +
            (newCredits?.zumba || 0) +
            (newCredits?.specialty || 0);

          user.totalClassCredits =
            (user.totalClassCredits || 0) + totalNewCredits;

          // ✅ Calculate subscription end date based on billing type
          const subscriptionDuration = billingType === "yearly"
            ? 365 * 24 * 60 * 60 * 1000  // 1 year
            : 30 * 24 * 60 * 60 * 1000;  // ~1 month

          // Update subscription
          user.subscription = {
            startDate: user.subscription?.startDate || new Date(),
            endDate: new Date(Date.now() + subscriptionDuration),
            status: "active",
          };

          // ✅ CRITICAL: Store billing type and Stripe subscription ID for future reference
          user.billingType = billingType;
          if (payment?.gateway === "stripe" && payment?.subscriptionId) {
            user.stripeSubscriptionId = payment.subscriptionId;
          }

          // Update plan
          user.plan = plan;
          user.onboardingCompleted = true;

          await user.save();

          if (payment?.source === "app") {
            await this.notifyPaymentSuccess(user._id.toString(), payment);
          }

          // Generate and queue invoice
          const invoiceId = `INV-${Date.now()}-${uuidv4()
            .slice(0, 8)
            .toUpperCase()}`;

          try {
            const subscriptionEndDate = new Date(Date.now() + subscriptionDuration);
            
            const invoicePDF = await generateInvoicePDF({
              invoiceId,
              orderRef: payment!.orderRef,
              userId: user._id.toString(),
              userEmail: user.email,
              userName: user.firstName + " " + user.lastName,
              plan: plan.charAt(0).toUpperCase() + plan.slice(1),
              amount: payment!.amount,
              currency: payment!.currency || "USD",
              date: new Date(),
              subscriptionEndDate: subscriptionEndDate,
              paymentMethod: `${payment.gateway.toUpperCase()} Payment Gateway`,
            });

            const invoicePDFBase64 = invoicePDF.toString("base64");

            addInvoiceEmailJob(
              {
                invoiceId,
                orderRef: payment?.orderRef as string,
                userId: user._id.toString(),
                email: user.email,
                userName: user.firstName + " " + user.lastName,
                plan: plan,
                amount: payment!.amount,
                currency: payment!.currency || "USD",
                date: new Date(),
                subscriptionEndDate: subscriptionEndDate,
                paymentMethod: `${payment.gateway.toUpperCase()} Payment Gateway`,
              },
              invoicePDFBase64,
            ).catch((err) =>
              console.error("❌ Invoice queue add failed:", err),
            );

            if (payment) payment.invoiceId = invoiceId;
            await payment?.save();
          } catch (invoiceErr) {
            console.error("❌ Error generating/sending invoice:", invoiceErr);
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
      }

      const subscriptionDuration = payment?.billingType === "yearly"
        ? 365 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;

      return res.status(isSuccessful ? 200 : 400).json({
        success: isSuccessful,
        gateway: payment?.gateway,
        orderRef: payment?.orderRef,
        reference: payment?.reference,
        amount: payment?.amount,
        currency: payment?.currency,
        status: payment?.status,
        plan: payment?.plan,
        billingType: payment?.billingType,
        subscriptionEndDate: new Date(Date.now() + subscriptionDuration),
        message: isSuccessful
          ? `✅ Payment successful! Subscription activated. ${payment?.billingType === "yearly" ? "Annual" : "Monthly"} billing will begin.`
          : `❌ Payment ${payment?.status}`,
      });
    } catch (error) {
      console.error("❌ Subscription Activation Error:", error);
      next(error);
    }
  }

  /**
   * Cancel subscription (works with both gateways)
   */
  // static async cancelSubscription(req: Request, res: Response) {
  //   try {
  //     const { userId } = req.body;

  //     if (!userId) {
  //       return res.status(400).json({
  //         success: false,
  //         message: "userId is required",
  //       });
  //     }

  //     const user = await User.findById(userId);
  //     if (!user) {
  //       return res.status(404).json({
  //         success: false,
  //         message: "User not found",
  //       });
  //     }

  //     const gateway = user.gateway || "ngenius";

  //     if (gateway === "stripe" && user.stripeSubscriptionId) {
  //       await StripeService.cancelSubscription(user.stripeSubscriptionId);
  //     } else {
  //       await NgeniusService.cancelRecurringSubscription(userId);
  //     }

  //     // Update user subscription status
  //     user.subscription = {
  //       ...user.subscription,
  //       status: "cancelled",
  //       cancelledAt: new Date(),
  //     };
  //     await user.save();

  //     return res.status(200).json({
  //       success: true,
  //       message: "Subscription cancelled successfully",
  //     });
  //   } catch (err) {
  //     console.error("❌ Error cancelling subscription:", err);
  //     return res.status(500).json({
  //       success: false,
  //       message: "Failed to cancel subscription",
  //     });
  //   }
  // }

  /**
   * Get subscription status
   */
  static async getSubscriptionStatus(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId).select(
        "subscription plan gateway",
      );

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
          gateway: user.gateway,
          daysRemaining: isActive
            ? Math.ceil(
                ((user?.subscription?.endDate?.getTime?.() ?? 0) - Date.now()) /
                  (1000 * 60 * 60 * 24),
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

  /**
   * Get payment history for a user
   */
  static async getPaymentHistory(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "userId is required",
        });
      }

      const payments = await Payment.find({ userId })
        .sort({ createdAt: -1 })
        .lean();

      if (!payments || payments.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No payments found for this user",
          payments: [],
          total: 0,
        });
      }

      return res.status(200).json({
        success: true,
        payments: payments.map((payment) => ({
          _id: payment._id,
          orderRef: payment.orderRef,
          reference: payment.reference,
          amount: payment.amount,
          localAmount: payment.localAmount,
          currency: payment.currency,
          plan: payment.plan,
          status: payment.status,
          gateway: payment.gateway,
          invoiceId: payment.invoiceId,
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt,
          paymentMethod: payment.reference
            ? `Visa ****${String(payment.reference).slice(-4)}`
            : "N/A",
        })),
        total: payments.length,
      });
    } catch (error) {
      console.error("❌ Error fetching payment history:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch payment history",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Get payment statistics for dashboard
   */
  static async getPaymentStats(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "userId is required",
        });
      }

      const payments = await Payment.find({
        userId,
        status: "COMPLETED",
      }).lean();

      // Calculate total spent
      const totalSpent = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

      // Calculate this month's spending
      const now = new Date();
      const currentMonth = payments.filter((p) => {
        const paymentDate = new Date(p.createdAt);
        return (
          paymentDate.getMonth() === now.getMonth() &&
          paymentDate.getFullYear() === now.getFullYear()
        );
      });
      const thisMonth = currentMonth.reduce(
        (sum, p) => sum + (p.amount || 0),
        0,
      );

      // Get last payment
      const lastPayment = payments.length > 0 ? payments[0] : null;

      // Get payment counts by status
      const allPayments = await Payment.find({ userId }).lean();
      const statusCounts = {
        completed: allPayments.filter((p) => p.status === "COMPLETED").length,
        pending: allPayments.filter((p) => p.status === "PENDING").length,
        failed: allPayments.filter((p) => p.status === "FAILED").length,
        cancelled: allPayments.filter((p) => p.status === "CANCELLED").length,
      };

      return res.status(200).json({
        success: true,
        stats: {
          totalSpent: parseFloat(totalSpent.toFixed(2)),
          thisMonth: parseFloat(thisMonth.toFixed(2)),
          totalTransactions: payments.length,
          lastPaymentAmount: lastPayment ? lastPayment.amount : 0,
          lastPaymentDate: lastPayment ? lastPayment.createdAt : null,
          statusCounts,
        },
      });
    } catch (error) {
      console.error("❌ Error fetching payment stats:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch payment statistics",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Get all payments (Admin only)
   */
  static async getAllPayments(req: Request, res: Response) {
    try {
      const {
        search,
        status,
        gateway,
        country,
        page = 1,
        limit = 10,
      } = req.query;

      const pageNum = parseInt(page as string) || 1;
      const limitNum = parseInt(limit as string) || 10;
      const skip = (pageNum - 1) * limitNum;

      const query: any = { status: "COMPLETED" };

      // Filter by status
      const validStatuses = ["COMPLETED", "PENDING", "FAILED", "CANCELLED"];
      if (
        status &&
        status !== "all" &&
        validStatuses.includes(String(status).toUpperCase())
      ) {
        query.status = String(status).toUpperCase();
      }

      // Filter by gateway
      const validGateways = ["ngenius", "stripe"];
      if (
        gateway &&
        gateway !== "all" &&
        validGateways.includes(String(gateway).toLowerCase())
      ) {
        query.gateway = String(gateway).toLowerCase();
      }

      // Build aggregation pipeline
      const pipeline: any[] = [
        // Match payment filters (status, gateway)
        { $match: { status: "COMPLETED" } },
        // Lookup user data
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        // Unwind user array
        { $unwind: "$user" },
      ];

      // Filter by country if provided
      if (country && country !== "all") {
        const countryCode = String(country).toUpperCase();
        pipeline.push({
          $match: {
            "user.countryCode": countryCode,
          },
        });
      }

      // Add sorting, facet for count and pagination
      pipeline.push(
        { $sort: { createdAt: -1 } },
        {
          $facet: {
            metadata: [{ $count: "total" }],
            data: [{ $skip: skip }, { $limit: limitNum }],
          },
        },
      );

      const result = await Payment.aggregate(pipeline as any);

      const totalCount = result[0]?.metadata[0]?.total || 0;
      let payments = result[0]?.data || [];

      // Apply search filter (client-side after population)
      let filteredPayments = payments;
      if (search) {
        const searchLower = String(search).toLowerCase();
        filteredPayments = payments.filter((payment: any) => {
          const user = payment.user;
          const username = user
            ? `${user.firstName} ${user.lastName || ""}`.trim()
            : "Unknown";

          return (
            user?.email?.toLowerCase().includes(searchLower) ||
            username.toLowerCase().includes(searchLower) ||
            payment._id?.toString().includes(searchLower) ||
            payment.orderRef?.toLowerCase().includes(searchLower) ||
            payment.reference?.toLowerCase().includes(searchLower)
          );
        });
      }

      // Format response
      const formattedPayments = filteredPayments.map((payment: any) => {
        const user = payment.user;
        const username = user
          ? `${user.firstName} ${user.lastName || ""}`.trim()
          : "Unknown";

        return {
          _id: payment._id,
          userId: user._id,
          username,
          email: user?.email || "N/A",
          stripeSubscriptionId: user?.stripeSubscriptionId || "N/A",
          country: user?.country || "N/A",
          orderRef: payment.orderRef,
          reference: payment.reference,
          amount: payment.amount,
          localAmount: payment.localAmount,
          currency: payment.currency,
          plan: payment.plan,
          gateway: payment.gateway,
          status: payment.status,
          invoiceId: payment.invoiceId,
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt,
          paymentMethod: payment.reference
            ? `Visa ****${String(payment.reference).slice(-4)}`
            : "N/A",
        };
      });

      return res.status(200).json({
        success: true,
        payments: formattedPayments,
        total: totalCount,
        filteredCount: filteredPayments.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
        currentFilters: {
          status: status || "all",
          gateway: gateway || "all",
          country: country || "all",
          search: search || "",
        },
      });
    } catch (error) {
      console.error("❌ Error fetching all payments:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch payments",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Export payments as CSV (Admin only)
   */
  static async exportPaymentsCSV(req: Request, res: Response) {
    try {
      const { search, status, country } = req.query;

      // Build aggregation pipeline
      const pipeline: any[] = [
        // Match payment filters (status)
        { $match: { status: "COMPLETED" } },
        // Lookup user data
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        // Unwind user array
        { $unwind: "$user" },
      ];

      // Filter by country if provided
      if (country && country !== "all") {
        const countryCode = String(country).toUpperCase();
        pipeline.push({
          $match: {
            "user.countryCode": countryCode,
          },
        });
      }

      // Add sorting
      pipeline.push({ $sort: { createdAt: -1 } });

      const payments = await Payment.aggregate(pipeline as any);

      // Apply search filter (client-side after population)
      let filteredPayments = payments;
      if (search) {
        const searchLower = String(search).toLowerCase();
        filteredPayments = payments.filter((payment: any) => {
          const user = payment.user;
          const username = user
            ? `${user.firstName} ${user.lastName || ""}`.trim()
            : "Unknown";

          return (
            user?.email?.toLowerCase().includes(searchLower) ||
            username.toLowerCase().includes(searchLower) ||
            payment._id?.toString().includes(searchLower) ||
            payment.orderRef?.toLowerCase().includes(searchLower) ||
            payment.reference?.toLowerCase().includes(searchLower)
          );
        });
      }

      // Generate CSV
      const headers = [
        "Order Reference",
        "Username",
        "Email",
        "Date",
        "Plan",
        "Amount",
        "Currency",
        "Status",
        "Country",
      ];

      const rows = filteredPayments.map((payment: any) => {
        const user = payment.user;
        const username = user
          ? `${user.firstName} ${user.lastName || ""}`.trim()
          : "Unknown";

        const formatDate = (dateString: string) => {
          return new Date(dateString).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
        };

        const formatPlanName = (planName: string) => {
          if (!planName) return "N/A";
          return planName
            .split("-")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
        };

        const formatStatusLabel = (status: string) => {
          return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
        };

        return [
          payment.orderRef || "N/A",
          username,
          user?.email || "N/A",
          formatDate(payment.createdAt),
          formatPlanName(payment.plan),
          payment.amount?.toString() || "0",
          payment.currency || "USD",
          formatStatusLabel(payment.status),
          user?.country || "N/A",
        ];
      });

      // Escape CSV values
      const escapeCSV = (value: string): string => {
        const escaped = String(value).replace(/"/g, '""');
        return escaped.includes(",") ||
          escaped.includes('"') ||
          escaped.includes("\n")
          ? `"${escaped}"`
          : escaped;
      };

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map(escapeCSV).join(",")),
      ].join("\n");

      // Set headers for file download
      const filename = `payments_${new Date().toISOString().split("T")[0]}.csv`;
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );

      return res.status(200).send(csvContent);
    } catch (error) {
      console.error("❌ Error exporting payments CSV:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to export payments CSV",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Get admin dashboard statistics
   */
  static async getAdminPaymentStats(req: Request, res: Response) {
    try {
      const payments = await Payment.find().lean();

      if (!payments || payments.length === 0) {
        return res.status(200).json({
          success: true,
          stats: {
            totalRevenue: 0,
            thisMonth: 0,
            lastPaymentAmount: 0,
            totalCount: 0,
            completedCount: 0,
            failedCount: 0,
            pendingCount: 0,
            successRate: 0,
            averageTransactionValue: 0,
            activeSubscriptions: 0,
            byGateway: {
              ngenius: { count: 0, revenue: 0 },
              stripe: { count: 0, revenue: 0 },
            },
          },
        });
      }

      const completedPayments = payments.filter(
        (p) => p.status === "COMPLETED",
      );
      const failedPayments = payments.filter((p) => p.status === "FAILED");
      const pendingPayments = payments.filter((p) => p.status === "PENDING");

      const totalRevenue = completedPayments.reduce(
        (sum, p) => sum + p.amount,
        0,
      );

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const thisMonth = completedPayments
        .filter((p) => {
          const paymentDate = new Date(p.createdAt);
          return (
            paymentDate.getMonth() === currentMonth &&
            paymentDate.getFullYear() === currentYear
          );
        })
        .reduce((sum, p) => sum + p.amount, 0);

      const lastPaymentAmount =
        completedPayments.length > 0
          ? completedPayments[completedPayments.length - 1].amount
          : 0;

      const successRate =
        payments.length > 0
          ? parseFloat(
              ((completedPayments.length / payments.length) * 100).toFixed(2),
            )
          : 0;

      const averageTransactionValue =
        completedPayments.length > 0
          ? parseFloat((totalRevenue / completedPayments.length).toFixed(2))
          : 0;

      // Get unique active subscriptions
      const activeUsers = await User.countDocuments({
        onboardingCompleted: true,
        role: "user",
      });

      // Revenue by gateway
      const ngeniusPayments = completedPayments.filter(
        (p) => p.gateway === "ngenius",
      );
      const stripePayments = completedPayments.filter(
        (p) => p.gateway === "stripe",
      );

      const ngeniusRevenue = ngeniusPayments.reduce(
        (sum, p) => sum + p.amount,
        0,
      );
      const stripeRevenue = stripePayments.reduce(
        (sum, p) => sum + p.amount,
        0,
      );

      return res.status(200).json({
        success: true,
        stats: {
          totalRevenue: parseFloat(totalRevenue.toFixed(2)),
          thisMonth: parseFloat(thisMonth.toFixed(2)),
          lastPaymentAmount,
          totalCount: payments.length,
          completedCount: completedPayments.length,
          failedCount: failedPayments.length,
          pendingCount: pendingPayments.length,
          successRate,
          averageTransactionValue,
          activeSubscriptions: activeUsers,
          byGateway: {
            ngenius: {
              count: ngeniusPayments.length,
              revenue: parseFloat(ngeniusRevenue.toFixed(2)),
            },
            stripe: {
              count: stripePayments.length,
              revenue: parseFloat(stripeRevenue.toFixed(2)),
            },
          },
        },
      });
    } catch (error) {
      console.error("❌ Error fetching admin stats:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch payment statistics",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // ✅ CORRECTED IMPLEMENTATION

  /**
   * Cancel subscription for a user
   * Works with both Stripe and nGenius gateways
   */
  static async cancelSubscription(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User ID is required",
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Check if user has an active subscription
      if (!user.subscription || user.subscription.status !== "active") {
        return res.status(400).json({
          success: false,
          message: "No active subscription found to cancel",
        });
      }

      const gateway = user.gateway || user.lastPaymentGateway;

      // Cancel based on gateway
      if (gateway === "stripe") {
        // ✅ Use stripeSubscriptionId from user
        if (!user.stripeSubscriptionId) {
          // Fallback: Get from payment record
          const payment = await Payment.findOne({
            userId: user._id,
            gateway: "stripe",
            status: "COMPLETED",
          }).sort({ createdAt: -1 });

          if (!payment?.subscriptionId) {
            return res.status(400).json({
              success: false,
              message: "No active Stripe subscription found",
            });
          }

          await StripeService.cancelSubscription(payment.subscriptionId);
        } else {
          await StripeService.cancelSubscription(user.stripeSubscriptionId);
        }
      } else if (gateway === "ngenius") {
        // For nGenius, mark payments as cancelled
        await Payment.updateMany(
          {
            userId: user._id,
            gateway: "ngenius",
            status: { $in: ["PENDING", "COMPLETED"] },
          },
          {
            status: "CANCELLED",
            cancelledAt: new Date(),
          },
        );
      } else {
        return res.status(400).json({
          success: false,
          message: "Unable to determine payment gateway for cancellation",
        });
      }

      // ✅ Update user subscription status (single operation)
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          "subscription.status": "cancelled",
          "subscription.cancelledAt": new Date(),
          // Optional: Clear the subscription ID on cancel
          stripeSubscriptionId: null,
        },
        { new: true },
      );

      const updateCancelRequest = await CancelSubscriptionModel.findOneAndUpdate(
        { userId },
        {
          subscriptionId: updatedUser?.stripeSubscriptionId || null,
          isCancelled: true,
          cancelledAt: new Date(),
        },
        { new: true }
      );

      return res.status(200).json({
        success: true,
        message: "Subscription cancelled successfully",
        subscription: {
          status: updatedUser?.subscription?.status,
          cancelledAt: updatedUser?.subscription?.cancelledAt,
          plan: updatedUser?.plan,
        },
      });
    } catch (error) {
      console.error("❌ Cancel subscription error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to cancel subscription",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Cancel Stripe subscription
   */
  private static async cancelStripeSubscription(user: any) {
    try {
      if (!user.stripeSubscriptionId) {
        throw new Error(`No Stripe subscription ID found for user ${user._id}`);
      }

      // Cancel the subscription at Stripe
      const cancelledSubscription = await StripeService.cancelSubscription(
        user.stripeSubscriptionId,
      );

      // Mark related payments as cancelled
      await Payment.updateMany(
        {
          userId: user._id,
          gateway: "stripe",
          status: { $in: ["PENDING", "COMPLETED"] },
        },
        {
          status: "CANCELLED",
          cancelledAt: new Date(),
        },
      );

    } catch (error) {
      console.error("❌ Error cancelling Stripe subscription:", error);
      throw error;
    }
  }

  /**
   * Cancel nGenius subscription
   */
  private static async cancelNgeniusSubscription(user: any) {
    try {
      // For nGenius, stop processing recurring charges
      const result = await Payment.updateMany(
        {
          userId: user._id,
          gateway: "ngenius",
          status: { $in: ["PENDING", "COMPLETED"] },
        },
        {
          status: "CANCELLED",
          cancelledAt: new Date(),
          isRecurring: false, // Stop recurring charges
        },
      );

    } catch (error) {
      console.error("❌ Error cancelling nGenius subscription:", error);
      throw error;
    }
  }
  /**
   * Verify mobile payment - Called by React Native app after user closes payment browser
   * Supports both Stripe and nGenius
   */
  static async verifyMobilePayment(req: Request, res: Response) {
    try {
      const { sessionId, orderRef, reference } = req.body;

      // console.log("📱 Mobile payment verification:", {
      //   sessionId,
      //   orderRef,
      //   reference,
      // });

      // Determine which gateway and call appropriate verification
      if (sessionId) {
        // ✅ Stripe verification
        return this.verifyStripeCheckout(req, res);
      } else if (orderRef || reference) {
        // ✅ nGenius verification
        return this.verifyNgeniusPayment(req, res, (err: any) => {
          console.error("nGenius verification error:", err);
          return res.status(500).json({
            success: false,
            error: "nGenius verification failed",
          });
        });
      }

      return res.status(400).json({
        success: false,
        error: "sessionId, orderRef, or reference is required",
      });
    } catch (error) {
      console.error("❌ Mobile verification error:", error);
      return res.status(500).json({
        success: false,
        error: "Payment verification failed",
      });
    }
  }

  private static async notifyPaymentSuccess(userId: string, payment: any) {
    try {
      const io = getIO();
      if (!io) {
        console.warn("⚠️ Socket.io not initialized");
        return;
      }

      io.to(`user-${userId}`).emit("payment-success", {
        success: true,
        userId,
        message: "Payment successful! Your subscription is now active.",
        plan: payment?.plan,
        amount: payment?.amount,
        currency: payment?.currency,
        subscriptionStartDate: new Date(),
        subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

    } catch (error) {
      console.error("❌ Error sending socket notification:", error);
    }
  }
}

// ==================== HELPER FUNCTIONS ====================

async function getUsdToAedRate() {
  try {
    const res = await fetch(
      "https://api.frankfurter.app/latest?amount=1&from=USD&to=AED",
    );
    const data = await res.json();
    return data.rates?.AED || 3.6725;
  } catch (error) {
    console.error("Error fetching exchange rate:", error);
    return 3.6725;
  }
}

// Helper function to add credits (for upgrades)
function addCredits(current: any, additional: any) {
  return {
    yoga: (current?.yoga || 0) + (additional?.yoga || 0),
    zumba: (current?.zumba || 0) + (additional?.zumba || 0),
    specialty: (current?.specialty || 0) + (additional?.specialty || 0),
  };
}
