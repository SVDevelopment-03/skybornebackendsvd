import FAQController from "./FAQController";

export const FAQRoute = [
  {
    path: "/faq",
    request: null,
    action: FAQController.getAll,
    method: "get",
  },
];
