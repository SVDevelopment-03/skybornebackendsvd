export enum UserRole {
  ADMIN = "admin",
  MEMBER = "user",
  TRAINER = "trainer",
}

export enum AuthProvider {
  EMAIL = "email",
  GOOGLE = "google",
  APPLE = "apple",
}

export interface IUser extends Document {
  // Step 2: Account Creation
  firstName: string;
  lastName?: string;
  email: string;
  password?: string;
  country: string;
  countryCode: string;
  dialingCode: string;
  localNumber: string;

  // OAuth
  authProvider: AuthProvider;
  googleId?: string;
  appleId?: string;

  // Step 3 & 4: Security
  phoneNumber?: string;

  // Step 5: Profile
  ageGroup?: string;
  wellnessRole?: string;
  agreeTerms: boolean;

  // Step 1: Motivation
  motivation?: string;

  // Step 6: Goals
  firstGoal?: string;

  // Step 7: Plan Selection
  plan?: "gold-yoga" | "gold-zumba" | "gold-mixed" | "diamond" | "platinum";

  // Class Credits
  classCredits: {
    yoga: number;
    zumba: number;
    specialty: number;
  };

  // Subscription
  subscription: {
    startDate: Date | null;
    endDate: Date | null;
    status: "active" | "expired" | "inactive";
  };

  // System
  role: UserRole;
  isActive: boolean;
  isEmailVerified: boolean;
  onboardingCompleted: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;

  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateOTP(): string;
  verifyOTP(otp: string): boolean;
}

export type PlanType =
  | "gold-yoga"
  | "gold-zumba"
  | "gold-mixed"
  | "diamond"
  | "platinum";

  export type ServiceType = "yoga"| "zumba"| "specialty"