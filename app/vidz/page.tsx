"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "../../lib/supabaseClient";
import type { Video } from "../../lib/types";

export default function VidzHome() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (!session) {
        router.push("/login?redirect=/vidz");
        return;
      }

      // Check if user is banned
      const { data: ban } = await supabase
        .from("platform_bans")
        .select("id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      
      if (ban) {
        router.push("/banned");
      }
    });
  }, [router, supabase]);

  useEffect(() => {
    if (!session) return;
    const loadVideos = async () => {
      const { data: videosData } = await supabase
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (videosData && videosData.length > 0) {
        const uploaderIds = [...new Set(videosData.map((v: any) => v.uploader_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("*")
          .in("id", uploaderIds);
        
        const profileMap = new Map((profilesData ?? []).map((p: any) => [p.id, p]));
        const videosWithProfiles = videosData.map((v: any) => ({
          ...v,
          profiles: profileMap.get(v.uploader_id),
        }));
        setVideos(videosWithProfiles);
      } else {
        setVideos([]);
      }
      setLoading(false);
    };
    loadVideos();
  }, [session, supabase]);

  if (!session || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f0f] text-white">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-[#272727] bg-[#0f0f0f] px-6 py-3">
        <Link href="/vidz" className="text-xl font-bold">
          AllInOne Vidz
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/vidz/upload"
            className="rounded-full bg-[#272727] px-4 py-2 text-sm hover:bg-[#3f3f3f]"
          >
            Upload
          </Link>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-sm text-gray-400 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-[1800px] p-6">
        <h1 className="mb-6 text-2xl font-bold">Home</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {videos.map((video) => (
            <Link
              key={video.id}
              href={`/vidz/watch/${video.id}`}
              className="group cursor-pointer"
            >
              <div className="relative aspect-video overflow-hidden rounded-xl bg-[#272727]">
                {video.thumbnail_url ? (
                  <img
                    src={video.thumbnail_url}
                    alt={video.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-4xl">
                    🎬
                  </div>
                )}
              </div>
              <div className="mt-3 flex gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500 text-sm font-bold">
                  {(video.profiles?.username ?? "?").slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1">
                  <h3 className="line-clamp-2 font-medium group-hover:text-gray-300">
                    {video.title}
                  </h3>
                  <p className="mt-1 text-sm text-gray-400">
                    {video.profiles?.username}
                  </p>
                  <p className="text-sm text-gray-400">
                    {video.views} views
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
        {videos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <p className="text-lg">No videos yet</p>
            <Link
              href="/vidz/upload"
              className="mt-4 rounded-full bg-indigo-500 px-6 py-2 text-white hover:bg-indigo-600"
            >
              Upload the first video
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
