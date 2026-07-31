import assert from "node:assert/strict";
import test from "node:test";
import { StripeService } from "./stripe.service";

test("syncs the active subscription to the customer's default payment method", async () => {
  const calls: Array<{ id: string; data: Record<string, string> }> = [];

  (StripeService as any).stripe = {
    customers: {
      retrieve: async () => ({
        invoice_settings: {
          default_payment_method: "pm_123",
        },
      }),
    },
    subscriptions: {
      retrieve: async () => ({
        default_payment_method: "pm_old",
      }),
      update: async (id: string, data: Record<string, string>) => {
        calls.push({ id, data });
        return {};
      },
    },
  };

  const user = { _id: "user_1", stripeSubscriptionId: "sub_1" };

  await (StripeService as any).syncSubscriptionDefaultPaymentMethod(user, "cus_1");

  assert.deepStrictEqual(calls, [
    {
      id: "sub_1",
      data: { default_payment_method: "pm_123" },
    },
  ]);
});
