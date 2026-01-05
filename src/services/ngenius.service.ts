import axios, { AxiosError } from "axios";
import Payment from "../modules/PaymentModule/models/Payment";
import User from "../modules/UserModule/models/User";
import cron from "node-cron";
import dotenv from 'dotenv';
dotenv.config()

interface ErrorResponse {
  status?: number;
  message?: string;
  errors?: Array<{ detail: string; errorCode?: string }>;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface OrderResponse {
  reference: string;
  links?: Array<{ rel: string; href: string }>;
  _links?: { payment?: { href: string } };
}

interface RecurringPaymentConfig {
  billingCycleDay?: number; // Day of month to charge (1-28)
  maxRetries?: number;
  retryDelayMs?: number;
}

export class NgeniusService {
  private static readonly TIMEOUT = 20000;
  private static readonly DEFAULT_RECURRING_CONFIG: RecurringPaymentConfig = {
    billingCycleDay: 1, // Charge on 1st of every month
    maxRetries: 3,
    retryDelayMs: 5000,
  };

  /**
   * Initialize recurring payment cron job
   * Runs daily to check which subscriptions need to be charged
   */
  static initRecurringPaymentCron() {
    console.log("🔄 Initializing recurring payment cron job...");

    // Run every day at 2 AM
    cron.schedule("0 2 * * *", async () => {
      console.log("⏰ Running recurring payment check...");
      await this.processRecurringPayments();
    });

    console.log("✅ Recurring payment cron job initialized");
  }

  /**
   * Process all monthly recurring payments
   */
  private static async processRecurringPayments() {
    try {
      const config = this.DEFAULT_RECURRING_CONFIG;
      const billingDay = config.billingCycleDay || 1;
      const today = new Date().getDate();

      console.log(`📅 Billing day: ${billingDay}, Today: ${today}`);

      if (today !== billingDay) {
        console.log(`⏭️ Not billing day yet. Next billing on: ${billingDay}`);
        return;
      }

      // Find all active subscriptions
      const activeUsers = await User.find({
        "subscription.status": "active",
        "subscription.endDate": { $gt: new Date() },
      });

      console.log(`📊 Found ${activeUsers.length} active subscriptions`);

      for (const user of activeUsers) {
        try {
          await this.chargeRecurringPayment(user?.id.toString(), user?.plan as string);
        } catch (err) {
          console.error(`❌ Error charging user ${user.id}:`, err);
        }
      }

      console.log("✅ Recurring payment processing completed");
    } catch (error) {
      console.error("❌ Error in processRecurringPayments:", error);
    }
  }

  /**
   * Charge a user for their monthly subscription
   */
  static async chargeRecurringPayment(
    userId: string,
    plan: string,
    retryAttempt = 0,
    config = this.DEFAULT_RECURRING_CONFIG
  ): Promise<void> {
    try {
      const user = await User.findById(userId);

      if (!user || !user.plan) {
        throw new Error(`User ${userId} not found or has no plan`);
      }

      // Get plan amount from config
      const amount = this.getPlanAmount(plan);

      console.log(`💳 Charging user ${userId} for plan ${plan}: ${amount} AED`);

      // Create recurring order
      const { orderRef, reference } = await this.createOrder(
        amount,
        "AED",
        userId,
        plan,
        100
      );

      // Create payment record marked as recurring
      const payment = await Payment.create({
        userId,
        orderRef,
        reference,
        amount,
        currency: "AED",
        plan,
        status: "PENDING",
        isRecurring: true,
        recurringCycle: this.getMonthlyRecurringCycle(),
        billingAttempt: retryAttempt + 1,
        createdAt: new Date(),
      });

      console.log(`📝 Recurring payment created: ${payment._id}`);

      // Verify payment after short delay
      setTimeout(() => {
        this.verifyRecurringPayment(orderRef, reference, userId, plan);
      }, 3000);

    } catch (error) {
      console.error(`❌ Recurring payment charge failed (Attempt ${retryAttempt + 1}):`, error);

      // Retry logic
      if (retryAttempt < (config.maxRetries || 3)) {
        console.log(
          `🔄 Retrying in ${config.retryDelayMs}ms... (Attempt ${retryAttempt + 2}/${(config.maxRetries || 3) + 1})`
        );

        setTimeout(() => {
          this.chargeRecurringPayment(userId, plan, retryAttempt + 1, config);
        }, config.retryDelayMs || 5000);
      } else {
        // Suspend subscription after max retries
        await this.suspendSubscription(userId);
        throw error;
      }
    }
  }

  /**
   * Verify and process recurring payment result
   */
  private static async verifyRecurringPayment(
    orderRef: string,
    reference: string,
    userId: string,
    plan: string
  ) {
    try {
      const payment = await Payment.findOne({ orderRef });

      if (!payment) {
        console.error(`❌ Payment not found: ${orderRef}`);
        return;
      }

      // Fetch status from nGenius
      const orderStatus = await this.getOrderStatus(reference);

      let paymentStatus = "PENDING";

      if (
        orderStatus?._embedded?.payment &&
        orderStatus._embedded.payment.length > 0
      ) {
        const paymentData = orderStatus._embedded.payment[0];
        const ngeniusStatus = paymentData.state;

        if (
          ngeniusStatus === "CAPTURED" ||
          ngeniusStatus === "AUTHORISED" ||
          ngeniusStatus === "SETTLED"
        ) {
          paymentStatus = "COMPLETED";
        } else if (ngeniusStatus === "DECLINED" || ngeniusStatus === "FAILED") {
          paymentStatus = "FAILED";
        }
      }

      // Update payment record
      payment.status = paymentStatus as any;
      payment.gatewayResponse = orderStatus;
      payment.verifiedAt = new Date();
      await payment.save();

      console.log(`✅ Recurring payment verified - Status: ${paymentStatus}`);

      // If successful, update next billing date
      if (paymentStatus === "COMPLETED") {
        const user = await User.findById(userId);
        if (user && user.subscription) {
          user.subscription.endDate = new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          );
          await user.save();

          console.log(`🎉 Subscription renewed for user ${userId}`);
        }
      } else {
        // Notify user of failed payment
        await this.notifyPaymentFailure(userId, plan);
      }
    } catch (error) {
      console.error(`❌ Error verifying recurring payment:`, error);
    }
  }

  /**
   * Suspend subscription due to failed payments
   */
  private static async suspendSubscription(userId: string) {
    try {
      const user = await User.findById(userId);
      if (user && user.subscription) {
        user.subscription.status = "suspended";
        user.subscription.suspendedAt = new Date();
        await user.save();

        console.log(`⛔ Subscription suspended for user ${userId}`);
        await this.notifySubscriptionSuspended(userId);
      }
    } catch (error) {
      console.error(`❌ Error suspending subscription:`, error);
    }
  }

  /**
   * Get monthly recurring cycle identifier (YYYY-MM format)
   */
  private static getMonthlyRecurringCycle(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  /**
   * Get plan amount from config
   */
  private static getPlanAmount(plan: string): number {
    const PLAN_AMOUNTS: { [key: string]: number } = {
      basic: 29.99,
      professional: 79.99,
      enterprise: 199.99,
      // Add your plan amounts here
    };

    return PLAN_AMOUNTS[plan.toLowerCase()] || 50;
  }

  /**
   * Notify user of failed payment
   */
  private static async notifyPaymentFailure(userId: string, plan: string) {
    try {
      const user = await User.findById(userId);
      if (user && user.email) {
        console.log(
          `📧 Sending payment failure notification to ${user.email}`
        );
        // Implement email notification here
        // await sendEmail(user.email, 'Payment Failed', ...);
      }
    } catch (error) {
      console.error(`❌ Error notifying payment failure:`, error);
    }
  }

  /**
   * Notify user of subscription suspension
   */
  private static async notifySubscriptionSuspended(userId: string) {
    try {
      const user = await User.findById(userId);
      if (user && user.email) {
        console.log(
          `📧 Sending suspension notification to ${user.email}`
        );
        // Implement email notification here
        // await sendEmail(user.email, 'Subscription Suspended', ...);
      }
    } catch (error) {
      console.error(`❌ Error notifying suspension:`, error);
    }
  }

  /**
   * Cancel recurring subscription
   */
  static async cancelRecurringSubscription(userId: string): Promise<void> {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      if (user.subscription) {
        user.subscription.status = "cancelled";
        user.subscription.cancelledAt = new Date();
        await user.save();
      }

      console.log(`✅ Recurring subscription cancelled for user ${userId}`);
    } catch (error) {
      console.error(`❌ Error cancelling subscription:`, error);
      throw error;
    }
  }

  static async getAccessToken(): Promise<string> {
    try {
      const tokenURL = `${process.env.NGENIUS_API_URL}/identity/auth/access-token`;
      const apiKey = process.env.NGENIUS_API_KEY;

      if (!apiKey) {
        throw new Error('NGENIUS_API_KEY is not defined');
      }

      if (!process.env.NGENIUS_API_URL) {
        throw new Error('NGENIUS_API_URL is not defined');
      }

      const encodedApiKey = apiKey;

      const response = await axios.post<TokenResponse>(
        tokenURL,
        { grant_type: 'client_credentials' },
        {
          headers: {
            'Content-Type': 'application/vnd.ni-identity.v1+json',
            'Authorization': `Basic ${encodedApiKey}`,
          },
          timeout: this.TIMEOUT,
        }
      );

      if (!response.data?.access_token) {
        throw new Error('No access token in response');
      }

      return response.data.access_token;
    } catch (error) {
      const axiosError = error as AxiosError<ErrorResponse>;

      console.error('❌ nGenius Token Error:');
      console.error('Status:', axiosError.response?.status);
      console.error('Message:', axiosError.message);

      if (axiosError.response?.status === 401) {
        throw new Error('Unauthorized - Invalid API credentials');
      }

      throw error;
    }
  }

  static async createOrder(amount: any, currency: any, userId: string, plan: string,userAmount:number) {
    try {
      if (!process.env.NGENIUS_OUTLET_ID) {
        throw new Error('NGENIUS_OUTLET_ID is not defined');
      }

      const token = await this.getAccessToken();
      const orderRef = "SB-" + Date.now();
      const outletId = process.env.NGENIUS_OUTLET_ID.trim();
      const orderURL = `${process.env.NGENIUS_API_URL}/transactions/outlets/${outletId}/orders`;

      const redirectUrl = process.env.NGENIUS_REDIRECT_URL?.split('?')[0];
      const cancelUrl = process.env.NGENIUS_CANCEL_URL?.split('?')[0];

      const body = {
        action: "SALE",
        amount: {
          currencyCode: currency,
          value: amount * 100,
        },
        merchantAttributes: {
          redirectUrl: redirectUrl,
          cancelUrl: cancelUrl,
        },
        merchantDefinedData: {
          orderRef,
          userId,
          plan,
        },
      };

      const response = await axios.post<OrderResponse>(orderURL, body, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/vnd.ni-payment.v2+json",
          Accept: "application/vnd.ni-payment.v2+json",
        },
        timeout: this.TIMEOUT,
      });

      const data = response.data;
      const paymentLink =
        data?._links?.payment?.href ||
        data?.links?.find((l) => l.rel === "payment")?.href;

      if (!paymentLink) {
        throw new Error('No payment link returned');
      }

      const payment = await Payment.create({
      userId,
      orderRef,
      reference: data.reference, // nGenius reference
      amount:userAmount,
      localAmount:amount,
      currency,
      plan,
      status: "PENDING", // ✅ Payment is pending verification
      paymentLink,
      gatewayResponse: data,
    });


      return {
        orderRef,
        paymentLink,
        reference: data.reference,
      };
    } catch (error) {
      const err = error as AxiosError<ErrorResponse>;
      console.error("❌ Order creation error:", err.message);
      throw err;
    }
  }

  static async getOrderStatus(reference: string): Promise<any> {
    try {
      const token = await this.getAccessToken();
      const outletId = process.env.NGENIUS_OUTLET_ID;

      const statusURL = `${process.env.NGENIUS_API_URL}/transactions/outlets/${outletId}/orders/${reference}`;

      const response = await axios.get(statusURL, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.ni-payment.v2+json",
        },
        timeout: this.TIMEOUT,
      });

      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      console.error("❌ Error fetching order status:", err.message);
      throw error;
    }
  }
}