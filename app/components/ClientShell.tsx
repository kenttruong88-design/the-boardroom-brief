"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const TickerBar = dynamic(() => import("@/app/components/TickerBar"), {
  ssr: false,
  loading: () => (
    <div
      className="h-10 bg-navy-500 dark:bg-navy-600 border-b border-navy-400 dark:border-navy-500"
      aria-hidden="true"
    />
  ),
});

const LoginModal = dynamic(
  () => import("@/app/components/auth/LoginModal"),
  { ssr: false }
);

export function LazyTickerBar() {
  return (
    <Suspense
      fallback={
        <div
          className="h-10 bg-navy-500 dark:bg-navy-600 border-b border-navy-400 dark:border-navy-500"
          aria-hidden="true"
        />
      }
    >
      <TickerBar />
    </Suspense>
  );
}

export function LazyLoginModal() {
  return (
    <Suspense fallback={null}>
      <LoginModal />
    </Suspense>
  );
}
