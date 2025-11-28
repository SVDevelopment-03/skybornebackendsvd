import { Request, Response } from "express";
import NewsletterSubscriber from "./NewsLetterModel";
import { SubscribeDto } from "./NewsLetterModel";
export default class NewsletterController {
  static async subscribe(req: Request<{}, {}, SubscribeDto>, res: Response) {
    const { email } = req.body;

    const exists = await NewsletterSubscriber.findOne({ email });

    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Email already subscribed",
      });
    }

    await NewsletterSubscriber.create({ email });

    return res.json({
      success: true,
      message: "Subscribed successfully!",
    });
  }
}
