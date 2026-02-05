import mongoose from "mongoose";
import FAQModel from "../modules/FAQModule/FAQModel";
import dotenv from "dotenv";

dotenv.config();

export const contentData = [
  {
    question: "How do I sign up?",
    answer:
      "Create an account using your email and phone number, verify it with the OTP, choose your wellness plan, and your account will be activated.",
    videoUrl: "https://skyborne-images.s3.ap-south-1.amazonaws.com/signup.mp4",
  },
  {
    question: "How do I subscribe?",
    answer:
      "After logging in, open the Packages section, choose a package, and complete the payment.",
  },
  {
    question: "How can I change or reset my password?",
    answer:
      "On the login screen, click the “Forgot Password” option and follow the steps to reset your password.",
    videoUrl:
      "https://skyborne-images.s3.ap-south-1.amazonaws.com/forgot-password2.mp4",
  },
];

const start = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI!);
    await FAQModel.deleteMany();
    await FAQModel.insertMany(contentData);

    process.exit();
  } catch (error) {
    console.log("❌ Seeder Error:", error);
    process.exit(1);
  }
};

start();
