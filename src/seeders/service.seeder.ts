import mongoose from "mongoose";
import dotenv from "dotenv";
import ServiceModel from "../modules/ServiceModule/models/Service";

dotenv.config();

const services = [
  {
    title: "Yoga",
    description:
      "Gentle movement and mindful stillness blend tradition and innovation for all levels.",
    image: "/images/service1.jpg",
    isActive: true,
    order: 1,
  },
  {
    title: "Zumba Dance",
    description: "Group classes with music. Burn calories and enjoy dance.",
    image: "/images/service2.jpg",
    isActive: false,
    order: 2,
  },
  {
    title: "Diet & Nutrition",
    description:
      "Recharge focus, relieve stress, and nourish with guided meditations & nutrition support.",
    image: "/images/service3.jpg",
    isActive: true,
    order: 3,
  },
];

async function seedServices() {
  try {
    const mongoUri =
      process.env.MONGO_URI || "mongodb://127.0.0.1:27017/your-db-name";

    await mongoose.connect(mongoUri);
    await ServiceModel.deleteMany({});
    await ServiceModel.insertMany(services);
    process.exit(0);
  } catch (error) {
    console.error("Error seeding services:", error);
    process.exit(1);
  }
}

seedServices();
