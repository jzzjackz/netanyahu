"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "../../../../lib/supabaseClient";

interface DiscordMigrationData {
  username: string;
  discriminator: string;
  avatar: string | null;
  discordId: string;
}

export default function CompleteMigrationPage() {
  const supabase = createSupabaseBrowserClient();
  const [migrationData, setMigrationData] = useState<DiscordMigrationData | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const data = sessionStorage.getItem("discord_migration");
    if (!data) {
      window.location.href = "/migrate";
      return;
    }
    setMigrationData(JSON.parse(data));
  }, []);

  const handleCompleteMigration = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    if (!migrationData) {
      setError("Migration data not found. Please start over.");
      setLoading(false);
      return;
    }

    try {
      // Create Supabase account
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) throw signUpError;

      if (authData.user) {
        // Download avatar if exists
        let avatarUrl = migrationData.avatar;
        if (migrationData.avatar) {
          try {
            const response = await fetch(migrationData.avatar);
            const blob = await response.blob();
            const fileName = `${authData.user.id}/avatar-${Date.now()}.png`;
            
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from("avatars")
              .upload(fileName, blob);

            if (!uploadError && uploadData) {
              const { data: { publicUrl } } = supabase.storage
                .from("avatars")
                .getPublicUrl(uploadData.path);
              avatarUrl = publicUrl;
            }
          } catch (err) {
            console.error("Failed to upload avatar:", err);
          }
        }

        // Create profile with Discord data
        await supabase.from("profiles").upsert(
          {
            id: authData.user.id,
            username: migrationData.username,
            avatar_url: avatarUrl,
            bio: `Migrated from Discord`,
            status: "online",
          },
          { onConflict: "id" }
        );

        // Clear migration data
        sessionStorage.removeItem("discord_migration");

        // Redirect to home
        window.location.href = "/";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete migration");
      setLoading(false);
    }
  };

  if (!migrationData) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#313338] text-white">
        <div className="w-full max-w-[480px] rounded-lg bg-[#2b2d31] p-8 shadow-2xl">
          <h1 className="text-center text-xl">Loading...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#313338] text-white">
      <div className="w-full max-w-[480px] rounded-lg bg-[#2b2d31] p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-2xl font-bold">
            Complete Your Migration
          </h1>
          <p className="text-sm text-[#b5bac1]">
            Almost done! Set up your Commz credentials
          </p>
        </div>

        <div className="mb-6 flex flex-col items-center gap-3 rounded-md bg-[#232428] p-4 border border-[#3f4147]">
          {migrationData.avatar && (
            <img
              src={migrationData.avatar}
              alt="Profile"
              className="h-20 w-20 rounded-full ring-4 ring-[#5865f2]/20"
            />
          )}
          <div className="text-center">
            <p className="font-semibold text-white">{migrationData.username}</p>
            <p className="text-xs text-[#b5bac1]">Discord Profile</p>
          </div>
        </div>

        <form className="space-y-5" onSubmit={handleCompleteMigration}>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-[#b5bac1]">
              Email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              className="w-full rounded-sm bg-[#1e1f22] px-3 py-2.5 text-[15px] outline-none transition focus:ring-1 focus:ring-[#00a8fc]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
            <p className="mt-1.5 text-xs text-[#b5bac1]">
              You'll use this to log in to Commz
            </p>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-[#b5bac1]">
              Password <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              className="w-full rounded-sm bg-[#1e1f22] px-3 py-2.5 text-[15px] outline-none transition focus:ring-1 focus:ring-[#00a8fc]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              minLength={6}
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-[#b5bac1]">
              Confirm Password <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              className="w-full rounded-sm bg-[#1e1f22] px-3 py-2.5 text-[15px] outline-none transition focus:ring-1 focus:ring-[#00a8fc]"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              minLength={6}
              required
            />
          </div>

          {error && (
            <div className="rounded bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center rounded-sm bg-[#5865f2] px-4 py-2.5 text-[15px] font-medium transition hover:bg-[#4752c4] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Complete Migration"}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                sessionStorage.removeItem("discord_migration");
                window.location.href = "/migrate";
              }}
              className="text-sm text-[#00a8fc] hover:underline"
            >
              Start over
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
