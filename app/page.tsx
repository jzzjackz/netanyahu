"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#313338] text-white">
      <div className="w-full max-w-2xl px-6">
        <div className="mb-12 text-center">
          <h1 className="mb-3 text-5xl font-bold">AllInOne</h1>
          <p className="text-lg text-[#b5bac1]">Choose your service</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Commz Card */}
          <Link
            href="/commz"
            className="group relative overflow-hidden rounded-lg bg-[#2b2d31] p-8 shadow-2xl transition hover:bg-[#313338]"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#5865f2]">
              <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h2 className="mb-2 text-2xl font-bold">Commz</h2>
            <p className="text-sm text-[#b5bac1]">
              Chat with friends, join servers, and connect with communities
            </p>
            <div className="mt-4 flex items-center gap-2 text-sm text-[#00a8fc] transition group-hover:gap-3">
              <span>Open Commz</span>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          {/* Vidz Card */}
          <Link
            href="/vidz"
            className="group relative overflow-hidden rounded-lg bg-[#2b2d31] p-8 shadow-2xl transition hover:bg-[#313338]"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500">
              <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="mb-2 text-2xl font-bold">Vidz</h2>
            <p className="text-sm text-[#b5bac1]">
              Watch, upload, and share videos with the community
            </p>
            <div className="mt-4 flex items-center gap-2 text-sm text-[#00a8fc] transition group-hover:gap-3">
              <span>Open Vidz</span>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

