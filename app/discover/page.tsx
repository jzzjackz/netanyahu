"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../lib/supabaseClient";
import Link from "next/link";

interface DiscoverableServer {
  id: string;
  name: string;
  icon_url: string | null;
  discovery_description: string | null;
  member_count: number;
  owner_id: string;
}

export default function DiscoverServers() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [servers, setServers] = useState<DiscoverableServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [joinedServers, setJoinedServers] = useState<Set<string>>(new Set());

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUserId(user.id);

      // Get user's joined servers
      const { data: memberships } = await supabase
        .from("server_members")
        .select("server_id")
        .eq("user_id", user.id);

      if (memberships) {
        setJoinedServers(new Set(memberships.map(m => m.server_id)));
      }

      // Get discoverable servers
      const { data } = await supabase
        .from("servers")
        .select("id, name, icon_url, discovery_description, member_count, owner_id")
        .eq("is_discoverable", true)
        .order("member_count", { ascending: false });

      if (data) {
        setServers(data);
      }
      setLoading(false);
    };

    init();
  }, [router, supabase]);

  const handleJoinServer = async (serverId: string) => {
    if (!userId) return;

    const { error } = await supabase.from("server_members").insert({
      server_id: serverId,
      user_id: userId,
      role: "member",
    });

    if (error) {
      alert("Failed to join server: " + error.message);
    } else {
      setJoinedServers(prev => new Set([...prev, serverId]));
      router.push("/commz");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#313338] text-white">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#313338] text-white">
      <div className="mx-auto w-full max-w-6xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Discover Servers</h1>
            <p className="text-sm text-gray-400">Find and join public servers</p>
          </div>
          <Link
            href="/commz"
            className="rounded-sm bg-[#5865f2] px-4 py-2 text-sm font-medium hover:bg-[#4752c4]"
          >
            Back to Home
          </Link>
        </div>

        {servers.length === 0 ? (
          <div className="rounded-lg bg-[#2b2d31] p-8 text-center">
            <p className="text-gray-400">No discoverable servers yet</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {servers.map((server) => {
              const isJoined = joinedServers.has(server.id);
              
              return (
                <div
                  key={server.id}
                  className="flex flex-col rounded-lg bg-[#2b2d31] p-4 transition hover:bg-[#32353b]"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[#313338] text-lg font-bold">
                      {server.icon_url ? (
                        <img
                          src={server.icon_url}
                          alt=""
                          className="h-full w-full rounded-2xl object-cover"
                        />
                      ) : (
                        (server.name[0] ?? "?").toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h3 className="truncate font-semibold">{server.name}</h3>
                      <p className="text-xs text-gray-400">
                        {server.member_count} {server.member_count === 1 ? "member" : "members"}
                      </p>
                    </div>
                  </div>

                  {server.discovery_description && (
                    <p className="mb-3 flex-1 text-sm text-gray-300">
                      {server.discovery_description}
                    </p>
                  )}

                  <button
                    onClick={() => handleJoinServer(server.id)}
                    disabled={isJoined}
                    className={`w-full rounded-sm px-4 py-2 text-sm font-medium transition ${
                      isJoined
                        ? "cursor-not-allowed bg-[#404249] text-gray-400"
                        : "bg-[#5865f2] hover:bg-[#4752c4]"
                    }`}
                  >
                    {isJoined ? "Already Joined" : "Join Server"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
