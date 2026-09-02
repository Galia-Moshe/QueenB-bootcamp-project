export type UserRole = "user" | "admin";

export type User = {
  _id: string;
  email: string;
  username: string;
  role: UserRole;
  programmingLanguages: string[];
  techStack: string[];
  jobTitle?: string;
  company?: string;
  yearsOfExperience?: number;
  profilePicture?: string;
  githubLink?: string;
  linkedinLink?: string;
  mentoringSessionsCount: number;
  menteeSessionsCount: number;
  createdAt?: string;
  updatedAt?: string;
};

export type MentorProfile = {
  _id: string;
  userId: User | string;
  background?: string;
  topics: string[];
  maxMeetings?: number;
  meetingLength?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type MeetingStatus =
  | "pending_mentor_times"
  | "pending_mentee_selection"
  | "scheduled"
  | "attendance_confirmed"
  | "completed"
  | "canceled"
  | "feedback_submitted";

export type Meeting = {
  _id: string;
  mentorId: User;
  menteeId: User;
  status: MeetingStatus;
  proposedTimes: string[];
  selectedTime?: string;
  rescheduleAttempts: number;
  feedbacks: Array<{
    fromUserId: string;
    role: "mentor" | "mentee";
    content: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
};

export const statusLabels: Record<MeetingStatus, string> = {
  pending_mentor_times: "ממתינה להצעת זמנים",
  pending_mentee_selection: "ממתינה לבחירת זמן",
  scheduled: "נקבעה",
  attendance_confirmed: "הגעה אושרה",
  completed: "התקיימה",
  canceled: "בוטלה",
  feedback_submitted: "משוב נשלח",
};
