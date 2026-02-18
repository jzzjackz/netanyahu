"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabaseClient";
import AppShell from "../../components/AppShell";
import type { Session } from "@supabase/supabase-js";

export default function CommzPage() {
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
  }, [supabase]);

  useEffect(() => {
    if (!session?.user) return;
    const ensureProfile = async () => {
      // Check if user is banned
      const { data: ban } = await supabase
        .from("platform_bans")
        .select("id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      
      if (ban) {
        window.location.href = "/banned";
        return;
      }

      const { data: existing } = await supabase.from("profiles").select("id").eq("id", session.user.id).maybeSingle();
      if (!existing) {
        const username = session.user.email?.split("@")[0] ?? `user_${session.user.id.slice(0, 8)}`;
        await supabase.from("profiles").upsert({ id: session.user.id, username, status: 'online' }, { onConflict: "id" });
      }
    };
    ensureProfile();
  }, [session?.user?.id, supabase]);

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#313338] text-white">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (session) {
    return <AppShell />;
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#313338] text-white">
      <div className="w-full max-w-md px-6">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-[#b5bac1] hover:text-white"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to services
        </Link>
        
        <div className="rounded-lg bg-[#2b2d31] p-8 shadow-2xl">
          <div className="mb-6 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#5865f2]">
              <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
          </div>
          
          <h1 className="mb-2 text-center text-3xl font-bold">Welcome to Commz</h1>
          <p className="mb-8 text-center text-sm text-[#b5bac1]">
            Chat with friends and join communities
          </p>
          
          <div className="flex flex-col gap-3">
            <Link
              href="/login"
              className="rounded-sm bg-[#5865f2] px-5 py-2.5 text-center text-[15px] font-medium transition hover:bg-[#4752c4]"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="rounded-sm bg-[#404249] px-5 py-2.5 text-center text-[15px] font-medium transition hover:bg-[#4f5058]"
            >
              Register
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
