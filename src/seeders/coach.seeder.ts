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
        email: "priya.sharma@demo.com",
        phoneNumber: "+919876543210",
        specialization: "69240b56e41325c9e05a3142",
        experience: 5,
        charges: 0,
      },
      {
        name: "Daniel Cooper",
        email: "daniel.cooper@demo.com",
        phoneNumber: "+447700900123",
        specialization: "69240b56e41325c9e05a3143",
        experience: 7,
        charges: 0,
      },
      {
        name: "Maria Santos",
        email: "maria.santos@demo.com",
        phoneNumber: "+5511987654321",
        specialization: "69240b56e41325c9e05a3144",
        experience: 4,
        charges: 0,
      },
      {
        name: "Ayesha Khan",
        email: "ayesha.khan@demo.com",
        phoneNumber: "+971501234567",
        specialization: "69240b56e41325c9e05a3142",
        experience: 6,
        charges: 0,
      },
    ];

    // Clear existing data
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
