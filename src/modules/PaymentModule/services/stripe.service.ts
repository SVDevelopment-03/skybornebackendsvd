// services/stripe.service.ts

import Stripe from "stripe";
import Payment from "../models/Payment";
import User from "../../UserModule/models/User";
import cron from "node-cron";
import dotenv from "dotenv";

dotenv.config();

interface RecurringPaymentConfig {
  billingCycleDay?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

export class StripeService {
  private static stripe: Stripe;
  private static readonly DEFAULT_RECURRING_CONFIG: RecurringPaymentConfig = {
    billingCycleDay: 1,
    maxRetries: 3,
    retryDelayMs: 5000,
  };

  /**
   * Initialize Stripe with API key
   */
  static initialize() {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not defined");
    }
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }

  /**
   * Get billing interval based on billing type
   */
  private static getBillingInterval(billingType: "monthly" | "yearly" = "monthly"): "month" | "year" {
    return billingType === "yearly" ? "year" : "month";
  }

  /**
   * Get subscription duration in milliseconds
   */
  private static getSubscriptionDuration(billingType: "monthly" | "yearly" = "monthly"): number {
    return billingType === "yearly" 
      ? 365 * 24 * 60 * 60 * 1000  // 1 year
      : 30 * 24 * 60 * 60 * 1000;  // ~1 month
  }

  /**
   * Get all subscriptions for a customer
   */
  static async getCustomerSubscriptions(
    customerId: string,
  ): Promise<Stripe.Subscription[]> {
    try {
      const subscriptions = await this.stripe.subscriptions.list({
        customer: customerId,
        status: "active",
      });

      return subscriptions.data;
    } catch (error) {
      console.error("❌ Error fetching customer subscriptions:", error);
      throw error;
    }
  }

  /**
   * Create a checkout session for payment (REDIRECT METHOD)
   * User is redirected directly to Stripe Checkout
   * Supports both monthly and yearly billing
   */
  static async createCheckoutSession(
    userId: string,
    amount: number,
    currency: string,
    plan: string,
    userAmount: number,
    source: "app" | "web" = "web",
    billingType: "monthly" | "yearly" = "monthly",
  ): Promise<{
    checkoutUrl: string;
    sessionId: string;
    reference: string;
  }> {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error("User not found");

      const orderRef = `STR-${Date.now()}`;
      const billingInterval = this.getBillingInterval(billingType);
      
      const successUrl =
        source === "app"
          ? "skybornedrop://payment-processing" 
          : `${process.env.FRONTEND_URL}/payment-success?sessionId={CHECKOUT_SESSION_ID}`;

      const cancelUrl =
        source === "app"
          ? "skybornedrop://payment-processing"
          : `${process.env.FRONTEND_URL}/payment-failed`;

      // Create checkout session
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "subscription",
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
              product_data: {
                name: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
                description: `${plan} - ${billingType === "yearly" ? "Annual" : "Monthly"} Subscription`,
              },
              unit_amount: Math.round(amount * 100), // cents
              recurring: {
                interval: billingInterval,
                interval_count: billingType === "yearly" ? 1 : 1,
              },
            },
            quantity: 1,
          },
        ],
        customer_email: user.email,
        metadata: {
          userId,
          plan,
          orderRef,
          userAmount: userAmount.toString(),
          billingType,
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
      } as Stripe.Checkout.SessionCreateParams);

      // Create payment record
      const payment = await Payment.create({
        userId,
        orderRef,
        reference: session.id,
        amount: userAmount,
        localAmount: amount,
        currency,
        plan,
        billingType,
        status: "PENDING",
        gateway: "stripe",
        paymentIntentId: session.id,
        gatewayResponse: {
          sessionId: session.id,
          checkoutUrl: session.url,
        },
        source: source,
      });

      return {
        checkoutUrl: session.url || "",
        sessionId: session.id,
        reference: session.id,
      };
    } catch (error) {
      console.error("❌ Error creating checkout session:", error);
      throw error;
    }
  }

  /**
   * Get checkout session details
   */
  static async getCheckoutSession(
    sessionId: string,
  ): Promise<Stripe.Checkout.Session> {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);
      return session;
    } catch (error) {
      console.error("❌ Error retrieving session:", error);
      throw error;
    }
  }

  /**
   * Fulfill order after successful payment (webhook handler)
   */
  static async fulfillOrder(sessionId: string) {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status === "paid") {
        // Get billing type from metadata
        const billingType = (session.metadata?.billingType as "monthly" | "yearly") || "monthly";
        
        // Update payment record
        const payment = await Payment.findOneAndUpdate(
          { paymentIntentId: sessionId },
          {
            status: "COMPLETED",
            billingType,
            verifiedAt: new Date(),
          },
          { new: true },
        );

        if (payment) {
          // Update user subscription
          const user = await User.findById(payment.userId);
          if (user) {
            const subscriptionDuration = this.getSubscriptionDuration(billingType);
            user.subscription = {
              ...user.subscription,
              startDate: new Date(),
              endDate: new Date(Date.now() + subscriptionDuration),
              status: "active",
              // plan: payment.plan as any,
            };
            await user.save();
          }

          return payment;
        }
      }
    } catch (error) {
      console.error("❌ Error fulfilling order:", error);
      throw error;
    }
  }

  /**
   * Get or create a Stripe customer for a user
   */
  static async getOrCreateCustomer(user: any): Promise<string> {
    try {
      // Check if user already has a Stripe customer ID
      if (user.stripeCustomerId) {
        return user.stripeCustomerId;
      }

      // Create new customer
      const customer = await this.stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: {
          userId: user._id.toString(),
        },
      });

      // Save customer ID to user
      user.stripeCustomerId = customer.id;
      await user.save();

      return customer.id;
    } catch (error) {
      console.error("❌ Error creating Stripe customer:", error);
      throw error;
    }
  }

  /**
   * Create a payment intent for one-time payment
   */
  static async createPaymentIntent(
    userId: string,
    amount: number, // in cents
    currency: string,
    plan: string,
    userAmount: number,
    billingType: "monthly" | "yearly" = "monthly",
  ): Promise<{
    clientSecret: string;
    reference: string;
    amount: number;
  }> {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error("User not found");

      const customerId = await this.getOrCreateCustomer(user);
      const orderRef = `STR-${Date.now()}`;

      // Create payment intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        customer: customerId,
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        description: `Plan: ${plan} - ${billingType === "yearly" ? "Annual" : "Monthly"} Subscription`,
        metadata: {
          userId: userId,
          plan,
          orderRef,
          billingType,
          isRecurring: "true",
        },
        // Enable off-session for recurring charges
        off_session: false,
        setup_future_usage: "off_session",
      });

      // Create payment record
      const payment = await Payment.create({
        userId,
        orderRef,
        reference: paymentIntent.id,
        amount: userAmount,
        localAmount: amount,
        currency,
        plan,
        billingType,
        status: "PENDING",
        gateway: "stripe",
        paymentIntentId: paymentIntent.id,
        gatewayResponse: {
          paymentIntentId: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
        },
      });

      return {
        clientSecret: paymentIntent.client_secret || "",
        reference: paymentIntent.id,
        amount: userAmount,
      };
    } catch (error) {
      console.error("❌ Error creating payment intent:", error);
      throw error;
    }
  }

  /**
   * Get payment intent status
   */
  static async getPaymentIntentStatus(paymentIntentId: string): Promise<{
    status: string;
    amount: number;
    currency: string;
  }> {
    try {
      const paymentIntent =
        await this.stripe.paymentIntents.retrieve(paymentIntentId);

      return {
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency.toUpperCase(),
      };
    } catch (error) {
      console.error("❌ Error fetching payment intent:", error);
      throw error;
    }
  }

  /**
   * Create subscription for recurring billing
   */
  static async createSubscription(
    userId: string,
    priceId: string,
    plan: string,
    billingType: "monthly" | "yearly" = "monthly",
  ): Promise<{ subscriptionId: string; clientSecret?: string }> {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error("User not found");

      const customerId = await this.getOrCreateCustomer(user);
      const billingInterval = this.getBillingInterval(billingType);

      const subscription = await this.stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        metadata: {
          userId: userId,
          plan,
          billingType,
        },
        // Collect payment on subscription creation
        payment_behavior: "default_incomplete",
        expand: ["latest_invoice.payment_intent"],
      });

      // latest_invoice can be a string ID or an Invoice object; use a safe cast and a type guard to access payment_intent
      const latestInvoice = subscription.latest_invoice as
        | Stripe.Invoice
        | string
        | null;
      const paymentIntent =
        typeof latestInvoice === "object" && latestInvoice !== null
          ? ((latestInvoice as any).payment_intent as
              | Stripe.PaymentIntent
              | undefined)
          : undefined;

      return {
        subscriptionId: subscription.id,
        clientSecret: paymentIntent?.client_secret as string,
      };
    } catch (error) {
      console.error("❌ Error creating subscription:", error);
      throw error;
    }
  }

  /**
   * Charge recurring payment using saved payment method
   * Supports both monthly and yearly billing cycles
   */
  static async chargeRecurringPayment(
    userId: string,
    plan: string,
    amount: number, // in cents
    currency: string,
    billingType: "monthly" | "yearly" = "monthly",
    retryAttempt = 0,
    config = this.DEFAULT_RECURRING_CONFIG,
  ): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user || !user.plan) {
        throw new Error(`User ${userId} not found or has no plan`);
      }

      const customerId = await this.getOrCreateCustomer(user);
      const orderRef = `STR-REC-${Date.now()}`;

      // Get default payment method
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: "card",
      });

      if (paymentMethods.data.length === 0) {
        throw new Error("No payment method on file");
      }

      const defaultPaymentMethod = paymentMethods.data[0];

      // Create invoice for recurring charge
      const paymentIntent = await this.stripe.paymentIntents.create({
        customer: customerId,
        amount: Math.round(amount * 100),
        currency: currency.toLowerCase(),
        payment_method: defaultPaymentMethod.id,
        off_session: true,
        confirm: true,
        description: `Recurring charge for ${plan} (${billingType})`,
        metadata: {
          userId: userId,
          plan,
          billingType,
          orderRef,
          isRecurring: "true",
        },
      });

      // Create payment record
      const payment = await Payment.create({
        userId,
        orderRef,
        reference: paymentIntent.id,
        amount: amount / 100,
        localAmount: amount / 100,
        currency,
        plan,
        billingType,
        status: "PENDING",
        gateway: "stripe",
        paymentIntentId: paymentIntent.id,
        isRecurring: true,
        recurringCycle: this.getMonthlyRecurringCycle(),
        billingAttempt: retryAttempt + 1,
        gatewayResponse: { paymentIntentId: paymentIntent.id },
      });

      // Verify payment after delay
      setTimeout(() => {
        this.verifyRecurringPayment(paymentIntent.id, userId, plan, billingType);
      }, 3000);
    } catch (error) {
      console.error(
        `❌ Recurring payment charge failed (Attempt ${retryAttempt + 1}):`,
        error,
      );

      if (retryAttempt < (config.maxRetries || 3)) {
        setTimeout(() => {
          this.chargeRecurringPayment(
            userId,
            plan,
            amount,
            currency,
            billingType,
            retryAttempt + 1,
            config,
          );
        }, config.retryDelayMs || 5000);
      } else {
        await this.suspendSubscription(userId);
        throw error;
      }
    }
  }

  /**
   * Verify recurring payment result
   */
  private static async verifyRecurringPayment(
    paymentIntentId: string,
    userId: string,
    plan: string,
    billingType: "monthly" | "yearly" = "monthly",
  ) {
    try {
      const payment = await Payment.findOne({
        paymentIntentId,
      });

      if (!payment) {
        console.error(`❌ Payment not found: ${paymentIntentId}`);
        return;
      }

      const paymentIntent =
        await this.stripe.paymentIntents.retrieve(paymentIntentId);

      let paymentStatus = "PENDING";

      if (paymentIntent.status === "succeeded") {
        paymentStatus = "COMPLETED";
      } else if (paymentIntent.status === "requires_action") {
        paymentStatus = "PENDING";
      } else if (paymentIntent.status === "requires_payment_method") {
        paymentStatus = "FAILED";
      }

      payment.status = paymentStatus as any;
      payment.billingType = billingType;
      payment.gatewayResponse = { paymentIntentId: paymentIntent.id };
      payment.verifiedAt = new Date();
      await payment.save();

      if (paymentStatus === "COMPLETED") {
        const user = await User.findById(userId);
        if (user && user.subscription) {
          const subscriptionDuration = this.getSubscriptionDuration(billingType);
          user.subscription.endDate = new Date(
            Date.now() + subscriptionDuration,
          );
          await user.save();
        }
      } else {
        await this.notifyPaymentFailure(userId, plan);
      }
    } catch (error) {
      console.error(`❌ Error verifying recurring payment:`, error);
    }
  }

  /**
   * Initialize recurring payment cron job
   */
  static initRecurringPaymentCron() {
    // Run daily at 2 AM
    cron.schedule("0 2 * * *", async () => {
      await this.processRecurringPayments();
    });
  }

  /**
   * Process all Stripe recurring payments
   * Handles both monthly and yearly subscriptions
   */
  private static async processRecurringPayments() {
    try {
      // Find all active Stripe subscriptions
      const activeUsers = await User.find({
        "subscription.status": "active",
        gateway: "stripe",
      });

      for (const user of activeUsers) {
        try {
          const billingType = user.billingType || "monthly";
          const planAmount = this.getPlanAmount(user.plan as string);
          
          await this.chargeRecurringPayment(
            user._id.toString(),
            user.plan as string,
            planAmount,
            "USD",
            billingType as any,
          );
        } catch (err) {
          console.error(`❌ Error charging user ${user._id}:`, err);
        }
      }
    } catch (error) {
      console.error("❌ Error in processRecurringPayments:", error);
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

        await this.notifySubscriptionSuspended(userId);
      }
    } catch (error) {
      console.error(`❌ Error suspending subscription:`, error);
    }
  }

  /**
   * Get monthly recurring cycle identifier
   */
  private static getMonthlyRecurringCycle(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  /**
   * Get plan amount
   */
  private static getPlanAmount(plan: string): number {
    const PLAN_AMOUNTS: { [key: string]: number } = {
      "gold-yoga": 100,
      "gold-zumba": 100,
      "gold-mixed": 100,
      diamond: 200,
      platinum: 300,
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
        // Implement email notification here
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
        // Implement email notification here
      }
    } catch (error) {
      console.error(`❌ Error notifying suspension:`, error);
    }
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(subscriptionId: string): Promise<void> {
    try {
      await this.stripe.subscriptions.cancel(subscriptionId);
    } catch (error) {
      console.error(`❌ Error cancelling Stripe subscription:`, error);
      throw error;
    }
  }
}