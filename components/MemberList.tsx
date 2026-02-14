"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";
import { useAppStore } from "../lib/store";
import type { ServerMember, Profile } from "../lib/types";

export default function MemberList() {
  const supabase = createSupabaseBrowserClient();
  const { currentServerId } = useAppStore();
  const [members, setMembers] = useState<ServerMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentServerId) {
      setMembers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const { data: rows } = await supabase.from("server_members").select("*").eq("server_id", currentServerId);
      const membersList = (rows as ServerMember[]) ?? [];
      if (membersList.length === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }
      const ids = membersList.map((m) => m.user_id);
      const { data: profs } = await supabase.from("profiles").select("*").in("id", ids);
      const profileMap = new Map<string, Profile>(((profs ?? []) as Profile[]).map((p) => [p.id, p]));
      setMembers(membersList.map((m) => ({ ...m, profiles: profileMap.get(m.user_id) ?? null })));
      setLoading(false);
    })();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`server_members:${currentServerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "server_members",
          filter: `server_id=eq.${currentServerId}`,
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const newMember = payload.new as ServerMember;
            const { data: profile } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", newMember.user_id)
              .single();
            setMembers((prev) => [...prev, { ...newMember, profiles: profile as Profile }]);
          } else if (payload.eventType === "DELETE") {
            const oldMember = payload.old as ServerMember;
            setMembers((prev) => prev.filter((m) => m.user_id !== oldMember.user_id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentServerId, supabase]);

  if (!currentServerId) return null;
  if (loading) {
    return (
      <div className="flex w-60 flex-shrink-0 flex-col bg-[#2b2d31] p-2">
        <div className="h-4 w-24 animate-pulse rounded bg-[#313338]" />
        <div className="mt-2 h-8 animate-pulse rounded bg-[#313338]" />
      </div>
    );
  }

  return (
    <div className="flex w-60 flex-shrink-0 flex-col bg-[#2b2d31]">
      <div className="border-b border-[#1e1f22] px-4 py-2 text-xs font-semibold uppercase text-gray-500">
        Members — {members.length}
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {members.map((m) => (
          <div key={m.user_id} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-white/5">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#5865f2] text-xs font-bold">
              {(m.profiles?.username ?? `User-${m.user_id.slice(-6)}`).slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 truncate">
              <span className="text-sm font-medium text-gray-200">
                {m.profiles?.username ?? `User-${m.user_id.slice(-6)}`}
              </span>
              <span className="ml-1 text-xs text-gray-500">{m.role}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-auto border-t border-[#1e1f22] p-2">
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="w-full rounded px-2 py-1.5 text-left text-sm text-gray-400 hover:bg-white/5 hover:text-red-400"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
