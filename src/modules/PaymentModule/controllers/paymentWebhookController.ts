import NgeniusWebhookService from "../paymentWebhookService";
import { Request, Response } from "express";


export const paymentWebhookController = async (req:Request, res:Response) => {
  try {
    const data = req.body;

    console.log("N-Genius Webhook Received:", data);

    await NgeniusWebhookService.handleWebhook(data);

    return res.status(200).json({ message: "Webhook processed" });
  } catch (err) {
    console.error("Webhook Error:", err);
    return res.status(500).json({ message: "Webhook error" });
  }
};
