import type { Metadata } from "next";

// The login page is a Client Component, so its metadata lives here.
export const metadata: Metadata = {
  title: "Sign in",
  alternates: { canonical: "/login" },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
