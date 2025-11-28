import * as yup from "yup";

export const consultationSchema = yup.object({
  body: yup.object({
    name: yup
      .string()
      .required("Name is required")
      .min(3, "Name should be at least 3 characters"),

    email: yup
      .string()
      .email("Invalid email format")
      .required("Email is required"),

    phone: yup
      .string()
      .required("Phone number is required")
      .matches(/^[0-9]{10}$/, "Phone number must be 10 digits"),

    service: yup.string().required("Please select a service"),

    message: yup
      .string()
      .required("Message is required")
      .min(10, "Message should be at least 10 characters"),
  }),
});
