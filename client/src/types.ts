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

export type AvailabilityWindow = {
  _id: string;
  mentorId: string;
  date: string;
  startTime: string;
  endTime: string;
  meetingLength: number;
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
    fromUserId: User | string;
    role: "mentor" | "mentee";
    content: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
};

export const statusLabels: Record<MeetingStatus, string> = {
  pending_mentor_times: "ממתינה להצעת זמנים",
  pending_mentee_selection: "ממתינה לבחירת זמן",
  scheduled: "פגישה נקבעה",
  attendance_confirmed: "הגעה אושרה",
  completed: "התקיימה פגישה",
  canceled: "בוטלה פגישה",
  feedback_submitted: "נשלח משוב",
};

/** Calendar / chip colors keyed by meeting status */
export const statusColors: Record<MeetingStatus, string> = {
  pending_mentor_times: "#B26A00",
  pending_mentee_selection: "#C85C8E",
  scheduled: "#146C94",
  attendance_confirmed: "#2E7D62",
  completed: "#5B8C5A",
  canceled: "#9E9E9E",
  feedback_submitted: "#6A4C93",
};

export const meetingStatusOptions: MeetingStatus[] = [
  "pending_mentor_times",
  "pending_mentee_selection",
  "scheduled",
  "attendance_confirmed",
  "completed",
  "canceled",
  "feedback_submitted",
];

/** Response shape of GET /api/admin/statistics */
export type AdminStatistics = {
  mentees: {
    totalMentees: number;
    totalDualRole: number;
  };
  mentors: {
    activeMentors: number;
    totalMentors: number;
  };
  meetings: {
    byStatus: Record<MeetingStatus, number>;
    thisWeek: number;
    thisMonth: number;
  };
  feedback: {
    responseRate: number;
    averageRating: number | null;
  };
  demand: {
    topTopics: Array<{ name: string; count: number }>;
    topTechStacks: Array<{ name: string; count: number }>;
    topProgrammingLanguages: Array<{ name: string; count: number }>;
  };
  bottlenecks: {
    cancellationRate: number;
    mentorsAtCapacity: number;
  };
  growth: {
    newUsersThisMonth: number;
    mentorToMenteeRatio: number;
  };
};
