"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "../../../lib/supabaseClient";

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;
  const [status, setStatus] = useState<"loading" | "joined" | "error" | "login">("loading");
  const [message, setMessage] = useState("");
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    if (!code) {
      setStatus("error");
      setMessage("Invalid invite link");
      return;
    }
    const join = async () => {
      // Check if user is logged in (you'll need to implement your own auth check)
      // For now, we'll try to get a session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        setStatus("login");
        return;
      }

      // Look up the invite code
      const { data: invite, error: inviteError } = await supabase
        .from("invite_codes")
        .select("server_id")
        .eq("code", code)
        .maybeSingle();

      if (inviteError || !invite) {
        setStatus("error");
        setMessage("Invite link expired or invalid");
        return;
      }

      // Try to join the server using auth.user.id directly
      const { error: joinError } = await supabase
        .from("server_members")
        .insert({
          server_id: invite.server_id,
          user_id: session.user.id,
          role: "member",
        });

      if (joinError) {
        if (joinError.code === "23505") {
          setMessage("You're already in this server");
          setStatus("joined");
        } else {
          setStatus("error");
          setMessage(joinError.message);
          return;
        }
      } else {
        setStatus("joined");
      }
      
      router.replace("/");
    };
    join();
  }, [code, router]);

  if (status === "login") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1e1f22] text-white">
        <div className="flex flex-col items-center gap-4 rounded-lg bg-[#313338] p-8">
          <h1 className="text-xl font-semibold">Sign in to join</h1>
          <p className="text-sm text-gray-400">You need to be signed in to join this server.</p>
          <Link href={`/login?redirect=/invite/${code}`} className="rounded bg-indigo-500 px-4 py-2 text-sm font-medium hover:bg-indigo-600">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1e1f22] text-white">
        <div className="flex flex-col items-center gap-4 rounded-lg bg-[#313338] p-8">
          <h1 className="text-xl font-semibold">Invalid invite</h1>
          <p className="text-sm text-gray-400">{message}</p>
          <Link href="/" className="rounded bg-indigo-500 px-4 py-2 text-sm font-medium hover:bg-indigo-600">
            Go home
          </Link>
        </div>
      </div>
    );
  }

  if (status === "joined") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1e1f22] text-white">
        <div className="flex flex-col items-center gap-4 rounded-lg bg-[#313338] p-8">
          <h1 className="text-xl font-semibold">{message || "You joined the server!"}</h1>
          <Link href="/" className="rounded bg-indigo-500 px-4 py-2 text-sm font-medium hover:bg-indigo-600">
            Open Commz
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1e1f22] text-white">
      <p className="text-gray-400">Joining server...</p>
    </div>
  );
}
