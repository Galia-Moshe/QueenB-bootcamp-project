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
  hasAvailability?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type MenteeProfile = {
  _id: string;
  userId: User | string;
  about?: string;
  skills: string[];
  techStack: string[];
  helpTopics: string[];
  goals?: string;
  experienceLevel?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type MentorsPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type AvailabilityWindowStatus = "available" | "pending" | "booked";

export type AvailabilityWindow = {
  _id: string;
  mentorId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: AvailabilityWindowStatus;
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
  | "feedback_submitted"
  | "disputed";

export type AttendanceResponseValue = "yes" | "no";

export type Meeting = {
  _id: string;
  mentorId: User;
  menteeId: User;
  availabilityWindowId?: AvailabilityWindow | string;
  status: MeetingStatus;
  proposedTimes: string[];
  selectedTime?: string;
  topics?: string[];
  rescheduleAttempts: number;
  attendanceResponses?: {
    mentor: AttendanceResponseValue | null;
    mentee: AttendanceResponseValue | null;
  };
  feedbacks: Array<{
    fromUserId: User | string;
    role: "mentor" | "mentee";
    content: string;
  }>;
  canceledBy?: "mentor" | "mentee" | null;
  /** Present when this meeting was fetched via GET /meetings/my?role=mentee: how many
   * qualifying (mentee-initiated) cancellations she already has with this specific mentor. */
  menteeCancellationCountWithMentor?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type NotificationType =
  | "new_meeting_request"
  | "meeting_approved"
  | "meeting_rejected"
  | "meeting_canceled"
  | "attendance_check"
  | "feedback_reminder"
  | "attendance_discrepancy";

export type NotificationActionStatus = "pending" | "awaiting_other" | "feedback_choice" | "answered";

export type NotificationItem = {
  _id: string;
  recipient: string;
  type: NotificationType;
  message: string;
  read: boolean;
  meetingId?: string;
  actionStatus?: NotificationActionStatus;
  createdAt: string;
  updatedAt: string;
};


export const statusLabels: Record<MeetingStatus, string> = {
  pending_mentor_times: "ממתינה לאישור",
  pending_mentee_selection: "ממתינה לאישור",
  scheduled: "פגישה נקבעה",
  attendance_confirmed: "הגעה אושרה",
  completed: "התקיימה פגישה",
  canceled: "בוטלה פגישה",
  feedback_submitted: "נשלח משוב",
  disputed: "במחלוקת",
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
  disputed: "#C62828",
};

export const meetingStatusOptions: MeetingStatus[] = [
  "pending_mentor_times",
  "pending_mentee_selection",
  "scheduled",
  "attendance_confirmed",
  "completed",
  "canceled",
  "feedback_submitted",
  "disputed",
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
