import * as yup from "yup";

const sendOtpValidation = yup.object({
  body: yup.object({
    email: yup
      .string()
      .email("Invalid email format")
      .required("Email is required"),
  }),
});

export default sendOtpValidation;

const verifyOtpValidation = yup.object({
  body: yup.object({
    email: yup
      .string()
      .email("Invalid email format")
      .required("Email is required"),

    otp: yup
      .string()
      .matches(/^\d{6}$/, "OTP must be 6 digits")
      .required("OTP is required"),
  }),
});

export { verifyOtpValidation };
