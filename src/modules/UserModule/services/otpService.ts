import redisClient from '../../../config/redis';
import nodemailer from 'nodemailer';
import { logger } from '../../../utils/winston.utils';
import { SendEmailCommand } from "@aws-sdk/client-ses";
import sesClient from '../../../config/ses';

export class OTPService {
  private static readonly OTP_PREFIX = 'otp:';
  private static readonly OTP_EXPIRY = 600; // 10 minutes

  /**
   * Generate and store OTP
   */
  static async generateAndStoreOTP(email: string): Promise<string> {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const key = `${this.OTP_PREFIX}${email}`;

    await redisClient.setEx(key, this.OTP_EXPIRY, otp);

    logger.info(`OTP generated for email: ${this.maskEmail(email)}`);
    return otp;
  }

/**
 * Send OTP Email using AWS SES
 */

static async sendEmailOTP(email: string, otp: string): Promise<void> {
  try {
    // 1. Prepare SES parameters
    const params = {
      Source: `"Skyborne" <info@skybornedrop.com>`,
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Subject: { Data: "Your Skyborne Verification Code" },
        Body: {
          Html: {
            Data: `
              <h2>Your Verification Code</h2>
              <p>Your OTP is: <strong>${otp}</strong></p>
              <p>This OTP expires in <b>10 minutes</b>.</p>
            `,
          },
        },
      },
    };

    // 2. Send Email via SES
    const response = await sesClient.send(new SendEmailCommand(params));

    logger.info(
      `OTP Email sent to: ${this.maskEmail(email)} | MessageID: ${response.MessageId}`
    );
  } catch (err: any) {
    logger.error(
      `Email OTP sending failed for ${this.maskEmail(email)} | Error: ${err.message}`
    );

    // Fallback — show OTP in development
    if (process.env.NODE_ENV === "development") {
      console.log(`
      📩 Email OTP (development mode)
      Email: ${email}
      OTP: ${otp}
      `);
    }
  }
}


  /**
   * Verify OTP
   */
  static async verifyOTP(email: string, otp: string): Promise<boolean> {
    const key = `${this.OTP_PREFIX}${email}`;
    const storedOTP = await redisClient.get(key);

    if (!storedOTP) {
      logger.warn(`OTP expired or not found for: ${this.maskEmail(email)}`);
      return false;
    }

    if (storedOTP === otp) {
      await redisClient.del(key);
      logger.info(`OTP verified for: ${this.maskEmail(email)}`);
      return true;
    }

    logger.warn(`Invalid OTP attempt for: ${this.maskEmail(email)}`);
    return false;
  }

  /**
   * Resend OTP
   */
  static async resendOTP(email: string): Promise<string> {
    const key = `${this.OTP_PREFIX}${email}`;
    await redisClient.del(key);

    const otp = await this.generateAndStoreOTP(email);
    await this.sendEmailOTP(email, otp);

    logger.info(`OTP resent to email: ${this.maskEmail(email)}`);
    return otp;
  }

  /** Remaining time */
  static async getOTPRemainingTime(email: string): Promise<number> {
    const key = `${this.OTP_PREFIX}${email}`;
    const ttl = await redisClient.ttl(key);
    return ttl > 0 ? ttl : 0;
  }

  /** Mask email for logs */
  private static maskEmail(email: string): string {
    const [name, domain] = email.split('@');
    const maskName = name[0] + '*'.repeat(name.length - 1);
    return `${maskName}@${domain}`;
  }
}
