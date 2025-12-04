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

      const { orderRef, paymentLink } = await NgeniusService.createOrder(
        1,
        "INR",
        plan,
        userId
      );

      // const { orderRef, paymentLink } = await NgeniusService.createOrder(
      //   amount,
      //   currency,
      //   plan,
      //   userId
      // );

      return res.status(200).json({
        success: true,
        orderRef,
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
    const { orderRef, reference } = req.body;
    let payment = await Payment.findOne({ orderRef });

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: "Payment record not found",
      });
    }
    let orderStatus: any = {};

    if (reference) {
      try {
        orderStatus = await NgeniusService.getOrderStatus(reference);
        console.log("Order Status from nGenius:", orderStatus);
      } catch (error) {
        console.error("Error fetching order status from nGenius:", error);
      }
    }

    const ngeniusStatus = orderStatus?.status || "PENDING";
    let paymentStatus = "PENDING";

    if (
      ngeniusStatus === "CAPTURED" ||
      ngeniusStatus === "AUTHORISED" ||
      ngeniusStatus === "SALE"
    ) {
      paymentStatus = "COMPLETED";
    } else if (ngeniusStatus === "DECLINED" || ngeniusStatus === "FAILED") {
      paymentStatus = "FAILED";
    } else if (ngeniusStatus === "CANCELLED") {
      paymentStatus = "CANCELLED";
    }

    payment = await Payment.findOneAndUpdate(
      { orderRef },
      {
        status: paymentStatus,
        // ngeniusStatus,
        gatewayResponse: orderStatus,
        updatedAt: new Date(),
      },
      { new: true }
    );
    console.log("ddd");

    const isSuccessful = paymentStatus === "COMPLETED";
    // const isSuccessful = true

    if (isSuccessful) {
      try {
        const user = await User.findById(payment?.userId);

        if (!user) {
          console.error("User not found for payment?:", payment?.userId);
        } else {
          const plan = payment?.plan; // saved earlier

          // Get credits
          const credits = PLAN_CONFIG[plan as PlanType];

          // Assign credits
          user.classCredits = credits;

          // Activate subscription (30 days)
          user.subscription = {
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            status: "active",
          };
          user.onboardingCompleted = true;

          user.plan = plan as PlanType;
          user.onboardingCompleted = true;

          await user.save();
        }
      } catch (err) {
        console.error("Error updating subscription:", err);
        next();
      }
    }

    return res.status(isSuccessful ? 200 : 400).json({
      success: isSuccessful,
      orderRef: payment?.orderRef,
      amount: payment?.amount,
      currency: payment?.currency,
      status: payment?.status,
      ngeniusStatus,
      message: isSuccessful
        ? "Payment successful"
        : `Payment ${paymentStatus.toLowerCase()}`,
    });
  }
}
