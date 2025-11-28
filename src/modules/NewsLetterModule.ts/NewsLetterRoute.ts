import NewsletterController from "./NewsLetterController";
import { NewsLetterValidate } from "./NewsLetterValidate";

export const NewsLetterRoute = [
  {
    path: "/news-letter",
    request: NewsLetterValidate,
    action: NewsletterController.subscribe,
    method: "post",
  },
];
