"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";

import type { AppRole } from "@/lib/types";

export type AppSessionState = {
  roles: AppRole[];
  onboardingCompleted: boolean | null;
};

export type ProfileUpdatedEventDetail = {
  onboardingCompleted?: boolean;
  roles?: AppRole[];
};

const AppSessionContext = createContext<AppSessionState>({
  roles: [],
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
