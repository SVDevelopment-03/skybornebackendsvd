// ============================================
// src/modules/AuthModule/controllers/authController.ts
// ============================================
import { NextFunction, Request, Response } from "express";
import User from "../../UserModule/models/User";
import {
  UserRole,
  AuthProvider,
} from "../../UserModule/interface/userInterface";
import { generateTokens } from "../../../config/jwt";
import { OTPService } from "../../UserModule/services/otpService";
import { logAuthEvent, logger } from "../../../utils/winston.utils";
import { AuthService } from "../services/authService";
import TempUser from "../../UserModule/models/TempUser";
import extractPhoneDetails from "../../../utils/extractPhoneDetail";

// Helper function for logging auth events

export class AuthController {
  static async signup(req: Request, res: Response, next: NextFunction) {
    try {
      const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";

      const { dialingCode, localNumber, countryCode, country } =
        extractPhoneDetails(req.body.phoneNumber);

      const payload = {
        ...req.body,
        dialingCode,
        country,
        countryCode,
        localNumber,
        ip,
        userAgent,
      };

      let result;

      if (payload.googleId) {
        result = await AuthService.googleSignup(payload);
      } else if (payload.appleId) {
        result = await AuthService.appleSignup(payload);
      } else {
        result = await AuthService.emailSignup(payload);
      }

      return res.status(201).json({
        success: true,
        message: "Account created successfully",
        data: {
          user: {
            id: result.user._id,
            firstName: result.user.firstName,
            lastName: result.user.lastName,
            email: result.user.email,
            country: result.user.country,
            countryCode: result.user.countryCode,
            role: result.user.role,
            motivation: result.user.motivation,
            onboardingCompleted: result.user.onboardingCompleted,
          },
          ...result.tokens,
        },
      });
    } catch (error: any) {
      logger.error("Signup error:", error.message);
      next(error);
    }
  }

  // Email/Password Login
  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      const ip = (req.ip ||
        req.headers["x-forwarded-for"] ||
        "unknown") as string;
      const userAgent = req.headers["user-agent"] || "unknown";

      const user = await User.findOne({ email }).select("+password");

      if (!user) {
        logAuthEvent({
          email,
          event: "login",
          success: false,
          ip,
          userAgent,
          error: "User not found",
        });

        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      if (!user.password) {
        logAuthEvent({
          userId: user._id.toString(),
          email: user.email,
          event: "login",
          success: false,
          ip,
          userAgent,
          error: "No password set - OAuth user",
        });

        return res.status(400).json({
          success: false,
          message: "Please login with your social account",
        });
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        logAuthEvent({
          userId: user._id.toString(),
          email: user.email,
          event: "login",
          success: false,
          ip,
          userAgent,
          error: "Invalid password",
        });

        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      // Check if account is active
      if (!user.isActive) {
        logAuthEvent({
          userId: user._id.toString(),
          email: user.email,
          event: "login",
          success: false,
          ip,
          userAgent,
          error: "Account deactivated",
        });

        return res.status(403).json({
          success: false,
          message: "Account is deactivated",
        });
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate tokens
      const tokens = generateTokens(user);

      // Log successful login
      logAuthEvent({
        userId: user._id.toString(),
        email: user.email,
        event: "login",
        success: true,
        ip,
        userAgent,
      });

      res.status(200).json({
        success: true,
        message: "Login successful",
        data: {
          user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
            onboardingCompleted: user.onboardingCompleted,
          },
          ...tokens,
        },
      });
    } catch (error: any) {
      logger.error("Login error", error.message);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Step 3: Send OTP
  static async sendOTP(req: Request, res: Response) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required",
        });
      }

      let tempUser = await TempUser.findOne({ email });

      // 1️⃣ Create temp user if not exists
      if (!tempUser) {
        tempUser = await TempUser.create({
          email,
          otpVerified: false,
        });
      }

      // 2️⃣ Generate & store OTP in redis
      const otp = await OTPService.generateAndStoreOTP(email);

      // 3️⃣ Send email OTP
      await OTPService.sendEmailOTP(email, otp);

      return res.status(200).json({
        success: true,
        message: "OTP sent",
        data: {
          tempUserId: tempUser._id,
          expiresIn: 600,
        },
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        return res.status(500).json({ success: false, message: err.message });
      }

      return res
        .status(500)
        .json({ success: false, message: "Unknown error occurred" });
    }
  }

  // Step 4: Verify OTP (Email Version)
  static async verifyOTP(req: Request, res: Response) {
    try {
      const { email, otp } = req.body;

      // 1️⃣ Validate OTP via Redis
      const valid = await OTPService.verifyOTP(email, otp);

      if (!valid) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired OTP",
        });
      }

      // 2️⃣ Update temporary user
      const tempUser = await TempUser.findOne({ email });

      if (!tempUser) {
        return res.status(404).json({
          success: false,
          message: "Temporary session not found",
        });
      }

      tempUser.otpVerified = true;
      await tempUser.save();

      return res.status(200).json({
        success: true,
        message: "OTP verified",
        data: {
          tempUserId: tempUser._id,
          otpVerified: true,
        },
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        return res.status(500).json({ success: false, message: err.message });
      }

      return res
        .status(500)
        .json({ success: false, message: "Unknown error occurred" });
    }
  }

  // Resend OTP
  // Resend OTP (Email Version)
  static async resendOTP(req: Request, res: Response) {
    try {
      const { email } = req.body;
      const userId = (req as any).user?.id;

      const ip = (req.ip ||
        req.headers["x-forwarded-for"] ||
        "unknown") as string;
      const userAgent = req.headers["user-agent"] || "unknown";

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required",
        });
      }

      // Rate limiting
      const remainingTime = await OTPService.getOTPRemainingTime(email);
      if (remainingTime > 570) {
        // 600 - 570 = 30 seconds
        return res.status(429).json({
          success: false,
          message: "Please wait 30 seconds before resending OTP",
          data: {
            retryAfter: remainingTime - 570,
          },
        });
      }

      // Resend OTP
      const otp = await OTPService.resendOTP(email);

      const user = await User.findById(userId);
      if (user) {
        logAuthEvent({
          userId: user._id.toString(),
          email: user.email,
          event: "otp_sent",
          success: true,
          ip,
          userAgent,
        });
      }

      return res.status(200).json({
        success: true,
        message: "OTP resent successfully",
        data: {
          email: email.replace(/(.{2}).+(@.+)/, "$1****$2"), // masking
          expiresIn: 600,
        },
      });
    } catch (error: any) {
      logger.error("Resend OTP error", error.message);
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Step 5: Update Profile (Age & Wellness Role)
  static async updateProfile(req: Request, res: Response) {
    try {
      const { ageGroup, wellnessRole } = req.body;
      const userId = (req as any).user?.id;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      user.ageGroup = ageGroup;
      user.wellnessRole = wellnessRole;
      await user.save();

      res.status(200).json({
        success: true,
        message: "Profile updated",
        data: {
          ageGroup: user.ageGroup,
          wellnessRole: user.wellnessRole,
        },
      });
    } catch (error: any) {
      logger.error("Update profile error", error.message);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Step 6: Set Goal
  static async setGoal(req: Request, res: Response) {
    try {
      const { firstGoal } = req.body;
      const userId = (req as any).user?.id;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      user.firstGoal = firstGoal;
      await user.save();

      res.status(200).json({
        success: true,
        message: "Goal set successfully",
        data: {
          firstGoal: user.firstGoal,
        },
      });
    } catch (error: any) {
      logger.error("Set goal error", error.message);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Step 7: Select Plan
  static async selectPlan(req: Request, res: Response) {
    try {
      const { plan } = req.body;
      const userId = (req as any).user?.id;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      user.plan = plan;
      await user.save();

      res.status(200).json({
        success: true,
        message: "Plan selected",
        data: {
          plan: user.plan,
        },
      });
    } catch (error: any) {
      logger.error("Select plan error", error.message);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Step 8: Complete Onboarding
  static async completeOnboarding(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      user.onboardingCompleted = true;
      await user.save();

      res.status(200).json({
        success: true,
        message: "Onboarding completed! Welcome to Skyborne!",
        data: {
          onboardingCompleted: true,
          user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
            plan: user.plan,
          },
        },
      });
    } catch (error: any) {
      logger.error("Complete onboarding error", error.message);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // Get Current User
  static async getCurrentUser(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phoneNumber: user.phoneNumber,
            role: user.role,
            ageGroup: user.ageGroup,
            wellnessRole: user.wellnessRole,
            motivation: user.motivation,
            firstGoal: user.firstGoal,
            plan: user.plan,
            onboardingCompleted: user.onboardingCompleted,
            isEmailVerified: user.isEmailVerified,
          },
        },
      });
    } catch (error: any) {
      logger.error("Get current user error", error.message);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}
