import Link from "next/link";

export default function Home() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#1e1f22] text-white">
      <div className="flex flex-col items-center gap-6 rounded-lg bg-[#313338] px-10 py-12 shadow-lg">
        <h1 className="text-3xl font-semibold">Discord Clone</h1>
        <p className="max-w-md text-center text-sm text-gray-300">
          Realtime text, voice, and servers powered by Next.js and Supabase.
          Sign in to start chatting.
        </p>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="rounded bg-indigo-500 px-5 py-2 text-sm font-semibold transition hover:bg-indigo-600"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="rounded bg-white/10 px-5 py-2 text-sm font-semibold transition hover:bg-white/20"
          >
            Register
          </Link>
        </div>
      </div>
    </div>
  );
}

