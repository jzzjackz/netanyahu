"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";
import { useAppStore } from "../lib/store";
import type { Server } from "../lib/types";

export default function ServerSidebar() {
  const supabase = createSupabaseBrowserClient();
  const { currentServerId, setServer } = useAppStore();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [contextServer, setContextServer] = useState<Server | null>(null);
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 });
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null));
  }, [supabase.auth]);

  useEffect(() => {
    const fetchServers = async () => {
      if (!userId) return;
      // Get servers where user is a member
      const { data: memberships } = await supabase
        .from("server_members")
        .select("server_id")
        .eq("user_id", userId);
      
      if (!memberships || memberships.length === 0) {
        setServers([]);
        setLoading(false);
        return;
      }
      
      const serverIds = memberships.map(m => m.server_id);
      const { data } = await supabase
        .from("servers")
        .select("*")
        .in("id", serverIds)
        .order("created_at", { ascending: true });
      
      setServers((data as Server[]) ?? []);
      setLoading(false);
    };
    fetchServers();
  }, [supabase, userId]);

  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || creating) return;
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCreating(false);
      return;
    }
    const { data: server, error: serverErr } = await supabase
      .from("servers")
      .insert({ owner_id: user.id, name: newName.trim() })
      .select("*")
      .single();
    if (serverErr || !server) {
      setCreating(false);
      return;
    }
    await supabase.from("server_members").insert({
      server_id: server.id,
      user_id: user.id,
      role: "owner",
    });
    setServers((prev) => [...prev, server as Server]);
    setServer(server.id);
    setNewName("");
    setCreateOpen(false);
    setCreating(false);
  };

  const handleDeleteServer = async (s: Server) => {
    if (!userId || s.owner_id !== userId) return;
    if (!confirm(`Delete server "${s.name}"? This cannot be undone.`)) return;
    await supabase.from("servers").delete().eq("id", s.id);
    setServers((prev) => prev.filter((x) => x.id !== s.id));
    if (currentServerId === s.id) setServer(null);
    setContextServer(null);
  };

  if (loading) {
    return (
      <div className="flex w-[72px] flex-col items-center gap-2 bg-[#1e1f22] py-3">
        <div className="h-12 w-12 animate-pulse rounded-2xl bg-[#313338]" />
      </div>
    );
  }

  return (
    <div className="flex w-[72px] flex-shrink-0 flex-col items-center gap-2 bg-[#1e1f22] py-3 scrollbar-thin overflow-y-auto">
      {/* Home Button */}
      <button
        type="button"
        onClick={() => setServer(null)}
        className={`group relative flex h-12 w-12 items-center justify-center rounded-[24px] bg-[#313338] transition-all duration-200 hover:rounded-[16px] hover:bg-[#5865f2] ${!currentServerId ? "rounded-[16px] bg-[#5865f2]" : ""}`}
        title="Home"
      >
        <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 28 20">
          <path d="M23.0212 1.67671C21.3107 0.879656 19.5079 0.318797 17.6584 0C17.4062 0.461742 17.1749 0.934541 16.9708 1.4184C15.003 1.12145 12.9974 1.12145 11.0283 1.4184C10.819 0.934541 10.589 0.461744 10.3368 0.00546311C8.48074 0.324393 6.67795 0.885118 4.96746 1.68231C1.56727 6.77853 0.649666 11.7538 1.11108 16.652C3.10102 18.1418 5.3262 19.2743 7.69177 20C8.22338 19.2743 8.69519 18.4993 9.09812 17.691C8.32996 17.3997 7.58522 17.0424 6.87684 16.6135C7.06531 16.4762 7.24726 16.3387 7.42403 16.1847C11.5911 18.1749 16.408 18.1749 20.5763 16.1847C20.7531 16.3332 20.9351 16.4762 21.1171 16.6135C20.41 17.0369 19.6639 17.3997 18.897 17.691C19.3052 18.4993 19.777 19.2689 20.3086 19.9945C22.6803 19.2689 24.9057 18.1364 26.8895 16.652C27.43 10.9731 25.9665 6.04728 23.0212 1.67671ZM9.68041 13.6383C8.39754 13.6383 7.34085 12.4453 7.34085 10.994C7.34085 9.54272 8.37155 8.34973 9.68041 8.34973C10.9893 8.34973 12.0395 9.54272 12.0187 10.994C12.0187 12.4453 10.9828 13.6383 9.68041 13.6383ZM18.3161 13.6383C17.0332 13.6383 15.9765 12.4453 15.9765 10.994C15.9765 9.54272 17.0124 8.34973 18.3161 8.34973C19.6184 8.34973 20.6751 9.54272 20.6543 10.994C20.6543 12.4453 19.6184 13.6383 18.3161 13.6383Z"/>
        </svg>
        {!currentServerId && (
          <div className="absolute left-0 top-1/2 h-10 w-1 -translate-x-2 -translate-y-1/2 rounded-r bg-white" />
        )}
      </button>
      
      <div className="my-1 h-[2px] w-8 rounded bg-[#35363c]" />
      
      {/* Star Icon */}
      <button
        type="button"
        className="group relative flex h-12 w-12 items-center justify-center rounded-[24px] bg-[#313338] transition-all duration-200 hover:rounded-[16px] hover:bg-[#5865f2]"
        title="Favorites"
      >
        <svg className="h-6 w-6 text-[#23a55a]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      </button>
      
      {/* Compass Icon */}
      <button
        type="button"
        onClick={() => window.location.href = "/discover"}
        className="group relative flex h-12 w-12 items-center justify-center rounded-[24px] bg-[#313338] transition-all duration-200 hover:rounded-[16px] hover:bg-[#23a559]"
        title="Discover Servers"
      >
        <svg className="h-6 w-6 text-[#23a55a]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 10.9c-.61 0-1.1.49-1.1 1.1s.49 1.1 1.1 1.1c.61 0 1.1-.49 1.1-1.1s-.49-1.1-1.1-1.1zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm2.19 12.19L6 18l3.81-8.19L18 6l-3.81 8.19z"/>
        </svg>
      </button>
      
      <div className="my-1 h-[2px] w-8 rounded bg-[#35363c]" />
      {servers.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => setServer(s.id)}
          onContextMenu={(e) => {
            e.preventDefault();
            if (s.owner_id === userId) {
              setContextServer(s);
              setContextPos({ x: e.clientX, y: e.clientY });
            }
          }}
          className={`group relative flex h-12 w-12 items-center justify-center rounded-[24px] bg-[#313338] text-lg font-bold transition-all duration-200 hover:rounded-[16px] hover:bg-[#5865f2] ${currentServerId === s.id ? "rounded-[16px] bg-[#5865f2]" : ""}`}
          title={s.name}
        >
          {s.icon_url ? (
            <img src={s.icon_url} alt="" className="h-full w-full rounded-[24px] object-cover group-hover:rounded-[16px]" />
          ) : (
            (s.name[0] ?? "?").toUpperCase()
          )}
          {currentServerId === s.id && (
            <div className="absolute left-0 top-1/2 h-10 w-1 -translate-x-2 -translate-y-1/2 rounded-r bg-white" />
          )}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        className="flex h-12 w-12 items-center justify-center rounded-[24px] bg-[#313338] text-[#23a55a] text-2xl transition-all duration-200 hover:rounded-[16px] hover:bg-[#23a559] hover:text-white"
        title="Add Server"
      >
        +
      </button>
      
      {/* Bottom Icons */}
      <div className="mt-auto mb-2">
        <button
          type="button"
          className="flex h-12 w-12 items-center justify-center rounded-[24px] bg-[#248046] transition-all duration-200 hover:rounded-[16px]"
          title="Download Apps"
        >
          <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17 13v6c0 .55-.45 1-1 1H8c-.55 0-1-.45-1-1v-6H5l7-7 7 7h-2z"/>
          </svg>
        </button>
      </div>
      <button
        type="button"
        className="flex h-12 w-12 items-center justify-center rounded-[24px] bg-[#313338] transition-all duration-200 hover:rounded-[16px] hover:bg-[#5865f2]"
        title="Help"
      >
        <svg className="h-6 w-6 text-[#23a55a]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
        </svg>
      </button>
      {contextServer && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextServer(null)} aria-hidden />
          <div
            className="fixed z-50 rounded bg-[#313338] py-1 shadow-xl"
            style={{ left: contextPos.x, top: contextPos.y }}
          >
          <button
            type="button"
            onClick={() => { handleDeleteServer(contextServer); setContextServer(null); }}
            className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-white/10"
          >
            Delete Server
          </button>
          <button
            type="button"
            onClick={() => setContextServer(null)}
            className="w-full px-4 py-2 text-left text-sm hover:bg-white/10"
          >
            Cancel
          </button>
          </div>
        </>
      )}
      {createOpen && (
        <div className="fixed left-0 top-0 z-50 flex h-full w-full items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-[#313338] p-4 shadow-xl">
            <h3 className="mb-3 font-semibold">Create Server</h3>
            <form onSubmit={handleCreateServer}>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Server name"
                className="mb-3 w-full rounded bg-[#1e1f22] px-3 py-2 text-sm outline-none ring-1 ring-[#1e1f22] focus:ring-indigo-500"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setCreateOpen(false)} className="rounded px-3 py-1.5 text-sm hover:bg-white/10">
                  Cancel
                </button>
                <button type="submit" disabled={creating || !newName.trim()} className="rounded bg-indigo-500 px-3 py-1.5 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
