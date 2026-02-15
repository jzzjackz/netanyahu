"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";
import { useAppStore } from "../lib/store";
import type { FriendRequest, Profile, DirectConversation, UserStatus } from "../lib/types";
import UserProfileModal from "./UserProfileModal";

export default function FriendsPanel() {
  const supabase = createSupabaseBrowserClient();
  const { setConversation } = useAppStore();
  const [userId, setUserId] = useState<string | null>(null);
  const [pendingIn, setPendingIn] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
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

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null));
  }, [supabase.auth]);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      const { data: reqs } = await supabase
        .from("friend_requests")
        .select("id, from_user_id, to_user_id, status, created_at")
        .eq("to_user_id", userId)
        .eq("status", "pending");
      const rawIn = (reqs ?? []) as FriendRequest[];
      const fromIds = [...new Set(rawIn.map((r) => r.from_user_id))];
      const fromProfiles = fromIds.length
        ? (await supabase.from("profiles").select("id, username, avatar_url, banner_url, bio, status, custom_status, last_seen, created_at").in("id", fromIds)).data as Profile[] ?? []
        : [];
      const incoming = rawIn.map((r) => ({
        ...r,
        from_profile: fromProfiles.find((p) => p.id === r.from_user_id) ?? null,
      }));
      setPendingIn(incoming);

      const { data: accepted } = await supabase
        .from("friend_requests")
        .select("from_user_id, to_user_id")
        .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
        .eq("status", "accepted");
      const ids = (accepted ?? []).flatMap((r: { from_user_id: string; to_user_id: string }) =>
        r.from_user_id === userId ? [r.to_user_id] : [r.from_user_id]
      );
      if (ids.length === 0) {
        setFriends([]);
        return;
      }
      const { data: profs } = await supabase.from("profiles").select("id, username, avatar_url, banner_url, bio, status, custom_status, last_seen, created_at").in("id", ids);
      setFriends((profs as Profile[]) ?? []);
    };
    load();

    // Subscribe to friend request changes
    const channel = supabase
      .channel(`friend_requests:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friend_requests",
          filter: `to_user_id=eq.${userId}`,
        },
        () => {
          // Reload friend requests when changes occur
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase]);

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = usernameInput.trim();
    if (!username || searching) return;
    setSearching(true);
    setAddError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSearching(false);
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("id").ilike("username", username).maybeSingle();
    if (!profile) {
      setAddError("No user found with that username.");
      setSearching(false);
      return;
    }
    if (profile.id === user.id) {
      setAddError("You can't add yourself.");
      setSearching(false);
      return;
    }
    const { error } = await supabase.from("friend_requests").upsert(
      { from_user_id: user.id, to_user_id: profile.id, status: "pending" },
      { onConflict: "from_user_id,to_user_id" }
    );
    if (error) {
      if (error.code === "23505") setAddError("Request already sent.");
      else setAddError(error.message);
    } else {
      setUsernameInput("");
      setAddOpen(false);
    }
    setSearching(false);
  };

  const acceptRequest = async (fromUserId: string) => {
    await supabase
      .from("friend_requests")
      .update({ status: "accepted" })
      .eq("from_user_id", fromUserId)
      .eq("to_user_id", userId!)
      .eq("status", "pending");
    setPendingIn((prev) => prev.filter((r) => r.from_user_id !== fromUserId));
    const { data: p } = await supabase.from("profiles").select("id, username, avatar_url, banner_url, bio, status, custom_status, last_seen, created_at").eq("id", fromUserId).single();
    if (p) setFriends((prev) => [...prev, p as Profile]);
  };

  const rejectRequest = async (fromUserId: string) => {
    await supabase
      .from("friend_requests")
      .update({ status: "rejected" })
      .eq("from_user_id", fromUserId)
      .eq("to_user_id", userId!);
    setPendingIn((prev) => prev.filter((r) => r.from_user_id !== fromUserId));
  };

  const openDM = async (friendId: string) => {
    if (!userId) return;
    const [userA, userB] = userId < friendId ? [userId, friendId] : [friendId, userId];
    let { data: conv } = await supabase
      .from("direct_conversations")
      .select("id")
      .eq("user_a_id", userA)
      .eq("user_b_id", userB)
      .maybeSingle();
    if (!conv) {
      const { data: inserted } = await supabase.from("direct_conversations").insert({ user_a_id: userA, user_b_id: userB }).select("id").single();
      conv = inserted as DirectConversation;
    }
    if (conv) setConversation(conv.id);
  };

  return (
    <div className="flex w-60 flex-shrink-0 flex-col bg-[#2b2d31]">
      <div className="border-b border-[#1e1f22] px-4 py-2 text-xs font-semibold uppercase text-gray-500">
        Friends
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white"
        >
          <span className="text-lg">+</span> Add Friend
        </button>
        {pendingIn.length > 0 && (
          <div className="mt-2">
            <div className="px-2 text-xs font-semibold text-gray-500">Pending</div>
            {pendingIn.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-white/5">
                <span className="truncate text-sm text-gray-200">
                  {r.from_profile?.username ?? "Unknown"}
                </span>
                <div className="flex gap-1">
                  <button type="button" onClick={() => acceptRequest(r.from_user_id)} className="rounded bg-green-600 px-2 py-0.5 text-xs hover:bg-green-500">
                    Accept
                  </button>
                  <button type="button" onClick={() => rejectRequest(r.from_user_id)} className="rounded bg-[#404249] px-2 py-0.5 text-xs hover:bg-[#50525a]">
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-2 flex-1">
          <div className="px-2 text-xs font-semibold text-gray-500">All Friends</div>
          {friends.map((f) => {
            const isCurrentUser = f.id === userId;
            return (
            <div key={f.id} className="group flex items-center gap-2 rounded px-2 py-1.5 hover:bg-white/5">
              <button
                onClick={() => setProfileModalUserId(f.id)}
                className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#5865f2] text-xs font-bold hover:opacity-80"
              >
                {f.avatar_url ? (
                  <img src={f.avatar_url} alt={f.username} className="h-full w-full rounded-full object-cover" />
                ) : (
                  f.username.slice(0, 1).toUpperCase()
                )}
                <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#2b2d31] ${getStatusColor(f.status)}`} />
              </button>
              <button
                onClick={() => openDM(f.id)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="truncate text-sm font-medium text-gray-200 hover:underline">{f.username}</div>
                {f.custom_status && (
                  <div className="truncate text-xs text-gray-500">{f.custom_status}</div>
                )}
              </button>
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
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-[#313338] p-4 shadow-xl">
            <h3 className="mb-3 font-semibold">Add Friend</h3>
            <p className="mb-2 text-xs text-gray-400">Enter the username of the person you want to add. They must have an account on this platform.</p>
            <form onSubmit={handleAddFriend}>
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => { setUsernameInput(e.target.value); setAddError(null); }}
                placeholder="Username"
                className="mb-2 w-full rounded bg-[#1e1f22] px-3 py-2 text-sm outline-none ring-1 ring-[#1e1f22] focus:ring-indigo-500"
                autoFocus
              />
              {addError && <p className="mb-2 text-xs text-red-400">{addError}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setAddOpen(false); setAddError(null); setUsernameInput(""); }} className="rounded px-3 py-1.5 text-sm hover:bg-white/10">
                  Cancel
                </button>
                <button type="submit" disabled={searching || !usernameInput.trim()} className="rounded bg-indigo-500 px-3 py-1.5 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50">
                  {searching ? "Sending..." : "Send Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
