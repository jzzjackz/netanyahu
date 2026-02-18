"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../../../../lib/supabaseClient";
import Link from "next/link";

interface Video {
  id: string;
  title: string;
  thumbnail_url: string;
  views: number;
  created_at: string;
}

interface Channel {
  id: string;
  username: string;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  created_at: string;
}

export default function ChannelPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const channelId = params.id as string;

  const [channel, setChannel] = useState<Channel | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      // Load channel info
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, banner_url, bio, created_at")
        .eq("id", channelId)
        .single();

      if (profileData) {
        setChannel(profileData as Channel);
      }

      // Load channel videos
      const { data: videosData } = await supabase
        .from("videos")
        .select("id, title, thumbnail_url, views, created_at")
        .eq("uploader_id", channelId)
        .order("created_at", { ascending: false });

      if (videosData) {
        setVideos(videosData as Video[]);
      }

      // Load subscriber count
      const { count } = await supabase
        .from("subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("channel_id", channelId);

      setSubscriberCount(count ?? 0);

      // Check if current user is subscribed
      if (user) {
        const { data: subData } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("user_id", user.id)
          .eq("channel_id", channelId)
          .maybeSingle();

        setIsSubscribed(!!subData);
      }

      setLoading(false);
    };

    load();
  }, [channelId, supabase]);

  const handleSubscribe = async () => {
    if (!currentUserId) {
      router.push("/login");
      return;
    }

    if (isSubscribed) {
      await supabase
        .from("subscriptions")
        .delete()
        .eq("user_id", currentUserId)
        .eq("channel_id", channelId);
      setIsSubscribed(false);
      setSubscriberCount(prev => prev - 1);
    } else {
      await supabase
        .from("subscriptions")
        .insert({ user_id: currentUserId, channel_id: channelId });
      setIsSubscribed(true);
      setSubscriberCount(prev => prev + 1);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f0f] text-white">
        <p>Loading...</p>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f0f] text-white">
        <p>Channel not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* Banner */}
      <div className="h-48 w-full bg-gradient-to-r from-purple-600 to-blue-600">
        {channel.banner_url && (
          <img src={channel.banner_url} alt="Banner" className="h-full w-full object-cover" />
        )}
      </div>

      {/* Channel Info */}
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex items-start gap-6 py-6">
          {/* Avatar */}
          <div className="h-32 w-32 flex-shrink-0 overflow-hidden rounded-full bg-[#272727]">
            {channel.avatar_url ? (
              <img src={channel.avatar_url} alt={channel.username} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-4xl font-bold">
                {channel.username.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{channel.username}</h1>
            <div className="mt-2 flex items-center gap-4 text-sm text-gray-400">
              <span>{subscriberCount} subscribers</span>
              <span>•</span>
              <span>{videos.length} videos</span>
            </div>
            {channel.bio && (
              <p className="mt-4 text-sm text-gray-300">{channel.bio}</p>
            )}
          </div>

          {/* Subscribe Button */}
          {currentUserId !== channelId && (
            <button
              onClick={handleSubscribe}
              className={`rounded-full px-6 py-2 font-medium ${
                isSubscribed
                  ? "bg-[#272727] hover:bg-[#3f3f3f]"
                  : "bg-white text-black hover:bg-gray-200"
              }`}
            >
              {isSubscribed ? "Subscribed" : "Subscribe"}
            </button>
          )}
        </div>

        {/* Videos Grid */}
        <div className="border-t border-[#272727] py-6">
          <h2 className="mb-4 text-xl font-bold">Videos</h2>
          {videos.length === 0 ? (
            <p className="text-gray-400">No videos yet</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {videos.map((video) => (
                <Link key={video.id} href={`/vidz/watch/${video.id}`}>
                  <div className="cursor-pointer">
                    <div className="relative aspect-video overflow-hidden rounded-lg bg-[#272727]">
                      {video.thumbnail_url && (
                        <img
                          src={video.thumbnail_url}
                          alt={video.title}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="mt-2">
                      <h3 className="line-clamp-2 text-sm font-medium">{video.title}</h3>
                      <p className="mt-1 text-xs text-gray-400">
                        {video.views} views • {new Date(video.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Back to Vidz */}
      <div className="fixed bottom-4 left-4">
        <Link
          href="/vidz"
          className="rounded-full bg-[#272727] px-4 py-2 text-sm hover:bg-[#3f3f3f]"
        >
          ← Back to Vidz
        </Link>
      </div>
    </div>
  );
}
