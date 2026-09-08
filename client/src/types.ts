export type UserRole = "user" | "admin";

export type User = {
  _id: string;
  email: string;
  username: string;
  role: UserRole;
  programmingLanguages: string[];
  techStack: string[];
  /** Topics the mentee wants help with — used for mentor match scoring. */
  desiredTopics?: string[];
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

export type MentorApprovalStatus = "pending" | "approved" | "rejected";

export type MentorProfile = {
  _id: string;
  userId: User | string;
  background?: string;
  topics: string[];
  maxMeetings?: number;
  meetingLength?: number;
  approvalStatus?: MentorApprovalStatus;
  rejectionReason?: string | null;
  isViewedByAdmin?: boolean;
  hasAvailability?: boolean;
  /** Overlap size between mentee interests and this mentor's topics (from GET /mentors). */
  matchScore?: number;
  /** Specific topics that overlapped with the mentee's interests. */
  matchedTopics?: string[];
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
  rescheduleInterest?: {
    mentor: AttendanceResponseValue | null;
    mentee: AttendanceResponseValue | null;
  };
  mentorSummary?: {
    content: string;
    createdAt?: string;
    updatedAt?: string;
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
  | "mentor_post_meeting_thank_you"
  | "feedback_reminder"
  | "attendance_discrepancy"
  | "reschedule_inquiry"
  | "reschedule_ready"
  | "availability_reminder"
  | "new_mentor_request"
  | "mentor_approved"
  | "mentor_rejected"
  | "additional_availability_request"
  | "additional_availability_added"
  | "additional_availability_unavailable";

export type NotificationActionStatus = "pending" | "awaiting_other" | "feedback_choice" | "answered";

export type NotificationItem = {
  _id: string;
  recipient: string;
  type: NotificationType;
  message: string;
  read: boolean;
  meetingId?: string;
  actionStatus?: NotificationActionStatus;
  actionUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type NotificationsPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type NotificationsListResponse = {
  notifications: NotificationItem[];
  unreadCount: number;
  pagination: NotificationsPagination;
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
  pending_mentee_selection: "#E5688F",
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

/** Response shape of GET /api/admin/alerts */
export type AdminAlertUser = {
  _id: string;
  username: string;
  email: string;
  mentoringSessionsCount?: number;
  menteeSessionsCount?: number;
};

export type AdminAlertMeeting = {
  _id: string;
  status: MeetingStatus;
  selectedTime?: string;
  mentorId: AdminAlertUser;
  menteeId: AdminAlertUser;
  attendanceResponses?: {
    mentor: AttendanceResponseValue | null;
    mentee: AttendanceResponseValue | null;
  };
  updatedAt?: string;
  createdAt?: string;
};

export type AdminAlerts = {
  disputes: AdminAlertMeeting[];
  missingFeedback: AdminAlertMeeting[];
  outstandingMentors: User[];
};

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
