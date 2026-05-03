export type AppRole =
  | "OWNER"
  | "MANAGER"
  | "EMPLOYEE"
  | "TEMP_WORKER"
  | "MODERATOR";

export type MarketplaceCode = "OZON" | "WB" | "YANDEX" | "OTHER";

export type ShiftPostType =
  | "URGENT_REPLACEMENT"
  | "DAY_SHIFT"
  | "PERMANENT_JOB";

export type ShiftPostStatus =
  | "PUBLISHED"
  | "IN_REVIEW"
  | "MATCHED"
  | "CLOSED"
  | "CANCELLED"
  | "EXPIRED";

export type ApplicationStatus =
  | "APPLIED"
  | "SHORTLISTED"
  | "REJECTED"
  | "WITHDRAWN"
  | "CONFIRMED"
  | "CANCELLED_BY_WORKER"
  | "CANCELLED_BY_EMPLOYER";

export type AssignmentStatus =
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "NO_SHOW"
  | "CANCELLED"
  | "DISPUTED";

export type VerificationStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

export type ReportStatus = "OPEN" | "IN_REVIEW" | "RESOLVED" | "DISMISSED";

export type ExperienceLevel =
  | "NO_EXPERIENCE"
  | "LESS_THAN_3_MONTHS"
  | "THREE_TO_TWELVE_MONTHS"
  | "ONE_PLUS_YEAR";

export type PaymentType = "FIXED_SHIFT" | "HOURLY" | "MONTHLY";

export type UserSummary = {
  id: string;
  telegramId: string;
  firstName: string;
  lastName: string | null;
  age?: number | null;
  username: string | null;
  photoUrl?: string | null;
  pickupPointCode?: string | null;
  experienceSummary?: string | null;
  isOnboardingCompleted?: boolean;
  cityName: string;
  district: string | null;
  roles: AppRole[];
  marketplaces: MarketplaceCode[];
  ratingAvg: number;
  ratingCount: number;
  completedAssignmentsCount: number;
  verificationStatus: VerificationStatus;
  isPhoneVerified: boolean;
};

export type ShiftCard = {
  id: string;
  createdByUserId?: string;
  title: string;
  type: ShiftPostType;
  status: ShiftPostStatus;
  marketplace: MarketplaceCode;
  cityName: string;
  regionName: string;
  district: string;
  address: string;
  landmark: string | null;
  shiftDate: string;
  startAt: string | null;
  endAt: string | null;
  paymentAmountRub: number;
  paymentType: PaymentType;
  experienceLevelRequired: ExperienceLevel;
  isUrgent: boolean;
  description: string;
  createdByName: string;
  applicationsCount: number;
  favorite: boolean;
};

export type ApplicationEmployerView = {
  id: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
};

export type ApplicationApplicantView = {
  id: string;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  experienceSummary: string | null;
  cityName: string;
  district: string | null;
  marketplaces: MarketplaceCode[];
  ratingAvg: number;
  completedAssignmentsCount: number;
};

export type ApplicationCard = {
  id: string;
  shiftPostId: string;
  shiftTitle: string;
  shiftMarketplace: MarketplaceCode;
  applicant: ApplicationApplicantView;
  employer: ApplicationEmployerView;
  status: ApplicationStatus;
  message: string | null;
  score: number;
  createdAt: string;
  assignment: {
    id: string;
    status: AssignmentStatus;
    completedAt: string | null;
    employerReviewSubmitted: boolean;
    workerReviewSubmitted: boolean;
  } | null;
};

export type ProfileView = UserSummary & {
  regionId?: string | null;
  cityId?: string | null;
  bio: string | null;
  phone: string | null;
  badges: string[];
  recentReviews: Array<{
    id: string;
    authorName: string;
    rating: number;
    text: string;
    createdAt: string;
  }>;
};
