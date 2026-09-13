import { useState } from "react";
import { supabase } from "../lib/supabase";
import type { AuthState } from "../lib/useSession";

/** Passwordless sign-in (magic link) + signed-in status. */
export function AuthBar({ auth }: { auth: AuthState }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (auth.session) {
    const role = auth.profile?.role;
    return (
      <div className="flex items-center gap-2 text-[11px]">
        <span className="text-slate-500">
          {auth.session.user.email}
          {role && role !== "contributor" ? ` · ${role}` : ""}
        </span>
        <button
          onClick={() => supabase?.auth.signOut()}
          className="rounded bg-slate-100 px-2 py-0.5 text-slate-600 hover:bg-slate-200"
        >
          Sign out
        </button>
      </div>
    );
  }

  if (sent) {
    return (
      <span className="text-[11px] text-green-700">
        Check your email for a sign-in link.
      </span>
    );
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !email) return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) setErr(error.message);
    else setSent(true);
  }

  return (
    <form onSubmit={signIn} className="flex items-center gap-1">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email to sign in"
        className="w-36 rounded border border-slate-200 px-2 py-0.5 text-[11px]"
      />
      <button
        disabled={busy}
        className="rounded bg-green-700 px-2 py-0.5 text-[11px] text-white disabled:opacity-50"
      >
        {busy ? "…" : "Sign in"}
      </button>
      {err && <span className="text-[10px] text-red-600">{err}</span>}
    </form>
  );
}
