"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabaseClient";
import Link from "next/link";

export default function BannedPage() {
  const supabase = createSupabaseBrowserClient();
  const [banInfo, setBanInfo] = useState<{ reason: string; created_at: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkBan = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: ban } = await supabase
        .from("platform_bans")
        .select("reason, created_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (ban) {
        setBanInfo(ban);
      } else {
        // Not banned, redirect to commz
        window.location.href = "/commz";
      }
      setLoading(false);
    };

    checkBan();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#313338] text-white">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#313338] text-white">
      <div className="w-full max-w-md px-6">
        <div className="rounded-lg bg-[#2b2d31] p-8 shadow-2xl">
          <div className="mb-6 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500">
              <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          
          <h1 className="mb-2 text-center text-3xl font-bold">Account Banned</h1>
          <p className="mb-6 text-center text-sm text-[#b5bac1]">
            Your account has been banned from this platform
          </p>
          
          {banInfo && (
            <div className="mb-6 rounded bg-[#1e1f22] p-4">
              <p className="mb-2 text-sm font-medium text-gray-400">Reason:</p>
              <p className="mb-3 text-[15px]">{banInfo.reason}</p>
              <p className="text-xs text-gray-500">
                Banned on: {new Date(banInfo.created_at).toLocaleString()}
              </p>
            </div>
          )}
          
          <p className="mb-6 text-center text-sm text-[#b5bac1]">
            If you believe this is a mistake, please contact support.
          </p>
          
          <div className="flex flex-col gap-3">
            <button
              onClick={handleLogout}
              className="rounded-sm bg-[#404249] px-5 py-2.5 text-center text-[15px] font-medium transition hover:bg-[#4f5058]"
            >
              Logout
            </button>
            <Link
              href="/"
              className="rounded-sm bg-[#5865f2] px-5 py-2.5 text-center text-[15px] font-medium transition hover:bg-[#4752c4]"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
