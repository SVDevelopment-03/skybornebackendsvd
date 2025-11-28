import * as yup from "yup";

export const NewsLetterValidate = yup.object({
  body: yup.object({
    email: yup
      .string()
      .email("Invalid email format")
      .required("Email is required"),
  }),
});
