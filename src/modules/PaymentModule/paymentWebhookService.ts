import Payment from "./models/Payment";
import UserSubscription from "./models/Subscription";
type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED";


class NgeniusWebhookService {
  static async handleWebhook(data: any) {
    const orderRef = data?.orderReference;

    const payment = await Payment.findOne({ orderRef });

    if (!payment) throw new Error("Order not found");

    // Extract status from webhook
    const paymentStatus = data?._embedded?.payment[0]?.state;

    let formattedStatus:PaymentStatus =
      paymentStatus === "CAPTURED"
        ? "SUCCESS"
        : paymentStatus === "FAILED"
        ? "FAILED"
        : "PENDING";

    // Update payment
    payment.status = formattedStatus;
    payment.gatewayResponse = data;
    await payment.save();

    // If success, activate subscription
    if (formattedStatus === "SUCCESS") {
      await UserSubscription.create({
        userId: payment.userId,
        planName: "Flex Plan",
        renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: "ACTIVE",
      });
    }

    return true;
  }
}

export default NgeniusWebhookService;
