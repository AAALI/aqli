"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [workspaceName, setWorkspaceName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // When a user is already signed in (e.g. came from /signup?step=workspace),
  // we only need the workspace name.
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setLoggedIn(!!data.user));
  }, [supabase]);

  async function createWorkspace() {
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: workspaceName }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Could not create workspace");
    }
    const { workspace } = await res.json();
    router.push(`/w/${workspace.slug}`);
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (!loggedIn) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        if (!data.session) {
          setNotice(
            "Account created. Check your email to confirm, then log in to finish setup.",
          );
          setBusy(false);
          return;
        }
      }
      await createWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold">Aqli</h1>
        <p className="mb-6 text-sm text-neutral-500">
          Create your team knowledge base.
        </p>
        <form
          onSubmit={submit}
          className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-6"
        >
          <h2 className="text-lg font-medium">
            {loggedIn ? "Name your workspace" : "Sign up"}
          </h2>
          <Input
            placeholder="Workspace name (e.g. Tabadulat)"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            required
          />
          {!loggedIn && (
            <>
              <Input
                type="email"
                placeholder="you@team.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                type="password"
                placeholder="Password (min 6 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {notice && <p className="text-sm text-green-700">{notice}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create workspace"}
          </Button>
          {!loggedIn && (
            <p className="text-center text-sm text-neutral-500">
              Already have an account?{" "}
              <Link href="/login" className="text-neutral-900 underline">
                Log in
              </Link>
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
