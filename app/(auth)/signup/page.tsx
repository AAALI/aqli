import type { Metadata } from "next";
import { Suspense } from "react";
import Onboarding from "@/components/auth/Onboarding";

export const metadata: Metadata = {
  title: "Create your workspace",
  description:
    "Sign up for Aqli Cloud — the shared knowledge base for humans and AI agents. Free while in beta.",
  alternates: { canonical: "/signup" },
};

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <Onboarding />
    </Suspense>
  );
}
