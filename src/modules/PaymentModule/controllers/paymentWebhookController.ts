import { Request, Response } from "express";
import NgeniusWebhookService from "../paymentWebhookService";

export const paymentWebhookController = async (req: Request, res: Response) => {
  try {
    await NgeniusWebhookService.handleWebhook(req.body);
    return res.status(200).json({ message: "Webhook processed" });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).json({ message: "Error" });
  }
};
