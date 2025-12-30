import mongoose from "mongoose";
import dotenv from "dotenv";
import { Feedback } from "../modules/FeedbackModule/FeedbackModel";
import User from "../modules/UserModule/models/User";
import Trainer from "../modules/TrainerModule/TrainerModel";

dotenv.config();

const seedFeedback = async () => {
  try {
    const mongoUri =
      process.env.MONGO_URI || "mongodb://localhost:27017/skyborne-production";

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    // ✅ DO NOT use lean() here
    const user = await User.findOne();
    const trainer = await Trainer.findOne();

    if (!user || !trainer) {
      console.error(
        "❌ Please ensure at least one User and one Trainer exist before seeding feedback"
      );
      process.exit(1);
    }

    console.log("👤 User ID:", user._id.toString());
    console.log("🧑‍🏫 Trainer ID:", trainer._id.toString());

    // Clear old feedback
    await Feedback.deleteMany({});
    console.log("🗑️ Old feedback removed");

    const feedbacks = [
      {
        userId: user._id,
        trainerId: trainer._id,
        rating: 5,
        comment:
          "Excellent session! Trainer explained each movement very clearly and calmly.",
      },
      {
        userId: user._id,
        trainerId: trainer._id,
        rating: 4,
        comment:
          "Very good class. The pace was comfortable and easy to follow.",
      },
      {
        userId: user._id,
        trainerId: trainer._id,
        rating: 5,
        comment:
          "Loved the energy of the session. Felt relaxed and refreshed afterward.",
      },
      {
        userId: user._id,
        trainerId: trainer._id,
        rating: 3,
        comment:
          "Session was decent but could have used more guidance on posture.",
      },
      {
        userId: user._id,
        trainerId: trainer._id,
        rating: 4,
        comment:
          "Trainer was supportive and motivating throughout the class.",
      },
      {
        userId: user._id,
        trainerId: trainer._id,
        rating: 5,
        comment:
          "Fantastic experience! Best session I’ve attended so far.",
      },
      {
        userId: user._id,
        trainerId: trainer._id,
        rating: 4,
        comment:
          "Good structure and flow. Would definitely attend again.",
      },
      {
        userId: user._id,
        trainerId: trainer._id,
        rating: 5,
        comment:
          "Trainer paid attention to everyone and corrected mistakes gently.",
      },
      {
        userId: user._id,
        trainerId: trainer._id,
        rating: 4,
        comment:
          "Nice balance between intensity and relaxation.",
      },
      {
        userId: user._id,
        trainerId: trainer._id,
        rating: 3,
        comment:
          "Session was okay. Some exercises felt a bit rushed.",
      },
      {
        userId: user._id,
        trainerId: trainer._id,
        rating: 5,
        comment:
          "Amazing guidance and calm voice. Very professional trainer.",
      },
      {
        userId: user._id,
        trainerId: trainer._id,
        rating: 4,
        comment:
          "Enjoyed the session. Clear instructions and positive vibe.",
      },
      {
        userId: user._id,
        trainerId: trainer._id,
        rating: 5,
        comment:
          "Highly recommended! Felt energized and confident after class.",
      },
      {
        userId: user._id,
        trainerId: trainer._id,
        rating: 4,
        comment:
          "Great session overall. Looking forward to the next one.",
      },
      {
        userId: user._id,
        trainerId: trainer._id,
        rating: 5,
        comment:
          "Perfect session length and very engaging trainer.",
      },
    ];

    await Feedback.insertMany(feedbacks);

    console.log("⭐ 15 Feedback records seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Feedback seeder error:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seedFeedback();
