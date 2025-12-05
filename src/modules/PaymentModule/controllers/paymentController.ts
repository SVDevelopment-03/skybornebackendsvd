/* eslint-disable @typescript-eslint/no-explicit-any */

import { Request, Response } from "express";
import { NgeniusService } from "../../../services/ngenius.service";
import Payment from "../models/Payment";
import User from "../../UserModule/models/User";
import { PLAN_CONFIG } from "../../../config/planConfig";
import { PlanType } from "../../UserModule/interface/userInterface";

export default class PaymentController {
static async createPaymentOrder(req: Request, res: Response) {
  try {
    const { amount, currency = "AED", userId, plan } = req.body;

    const { orderRef, paymentLink, reference } = await NgeniusService.createOrder(
      amount,
      currency,
      userId,
      plan
    );

    return res.status(200).json({
      success: true,
      orderRef,
      reference,
      paymentLink,
    });
  } catch (err) {
    console.error("Payment order error:", err);
    return res.status(500).json({
      success: false,
      message: "Payment order failed",
    });
  }
}
  static async getPaymentStatus(req: Request, res: Response) {
    const { orderRef } = req.params;
    const record = await Payment.findOne({ orderRef });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    return res.status(200).json({
      success: true,
      status: record.status,
    });
  }

static async verifyPayment(req: Request, res: Response, next: any) {
  try {
    const { orderRef, reference } = req.body;

    if (!orderRef) {
      console.error("❌ orderRef is required but not provided");
      return res.status(400).json({
        success: false,
        error: "Order reference is required",
      });
    }

    // Step 1: Find payment in database
    let payment = await Payment.findOne({ orderRef });

    if (!payment) {
      console.error("❌ Payment not found for orderRef:", orderRef);
      return res.status(404).json({
        success: false,
        error: "Payment record not found",
      });
    }

    console.log("✅ Payment found:", payment._id);

    // Step 2: Fetch order status from nGenius
    let orderStatus: any = {};
    let ngeniusStatus = "PENDING";

    const refToCheck = reference || payment.reference;

    if (refToCheck) {
      try {
        orderStatus = await NgeniusService.getOrderStatus(refToCheck);
        

        if (orderStatus?._embedded?.payment && orderStatus._embedded.payment.length > 0) {
          const paymentData = orderStatus._embedded.payment[0];
          ngeniusStatus = paymentData.state; // e.g., "CAPTURED", "FAILED", "DECLINED"
          
        } else {
          // Fallback to order status if no payment found
          ngeniusStatus = orderStatus?.status || "PENDING";
          console.log("⚠️ No payment in order, using order status:", ngeniusStatus);
        }
        
        console.log("✅ Order Status from nGenius:", ngeniusStatus);
      } catch (error) {
        console.error("❌ Error fetching order status from nGenius:", error);
        ngeniusStatus = "PENDING";
      }
    }

    // Step 3: Map nGenius payment state to your payment status
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

    console.log("Mapped Payment Status:", paymentStatus);

    // Step 4: Update payment in database
    payment = await Payment.findOneAndUpdate(
      { orderRef },
      {
        status: paymentStatus,
        ngeniusStatus,
        reference: refToCheck,
        gatewayResponse: orderStatus,
        updatedAt: new Date(),
      },
      { new: true }
    );

    console.log("✅ Payment updated in DB - Status:", paymentStatus);

    // Step 5: If successful, update user subscription
    const isSuccessful = paymentStatus === "COMPLETED";

    if (isSuccessful) {
      try {
        console.log("🎉 Payment successful! Processing subscription for user:", payment?.userId);
        
        const user = await User.findById(payment?.userId);

        if (!user) {
          console.error("❌ User not found:", payment?.userId);
        } else {
          const plan = payment?.plan as PlanType;
          const credits = PLAN_CONFIG[plan];

          user.classCredits = credits;
          user.subscription = {
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            status: "active",
          };
          user.plan = plan;
          user.onboardingCompleted = true;

          await user.save();
          console.log("✅ User subscription updated successfully");
        }
      } catch (err) {
        console.error("❌ Error updating subscription:", err);
        next(err);
      }
    } else {
      console.log("⚠️ Payment not successful - Status:", paymentStatus);
    }

    // Step 6: Return response
    return res.status(isSuccessful ? 200 : 400).json({
      success: isSuccessful,
      orderRef: payment?.orderRef,
      reference: payment?.reference,
      amount: payment?.amount,
      currency: payment?.currency,
      status: payment?.status,
      ngeniusStatus,
      plan: payment?.plan,
      message: isSuccessful
        ? "✅ Payment successful! Your subscription is now active."
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
}
