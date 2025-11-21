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

  if (!tempUserId) throw new BadRequestError("Temp ID required");

  const tempUser = await TempUser.findById(tempUserId);
  if (!tempUser || !tempUser.otpVerified)
    throw new BadRequestError("Email not verified");

  if (tempUser.email !== email)
    throw new BadRequestError("Email mismatch");

  const existing = await User.findOne({ email });
  if (existing) throw new ConflictError("User already exists");

  const user = await User.create({
    firstName,
    lastName,
    email,
    password,
    phoneNumber,
    ...rest,
    isActive: true,
    isEmailVerified: true,
    authProvider: AuthProvider.EMAIL,
  });

  await TempUser.findByIdAndDelete(tempUserId);

  return { user, tokens: generateTokens(user) };
}

static async googleSignup(data: any) {
  const { email, googleId, ip, userAgent, ...rest } = data;

  if (!googleId) throw new BadRequestError("Google ID missing");

  // Step 1: Check if user already has googleId
  let user = await User.findOne({ googleId });

  if (user) {
    user.lastLogin = new Date();
    await user.save();
    return { user, tokens: generateTokens(user) };
  }

  // Step 2: Email exists → link googleId
  user = await User.findOne({ email });
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
    email,
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

  if (!appleId) throw new BadRequestError("Apple ID missing");

  // Step 1: Check if user already has appleId
  let user = await User.findOne({ appleId });

  if (user) {
    user.lastLogin = new Date();
    await user.save();
    return { user, tokens: generateTokens(user) };
  }

  // Step 2: Email exists → link appleId
  user = await User.findOne({ email });
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
    email,
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
