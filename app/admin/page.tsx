"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../../lib/supabaseClient";
import Link from "next/link";

interface User {
  id: string;
  username: string;
  email: string;
  created_at: string;
  is_admin: boolean;
}

interface Ban {
  id: string;
  user_id: string;
  reason: string;
  created_at: string;
  profiles?: { username: string };
}

interface Report {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  context: string;
  status: string;
  created_at: string;
  reporter?: { username: string };
  reported?: { username: string };
}

export default function AdminPanel() {
  const supabase = createSupabaseBrowserClient();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [bans, setBans] = useState<Ban[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [serverIdInput, setServerIdInput] = useState("");
  const [generatedInvite, setGeneratedInvite] = useState("");
  const [generatingInvite, setGeneratingInvite] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (!profile?.is_admin) {
        alert("Access denied. Admin only.");
        window.location.href = "/commz";
        return;
      }

      setIsAdmin(true);
      loadData();
      setLoading(false);
    };

    checkAdmin();
  }, [supabase]);

  const loadData = async () => {
    // Load all users
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, created_at, is_admin");
    
    if (profiles) {
      // Get emails from auth.users
      const userIds = profiles.map(p => p.id);
      const usersWithEmail = await Promise.all(
        profiles.map(async (profile) => {
          return {
            ...profile,
            email: "N/A", // Email is in auth.users which we can't query directly
          };
        })
      );
      setUsers(usersWithEmail as User[]);
    }

    // Load bans
    const { data: banData } = await supabase
      .from("platform_bans")
      .select("*, profiles(username)")
      .order("created_at", { ascending: false });
    
    if (banData) {
      setBans(banData as Ban[]);
    }

    // Load reports
    const { data: reportData } = await supabase
      .from("user_reports")
      .select(`
        *,
        reporter:reporter_id(username),
        reported:reported_id(username)
      `)
      .order("created_at", { ascending: false });
    
    if (reportData) {
      setReports(reportData as Report[]);
    }
  };

  const handleBanUser = async (userId: string) => {
    const reason = prompt("Ban reason:");
    if (!reason) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("platform_bans")
      .insert({
        user_id: userId,
        banned_by: user.id,
        reason,
      });

    if (error) {
      alert("Failed to ban user: " + error.message);
    } else {
      alert("User banned successfully");
      loadData();
    }
  };

  const handleUnbanUser = async (banId: string) => {
    const { error } = await supabase
      .from("platform_bans")
      .delete()
      .eq("id", banId);

    if (error) {
      alert("Failed to unban user: " + error.message);
    } else {
      alert("User unbanned successfully");
      loadData();
    }
  };

  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementTitle.trim() || !announcementMessage.trim()) return;

    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("announcements")
      .insert({
        admin_id: user.id,
        title: announcementTitle,
        message: announcementMessage,
      });

    if (error) {
      alert("Failed to send announcement: " + error.message);
    } else {
      alert("Announcement sent to all users!");
      setAnnouncementTitle("");
      setAnnouncementMessage("");
    }
    setSending(false);
  };

  const handleUpdateReportStatus = async (reportId: string, newStatus: string) => {
    await supabase
      .from("user_reports")
      .update({ status: newStatus })
      .eq("id", reportId);
    
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: newStatus } : r));
  };

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverIdInput.trim() || generatingInvite) return;

    setGeneratingInvite(true);
    setGeneratedInvite("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setGeneratingInvite(false);
      return;
    }

    // Check if server exists
    const { data: server } = await supabase
      .from("servers")
      .select("id, name")
      .eq("id", serverIdInput.trim())
      .maybeSingle();

    if (!server) {
      alert("Server not found with that ID");
      setGeneratingInvite(false);
      return;
    }

    // Generate invite code
    const code = Math.random().toString(36).slice(2, 10);
    const { error } = await supabase.from("invite_codes").insert({
      server_id: serverIdInput.trim(),
      code,
      created_by: user.id,
    });

    if (error) {
      alert("Failed to generate invite: " + error.message);
      setGeneratingInvite(false);
      return;
    }

    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${code}`;
    setGeneratedInvite(url);
    
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore
    }

    setGeneratingInvite(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#313338] text-white">
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="flex h-screen flex-col bg-[#313338] text-white overflow-hidden">
      <div className="mx-auto w-full max-w-7xl flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <Link
            href="/commz"
            className="rounded-sm bg-[#5865f2] px-4 py-2 text-sm font-medium hover:bg-[#4752c4]"
          >
            Back to Commz
          </Link>
        </div>

        {/* Send Announcement */}
        <div className="mb-8 rounded-lg bg-[#2b2d31] p-6">
          <h2 className="mb-4 text-xl font-bold">Send Live Announcement</h2>
          <form onSubmit={handleSendAnnouncement} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#b5bac1]">
                Title
              </label>
              <input
                type="text"
                value={announcementTitle}
                onChange={(e) => setAnnouncementTitle(e.target.value)}
                className="w-full rounded-sm bg-[#1e1f22] px-3 py-2 text-[15px] outline-none"
                placeholder="Announcement title"
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[#b5bac1]">
                Message
              </label>
              <textarea
                value={announcementMessage}
                onChange={(e) => setAnnouncementMessage(e.target.value)}
                className="w-full rounded-sm bg-[#1e1f22] px-3 py-2 text-[15px] outline-none"
                placeholder="Announcement message"
                rows={4}
                required
              />
            </div>
            <button
              type="submit"
              disabled={sending}
              className="rounded-sm bg-[#5865f2] px-6 py-2 font-medium hover:bg-[#4752c4] disabled:opacity-50"
            >
              {sending ? "Sending..." : "Send to All Users"}
            </button>
          </form>
        </div>

        {/* Generate Invite from Server ID */}
        <div className="mb-8 rounded-lg bg-[#2b2d31] p-6">
          <h2 className="mb-4 text-xl font-bold">Generate Invite Link</h2>
          <p className="mb-4 text-sm text-gray-400">
            Convert a server ID into an invite link. Useful for joining servers or sharing access.
          </p>
          <form onSubmit={handleGenerateInvite} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#b5bac1]">
                Server ID
              </label>
              <input
                type="text"
                value={serverIdInput}
                onChange={(e) => setServerIdInput(e.target.value)}
                className="w-full rounded-sm bg-[#1e1f22] px-3 py-2 text-[15px] outline-none font-mono"
                placeholder="Enter server UUID..."
                required
              />
            </div>
            <button
              type="submit"
              disabled={generatingInvite}
              className="rounded-sm bg-[#5865f2] px-6 py-2 font-medium hover:bg-[#4752c4] disabled:opacity-50"
            >
              {generatingInvite ? "Generating..." : "Generate Invite Link"}
            </button>
            {generatedInvite && (
              <div className="mt-4">
                <p className="mb-2 text-sm text-green-400">✓ Invite link generated and copied to clipboard!</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedInvite}
                    className="flex-1 rounded-sm bg-[#1e1f22] px-3 py-2 text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(generatedInvite)}
                    className="rounded-sm bg-[#404249] px-4 py-2 text-sm hover:bg-[#4f5058]"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Banned Users */}
        <div className="mb-8 rounded-lg bg-[#2b2d31] p-6">
          <h2 className="mb-4 text-xl font-bold">Banned Users ({bans.length})</h2>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {bans.length === 0 ? (
              <p className="text-sm text-gray-400">No banned users</p>
            ) : (
              bans.map((ban) => (
                <div
                  key={ban.id}
                  className="flex items-center justify-between rounded bg-[#1e1f22] p-3"
                >
                  <div>
                    <p className="font-medium">{ban.profiles?.username || "Unknown"}</p>
                    <p className="text-sm text-gray-400">Reason: {ban.reason}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(ban.created_at).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleUnbanUser(ban.id)}
                    className="rounded bg-green-500 px-4 py-2 text-sm hover:bg-green-600"
                  >
                    Unban
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* User Reports */}
        <div className="mb-8 rounded-lg bg-[#2b2d31] p-6">
          <h2 className="mb-4 text-xl font-bold">User Reports ({reports.filter(r => r.status === 'pending').length} pending)</h2>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {reports.length === 0 ? (
              <p className="text-sm text-gray-400">No reports</p>
            ) : (
              reports.map((report) => (
                <div
                  key={report.id}
                  className="rounded bg-[#1e1f22] p-3"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <p className="font-medium">
                        <span className="text-gray-400">Reporter:</span> {report.reporter?.username || "Unknown"}
                      </p>
                      <p className="font-medium">
                        <span className="text-gray-400">Reported:</span> {report.reported?.username || "Unknown"}
                      </p>
                      <p className="text-sm text-gray-400">Reason: {report.reason}</p>
                      {report.context && (
                        <p className="mt-1 text-sm text-gray-500">Details: {report.context}</p>
                      )}
                      <p className="mt-1 text-xs text-gray-500">
                        {new Date(report.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span className={`rounded px-2 py-1 text-xs ${
                      report.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                      report.status === 'reviewed' ? 'bg-blue-500/20 text-blue-400' :
                      report.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {report.status}
                    </span>
                  </div>
                  {report.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateReportStatus(report.id, 'reviewed')}
                        className="rounded bg-blue-500 px-3 py-1 text-sm hover:bg-blue-600"
                      >
                        Mark Reviewed
                      </button>
                      <button
                        onClick={() => handleUpdateReportStatus(report.id, 'resolved')}
                        className="rounded bg-green-500 px-3 py-1 text-sm hover:bg-green-600"
                      >
                        Resolve
                      </button>
                      <button
                        onClick={() => handleUpdateReportStatus(report.id, 'dismissed')}
                        className="rounded bg-gray-500 px-3 py-1 text-sm hover:bg-gray-600"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => handleBanUser(report.reported_id)}
                        className="rounded bg-red-500 px-3 py-1 text-sm hover:bg-red-600"
                      >
                        Ban User
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* All Users */}
        <div className="rounded-lg bg-[#2b2d31] p-6">
          <h2 className="mb-4 text-xl font-bold">All Users ({users.length})</h2>
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-[#2b2d31]">
                <tr className="border-b border-[#404249] text-left text-sm text-gray-400">
                  <th className="pb-2">Username</th>
                  <th className="pb-2">User ID</th>
                  <th className="pb-2">Joined</th>
                  <th className="pb-2">Role</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-[#404249]">
                    <td className="py-3">{user.username}</td>
                    <td className="py-3 text-sm text-gray-400">{user.id.slice(0, 8)}...</td>
                    <td className="py-3 text-sm text-gray-400">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      {user.is_admin ? (
                        <span className="rounded bg-red-500/20 px-2 py-1 text-xs text-red-400">
                          Admin
                        </span>
                      ) : (
                        <span className="rounded bg-gray-500/20 px-2 py-1 text-xs text-gray-400">
                          User
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      {!user.is_admin && (
                        <button
                          onClick={() => handleBanUser(user.id)}
                          className="rounded bg-red-500 px-3 py-1 text-sm hover:bg-red-600"
                        >
                          Ban
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
