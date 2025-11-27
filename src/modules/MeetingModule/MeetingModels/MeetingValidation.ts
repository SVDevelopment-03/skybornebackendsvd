import * as yup from "yup";

export const CreateMeetingSchema = yup.object({
  body: yup.object({
    topic: yup.string().required("Topic is required"),
    start_time: yup
      .string()
      .required("Start time is required")
      .matches(
        /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z?/,
        "Start time must be ISO format"
      ),

  // Local time (non-ISO allowed)
  local_time: yup
    .string()
    .required("Local time is required")
    .matches(
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/,
      "localTime must be valid local datetime"
    ),
    duration: yup
      .number()
      .required("Duration is required")
      .min(1, "Minimum duration is 1 minute"),
    adminId: yup.string().required("Admin ID is required"),
  }),
});

export const JoinMeetingSchema = yup.object({
  body: yup.object({
    meetingId: yup.string().required("Meeting ID is required"),
    userId: yup.string().required("User ID is required"),
  }),
});

export const LeaveMeetingSchema = yup.object({
  body: yup.object({
    attendanceId: yup.string().required("Attendance ID is required"),
    userId: yup.string().optional(),
  }),
});

export const UpcomingMeetingsSchema = yup.object({
  body: yup.object({}),
});
