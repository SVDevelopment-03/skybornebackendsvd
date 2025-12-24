import MeetingController from "./MeetingController";
import {
  CreateMeetingSchema,
  JoinMeetingSchema,
  LeaveMeetingSchema,
  UpcomingMeetingsSchema,
} from "./MeetingModels/MeetingValidation";

export const MeetingRoute = [
  {
    path: "/meetings/create",
    request: CreateMeetingSchema,
    action: MeetingController.CreateMeeting,
    method: "post",
  },
  {
    path: "/meetings/join",
    request: JoinMeetingSchema,
    action: MeetingController.JoinMeeting,
    method: "post",
  },
  {
    path: "/meetings/upcoming",
    request: UpcomingMeetingsSchema,
    action: MeetingController.GetUpcomingMeetings,
    method: "get",
  },
  {
    path: "/meetings/trainer/upcoming",
    request: UpcomingMeetingsSchema,
    action: MeetingController.GetTrainerUpcomingMeetings,
    method: "get",
  },

  {
    path: "/meetings/getAll",
    request: null,
    action: MeetingController.getAllMeetings,
    method: "get",
  },
  {
    path: "/meetings/attendance/monthly",
    request: null,
    action: MeetingController.GetMonthlyAttendance,
    method: "get",
  },
  {
    path: "/meetings/:id",
    request: null,
    action: MeetingController.GetMeetingById,
    method: "get",
  },
  {
    path: "/meetings/:id",
    request: null,
    action: MeetingController.UpdateMeeting,
    method: "patch",
  },
  {
    path: "/meetings/:id",
    request: null,
    action: MeetingController.DeleteMeeting,
    method: "delete",
  },
];
