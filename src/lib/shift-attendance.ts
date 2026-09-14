import type { ApplicationStatus, AssignmentStatus, ShiftAttendanceScore } from "@/lib/types";

export const SHIFT_ATTENDANCE_MIN_COUNT = 5;
export const SHIFT_ATTENDANCE_WARNING_PERCENTAGE = 50;

type AttendanceAssignment = {
  status: AssignmentStatus;
  applicationStatus?: ApplicationStatus | null;
};

export function calculateShiftAttendance(
  assignments: AttendanceAssignment[],
): ShiftAttendanceScore | null {
  const completedCount = assignments.filter(
    (assignment) => assignment.status === "COMPLETED",
  ).length;
  const failedCount = assignments.filter(
    (assignment) =>
      assignment.status === "NO_SHOW" ||
      (assignment.status === "CANCELLED" &&
        assignment.applicationStatus === "CANCELLED_BY_WORKER"),
  ).length;
  const totalCount = completedCount + failedCount;

  if (totalCount < SHIFT_ATTENDANCE_MIN_COUNT) {
    return null;
  }

  const percentage = Math.round((completedCount / totalCount) * 100);

  return {
    percentage,
    completedCount,
    failedCount,
    totalCount,
    warning: percentage <= SHIFT_ATTENDANCE_WARNING_PERCENTAGE,
  };
}
