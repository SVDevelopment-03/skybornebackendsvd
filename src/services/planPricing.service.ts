import mongoose from "mongoose";
import PlanModel from "../modules/PlanModule/models/Plan";

const PLAN_NAME_ALIASES: Record<string, string> = {
  "gold-yoga": "Gold Package",
  "gold-zumba": "Gold Package",
  "gold-mixed": "Gold Package",
  "diamond": "Diamond Package",
  "platinum": "Platinum Package",
  "gold package": "Gold Package",
  "diamond package": "Diamond Package",
  "platinum package": "Platinum Package",
};

const FALLBACK_PLAN_AMOUNTS: Record<string, number> = {
  "gold-yoga": 100,
  "gold-zumba": 100,
  "gold-mixed": 129.99,
  "diamond": 200,
  "platinum": 300,
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
}

function slugifyPlanName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function findPlanByName(name: string) {
  return PlanModel.findOne({
    name: { $regex: `^${escapeRegExp(name)}$`, $options: "i" },
  })
    .lean()
    .select("price name");
}

async function findPlanByKey(planKey: string) {
  const normalizedKey = String(planKey || "").trim();
  const query: any[] = [
    { uuid: normalizedKey },
    { name: { $regex: `^${escapeRegExp(normalizedKey)}$`, $options: "i" } },
  ];

  if (mongoose.Types.ObjectId.isValid(normalizedKey)) {
    query.push({ _id: normalizedKey });
  }

  const plan = await PlanModel.findOne({ $or: query })
    .lean()
    .select("price name");

  if (plan?.price != null) {
    return plan;
  }

  return null;
}

async function findPlanByBestMatch(planKey: string) {
  const normalizedKey = String(planKey || "").trim().toLowerCase();

  const aliasName = PLAN_NAME_ALIASES[normalizedKey];
  if (aliasName) {
    const aliasPlan = await findPlanByName(aliasName);
    if (aliasPlan?.price != null) {
      return aliasPlan;
    }
  }

  const allPlans = await PlanModel.find({}, { name: 1, price: 1 }).lean();
  const targetSlug = slugifyPlanName(normalizedKey);

  const bestMatch = allPlans.find((candidate) => {
    const candidateSlug = slugifyPlanName(candidate.name || "");
    return (
      candidateSlug === targetSlug ||
      candidateSlug.startsWith(targetSlug) ||
      targetSlug.startsWith(candidateSlug) ||
      candidateSlug.includes(targetSlug) ||
      targetSlug.includes(candidateSlug)
    );
  });

  if (bestMatch?.price != null) {
    return bestMatch;
  }

  return null;
}

export async function resolvePlanMonthlyPrice(planKey: string): Promise<number> {
  const normalizedPlanKey = String(planKey || "").trim();
  if (!normalizedPlanKey) {
    return 0;
  }

  let plan = await findPlanByKey(normalizedPlanKey);
  if (!plan) {
    plan = await findPlanByBestMatch(normalizedPlanKey);
  }

  if (plan?.price != null && plan.price >= 0) {
    return Number(plan.price);
  }

  const fallback = FALLBACK_PLAN_AMOUNTS[normalizedPlanKey.toLowerCase()];
  return fallback ?? 0;
}

export async function resolvePlanPrice(
  planKey: string,
  billingType: "monthly" | "yearly" = "monthly",
): Promise<number> {
  const monthlyPrice = await resolvePlanMonthlyPrice(planKey);
  if (monthlyPrice <= 0) {
    return 0;
  }
  return billingType === "yearly" ? Number((monthlyPrice * 12).toFixed(2)) : monthlyPrice;
}
