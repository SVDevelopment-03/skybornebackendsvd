export type Credits = {
  yoga: number;
  zumba: number;
  specialty: number;
};

export const emptyCredits = (): Credits => ({
  yoga: 0,
  zumba: 0,
  specialty: 0,
});

export const normalizeCredits = (value: any): Credits => ({
  yoga: Number(value?.yoga || 0),
  zumba: Number(value?.zumba || 0),
  specialty: Number(value?.specialty || 0),
});

export const addCredits = (current: any, additional: any): Credits => ({
  yoga: (current?.yoga || 0) + (additional?.yoga || 0),
  zumba: (current?.zumba || 0) + (additional?.zumba || 0),
  specialty: (current?.specialty || 0) + (additional?.specialty || 0),
});

export const hasActiveSubscription = (user: any): boolean => {
  if (!user?.subscription) return false;

  const status = String(user.subscription.status || "").toLowerCase();
  const endDate = user.subscription.endDate
    ? new Date(user.subscription.endDate)
    : null;

  return (
    status === "active" &&
    !!endDate &&
    !Number.isNaN(endDate.getTime()) &&
    endDate.getTime() > Date.now()
  );
};

export const getEffectiveClassCredits = (user: any): Credits => {
  if (!hasActiveSubscription(user)) return emptyCredits();
  return normalizeCredits(user.classCredits);
};

export const applySubscriptionCreditPolicy = (user: any): boolean => {
  if (!user) return false;
  if (hasActiveSubscription(user)) return false;

  const normalized = normalizeCredits(user.classCredits);
  const hadCredits = Object.values(normalized).some((value) => value > 0);

  user.classCredits = emptyCredits();
  user.subscription = {
    ...user.subscription,
    status: "expired",
  };

  return hadCredits;
};
