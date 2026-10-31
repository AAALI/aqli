"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthStage } from "@/components/auth/AuthShell";
import EmailAuthForm from "@/components/auth/EmailAuthForm";
import { authPageHref, safeAuthNext } from "@/lib/auth/email";

export default function LoginPage() {
  return <Suspense fallback={null}><LoginForm /></Suspense>;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeAuthNext(params.get("next"));
  const failedLink = params.get("notice") === "link_failed";

  useEffect(() => {
    let active = true;
    createClient().auth.getUser().then(({ data }) => {
      if (active && data.user) router.replace(next);
    }).catch(() => {});
    return () => { active = false; };
  }, [router, next]);

  return (
    <AuthStage>
      <EmailAuthForm
        next={next} shouldCreateUser={false} allowPassword
        title="Sign in." eyebrow="Welcome back" description="A link and a code. No password to remember."
        notice={failedLink ? "That link couldn't sign you in. Enter the code from the email, or request a new message. Links can expire, be used already, or require the browser that requested them." : null}
        footer={<span className="ob-skip">New here? <Link href={authPageHref("/signup", next)} style={{ color: "var(--accent)", textDecoration: "underline" }}>Create an account</Link></span>}
      />
    </AuthStage>
  );
}
