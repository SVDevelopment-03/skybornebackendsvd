// FeedbackTypes.ts
export interface SubmitFeedbackRequest {
  trainerId: string;
  rating: number;
  comment: string;
}

export interface FeedbackResponse {
  id: string;
  userId: string;
  trainerId: string;
  rating: number;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeedbackListResponse {
  totalCount: number;
  averageRating: number;
  feedbacks: FeedbackResponse[];
}

export interface TrainerFeedbackStats {
  trainerId: string;
  totalFeedback: number;
  averageRating: number;
}