import * as yup from "yup";
import mongoose from "mongoose";

export const CreatePaymentOrderSchema = yup.object({
  body: yup.object({
    amount: yup
      .number()
      .typeError("Amount must be a number")
      .positive("Amount must be greater than 0")
      .required("Amount is required"),

    currency: yup
      .string()
      .trim()
      .default("AED")
      .matches(/^[A-Z]{3}$/, "Invalid currency format"),

    userId: yup
      .string()
      .required("User ID is required")
      .test("is-objectid", "Invalid User ID", (value) =>
        mongoose.Types.ObjectId.isValid(value)
      ),
      plan: yup
      .string()
      .required("Plan is required")
  }),
});
