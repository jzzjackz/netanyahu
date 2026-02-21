"use client";

import { useState, useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";
import type { Profile, UserStatus } from "../lib/types";

interface UserProfileModalProps {
  userId: string;
  onClose: () => void;
}

export default function UserProfileModal({ userId, onClose }: UserProfileModalProps) {
  const supabase = createSupabaseBrowserClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [bio, setBio] = useState("");
  const [customStatus, setCustomStatus] = useState("");
  const [status, setStatus] = useState<UserStatus>("online");
  const [username, setUsername] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [profileColor, setProfileColor] = useState("#5865f2");
  const [displayName, setDisplayName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportContext, setReportContext] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Helper function to adjust color brightness
  const adjustColor = (color: string, amount: number) => {
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.slice(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.slice(2, 4), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.slice(4, 6), 16) + amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (data) {
        const prof = data as Profile;
        setProfile(prof);
        setBio(prof.bio || "");
        setCustomStatus(prof.custom_status || "");
        setStatus(prof.status);
        setUsername(prof.username);
        setPronouns((prof as any).pronouns || "");
        setProfileColor((prof as any).profile_color || "#5865f2");
        setDisplayName((prof as any).display_name || "");
      }

      // Check if user is blocked
      if (user) {
        const { data: blockData } = await supabase
          .from("user_blocks")
          .select("id")
          .eq("blocker_id", user.id)
          .eq("blocked_id", userId)
          .maybeSingle();
        
        setIsBlocked(!!blockData);
      }
    };
    load();
  }, [userId, supabase]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUserId) return;

    setUploading(true);
    const fileExt = file.name.split(".").pop();
    const fileName = `${currentUserId}/${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from("avatars")
      .upload(fileName, file);

    if (!error && data) {
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(data.path);

      await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", currentUserId);

      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
    }
    setUploading(false);
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUserId) return;

    setUploading(true);
    const fileExt = file.name.split(".").pop();
    const fileName = `${currentUserId}/${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from("banners")
      .upload(fileName, file);

    if (!error && data) {
      const { data: { publicUrl } } = supabase.storage
        .from("banners")
        .getPublicUrl(data.path);

      await supabase
        .from("profiles")
        .update({ banner_url: publicUrl })
        .eq("id", currentUserId);

      setProfile(prev => prev ? { ...prev, banner_url: publicUrl } : null);
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!currentUserId) return;

    // Validate username
    if (username.trim().length < 3) {
      setUsernameError("Username must be at least 3 characters");
      return;
    }

    if (username.trim().length > 32) {
      setUsernameError("Username must be less than 32 characters");
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username.trim())) {
      setUsernameError("Username can only contain letters, numbers, underscores, and hyphens");
      return;
    }

    // Check if username is taken (if changed)
    if (username.trim() !== profile?.username) {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", username.trim())
        .neq("id", currentUserId)
        .maybeSingle();

      if (existing) {
        setUsernameError("Username is already taken");
        return;
      }
    }

    setUsernameError("");

    const { error } = await supabase
      .from("profiles")
      .update({
        username: username.trim(),
        bio,
        custom_status: customStatus,
        status,
        pronouns: pronouns.trim() || null,
        profile_color: profileColor,
        display_name: displayName.trim() || null,
      })
      .eq("id", currentUserId);

    if (error) {
      console.error("Error saving profile:", error);
      alert("Failed to save profile: " + error.message);
      return;
    }

    setProfile(prev => prev ? { 
      ...prev, 
      username: username.trim(), 
      bio, 
      custom_status: customStatus, 
      status,
      pronouns: pronouns.trim() || null,
      profile_color: profileColor,
      display_name: displayName.trim() || null,
    } as any : null);
    setIsEditing(false);
  };

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

  const handleBlockUser = async () => {
    if (!currentUserId || currentUserId === userId) return;

    if (isBlocked) {
      // Unblock
      await supabase
        .from("user_blocks")
        .delete()
        .eq("blocker_id", currentUserId)
        .eq("blocked_id", userId);
      setIsBlocked(false);
    } else {
      // Block
      await supabase
        .from("user_blocks")
        .insert({
          blocker_id: currentUserId,
          blocked_id: userId,
        });
      setIsBlocked(true);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId || !reportReason.trim()) return;

    setSubmittingReport(true);
    await supabase
      .from("user_reports")
      .insert({
        reporter_id: currentUserId,
        reported_id: userId,
        reason: reportReason,
        context: reportContext || null,
      });

    setSubmittingReport(false);
    setShowReportModal(false);
    setReportReason("");
    setReportContext("");
    alert("Report submitted. Our team will review it.");
  };

  if (!profile) return null;

  const isOwnProfile = currentUserId === userId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-lg bg-[#313338] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Banner */}
        <div 
          className="relative h-32 overflow-hidden rounded-t-lg"
          style={{ 
            background: `linear-gradient(to right, ${(profile as any).profile_color || '#5865f2'}, ${adjustColor((profile as any).profile_color || '#5865f2', -30)})`
          }}
        >
          {profile.banner_url && (
            <img src={profile.banner_url} alt="Banner" className="h-full w-full object-cover opacity-80" />
          )}
          {isOwnProfile && isEditing && (
            <>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                onChange={handleBannerUpload}
                className="hidden"
              />
              <button
                onClick={() => bannerInputRef.current?.click()}
                className="absolute right-4 top-4 rounded bg-black/50 px-3 py-1 text-sm hover:bg-black/70"
                disabled={uploading}
              >
                {uploading ? "Uploading..." : "Change Banner"}
              </button>
            </>
          )}
        </div>

        {/* Avatar */}
        <div className="relative px-6">
          <div className="relative -mt-16 inline-block">
            <div className="h-32 w-32 overflow-hidden rounded-full border-8 border-[#313338] bg-[#5865f2]">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.username} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-4xl font-bold">
                  {profile.username.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div className={`absolute bottom-2 right-2 h-6 w-6 rounded-full border-4 border-[#313338] ${getStatusColor(profile.status)}`} />
            {isOwnProfile && isEditing && (
              <>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 hover:opacity-100"
                  disabled={uploading}
                >
                  <span className="text-sm">Change</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 pt-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold" style={{ color: (profile as any).profile_color || '#ffffff' }}>
                  {(profile as any).display_name || profile.username}
                </h2>
                {userId === 'ea46b6de-1fb6-4e26-aea0-cfacde5678b5' && (
                  <span className="group relative cursor-help text-xl" title="Dev">
                    🔨
                    <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-black px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                      Dev
                    </span>
                  </span>
                )}
              </div>
              {(profile as any).display_name && (
                <p className="text-sm text-gray-400">@{profile.username}</p>
              )}
              {(profile as any).pronouns && (
                <p className="text-xs text-gray-500">{(profile as any).pronouns}</p>
              )}
              {profile.custom_status && (
                <p className="text-sm text-gray-400">{profile.custom_status}</p>
              )}
            </div>
            {isOwnProfile && (
              <button
                onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                className="rounded bg-indigo-500 px-4 py-2 text-sm font-medium hover:bg-indigo-600"
              >
                {isEditing ? "Save Profile" : "Edit Profile"}
              </button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-400">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setUsernameError("");
                  }}
                  className="w-full rounded bg-[#1e1f22] px-3 py-2 outline-none"
                  placeholder="Enter username"
                />
                {usernameError && (
                  <p className="mt-1 text-sm text-red-400">{usernameError}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-400">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as UserStatus)}
                  className="w-full rounded bg-[#1e1f22] px-3 py-2 outline-none"
                >
                  <option value="online">🟢 Online</option>
                  <option value="idle">🟡 Idle</option>
                  <option value="dnd">🔴 Do Not Disturb</option>
                  <option value="invisible">⚫ Invisible</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-400">Custom Status</label>
                <input
                  type="text"
                  value={customStatus}
                  onChange={(e) => setCustomStatus(e.target.value)}
                  placeholder="What's on your mind?"
                  maxLength={128}
                  className="w-full rounded bg-[#1e1f22] px-3 py-2 outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-400">Display Name (optional)</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                  maxLength={32}
                  className="w-full rounded bg-[#1e1f22] px-3 py-2 outline-none"
                />
                <p className="mt-1 text-xs text-gray-500">This will be shown instead of your username</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-400">Pronouns (optional)</label>
                <input
                  type="text"
                  value={pronouns}
                  onChange={(e) => setPronouns(e.target.value)}
                  placeholder="e.g. he/him, she/her, they/them"
                  maxLength={50}
                  className="w-full rounded bg-[#1e1f22] px-3 py-2 outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-400">Profile Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={profileColor}
                    onChange={(e) => setProfileColor(e.target.value)}
                    className="h-10 w-20 cursor-pointer rounded border-2 border-[#404249]"
                  />
                  <input
                    type="text"
                    value={profileColor}
                    onChange={(e) => setProfileColor(e.target.value)}
                    placeholder="#5865f2"
                    maxLength={7}
                    className="flex-1 rounded bg-[#1e1f22] px-3 py-2 font-mono text-sm outline-none"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">This color will be used for your profile accents</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-400">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself..."
                  maxLength={190}
                  rows={4}
                  className="w-full rounded bg-[#1e1f22] px-3 py-2 outline-none"
                />
                <p className="mt-1 text-xs text-gray-500">{bio.length}/190</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase text-gray-400">Status</h3>
                <div className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${getStatusColor(profile.status)}`} />
                  <span>{getStatusLabel(profile.status)}</span>
                </div>
              </div>

              {((profile as any).pronouns || (profile as any).display_name) && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold uppercase text-gray-400">Profile</h3>
                  {(profile as any).display_name && (
                    <p className="text-gray-300">Display Name: {(profile as any).display_name}</p>
                  )}
                  {(profile as any).pronouns && (
                    <p className="text-gray-300">Pronouns: {(profile as any).pronouns}</p>
                  )}
                </div>
              )}

              {profile.bio && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold uppercase text-gray-400">About Me</h3>
                  <p className="text-gray-300">{profile.bio}</p>
                </div>
              )}

              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase text-gray-400">Member Since</h3>
                <p className="text-gray-300">{new Date(profile.created_at).toLocaleDateString()}</p>
              </div>

              {/* Block and Report buttons (only for other users) */}
              {!isOwnProfile && (
                <div className="flex gap-2 border-t border-[#404249] pt-4">
                  <button
                    onClick={handleBlockUser}
                    className={`flex-1 rounded px-4 py-2 text-sm font-medium ${
                      isBlocked
                        ? "bg-gray-600 hover:bg-gray-500"
                        : "bg-red-600 hover:bg-red-500"
                    }`}
                  >
                    {isBlocked ? "Unblock User" : "Block User"}
                  </button>
                  <button
                    onClick={() => setShowReportModal(true)}
                    className="flex-1 rounded bg-orange-600 px-4 py-2 text-sm font-medium hover:bg-orange-500"
                  >
                    Report User
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full bg-black/50 p-2 hover:bg-black/70"
        >
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowReportModal(false)}>
          <div className="w-full max-w-md rounded-lg bg-[#313338] p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-xl font-bold">Report User</h2>
            <form onSubmit={handleSubmitReport} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Reason for report
                </label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full rounded bg-[#1e1f22] px-3 py-2 text-sm outline-none"
                  required
                >
                  <option value="">Select a reason...</option>
                  <option value="harassment">Harassment or bullying</option>
                  <option value="spam">Spam or scam</option>
                  <option value="inappropriate">Inappropriate content</option>
                  <option value="impersonation">Impersonation</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Additional details (optional)
                </label>
                <textarea
                  value={reportContext}
                  onChange={(e) => setReportContext(e.target.value)}
                  className="w-full rounded bg-[#1e1f22] px-3 py-2 text-sm outline-none"
                  rows={4}
                  placeholder="Provide any additional context..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="rounded px-4 py-2 text-sm hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReport || !reportReason}
                  className="rounded bg-orange-600 px-4 py-2 text-sm font-medium hover:bg-orange-500 disabled:opacity-50"
                >
                  {submittingReport ? "Submitting..." : "Submit Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
