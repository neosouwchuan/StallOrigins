import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type Role = "contributor" | "moderator" | "admin";

export interface Profile {
  id: string;
  display_name: string | null;
  role: Role;
}

export interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isModerator: boolean;
}

/** Track the Supabase auth session and the signed-in user's profile (role). */
export function useSession(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setSession(s),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session) {
      setProfile(null);
      return;
    }
    supabase
      .from("profiles")
      .select("id,display_name,role")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => setProfile((data as Profile) ?? null));
  }, [session]);

  const role = profile?.role;
  return {
    session,
    profile,
    loading,
    isModerator: role === "moderator" || role === "admin",
  };
}
