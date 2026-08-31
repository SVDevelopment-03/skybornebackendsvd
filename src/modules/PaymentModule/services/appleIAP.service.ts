/**
 * Apple In-App Purchase (IAP) Service
 * Handles receipt validation, subscription verification, and transaction processing
 */

import * as verifier from 'node-apple-receipt-verify';
import { v4 as uuidv4 } from 'uuid';

interface AppleReceiptData {
  receipt: string;
  environment?: 'production' | 'sandbox';
}

interface ValidatedReceipt {
  bundleId: string;
  applicationVersion: string;
  originalApplicationVersion?: string;
  creationDate: number;
  expirationDate?: number;
  inApp?: Array<{
    transactionId: string;
    originalTransactionId: string;
    productId: string;
    purchaseDate: number;
    originalPurchaseDate: number;
    expiresDate?: number;
    quantity?: number;
    bundleId?: string;
    isTrialPeriod?: boolean;
    cancellationDate?: number;
  }>;
}

interface ValidationResult {
  isValid: boolean;
  receipt?: ValidatedReceipt;
  error?: string;
  environment?: 'production' | 'sandbox';
}

interface SubscriptionInfo {
  productId: string;
  transactionId: string;
  originalTransactionId: string;
  expiryDate: Date;
  isTrialPeriod: boolean;
  isCancelled: boolean;
  purchaseDate: Date;
}

export class AppleIAPService {
  private static readonly APPLE_SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';
  private static readonly APPLE_PRODUCTION_URL = 'https://buy.itunes.apple.com/verifyReceipt';

  /**
   * Validate Apple receipt
   * Attempts production first, then sandbox if production returns invalid
   */
  static async validateReceipt(receiptData: AppleReceiptData): Promise<ValidationResult> {
    try {
      const { receipt, environment = 'production' } = receiptData;

      if (!receipt || !receipt.trim()) {
        return {
          isValid: false,
          error: 'Receipt is required and cannot be empty',
        };
      }

      // Try validating with specified environment first
      let validatedReceipt: ValidatedReceipt | null = null;
      let detectedEnvironment: 'production' | 'sandbox' = environment;

      try {
        validatedReceipt = await this.verifyReceiptWithApple(receipt, 'production');
        detectedEnvironment = 'production';
      } catch (prodError: any) {
        // If production fails, try sandbox
        console.log('⚠️  Production verification failed, trying sandbox...');
        try {
          validatedReceipt = await this.verifyReceiptWithApple(receipt, 'sandbox');
          detectedEnvironment = 'sandbox';
        } catch (sandboxError: any) {
          return {
            isValid: false,
            error: `Receipt validation failed: ${sandboxError.message || 'Unknown error'}`,
          };
        }
      }

      if (!validatedReceipt) {
        return {
          isValid: false,
          error: 'Failed to validate receipt with Apple',
        };
      }

      return {
        isValid: true,
        receipt: validatedReceipt,
        environment: detectedEnvironment,
      };
    } catch (error: any) {
      return {
        isValid: false,
        error: error.message || 'Receipt validation error',
      };
    }
  }

  /**
   * Verify receipt with Apple servers
   */
  private static async verifyReceiptWithApple(
    receipt: string,
    environment: 'production' | 'sandbox',
  ): Promise<ValidatedReceipt> {
    return new Promise((resolve, reject) => {
      verifier.validateReceiptAsync(
        {
          receipt: receipt.startsWith('MII') ? receipt : undefined,
          receiptBuffer: !receipt.startsWith('MII') ? Buffer.from(receipt, 'utf-8') : undefined,
          secret: process.env.APPLE_SHARED_SECRET || '',
          apple_exclude_old_transactions: true,
          extended_validation: false,
          environment: environment,
        },
        (error: any, validatedData: any) => {
          if (error) {
            console.error(`❌ Apple verification failed (${environment}):`, error);
            reject(new Error(`Apple verification failed: ${error.message}`));
          } else {
            console.log(`✅ Apple verification successful (${environment})`);
            resolve(validatedData);
          }
        },
      );
    });
  }

  /**
   * Extract subscription information from validated receipt
   */
  static extractSubscriptionInfo(validatedReceipt: ValidatedReceipt): SubscriptionInfo | null {
    if (!validatedReceipt.inApp || validatedReceipt.inApp.length === 0) {
      return null;
    }

    // Get the most recent active subscription
    const subscription = validatedReceipt.inApp.reduce(
      (latest: any, current: any) => {
        // Skip cancelled subscriptions
        if (current.cancellationDate) {
          return latest;
        }

        // For subscription products, check expiry
        if (current.expiresDate) {
          const currentExpiry = current.expiresDate;
          const latestExpiry = latest?.expiresDate || 0;
          return currentExpiry > latestExpiry ? current : latest;
        }

        return latest || current;
      },
      null,
    );

    if (!subscription) {
      return null;
    }

    return {
      productId: subscription.productId,
      transactionId: subscription.transactionId,
      originalTransactionId: subscription.originalTransactionId,
      expiryDate: new Date(subscription.expiresDate || subscription.originalPurchaseDate),
      isTrialPeriod: subscription.isTrialPeriod === 'true' || subscription.isTrialPeriod === true,
      isCancelled: !!subscription.cancellationDate,
      purchaseDate: new Date(subscription.purchaseDate),
    };
  }

  /**
   * Generate order reference for Apple IAP transaction
   */
  static generateAppleOrderRef(): string {
    return `APPLE-${Date.now()}-${uuidv4().substring(0, 8)}`;
  }

  /**
   * Get plan from Apple product ID
   * Maps Apple product IDs to internal plan names
   */
  static getPlanFromAppleProductId(productId: string): string | null {
    // Map Apple product IDs to plan names
    // Example: com.skyborne.gold.yearly -> gold-yoga
    const productIdLower = productId.toLowerCase();

    if (productIdLower.includes('gold')) return 'gold-yoga';
    if (productIdLower.includes('diamond')) return 'diamond';
    if (productIdLower.includes('platinum')) return 'platinum';

    return null;
  }

  /**
   * Validate subscription expiry status
   */
  static isSubscriptionActive(expiryDate: Date): boolean {
    const now = new Date();
    return expiryDate > now;
  }

  /**
   * Calculate subscription renewal date based on billing type
   */
  static calculateNextRenewalDate(
    purchaseDate: Date,
    billingType: 'monthly' | 'yearly',
  ): Date {
    const nextRenewal = new Date(purchaseDate);
    if (billingType === 'yearly') {
      nextRenewal.setFullYear(nextRenewal.getFullYear() + 1);
    } else {
      nextRenewal.setMonth(nextRenewal.getMonth() + 1);
    }
    return nextRenewal;
  }

  /**
   * Extract billing type from Apple product ID or use default
   */
  static extractBillingTypeFromProductId(productId: string): 'monthly' | 'yearly' {
    const productIdLower = productId.toLowerCase();
    if (productIdLower.includes('yearly') || productIdLower.includes('annual')) {
      return 'yearly';
    }
    return 'monthly';
  }
}
