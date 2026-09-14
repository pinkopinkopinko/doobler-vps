"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";

import type { AppRole, VerificationStatus } from "@/lib/types";

export type AppSessionState = {
  roles: AppRole[];
  employerVerificationStatus: VerificationStatus | null;
  onboardingCompleted: boolean | null;
};

export type ProfileUpdatedEventDetail = {
  onboardingCompleted?: boolean;
  roles?: AppRole[];
  employerVerificationStatus?: VerificationStatus | null;
};

const AppSessionContext = createContext<AppSessionState>({
  roles: [],
  employerVerificationStatus: null,
  onboardingCompleted: null,
});

export function AppSessionProvider({
  value,
  children,
}: {
  value: AppSessionState;
  children: ReactNode;
}) {
  return <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>;
}

export function useAppSession() {
  return useContext(AppSessionContext);
}
