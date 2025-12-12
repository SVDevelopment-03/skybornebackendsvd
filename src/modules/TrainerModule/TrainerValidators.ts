// ============================================================================
// Backend: trainerValidation.ts (Validation Schemas)
// ============================================================================
import * as Yup from "yup";

export const createTrainerSchema = Yup.object().shape({
  body: Yup.object().shape({
    name: Yup.string()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name must not exceed 100 characters")
      .required("Name is required"),
    experience: Yup.number()
      .min(0, "Experience cannot be negative")
      .max(70, "Experience cannot exceed 70 years")
      .typeError("Experience must be a number"),
  })
});

export const updateTrainerSchema = Yup.object().shape({
  body: Yup.object().shape({
    name: Yup.string()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name must not exceed 100 characters"),
    experience: Yup.number()
      .min(0, "Experience cannot be negative")
      .max(70, "Experience cannot exceed 70 years")
      .typeError("Experience must be a number"),
  }),
  query: Yup.object().nullable(),
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
