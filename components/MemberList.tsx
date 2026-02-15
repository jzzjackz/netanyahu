"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";
import { useAppStore } from "../lib/store";
import type { ServerMember, Profile, UserStatus } from "../lib/types";
import UserProfileModal from "./UserProfileModal";

export default function MemberList() {
  const supabase = createSupabaseBrowserClient();
  const { currentServerId } = useAppStore();
  const [members, setMembers] = useState<ServerMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [contextMember, setContextMember] = useState<ServerMember | null>(null);
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 });
  const [profileModalUserId, setProfileModalUserId] = useState<string | null>(null);
  const [editingOwnProfile, setEditingOwnProfile] = useState(false);

  const getStatusColor = (status: UserStatus) => {
    switch (status) {
      case "online": return "bg-green-500";
      case "idle": return "bg-yellow-500";
      case "dnd": return "bg-red-500";
      case "invisible": return "bg-gray-500";
    }
  };

  const getStatusLabel = (status: UserStatus) => {
    switch (status) {
      case "online": return "Online";
      case "idle": return "Idle";
      case "dnd": return "Do Not Disturb";
      case "invisible": return "Invisible";
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null));
  }, [supabase.auth]);

  useEffect(() => {
    if (!currentServerId) return;
    (async () => {
      setLoading(true);
      const { data: rows } = await supabase.from("server_members").select("*").eq("server_id", currentServerId);
      const membersList = (rows as ServerMember[]) ?? [];
      if (membersList.length === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }
      
      // Get current user's role
      if (userId) {
        const userMember = membersList.find(m => m.user_id === userId);
        setUserRole(userMember?.role ?? null);
      }
      
      // Check if user is server owner
      const { data: serverData } = await supabase
        .from("servers")
        .select("owner_id")
        .eq("id", currentServerId)
        .single();
      
      setIsOwner(serverData?.owner_id === userId);
      
      const ids = membersList.map((m) => m.user_id);
      const { data: profs } = await supabase.from("profiles").select("id, username, avatar_url, banner_url, bio, status, custom_status, last_seen, created_at").in("id", ids);
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
              .select("id, username, avatar_url, banner_url, bio, status, custom_status, last_seen, created_at")
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
  }, [currentServerId, userId, supabase]);

  const handleKick = async (member: ServerMember) => {
    if (!currentServerId || !isOwner) return;
    if (!confirm(`Kick ${member.profiles?.username ?? 'this user'}?`)) return;
    await supabase.from("server_members").delete().eq("server_id", currentServerId).eq("user_id", member.user_id);
    setMembers((prev) => prev.filter((m) => m.user_id !== member.user_id));
    setContextMember(null);
  };

  const handleBan = async (member: ServerMember) => {
    if (!currentServerId || !userId || !isOwner) return;
    if (!confirm(`Ban ${member.profiles?.username ?? 'this user'}? They won't be able to rejoin.`)) return;
    await supabase.from("server_bans").insert({
      server_id: currentServerId,
      user_id: member.user_id,
      banned_by: userId,
    });
    await supabase.from("server_members").delete().eq("server_id", currentServerId).eq("user_id", member.user_id);
    setMembers((prev) => prev.filter((m) => m.user_id !== member.user_id));
    setContextMember(null);
  };

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
        {members.map((m) => {
          const isCurrentUser = m.user_id === userId;
          return (
          <div 
            key={m.user_id} 
            className="group flex items-center gap-2 rounded px-2 py-1.5 hover:bg-white/5"
            onContextMenu={(e) => {
              e.preventDefault();
              if (isOwner && m.user_id !== userId) {
                setContextMember(m);
                setContextPos({ x: e.clientX, y: e.clientY });
              }
            }}
          >
            <button
              onClick={() => setProfileModalUserId(m.user_id)}
              className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#5865f2] text-xs font-bold hover:opacity-80"
            >
              {m.profiles?.avatar_url ? (
                <img 
                  src={m.profiles.avatar_url} 
                  alt={m.profiles.username} 
                  className="h-full w-full rounded-full object-cover" 
                />
              ) : (
                (m.profiles?.username ?? `User-${m.user_id.slice(-6)}`).slice(0, 1).toUpperCase()
              )}
              <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#2b2d31] ${getStatusColor(m.profiles?.status || 'online')}`} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setProfileModalUserId(m.user_id)}
                  className="truncate text-sm font-medium text-gray-200 hover:underline"
                >
                  {m.profiles?.username ?? `User-${m.user_id.slice(-6)}`}
                </button>
                {m.role === "owner" && <span className="text-xs">👑</span>}
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <span>{getStatusLabel(m.profiles?.status || 'online')}</span>
                {m.profiles?.custom_status && (
                  <>
                    <span>•</span>
                    <span className="truncate">{m.profiles.custom_status}</span>
                  </>
                )}
              </div>
            </div>
            {isCurrentUser && (
              <button
                onClick={() => setEditingOwnProfile(true)}
                className="opacity-0 group-hover:opacity-100 rounded p-1 hover:bg-white/10"
                title="Edit Profile"
              >
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            )}
          </div>
        );
        })}
      </div>
      {contextMember && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMember(null)} aria-hidden />
          <div
            className="fixed z-50 rounded bg-[#313338] py-1 shadow-xl"
            style={{ left: contextPos.x, top: contextPos.y }}
          >
            <button
              type="button"
              onClick={() => handleKick(contextMember)}
              className="w-full px-4 py-2 text-left text-sm text-orange-400 hover:bg-white/10"
            >
              Kick {contextMember.profiles?.username}
            </button>
            <button
              type="button"
              onClick={() => handleBan(contextMember)}
              className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-white/10"
            >
              Ban {contextMember.profiles?.username}
            </button>
            <button
              type="button"
              onClick={() => setContextMember(null)}
              className="w-full px-4 py-2 text-left text-sm hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </>
      )}
      <div className="mt-auto border-t border-[#1e1f22] p-2">
        <a
          href="/vidz"
          className="mb-2 block w-full rounded px-2 py-1.5 text-center text-sm text-indigo-400 hover:bg-white/5"
        >
          🎬 AllInOne Vidz
        </a>
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="w-full rounded px-2 py-1.5 text-left text-sm text-gray-400 hover:bg-white/5 hover:text-red-400"
        >
          Log out
        </button>
      </div>
      {profileModalUserId && (
        <UserProfileModal
          userId={profileModalUserId}
          onClose={() => setProfileModalUserId(null)}
        />
      )}
      {editingOwnProfile && userId && (
        <UserProfileModal
          userId={userId}
          onClose={() => setEditingOwnProfile(false)}
        />
      )}
    </div>
  );
}
