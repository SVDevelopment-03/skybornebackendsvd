/* eslint-disable @typescript-eslint/no-explicit-any */

import express from "express";
import type { Application, Request, Response } from "express";
import { emailQueue } from './services/queues/emailQueue';
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import authApiRouter from "./routes/authApiRouter";
import appApiRouter from "./routes/appApiRouter";
import { routeNotFound } from "./handlers/routeError.handler";
import { httpErrorHandler } from "./handlers/httpError.handler";
import multer from "multer";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimitMiddleware from "./utils/rateLimit.utils";
import { apiTimeout } from "./middlewares/timeout";
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import Stripe from 'stripe';
import zoomWebhook from "./routes/zoomWebhook";
import PaymentController from "./modules/PaymentModule/controllers/paymentController";
import { StripeService } from "./modules/PaymentModule/services/stripe.servise";
const app: Application = express();

// BullBoard UI
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");



createBullBoard({
  queues: [new BullAdapter(emailQueue)],
  serverAdapter,
});

app.use("/admin/queues", serverAdapter.getRouter());

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(cookieParser());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(compression());

app.use(helmet({ crossOriginResourcePolicy: false }));

if (process.env.APP_ENV === "production") {
  app.use(rateLimitMiddleware);
}

// Initialize email queue
emailQueue.on('ready', () => {
  console.log('✅ Email queue is ready');
});

emailQueue.on('error', (err) => {
  console.error('❌ Email queue error:', err);
});

try {
  PaymentController.initPaymentSystems();
  console.log('✅ All payment systems ready');
} catch (error) {
  console.error('❌ Error initializing payment systems:', error);
  process.exit(1);
}

// nGenius webhook callback
app.post('/webhooks/ngenius', (req, res) => {
  try {
    const { orderRef, status } = req.body;
    console.log(`📨 nGenius Webhook - OrderRef: ${orderRef}, Status: ${status}`);
    // Handle webhook
    res.json({ received: true });
  } catch (error) {
    console.error('❌ nGenius webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});


// Stripe webhook endpoint
app.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;

    let event: Stripe.Event;

    try {
      // Verify the webhook signature
      // req.body is a Buffer when using express.raw()
      event = stripe.webhooks.constructEvent(
        req.body, // This is a Buffer
        sig,
        webhookSecret
      );
      console.log(`✅ Webhook verified - Event: ${event.type}`);
    } catch (error: any) {
      console.error(`❌ Webhook signature verification failed:`, error.message);
      return res.status(400).json({ error: `Webhook Error: ${error.message}` });
    }

    // Handle the event
    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          console.log(`✅ Checkout completed: ${session.id}`);
          
          // Update payment status in your database
          break;
        }

        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          console.log(`✅ Payment intent succeeded: ${paymentIntent.id}`);
          
          // Handle payment intent success
          break;
        }

        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          console.log(`❌ Payment intent failed: ${paymentIntent.id}`);
          
          // Handle payment intent failure
          break;
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as Stripe.Invoice;
          console.log(`✅ Invoice paid: ${invoice.id}`);
          
          // Handle invoice payment success (subscription renewal)
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          console.log(`❌ Invoice payment failed: ${invoice.id}`);
          
          // Handle invoice payment failure
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          console.log(`🛑 Subscription cancelled: ${subscription.id}`);
          
          // Handle subscription cancellation
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;
          console.log(`📝 Subscription updated: ${subscription.id}`);
          
          // Handle subscription updates
          break;
        }

        default:
          console.log(`ℹ️ Unhandled event type: ${event.type}`);
      }

      // Acknowledge receipt of the event
      res.json({ received: true });
    } catch (error: any) {
      console.error(`❌ Error processing webhook event:`, error);
      res.status(500).json({ error: 'Event processing failed' });
    }
  });




// app.use(apiTimeout(10000));

/* 7. STATIC files (optional) */
// app.use("/uploads", express.static("uploads"));

/* 8. Request Logger */
app.use((req: Request, res: Response, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(
      `[API HIT] ${req.method} ${req.originalUrl} → ${res.statusCode} (${
        Date.now() - start
      }ms)`
    );
  });
  next();
});




/* 9. All routes go here */
const apiVersion = "/api/v1/";

app.use(apiVersion, zoomWebhook);


// Demo route
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    status: "success",
    message: "Skyborne API is running smoothly!",
    version: apiVersion,
    timestamp: new Date().toISOString(),
  });
});

app.use(apiVersion, authApiRouter);
app.use(apiVersion, appApiRouter);

/* 10. 404 handler (route not found) */
app.use(routeNotFound);

/* 11. Global error handler — MUST BE LAST */
app.use(httpErrorHandler);

/* 12. Hide Express signature */
app.disable("x-powered-by");

export default app;
