// seeders/testimonial.seeder.ts
import mongoose from "mongoose";
import dotenv from "dotenv";
import Testimonials from "../modules/TestimonialModule/models/Testimonials";

dotenv.config();

const testimonials = [
  {
    title: "Calm Mind, Strong Body",
    description:
      "The blend of mindfulness and strength sessions is perfect. My stress has dropped, and I’ve grown more confident physically.",
    user: {
      image: "/images/user-image.png",
      name: "Priya S",
      totalClasses: 22,
    },
  },
  {
    title: "A Life-Changing Routine",
    description:
      "I love how flexible and uplifting these sessions are! I feel more energized and balanced every day.",
    user: {
      image: "/images/user-1.svg",
      name: "Rahul M",
      totalClasses: 30,
    },
  },
  {
    title: "Best Wellness Experience",
    description:
      "Everything feels personalized and supportive. I enjoy every session and look forward to the next one!",
    user: {
      image: "/images/user-2.svg",
      name: "Sneha Kapoor",
      totalClasses: 18,
    },
  },
];

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI!);
    console.log("Connected to DB");

    await Testimonials.deleteMany({});
    await Testimonials.insertMany(testimonials);

    console.log("Testimonials seeded successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Seeder Error:", err);
    process.exit(1);
  }
})();
