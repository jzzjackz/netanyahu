"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";
import AppShell from "../components/AppShell";
import type { Session } from "@supabase/supabase-js";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    const ensureProfile = async () => {
      const { data: existing } = await supabase.from("profiles").select("id").eq("id", session.user.id).maybeSingle();
      if (!existing) {
        const username = session.user.email?.split("@")[0] ?? `user_${session.user.id.slice(0, 8)}`;
        await supabase.from("profiles").upsert({ id: session.user.id, username }, { onConflict: "id" });
      }
    };
    ensureProfile();
  }, [session?.user?.id, supabase]);

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#1e1f22] text-white">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (session) {
    return <AppShell />;
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-[#1e1f22] text-white">
      <div className="flex flex-col items-center gap-6 rounded-lg bg-[#313338] px-10 py-12 shadow-lg">
        <h1 className="text-3xl font-semibold">Commz</h1>
        <p className="max-w-md text-center text-sm text-gray-300">
          Discord alternative for the real commies
        </p>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="rounded bg-indigo-500 px-5 py-2 text-sm font-semibold transition hover:bg-indigo-600"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="rounded bg-white/10 px-5 py-2 text-sm font-semibold transition hover:bg-white/20"
          >
            Register
          </Link>
        </div>
      </div>
    </div>
  );
}

