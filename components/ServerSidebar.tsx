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
    <div className="flex w-[72px] flex-shrink-0 flex-col items-center gap-2 bg-[#1e1f22] py-3">
      <button
        type="button"
        onClick={() => setServer(null)}
        className={`flex h-12 w-12 items-center justify-center rounded-2xl transition hover:rounded-xl hover:bg-indigo-500 ${!currentServerId ? "rounded-xl bg-indigo-500" : "bg-[#313338]"}`}
        title="Home"
      >
        <span className="text-xl">⌂</span>
      </button>
      <div className="my-1 h-px w-8 bg-[#313338]" />
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
          className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-[#313338] text-lg font-bold transition hover:rounded-xl hover:bg-indigo-500 ${currentServerId === s.id ? "rounded-xl bg-indigo-500" : ""}`}
          title={s.name}
        >
          {s.icon_url ? (
            <img src={s.icon_url} alt="" className="h-full w-full rounded-2xl object-cover" />
          ) : (
            (s.name[0] ?? "?").toUpperCase()
          )}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#313338] text-xl transition hover:rounded-xl hover:bg-green-600"
        title="Add Server"
      >
        +
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
