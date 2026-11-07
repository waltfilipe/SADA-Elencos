"use client";

import { Suspense } from "react";
import { LoadingProvider } from "@/components/LoadingProvider";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell scout-shell">
      <Suspense fallback={null}>
        <LoadingProvider>{children}</LoadingProvider>
      </Suspense>
    </div>
  );
}
