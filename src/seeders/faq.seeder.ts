import mongoose from "mongoose";
import FAQModel from "../modules/FAQModule/FAQModel";
import dotenv from "dotenv";

dotenv.config();

export const contentData = [
  {
    question: "How do I sign up?",
    answer:
      "Create an account using your email and phone, verify it with the OTP, choose you wellness plan  and your account will be activated.",
  },
  {
    question: "How do I subscribe?",
    answer:
      "After logging in, open packages section, choose a package, and complete your payment.",
  },
];


const start = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI!);

    console.log("🌿 Database Connected");

    await FAQModel.deleteMany();
    console.log("🗑️ Old FAQ data removed");

    await FAQModel.insertMany(contentData);
    console.log("✅ New FAQ data inserted");

    process.exit();
  } catch (error) {
    console.log("❌ Seeder Error:", error);
    process.exit(1);
  }
};

start();
