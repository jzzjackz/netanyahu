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
      <div className="flex min-h-screen w-full items-center justify-center bg-[#1e1f22] text-white">
        <div className="w-full max-w-md rounded-md bg-[#313338] p-8 shadow-lg">
          <h1 className="text-center text-xl">Loading...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#1e1f22] text-white">
      <div className="w-full max-w-md rounded-md bg-[#313338] p-8 shadow-lg">
        <h1 className="mb-2 text-center text-2xl font-semibold">
          Complete Your Migration
        </h1>
        <p className="mb-6 text-center text-sm text-gray-400">
          Almost done! Set up your Commz credentials
        </p>

        <div className="mb-6 flex flex-col items-center gap-3 rounded-lg bg-[#2b2d31] p-4">
          {migrationData.avatar && (
            <img
              src={migrationData.avatar}
              alt="Profile"
              className="h-20 w-20 rounded-full"
            />
          )}
          <div className="text-center">
            <p className="font-semibold">{migrationData.username}</p>
            <p className="text-xs text-gray-400">Discord Profile</p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleCompleteMigration}>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-gray-300">
              Email
            </label>
            <input
              type="email"
              className="w-full rounded bg-[#1e1f22] px-3 py-2 text-sm outline-none ring-1 ring-[#1e1f22] focus:ring-indigo-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              You'll use this to log in to Commz
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-gray-300">
              Password
            </label>
            <input
              type="password"
              className="w-full rounded bg-[#1e1f22] px-3 py-2 text-sm outline-none ring-1 ring-[#1e1f22] focus:ring-indigo-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              minLength={6}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-gray-300">
              Confirm Password
            </label>
            <input
              type="password"
              className="w-full rounded bg-[#1e1f22] px-3 py-2 text-sm outline-none ring-1 ring-[#1e1f22] focus:ring-indigo-500"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              minLength={6}
              required
            />
          </div>

          {error && (
            <p className="text-xs text-red-400" aria-live="polite">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center rounded bg-indigo-500 px-4 py-2.5 text-sm font-semibold transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-70"
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
              className="text-xs text-gray-400 hover:text-gray-300"
            >
              Start over
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
