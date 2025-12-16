
import * as Yup from "yup";

export const createTrainerSchema = Yup.object().shape({
  body: Yup.object().shape({
    name: Yup.string()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name must not exceed 100 characters")
      .required("Name is required"),
    email: Yup.string()
      .email("Enter a valid email address")
      .required("Email is required"),
    phoneNumber: Yup.string()
      .matches(
        /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/,
        "Enter a valid phone number"
      ),
    experience: Yup.number()
      .min(0, "Experience cannot be negative")
      .max(70, "Experience cannot exceed 70 years")
      .typeError("Experience must be a number"),
    charges: Yup.number()
      .min(0, "Charges cannot be negative")
      .required("Charges per session is required"),
    specialization: Yup.string(),
  }),
});

export const updateTrainerSchema = Yup.object().shape({
  body: Yup.object().shape({
    name: Yup.string()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name must not exceed 100 characters"),
    email: Yup.string().email("Enter a valid email address"),
    phoneNumber: Yup.string()
      .matches(
        /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/,
        "Enter a valid phone number"
      ),
    experience: Yup.number()
      .min(0, "Experience cannot be negative")
      .max(70, "Experience cannot exceed 70 years")
      .typeError("Experience must be a number"),
    charges: Yup.number().min(0, "Charges cannot be negative"),
    specialization: Yup.string(),
  }),
  params: Yup.object().shape({
    id: Yup.string().required("ID is required"),
  }),
});

export const getTrainerByIdSchema = Yup.object().shape({
  body: Yup.object().nullable(),
  query: Yup.object().nullable(),
  params: Yup.object().shape({
    id: Yup.string().required("ID is required"),
  }),
});

export const deleteTrainerSchema = Yup.object().shape({
  body: Yup.object().nullable(),
  query: Yup.object().nullable(),
  params: Yup.object().shape({
    id: Yup.string().required("ID is required"),
  }),
});

export const getTrainersSchema = Yup.object().shape({
  body: Yup.object().nullable(),
  query: Yup.object().shape({
    page: Yup.number().positive("Page must be positive").default(1),
    limit: Yup.number().positive("Limit must be positive").default(10),
    search: Yup.string().notRequired(),
  }),
  params: Yup.object().nullable(),
});
