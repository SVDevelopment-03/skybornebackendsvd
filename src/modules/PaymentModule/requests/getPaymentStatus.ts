import * as Yup from "yup";

export const  GetPaymentStatusSchema = Yup.object({
  params: Yup.object({
    orderRef: Yup.string()
      .required("orderRef is required")
      .matches(/^[A-Za-z0-9\-]+$/, "Invalid orderRef format"),
  }),
});
