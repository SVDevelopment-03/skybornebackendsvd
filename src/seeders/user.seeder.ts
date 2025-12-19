import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../modules/UserModule/models/User"; // Adjust path to your User model
import dotenv from "dotenv";

dotenv.config();

const seedAdmin = async () => {
  try {
    // Connect to MongoDB
    const mongoUri =
      process.env.MONGO_URI || "mongodb://localhost:27017/skyborne-production";
    console.log("Connecting to MongoDB:", mongoUri.split("@")[1]); // Log without password

    await mongoose.connect(mongoUri);

    console.log("Connected to MongoDB");

    // Force a direct database query with lean() to bypass Mongoose cache
    const existingAdmin = await User.findOne({
      email: "info@skybornedrop.com",
    }).lean();

    console.log(
      "Checking for existing admin with email: info@skybornedrop.com"
    );
    console.log("Existing admin found:", existingAdmin ? "Yes" : "No");

    if (existingAdmin) {
      console.log("Deleting existing admin...");
      await User.deleteOne({ _id: existingAdmin._id });
      console.log("Deleted existing admin");
    }

    // Create admin user
    // DO NOT hash password here - let Mongoose pre-save hook handle it
    const adminUser = new User({
      firstName: "Admin",
      lastName: "Skyborne",
      email: "info@skybornedrop.com",
      password: "Admin123@$#k",
      country: "United Arab Emirates",
      countryCode: "AE",
      localNumber: "",
      dialingCode: "+971",
      authProvider: "email",
      phoneNumber: "",
      ageGroup: "",
      wellnessRole: "",
      motivation: "",
      firstGoal: "",
      agreeTerms: true,
      plan: "diamond",
      classCredits: {
        yoga: 0,
        zumba: 0,
        specialty: 0,
      },
      subscription: {
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        status: "active",
        suspendedAt: null,
        cancelledAt: null,
      },
      role: "admin",
      isActive: true,
      isEmailVerified: true,
      onboardingCompleted: true,
      lastLogin: new Date(),
    });

    // Save the admin user
    const savedAdmin = await adminUser.save();
    console.log("✓ Admin user created successfully!");
    console.log("  Email: info@skybornedrop.com");
    console.log("  Password: Admin123@$#k");
    console.log("  User ID:", savedAdmin._id);

    // Verify it was saved
    const verifyAdmin = await User.findOne({
      email: "info@skybornedrop.com",
    }).lean();
    console.log(
      "✓ Verification - Admin found in database:",
      verifyAdmin ? "Yes" : "No"
    );

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Error seeding admin user:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seedAdmin();
