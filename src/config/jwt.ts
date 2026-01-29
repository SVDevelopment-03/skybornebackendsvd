import jwt from "jsonwebtoken";

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "access-secret";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "refresh-secret";
const JWT_EXPIRES_IN = "7d";
const REFRESH_TOKEN_EXPIRES_IN = "30d";

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, JWT_ACCESS_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_ACCESS_SECRET) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  
  const verify= jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
  return verify
};

export const generateTokens = (user: any) => {
  const payload: TokenPayload = {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
  };

  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
};
