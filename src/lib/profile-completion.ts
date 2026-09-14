import type { AppRole, MarketplaceCode, VerificationStatus } from "@/lib/types";
import { isValidExperienceYears } from "@/lib/utils";

type ProfileLike = {
  firstName?: string | null;
  lastName?: string | null;
  age?: number | null;
  regionId?: string | null;
  cityId?: string | null;
  photoUrl?: string | null;
  pickupPointCode?: string | null;
  experienceSummary?: string | null;
  marketplaces?: MarketplaceCode[] | null;
  isOnboardingCompleted?: boolean | null;
  roles?: Array<{ role: AppRole }> | AppRole[];
};

function hasAtLeastOneMarketplace(profile: ProfileLike) {
  return Array.isArray(profile.marketplaces) && profile.marketplaces.length > 0;
}

function normalizeRoles(profile: ProfileLike): AppRole[] {
  if (!profile.roles) {
    return [];
  }

  return profile.roles.map((role) => (typeof role === "string" ? role : role.role));
}

export function isOwnerRole(roles: AppRole[]) {
  return roles.includes("OWNER");
}

export function isManagerRole(roles: AppRole[]) {
  return roles.includes("MANAGER");
}

export function hasEmployerCapabilities(roles: AppRole[]) {
  return isOwnerRole(roles) || isManagerRole(roles);
}

export function isEmployeeRole(roles: AppRole[]) {
  return roles.includes("EMPLOYEE") || roles.includes("TEMP_WORKER") || isManagerRole(roles);
}

export function getPrimaryRole(roles: AppRole[]) {
  if (isManagerRole(roles)) {
    return "MANAGER" as const;
  }

  if (isOwnerRole(roles)) {
    return "OWNER" as const;
  }

  if (isEmployeeRole(roles)) {
    return "EMPLOYEE" as const;
  }

  return null;
}

export function canCreateShiftPosts(
  roles: AppRole[],
  employerVerificationStatus: VerificationStatus | null | undefined,
) {
  return hasEmployerCapabilities(roles) && employerVerificationStatus === "APPROVED";
}

export function isProfileComplete(profile: ProfileLike | null | undefined) {
  if (!profile) {
    return false;
  }

  const roles = normalizeRoles(profile);
  const hasBaseFields = Boolean(
    profile.firstName?.trim() &&
      profile.lastName?.trim() &&
      profile.age &&
      profile.age >= 16 &&
      profile.age <= 99 &&
      profile.regionId &&
      roles.length,
  );

  if (!hasBaseFields) {
    return false;
  }

  if (isOwnerRole(roles)) {
    return Boolean(profile.cityId) && hasAtLeastOneMarketplace(profile);
  }

  if (isEmployeeRole(roles)) {
    // Работнику нужен город, чтобы видеть смены в своём городе.
    return Boolean(profile.cityId) && isValidExperienceYears(profile.experienceSummary);
  }

  return false;
}

export function resolveOnboardingCompleted(profile: ProfileLike | null | undefined) {
  if (!profile) {
    return false;
  }

  return Boolean(profile.isOnboardingCompleted) || isProfileComplete(profile);
}

export function getProfileCompletionScore(profile: ProfileLike | null | undefined) {
  if (!profile) {
    return 0;
  }

  const roles = normalizeRoles(profile);
  const locationCheck = Boolean(profile.regionId) && Boolean(profile.cityId);
  const checks = [
    Boolean(profile.firstName?.trim()),
    Boolean(profile.lastName?.trim()),
    Boolean(profile.age && profile.age >= 16 && profile.age <= 99),
    locationCheck,
    roles.length > 0,
    isOwnerRole(roles)
      ? hasAtLeastOneMarketplace(profile)
      : isEmployeeRole(roles)
        ? isValidExperienceYears(profile.experienceSummary)
        : false,
  ];

  const completed = checks.filter(Boolean).length;
  return completed / checks.length;
}
