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
import zoomWebhook from "./routes/zoomWebhook";
import PaymentController from "./modules/PaymentModule/controllers/paymentController";
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

try {
  PaymentController.initRecurringPayments();
  console.log("✅ Recurring payment system initialized");
} catch (error) {
  console.error("❌ Failed to initialize recurring payments:", error);
}

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
