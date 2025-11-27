import MeetingController from "./MeetingController";
import { CreateMeetingSchema, JoinMeetingSchema, LeaveMeetingSchema, UpcomingMeetingsSchema } from "./MeetingModels/MeetingValidation";

export const MeetingRoute = [
  {
    path: "/meetings/create",
    request: CreateMeetingSchema,
    action: MeetingController.CreateMeeting,
    method: "post",
  },
    {
    path: "/meetings/leave",
    request: LeaveMeetingSchema,
    action: MeetingController.LeaveMeeting,
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
];
