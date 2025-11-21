// controllers/paymentController.ts
import { Request, Response } from "express";
import { NgeniusService } from "../../../services/ngenius.service";
import Payment from "../models/Payment";

export default class PaymentController {
  static async createPaymentOrder(req: Request, res: Response) {
    const { amount, currency = "USD", userId } = req.body;
    const { orderRef, paymentLink } = await NgeniusService.createOrder(
      amount,
      currency,
      userId
    );

    return res.status(200).json({
      success: true,
      orderRef,
      paymentLink,
    });
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

}
