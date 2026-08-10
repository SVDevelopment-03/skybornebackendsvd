export type LegacyCredits = {
  yoga: number;
  zumba: number;
  specialty: number;
};

export function migrateLegacyZumbaCredits(
  credits?: Partial<LegacyCredits> | null,
): LegacyCredits {
  const yoga = Number(credits?.yoga || 0) + Number(credits?.zumba || 0);
  return {
    yoga,
    zumba: 0,
    specialty: Number(credits?.specialty || 0),
  };
}

export function normalizePlanKeyForDisabledZumba(planKey?: string | null): string {
  const normalized = String(planKey || "").trim().toLowerCase();
  if (!normalized) return "";

  if (normalized.includes("gold-zumba") || normalized.includes("zumba")) {
    return "gold-yoga";
  }

  if (normalized.includes("gold-mixed") || normalized.includes("mixed")) {
    return "gold-yoga";
  }

  return normalized;
}

export function getServiceTitlesForDisabledZumbaPlan(planKey?: string | null): string[] {
  const normalized = String(planKey || "").trim().toLowerCase();

  if (normalized === "diamond" || normalized === "platinum") {
    return ["Yoga", "Diet & Nutrition"];
  }

  return ["Yoga"];
}

export function migrateLegacyZumbaUser(user: any) {
  if (!user) return user;

  const migratedCredits = migrateLegacyZumbaCredits(user.classCredits);
  const migratedOverallCredits = migrateLegacyZumbaCredits(user.overAllclassCredits);

  user.classCredits = migratedCredits;
  user.overAllclassCredits = migratedOverallCredits;
  user.totalClassCredits =
    Number(migratedCredits.yoga || 0) +
    Number(migratedCredits.specialty || 0);

  const normalizedPlan = normalizePlanKeyForDisabledZumba(user.plan);
  if (normalizedPlan) {
    user.plan = normalizedPlan;
  }

  return user;
}
