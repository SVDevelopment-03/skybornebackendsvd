/**
 * Apple In-App Purchase (IAP) Controller
 * Handles receipt validation, subscription processing, and payment operations
 */

import { Request, Response } from 'express';
import { AppleIAPService } from '../services/appleIAP.service';
import Payment from '../models/Payment';
import PlanProduct from '../models/PlanProduct';
import User from '../../UserModule/models/User';
import { PLAN_CONFIG } from '../../../config/planConfig';
import { hasActiveSubscription } from '../../../utils/creditUtils';
import { normalizePlanKeyForDisabledZumba } from '../../../utils/zumbaMigration';
import { v4 as uuidv4 } from 'uuid';

export class AppleIAPController {
  /**
   * Validate Apple IAP receipt and process payment
   * POST /payment/apple-iap/validate-receipt
   */
  static async validateAppleReceipt(req: Request, res: Response) {
    try {
      const { receipt, userId } = req.body;

      // Validation
      if (!receipt) {
        return res.status(400).json({
          success: false,
          message: 'Receipt is required',
        });
      }

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'userId is required',
        });
      }

      // Find user
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      console.log(`🍎 Validating Apple IAP receipt for user: ${user.email}`);

      // Validate receipt with Apple
      const validationResult = await AppleIAPService.validateReceipt({
        receipt,
        environment: 'production', // Default to production
      });

      if (!validationResult.isValid || !validationResult.receipt) {
        console.error(`❌ Apple receipt validation failed:`, validationResult.error);
        return res.status(400).json({
          success: false,
          message: validationResult.error || 'Receipt validation failed',
        });
      }

      // Extract subscription info
      const subscriptionInfo = AppleIAPService.extractSubscriptionInfo(validationResult.receipt);
      if (!subscriptionInfo) {
        return res.status(400).json({
          success: false,
          message: 'No active subscription found in receipt',
        });
      }

      console.log(`✅ Apple subscription info:`, {
        productId: subscriptionInfo.productId,
        isActive: AppleIAPService.isSubscriptionActive(subscriptionInfo.expiryDate),
        expiryDate: subscriptionInfo.expiryDate,
      });

      // Get plan from product ID
      const plan = AppleIAPService.getPlanFromAppleProductId(subscriptionInfo.productId);
      if (!plan) {
        return res.status(400).json({
          success: false,
          message: `Unknown Apple product: ${subscriptionInfo.productId}`,
        });
      }

      // Normalize plan (in case Zumba is disabled)
      const normalizedPlan = normalizePlanKeyForDisabledZumba(plan);

      // Determine billing type
      const billingType = AppleIAPService.extractBillingTypeFromProductId(
        subscriptionInfo.productId,
      );

      // Check if this is a duplicate transaction
      const existingPayment = await Payment.findOne({
        userId,
        appleTransactionId: subscriptionInfo.transactionId,
        status: 'COMPLETED',
      });

      if (existingPayment) {
        console.log(`⚠️  Duplicate Apple transaction detected: ${subscriptionInfo.transactionId}`);
        return res.status(400).json({
          success: false,
          message: 'This transaction has already been processed',
        });
      }

      // Check for existing payment with same original transaction ID
      const existingOriginalPayment = await Payment.findOne({
        userId,
        appleOriginalTransactionId: subscriptionInfo.originalTransactionId,
        status: 'COMPLETED',
      });

      let isRenewal = false;
      if (existingOriginalPayment) {
        console.log(
          `ℹ️  This is a renewal of subscription: ${subscriptionInfo.originalTransactionId}`,
        );
        isRenewal = true;
      }

      // Create payment record
      const orderRef = AppleIAPService.generateAppleOrderRef();

      // Prefer price from PlanProduct if populated; otherwise fallback to 0
      const planProduct = await PlanProduct.findOne({ planKey: normalizedPlan }).lean();
      const amount = planProduct?.price ?? 0;

      const paymentData = new Payment({
        userId,
        orderRef,
        plan: normalizedPlan,
        amount,
        currency: planProduct?.currency || 'USD',
        localAmount: amount,
        localCurrency: planProduct?.currency || 'USD',
        status: 'COMPLETED',
        gateway: 'apple-iap',
        billingType,
        appleTransactionId: subscriptionInfo.transactionId,
        appleProductId: subscriptionInfo.productId,
        appleOriginalTransactionId: subscriptionInfo.originalTransactionId,
        appleEnvironment: validationResult.environment,
        verifiedAt: new Date(),
        isRecurring: true,
        billingAttempt: 1,
        subscriptionActivated: false,
      });

      await paymentData.save();
      console.log(`✅ Payment record created: ${orderRef}`);

      // Update user subscription if not already active
      const hasActive = await hasActiveSubscription(userId);

      if (!hasActive || isRenewal) {
        // Calculate subscription end date
        const subscriptionEndDate = AppleIAPService.calculateNextRenewalDate(
          subscriptionInfo.purchaseDate,
          billingType,
        );

        // Compute credit counts from PLAN_CONFIG (yoga/zumba/specialty). If missing, default to totals.
        const planCreditConfig = PLAN_CONFIG[normalizedPlan as keyof typeof PLAN_CONFIG] || null;
        const totalCredits = planCreditConfig
          ? Object.values(planCreditConfig).reduce((a: number, b: number) => a + b, 0)
          : 10;

        const updateData: any = {
          plan: normalizedPlan,
          totalClassCredits: totalCredits,
          subscription: {
            status: 'active',
            startDate: new Date(),
            endDate: subscriptionEndDate,
            billingCycle: billingType,
            lastPaymentDate: new Date(),
            renewalDate: subscriptionEndDate,
          },
          stripeCustomerId: user.stripeCustomerId || undefined,
        };

        // Initialize credits if new subscription
        if (!hasActive) {
          updateData.classCredits = {
            yoga: planCreditConfig?.yoga || totalCredits,
            zumba: planCreditConfig?.zumba || 0,
            specialty: planCreditConfig?.specialty || 0,
          };
        }

        await User.updateOne({ _id: userId }, { $set: updateData });
        console.log(`✅ User subscription updated for plan: ${normalizedPlan}`);

        // Mark payment as subscription activated
        await Payment.updateOne({ _id: paymentData._id }, { subscriptionActivated: true });
      }

      return res.status(200).json({
        success: true,
        message: 'Apple IAP receipt validated successfully',
        data: {
          paymentId: paymentData._id,
          orderRef,
          plan: normalizedPlan,
          amount: paymentData.amount,
          currency: 'USD',
          subscriptionEndDate: subscriptionInfo.expiryDate,
          isRenewal,
          environment: validationResult.environment,
        },
      });
    } catch (error: any) {
      console.error('❌ Apple IAP validation error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to validate Apple IAP receipt',
      });
    }
  }

  /**
   * Restore previous Apple IAP purchases
   * POST /payment/apple-iap/restore-purchases
   */
  static async restoreApplePurchases(req: Request, res: Response) {
    try {
      const { receipt, userId } = req.body;

      if (!receipt) {
        return res.status(400).json({
          success: false,
          message: 'Receipt is required',
        });
      }

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'userId is required',
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      console.log(`🍎 Restoring Apple purchases for user: ${user.email}`);

      // Validate receipt
      const validationResult = await AppleIAPService.validateReceipt({
        receipt,
        environment: 'production',
      });

      if (!validationResult.isValid || !validationResult.receipt) {
        return res.status(400).json({
          success: false,
          message: 'Receipt validation failed',
        });
      }

      // Extract all in-app purchases from receipt
      const purchases: any[] = [];

      if (validationResult.receipt.inApp && validationResult.receipt.inApp.length > 0) {
        for (const inApp of validationResult.receipt.inApp) {
          // Skip cancelled subscriptions
          if (inApp.cancellationDate) {
            continue;
          }

          const plan = AppleIAPService.getPlanFromAppleProductId(inApp.productId);
          if (!plan) {
            console.warn(`⚠️  Unknown product ID in receipt: ${inApp.productId}`);
            continue;
          }

          purchases.push({
            productId: inApp.productId,
            transactionId: inApp.transactionId,
            originalTransactionId: inApp.originalTransactionId,
            purchaseDate: new Date(inApp.purchaseDate),
            expiryDate: inApp.expiresDate ? new Date(inApp.expiresDate) : null,
            plan: normalizePlanKeyForDisabledZumba(plan),
            isActive: inApp.expiresDate
              ? new Date(inApp.expiresDate) > new Date()
              : true,
          });
        }
      }

      if (purchases.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid purchases found in receipt',
        });
      }

      console.log(`✅ Found ${purchases.length} purchases to restore`);

      return res.status(200).json({
        success: true,
        message: 'Purchases restored successfully',
        data: {
          purchases,
          count: purchases.length,
        },
      });
    } catch (error: any) {
      console.error('❌ Purchase restoration error:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to restore purchases',
      });
    }
  }

  /**
   * Get available Apple IAP products
   * GET /payment/apple-iap/products
   */
  static async getAppleProducts(req: Request, res: Response) {
    try {
      // Prefer dynamic PlanProduct entries if available
      const planProducts = await PlanProduct.find({}).lean();

      if (Array.isArray(planProducts) && planProducts.length > 0) {
        const grouped = planProducts.map((p) => ({
          plan: p.planKey,
          name: p.displayName || p.planKey,
          description: p.description || '',
          price: p.price?.toString?.() || '0',
          currency: p.currency || 'USD',
          billingType: p.billingType || 'monthly',
          appleProductIds: p.appleProductIds || [],
          googleProductIds: p.googleProductIds || [],
          stripePriceIds: p.stripePriceIds || [],
        }));

        return res.status(200).json({
          success: true,
          message: 'Apple IAP products retrieved successfully',
          data: grouped,
        });
      }

      // Fallback static list (kept for backward compatibility)
      const products = [
        {
          productId: 'com.skyborne.gold.monthly',
          name: 'Gold Yoga - Monthly',
          plan: 'gold-yoga',
          price: '9.99',
          currency: 'USD',
          billingType: 'monthly',
          description: 'Gold Yoga plan - Monthly subscription',
        },
        {
          productId: 'com.skyborne.gold.yearly',
          name: 'Gold Yoga - Yearly',
          plan: 'gold-yoga',
          price: '99.99',
          currency: 'USD',
          billingType: 'yearly',
          description: 'Gold Yoga plan - Annual subscription',
        },
        {
          productId: 'com.skyborne.diamond.monthly',
          name: 'Diamond - Monthly',
          plan: 'diamond',
          price: '19.99',
          currency: 'USD',
          billingType: 'monthly',
          description: 'Diamond plan - Monthly subscription',
        },
        {
          productId: 'com.skyborne.diamond.yearly',
          name: 'Diamond - Yearly',
          plan: 'diamond',
          price: '199.99',
          currency: 'USD',
          billingType: 'yearly',
          description: 'Diamond plan - Annual subscription',
        },
        {
          productId: 'com.skyborne.platinum.monthly',
          name: 'Platinum - Monthly',
          plan: 'platinum',
          price: '29.99',
          currency: 'USD',
          billingType: 'monthly',
          description: 'Platinum plan - Monthly subscription',
        },
        {
          productId: 'com.skyborne.platinum.yearly',
          name: 'Platinum - Yearly',
          plan: 'platinum',
          price: '299.99',
          currency: 'USD',
          billingType: 'yearly',
          description: 'Platinum plan - Annual subscription',
        },
      ];

      return res.status(200).json({
        success: true,
        message: 'Apple IAP products retrieved successfully',
        data: products,
      });
    } catch (error: any) {
      console.error('❌ Error fetching Apple products:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch Apple products',
      });
    }
  }
}
