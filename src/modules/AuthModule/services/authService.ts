import {
  UserRole,
  AuthProvider,
} from "../../UserModule/interface/userInterface";
import { generateTokens } from "../../../config/jwt";
import { logAuthEvent } from "../../../utils/winston.utils";
import User from "../../UserModule/models/User";
import {
  BadRequestError,
  ConflictError,
} from "../../../handlers/httpError.handler";
import { SignupTypes } from "../types/signupTypes";
import TempUser from "../../UserModule/models/TempUser";
import AccountDeletionRequest from "../../UserModule/models/AccountDeletionRequest";
const normalizeEmail = (value?: string | null) => String(value ?? "").trim().toLowerCase();

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildCaseInsensitiveEmailQuery = (email?: string | null) => ({
  email: {
    $regex: `^${escapeRegExp(normalizeEmail(email))}$`,
    $options: "i",
  },
});

export class AuthService {
static async emailSignup(data: SignupTypes) {
  const {
    firstName,
    lastName,
    email,
    password,
    tempUserId,
    phoneNumber,
    ...rest
  } = data;

  const normalizedEmail = normalizeEmail(email);
  const normalizedPhoneNumber = phoneNumber?.trim();

  if (!tempUserId) throw new BadRequestError("Temp ID required");

  const tempUser = await TempUser.findById(tempUserId);
  if (!tempUser || !tempUser.otpVerified)
    throw new BadRequestError("Email not verified");

  if (normalizeEmail(tempUser.email) !== normalizedEmail)
    throw new BadRequestError("Email mismatch");

  const pendingDeletionRequest: any = await AccountDeletionRequest.findOne({
    email: normalizedEmail,
    status: "requested",
  })
    .sort({ requestedAt: -1 })
    .lean();

  const emailMatchedUser = await User.findOne(buildCaseInsensitiveEmailQuery(normalizedEmail));
  const phoneMatchedUser = normalizedPhoneNumber
    ? await User.findOne({ phoneNumber: normalizedPhoneNumber })
    : null;

  let existingUser = emailMatchedUser || phoneMatchedUser;

  if (!existingUser && pendingDeletionRequest?.userId) {
    existingUser = await User.findById(pendingDeletionRequest.userId);
  }

  let user;
  try {
    if (existingUser) {
      // If one or both fields match different users, report specific conflict
      if (emailMatchedUser && phoneMatchedUser && emailMatchedUser._id?.toString() !== phoneMatchedUser._id?.toString()) {
        throw new ConflictError("Email and phone number already in use");
      }

      const shouldReactivate = !existingUser.isActive || !!pendingDeletionRequest;

      if (shouldReactivate) {
        Object.assign(existingUser, {
          firstName,
          lastName,
          email: normalizedEmail,
          password,
          phoneNumber: normalizedPhoneNumber,
          ...rest,
          isActive: true,
          isEmailVerified: true,
          authProvider: AuthProvider.EMAIL,
        });

        await existingUser.save();

        if (pendingDeletionRequest?.userId) {
          await AccountDeletionRequest.updateMany(
            { userId: existingUser._id, status: "requested" },
            {
              $set: {
                status: "rejected",
                reviewedAt: new Date(),
                rejectionReason: "User re-registered before deletion completed",
              },
            },
          );
        }

        user = existingUser;
      } else {
        const conflicts: string[] = [];
        if (emailMatchedUser) conflicts.push("Email");
        if (phoneMatchedUser) conflicts.push("Phone number");

        const message = conflicts.length > 1 ? `${conflicts.join(' and ')} already in use` : `${conflicts[0]} already in use`;
        throw new ConflictError(message);
      }
    } else {
      user = await User.create({
        firstName,
        lastName,
        email: normalizedEmail,
        password,
        phoneNumber: normalizedPhoneNumber,
        ...rest,
        isActive: true,
        isEmailVerified: true,
        authProvider: AuthProvider.EMAIL,
      });
    }
  } catch (error: any) {
    if (error?.code === 11000 || error?.name === "MongoServerError") {
      const duplicateUser = await User.findOne({
        $or: [
          buildCaseInsensitiveEmailQuery(normalizedEmail),
          ...(normalizedPhoneNumber ? [{ phoneNumber: normalizedPhoneNumber }] : []),
        ],
      });

      if (duplicateUser && (!duplicateUser.isActive || !!pendingDeletionRequest)) {
        Object.assign(duplicateUser, {
          firstName,
          lastName,
          email: normalizedEmail,
          password,
          phoneNumber: normalizedPhoneNumber,
          ...rest,
          isActive: true,
          isEmailVerified: true,
          authProvider: AuthProvider.EMAIL,
        });

        await duplicateUser.save();

        if (pendingDeletionRequest?.userId) {
          await AccountDeletionRequest.updateMany(
            { userId: duplicateUser._id, status: "requested" },
            {
              $set: {
                status: "rejected",
                reviewedAt: new Date(),
                rejectionReason: "User re-registered before deletion completed",
              },
            },
          );
        }

        return { user: duplicateUser, tokens: generateTokens(duplicateUser) };
      }

      // Determine which field(s) caused the duplicate
      const dupConflicts: string[] = [];
      if (duplicateUser) {
        const dupEmailMatches = duplicateUser.email && normalizeEmail(duplicateUser.email) === normalizedEmail;
        const dupPhoneMatches = normalizedPhoneNumber && duplicateUser.phoneNumber === normalizedPhoneNumber;
        if (dupEmailMatches) dupConflicts.push("Email");
        if (dupPhoneMatches) dupConflicts.push("Phone number");
      }

      const dupMessage = dupConflicts.length > 1 ? `${dupConflicts.join(' and ')} already in use` : dupConflicts[0] ? `${dupConflicts[0]} already in use` : "User already exists";
      throw new ConflictError(dupMessage);
    }

    throw error;
  }

  await TempUser.findByIdAndDelete(tempUserId);

  return { user, tokens: generateTokens(user) };
}

static async googleSignup(data: any) {
  const { email, googleId, ip, userAgent, ...rest } = data;
  const normalizedEmail = normalizeEmail(email);

  if (!googleId) throw new BadRequestError("Google ID missing");

  // Step 1: Check if user already has googleId
  let user = await User.findOne({ googleId });

  if (user) {
    user.lastLogin = new Date();
    await user.save();
    return { user, tokens: generateTokens(user) };
  }

  // Step 2: Email exists → link googleId
  user = await User.findOne(buildCaseInsensitiveEmailQuery(normalizedEmail));
  if (user) {
    Object.assign(user, {
      googleId,
      authProvider: AuthProvider.GOOGLE,
      lastLogin: new Date(),
      isEmailVerified: true,
      isActive: true,
    });

    await user.save();
    return { user, tokens: generateTokens(user) };
  }

  if (googleId && rest?.password) {
  delete rest?.password;
}
  // Step 3: Create new google user
  user = await User.create({
    email: normalizedEmail,
    googleId,
    authProvider: AuthProvider.GOOGLE,
    isEmailVerified: true,
    isActive: true,
    lastLogin: new Date(),
    ...rest,
  });

  return { user, tokens: generateTokens(user) };
}

static async appleSignup(data: any) {
  const { email, appleId, ip, userAgent, ...rest } = data;
  const normalizedEmail = normalizeEmail(email);

  if (!appleId) throw new BadRequestError("Apple ID missing");

  // Step 1: Check if user already has appleId
  let user = await User.findOne({ appleId });

  if (user) {
    user.lastLogin = new Date();
    await user.save();
    return { user, tokens: generateTokens(user) };
  }

  // Step 2: Email exists → link appleId
  user = await User.findOne(buildCaseInsensitiveEmailQuery(normalizedEmail));
  if (user) {
    Object.assign(user, {
      appleId,
      authProvider: AuthProvider.APPLE,
      lastLogin: new Date(),
      isEmailVerified: true,
      isActive: true,
    });

    await user.save();
    return { user, tokens: generateTokens(user) };
  }

    if (appleId && rest?.password ) {
  delete rest?.password;
}

  // Step 3: Create new apple user
  user = await User.create({
    email: normalizedEmail,
    appleId,
    authProvider: AuthProvider.APPLE,
    isEmailVerified: true,
    isActive: true,
    lastLogin: new Date(),
    ...rest,
  });

  return { user, tokens: generateTokens(user) };
}


}
