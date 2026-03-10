import cron from "node-cron";
import RecurringPaymentFailure from "../modules/PaymentModule/models/RecurringPaymentFailure";
import Payment from "../modules/PaymentModule/models/Payment";
import User from "../modules/UserModule/models/User";

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

export const runRecurringFailureSubscriptionInactiveOnce = async () => {
  try {
    const failedEntries = await RecurringPaymentFailure.find({
      $or: [{ status: "processing" }, { status: { $exists: false } }],
    })
      .sort({ failedAt: 1 })
      .limit(500)
      .lean();

    if (!failedEntries.length) {
      return;
    }

    const now = Date.now();

    for (const entry of failedEntries) {
      try {
        const entryId = String(entry._id);
        const email = String(entry.email || "").trim().toLowerCase();
        const failedAtMs = new Date(entry.failedAt).getTime();

        if (Number.isNaN(failedAtMs)) {
          console.warn("[RecurringFailureInactiveCron] invalid failedAt on entry", {
            entryId,
            email,
            failedAt: entry.failedAt,
          });

          await RecurringPaymentFailure.updateOne(
            { _id: entry._id },
            { $set: { status: "cancelled" } },
          );
          continue;
        }

        const isPast48Hours = now - failedAtMs >= FORTY_EIGHT_HOURS_MS;

        if (!isPast48Hours) {
          continue;
        }

        const user =
          (entry.userId
            ? await User.findById(entry.userId).select("subscription email")
            : null) || (email ? await User.findOne({ email }).select("subscription email") : null);

        if (!user) {
          console.warn("[RecurringFailureInactiveCron] user not found for entry", {
            entryId,
            email,
          });
        } else {
          const recoveredPayment = await Payment.findOne({
            userId: user._id,
            gateway: "stripe",
            status: "COMPLETED",
            isRecurring: true,
            verifiedAt: { $gte: new Date(failedAtMs) },
          })
            .sort({ verifiedAt: -1 })
            .select("_id verifiedAt")
            .lean();

          if (recoveredPayment) {
            await RecurringPaymentFailure.deleteOne({ _id: entry._id });
            console.log("[RecurringFailureInactiveCron] payment recovered, entry removed", {
              entryId,
              userId: String(user._id),
              email,
              paymentId: String(recoveredPayment._id),
            });
            continue;
          }

          if (user.subscription?.status !== "inactive") {
            await User.updateOne(
              { _id: user._id },
              {
                $set: {
                  "subscription.status": "inactive",
                },
              },
            );
          }
        }

        await RecurringPaymentFailure.updateOne(
          { _id: entry._id },
          { $set: { status: "cancelled" } },
        );

        console.log("[RecurringFailureInactiveCron] entry marked cancelled", {
          entryId,
          userId: user?._id ? String(user._id) : null,
          email,
        });
      } catch (entryError: any) {
        console.error("[RecurringFailureInactiveCron] entry processing failed", {
          entryId: String(entry._id),
          error: entryError?.message || entryError,
        });
      }
    }
  } catch (error: any) {
    console.error("[RecurringFailureInactiveCron] run failed", error?.message || error);
  }
};

export const startRecurringFailureSubscriptionInactiveCron = () => {
  // Run once on startup so pending entries are handled immediately.
  runRecurringFailureSubscriptionInactiveOnce().catch((error: any) => {
    console.error(
      "[RecurringFailureInactiveCron] startup run failed",
      error?.message || error,
    );
  });

  // Run twice a day at 12:10 AM and 12:10 PM (IST)
  cron.schedule(
    "10 0,12 * * *",
    async () => {
      await runRecurringFailureSubscriptionInactiveOnce();
    },
    {
      timezone: "Asia/Kolkata",
    },
  );

  console.log("[RecurringFailureInactiveCron] started (twice daily at 00:10 and 12:10 IST)");
};
