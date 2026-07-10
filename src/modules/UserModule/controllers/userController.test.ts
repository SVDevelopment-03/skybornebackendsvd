import assert from "node:assert/strict";
import test from "node:test";
import { anonymizeUserAccount } from "./userController";
import Payment from "../../PaymentModule/models/Payment";
import UserSubscription from "../../PaymentModule/models/Subscription";
import MeetingParticipant from "../../MeetingModule/MeetingModels/MeetingParticipant";
import MeetingAttendance from "../../MeetingModule/MeetingModels/MeetingAttendance";
import { Feedback } from "../../FeedbackModule/FeedbackModel";

test("anonymizeUserAccount clears remaining credit records", async () => {
  const originalPaymentDeleteMany = Payment.deleteMany;
  const originalSubscriptionDeleteMany = UserSubscription.deleteMany;
  const originalParticipantDeleteMany = MeetingParticipant.deleteMany;
  const originalAttendanceDeleteMany = MeetingAttendance.deleteMany;
  const originalFeedbackDeleteMany = Feedback.deleteMany;

  try {
    Payment.deleteMany = (async () => ({ deletedCount: 0 })) as typeof Payment.deleteMany;
    UserSubscription.deleteMany = (async () => ({ deletedCount: 0 })) as typeof UserSubscription.deleteMany;
    MeetingParticipant.deleteMany = (async () => ({ deletedCount: 0 })) as typeof MeetingParticipant.deleteMany;
    MeetingAttendance.deleteMany = (async () => ({ deletedCount: 0 })) as typeof MeetingAttendance.deleteMany;
    Feedback.deleteMany = (async () => ({ deletedCount: 0 })) as typeof Feedback.deleteMany;

    const user: any = {
      _id: "user-1",
      email: "user@example.com",
      firstName: "John",
      lastName: "Doe",
      phoneNumber: "+123456789",
      dialingCode: "+1",
      localNumber: "23456789",
      ngeniusCustomerId: "ngenius-1",
      stripeCustomerId: "stripe-1",
      stripeSubscriptionId: "sub-1",
      classCredits: { yoga: 2, zumba: 1, specialty: 3 },
      overAllclassCredits: { yoga: 5, zumba: 2, specialty: 1 },
      totalClassCredits: 9,
      subscription: { status: "active", endDate: new Date() },
      isActive: true,
      onboardingCompleted: true,
      save: async function () {
        return this;
      },
    };

    await anonymizeUserAccount(user);

    assert.deepEqual(user.classCredits, { yoga: 0, zumba: 0, specialty: 0 });
    assert.deepEqual(user.overAllclassCredits, { yoga: 0, zumba: 0, specialty: 0 });
    assert.equal(user.totalClassCredits, 0);
    assert.equal(user.subscription.status, "cancelled");
    assert.equal(user.isActive, false);
    assert.equal(user.onboardingCompleted, false);
    assert.match(user.email, /^deleted\+user-1@remove\.local$/);
  } finally {
    Payment.deleteMany = originalPaymentDeleteMany;
    UserSubscription.deleteMany = originalSubscriptionDeleteMany;
    MeetingParticipant.deleteMany = originalParticipantDeleteMany;
    MeetingAttendance.deleteMany = originalAttendanceDeleteMany;
    Feedback.deleteMany = originalFeedbackDeleteMany;
  }
});
