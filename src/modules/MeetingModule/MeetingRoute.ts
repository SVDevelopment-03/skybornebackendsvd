import MeetingController from "./MeetingController";
import { CreateMeetingSchema, JoinMeetingSchema, LeaveMeetingSchema, UpcomingMeetingsSchema } from "./MeetingModels/MeetingValidation";

export const MeetingRoute = [
  {
    path: "/meetings/create",
    request: CreateMeetingSchema,
    action: MeetingController.CreateMeeting,
    method: "post",
  },
  //   {
  //   path: "/meetings/redirect",
  //   request: null,
  //   action: MeetingController.RedirectZoom,
  //   method: "post",
  // },
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
    path: "/meetings/getAll",
    request: UpcomingMeetingsSchema,
    action: MeetingController.getSessionsWithPagination,
    method: "get",
  },
    {
    path: "/meetings/attendance/monthly",
    request: null,
    action: MeetingController.GetMonthlyAttendance,
    method: "get",
  },
];
