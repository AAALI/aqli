import { Suspense } from "react";
import Onboarding from "@/components/auth/Onboarding";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <Onboarding />
    </Suspense>
  );
}
