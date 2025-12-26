// validations/feedbackValidation.ts
import * as Yup from "yup";

export const createFeedbackValidationSchema = Yup.object({
  body: Yup.object({
    trainerId: Yup.string()
      .required("Trainer ID is required")
      .matches(/^[0-9a-fA-F]{24}$/, "Invalid trainer ID format"),
    rating: Yup.number()
      .required("Rating is required")
      .min(1, "Rating must be at least 1")
      .max(5, "Rating must not exceed 5")
      .typeError("Rating must be a number"),
    comment: Yup.string()
      .required("Comment is required")
      .min(10, "Comment must be at least 10 characters")
      .max(500, "Comment must not exceed 500 characters")
      .trim(),
  }).required(),
  query: Yup.object(),
  params: Yup.object(),
});