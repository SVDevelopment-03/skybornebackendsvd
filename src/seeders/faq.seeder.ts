import mongoose from "mongoose";
import FAQModel from "../modules/FAQModule/FAQModel";
import dotenv from "dotenv";

dotenv.config();

export const contentData = [
  {
    question: "What types of wellness classes do you offer?",
    answer:
      "  Lorem ipsum dolor sit amet consectetur adipisicing elit. Id natus aliquid laborum consequatur debitis similique, illo voluptatum quo molestias possimus officia tempore vitae tenetur velit. Quae eius totam ducimus nobis.",
  },
  {
    question: "Do I need prior experience to join Skyborne programs?",
    answer:
      "  Lorem ipsum dolor sit amet consectetur adipisicing elit. Id natus aliquid laborum consequatur debitis similique, illo voluptatum quo molestias possimus officia tempore vitae tenetur velit. Quae eius totam ducimus nobis.",
  },
  {
    question: "How do I book a class or coaching session?",
    answer:
      "  Lorem ipsum dolor sit amet consectetur adipisicing elit. Id natus aliquid laborum consequatur debitis similique, illo voluptatum quo molestias possimus officia tempore vitae tenetur velit. Quae eius totam ducimus nobis.",
  },
  {
    question: "What should I bring to a yoga or fitness session?",
    answer:
      "  Lorem ipsum dolor sit amet consectetur adipisicing elit. Id natus aliquid laborum consequatur debitis similique, illo voluptatum quo molestias possimus officia tempore vitae tenetur velit. Quae eius totam ducimus nobis.",
  },
  {
    question: "Are nutritional plans personalized for each member?",
    answer:
      "  Lorem ipsum dolor sit amet consectetur adipisicing elit. Id natus aliquid laborum consequatur debitis similique, illo voluptatum quo molestias possimus officia tempore vitae tenetur velit. Quae eius totam ducimus nobis.",
  },
  {
    question: "How often are workshops or special events held?",
    answer:
      "  Lorem ipsum dolor sit amet consectetur adipisicing elit. Id natus aliquid laborum consequatur debitis similique, illo voluptatum quo molestias possimus officia tempore vitae tenetur velit. Quae eius totam ducimus nobis.",
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
