import mongoose from "mongoose";
import Plan from "../modules/PlanModule/models/Plan";
import dotenv from "dotenv";

dotenv.config();

// const plans = [
//   {
//     name: "Basic",
//     features: [
//       "Access to 4 group sessions/week",
//       "All Starter benefits",
//       "Downloadable resources",
//       "Session reminders",
//       "Personal progress dashboard",
//     ],
//     image: "/images/basic-plan.svg",
//     order: 1,
//     price: 0
//   },
//   {
//     name: "Pro",
//     features: [
//       "Unlimited group sessions/month",
//       "All Basic benefits",
//       "Priority booking",
//       "Early access to new programs",
//       "Dedicated instructor Q&A",
//       "Wellness milestone rewards",
//     ],
//     image: "/images/subscribe.svg",
//     order: 2,
//     price: 0
//   },
//   {
//     name: "Elite",
//     features: [
//       "Unlimited sessions + 1:1 instructor consult/month",
//       "Exclusive webinars & workshops",
//       "Advanced analytics & AI recommendations",
//       "Member badge and invites to Skyborne events",
//     ],
//     image: "/images/elit-plan.svg",
//     order: 3,
//     price: 0
//   },
// ];

const plans = [
  {
    name: "Gold Package",
    description: "Wellness for beginners or focused paths.",
    price: 100,
    image: "/images/basic-plan.svg",
    features: ["Includes 2 classes per month"],
    options: [
      { label: "2 Yoga", value: "2_yoga" },
      { label: "2 Zumba", value: "2_zumba" },
      { label: "Mixed (1 Yoga + 1 Zumba)", value: "mixed" },
    ],
    order: 1,
  },

  {
    name: "Diamond Package",
    description: "Balance, variety, and tools for steady progress.",
    price: 200,
    image: "/images/subscribe.svg",
    features: ["2 Yoga Classes", "2 Zumba Classes"],
    options: [],
    order: 2,
  },

  {
    name: "Platinum Package",
    description: "Full access for holistic living and big goals",
    price: 300,
    image: "/images/elit-plan.svg",
    features: ["2 Yoga Classes", "2 Zumba Classes", "1 Specialized Class"],
    options: [],
    order: 3,
  },
];
(async () => {
  await mongoose.connect(process.env.MONGO_URI!);

  await Plan.deleteMany({});
  await Plan.insertMany(plans);

  process.exit(0);
})();
