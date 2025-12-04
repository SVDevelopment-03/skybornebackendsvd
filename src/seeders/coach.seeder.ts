import mongoose from "mongoose";
import Coach from "../modules/TrainerModule/TrainerModel";  
import dotenv from "dotenv";

dotenv.config();

async function seedCoaches() {
  try {
    await mongoose.connect(process.env.MONGO_URI!);
    console.log("MongoDB connected ✔️");

    const coaches = [
      {
        name: "Priya Sharma",
        specialization: "Yoga Expert",
        experience: 5,
        image: "https://example.com/priya.jpg",
      },
      {
        name: "Daniel Cooper",
        specialization: "Fitness Coach",
        experience: 7,
        image: "https://example.com/daniel.jpg",
      },
      {
        name: "Maria Santos",
        specialization: "Zumba Specialist",
        experience: 4,
        image: "https://example.com/maria.jpg",
      },
      {
        name: "Ayesha Khan",
        specialization: "Nutrition Coach",
        experience: 6,
        image: "https://example.com/ayesha.jpg",
      },
    ];

    // Clear existing data to avoid duplicates
    await Coach.deleteMany({});
    console.log("Old coach records removed");

    // Insert fresh data
    await Coach.insertMany(coaches);
    console.log("Coaches seeded successfully ✔️");

    process.exit(0);
  } catch (error) {
    console.error("Seeding error ❌:", error);
    process.exit(1);
  }
}

seedCoaches();
