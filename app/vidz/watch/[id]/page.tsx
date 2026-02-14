"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "../../../../lib/supabaseClient";
import type { Video, VideoComment } from "../../../../lib/types";
import { format } from "date-fns";

export default function WatchVideo() {
  const params = useParams();
  const router = useRouter();
  const videoId = params.id as string;
  const supabase = createSupabaseBrowserClient();
  
  const [video, setVideo] = useState<Video | null>(null);
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [reaction, setReaction] = useState<"like" | "dislike" | null>(null);
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
      if (!user) {
        router.push("/login?redirect=/vidz");
      }
    });
  }, [router, supabase.auth]);

  useEffect(() => {
    if (!userId) return;
    
    const loadVideo = async () => {
      // Increment view count
      await supabase.rpc("increment_video_views", { video_id: videoId });
      
      // Load video
      const { data: videoData } = await supabase
        .from("videos")
        .select("*")
        .eq("id", videoId)
        .single();
      
      if (videoData) {
        // Load uploader profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", videoData.uploader_id)
          .single();
        
        setVideo({ ...videoData, profiles: profileData } as any);
        
        // Load reactions
        const { data: reactionsData } = await supabase
          .from("video_reactions")
          .select("reaction")
          .eq("video_id", videoId);
        
        setLikes((reactionsData ?? []).filter(r => r.reaction === "like").length);
        setDislikes((reactionsData ?? []).filter(r => r.reaction === "dislike").length);
        
        // Load user's reaction
        const { data: userReaction } = await supabase
          .from("video_reactions")
          .select("reaction")
          .eq("video_id", videoId)
          .eq("user_id", userId)
          .maybeSingle();
        
        if (userReaction) {
          setReaction(userReaction.reaction as "like" | "dislike");
        }
        
        // Check subscription
        const { data: subData } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("subscriber_id", userId)
          .eq("channel_id", videoData.uploader_id)
          .maybeSingle();
        
        setIsSubscribed(!!subData);
      }
      
      // Load comments
      const { data: commentsData } = await supabase
        .from("video_comments")
        .select("*")
        .eq("video_id", videoId)
        .order("created_at", { ascending: false });
      
      if (commentsData && commentsData.length > 0) {
        const userIds = [...new Set(commentsData.map((c: any) => c.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("*")
          .in("id", userIds);
        
        const profileMap = new Map((profilesData ?? []).map((p: any) => [p.id, p]));
        const commentsWithProfiles = commentsData.map((c: any) => ({
          ...c,
          profiles: profileMap.get(c.user_id),
        }));
        setComments(commentsWithProfiles);
      } else {
        setComments([]);
      }
      setLoading(false);
    };
    
    loadVideo();
  }, [videoId, userId, supabase, router]);

  const handleReaction = async (newReaction: "like" | "dislike") => {
    if (!userId) return;
    
    if (reaction === newReaction) {
      // Remove reaction
      await supabase
        .from("video_reactions")
        .delete()
        .eq("video_id", videoId)
        .eq("user_id", userId);
      
      if (newReaction === "like") setLikes(l => l - 1);
      else setDislikes(d => d - 1);
      setReaction(null);
    } else {
      // Add or update reaction
      await supabase
        .from("video_reactions")
        .upsert({
          video_id: videoId,
          user_id: userId,
          reaction: newReaction,
        });
      
      if (reaction === "like") setLikes(l => l - 1);
      if (reaction === "dislike") setDislikes(d => d - 1);
      
      if (newReaction === "like") setLikes(l => l + 1);
      else setDislikes(d => d + 1);
      
      setReaction(newReaction);
    }
  };

  const handleSubscribe = async () => {
    if (!userId || !video) return;
    
    if (isSubscribed) {
      await supabase
        .from("subscriptions")
        .delete()
        .eq("subscriber_id", userId)
        .eq("channel_id", video.uploader_id);
      setIsSubscribed(false);
    } else {
      await supabase
        .from("subscriptions")
        .insert({
          subscriber_id: userId,
          channel_id: video.uploader_id,
        });
      setIsSubscribed(true);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !userId) return;
    
    const { data, error } = await supabase
      .from("video_comments")
      .insert({
        video_id: videoId,
        user_id: userId,
        content: newComment.trim(),
      })
      .select("*")
      .single();
    
    if (data) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      
      setComments([{ ...data, profiles: profileData } as any, ...comments]);
      setNewComment("");
    }
  };

  if (loading || !video) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f0f] text-white">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-[#272727] bg-[#0f0f0f] px-6 py-3">
        <Link href="/vidz" className="text-xl font-bold">
          AllInOne Vidz
        </Link>
      </header>

      <main className="mx-auto max-w-[1800px] p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Video player */}
          <div className="lg:col-span-2">
            <div className="aspect-video overflow-hidden rounded-xl bg-black">
              <video
                src={video.video_url}
                controls
                className="h-full w-full"
                autoPlay
              />
            </div>

            {/* Video info */}
            <div className="mt-4">
              <h1 className="text-xl font-bold">{video.title}</h1>
              
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500 text-sm font-bold">
                      {(video.profiles?.username ?? "?").slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{video.profiles?.username}</p>
                      <p className="text-sm text-gray-400">{video.views} views</p>
                    </div>
                  </div>
                  {video.uploader_id !== userId && (
                    <button
                      onClick={handleSubscribe}
                      className={`rounded-full px-4 py-2 text-sm font-medium ${
                        isSubscribed
                          ? "bg-[#272727] hover:bg-[#3f3f3f]"
                          : "bg-white text-black hover:bg-gray-200"
                      }`}
                    >
                      {isSubscribed ? "Subscribed" : "Subscribe"}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleReaction("like")}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 ${
                      reaction === "like" ? "bg-indigo-500" : "bg-[#272727] hover:bg-[#3f3f3f]"
                    }`}
                  >
                    👍 {likes}
                  </button>
                  <button
                    onClick={() => handleReaction("dislike")}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 ${
                      reaction === "dislike" ? "bg-indigo-500" : "bg-[#272727] hover:bg-[#3f3f3f]"
                    }`}
                  >
                    👎 {dislikes}
                  </button>
                </div>
              </div>

              {video.description && (
                <div className="mt-4 rounded-xl bg-[#272727] p-4">
                  <p className="whitespace-pre-wrap text-sm">{video.description}</p>
                </div>
              )}
            </div>

            {/* Comments */}
            <div className="mt-6">
              <h2 className="mb-4 text-lg font-bold">{comments.length} Comments</h2>
              
              <form onSubmit={handleComment} className="mb-6 flex gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500 text-sm font-bold">
                  U
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="w-full border-b border-[#272727] bg-transparent pb-2 outline-none focus:border-white"
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setNewComment("")}
                      className="rounded-full px-4 py-2 text-sm hover:bg-[#272727]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!newComment.trim()}
                      className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50"
                    >
                      Comment
                    </button>
                  </div>
                </div>
              </form>

              <div className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500 text-sm font-bold">
                      {(comment.profiles?.username ?? "?").slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{comment.profiles?.username}</span>
                        <span className="text-xs text-gray-400">
                          {format(new Date(comment.created_at), "MMM d, yyyy")}
                        </span>
                      </div>
                      <p className="mt-1 text-sm">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar - Related videos */}
          <div className="lg:col-span-1">
            <h3 className="mb-4 font-bold">More videos</h3>
            <p className="text-sm text-gray-400">Coming soon...</p>
          </div>
        </div>
      </main>
    </div>
  );
}
