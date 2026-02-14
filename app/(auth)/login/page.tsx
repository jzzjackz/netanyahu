"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../lib/supabaseClient";

function LoginForm() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/";
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      window.location.href = redirect;
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#1e1f22] text-white">
      <div className="w-full max-w-md rounded-md bg-[#313338] p-8 shadow-lg">
        <h1 className="mb-6 text-center text-2xl font-semibold">
          Welcome back, Please sign in with you AllInOne account.
        </h1>
        <form className="space-y-4" onSubmit={handleEmailLogin}>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-gray-300">
              Email
            </label>
            <input
              type="email"
              className="w-full rounded bg-[#1e1f22] px-3 py-2 text-sm outline-none ring-1 ring-[#1e1f22] focus:ring-indigo-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
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
            className="mt-2 flex w-full items-center justify-center rounded bg-indigo-500 px-4 py-2 text-sm font-semibold transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
          <p className="mt-3 text-center text-xs text-gray-400">
            New?{" "}
            <a href="/register" className="text-indigo-400 hover:text-indigo-300">
              Create an account here
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen w-full items-center justify-center bg-[#1e1f22] text-white">
        <div className="w-full max-w-md rounded-md bg-[#313338] p-8 shadow-lg">
          <h1 className="mb-6 text-center text-2xl font-semibold">Loading...</h1>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

