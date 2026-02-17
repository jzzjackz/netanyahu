"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "../../../lib/supabaseClient";

export default function RegisterPage() {
  const supabase = createSupabaseBrowserClient();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }
    if (data.user) {
      await supabase.from("profiles").upsert(
        { id: data.user.id, username, status: 'online' },
        { onConflict: "id" }
      );
    }
    setLoading(false);
    window.location.href = "/";
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#313338] text-white">
      <div className="w-full max-w-[480px] rounded-lg bg-[#2b2d31] p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-2xl font-bold">
            Create an account
          </h1>
        </div>
        <form className="space-y-5" onSubmit={handleRegister}>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-[#b5bac1]">
              Username <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              className="w-full rounded-sm bg-[#1e1f22] px-3 py-2.5 text-[15px] outline-none transition focus:ring-1 focus:ring-[#00a8fc]"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-[#b5bac1]">
              Email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              className="w-full rounded-sm bg-[#1e1f22] px-3 py-2.5 text-[15px] outline-none transition focus:ring-1 focus:ring-[#00a8fc]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
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
            {loading ? "Creating account..." : "Continue"}
          </button>
          <p className="text-xs text-[#b5bac1]">
            By registering, you agree to Commz's Terms of Service and Privacy Policy.
          </p>
          <p className="text-sm text-gray-400">
            <a href="/login" className="text-[#00a8fc] hover:underline">
              Already have an account?
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}

