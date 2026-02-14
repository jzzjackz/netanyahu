"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "../../../lib/supabaseClient";

export default function UploadVideo() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !videoUrl.trim()) {
      setError("Title and video URL are required");
      return;
    }

    setUploading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be logged in");
      setUploading(false);
      return;
    }

    const { data, error: uploadError } = await supabase
      .from("videos")
      .insert({
        uploader_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        video_url: videoUrl.trim(),
        thumbnail_url: thumbnailUrl.trim() || null,
      })
      .select()
      .single();

    setUploading(false);

    if (uploadError) {
      setError(uploadError.message);
      return;
    }

    router.push(`/vidz/watch/${data.id}`);
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-[#272727] bg-[#0f0f0f] px-6 py-3">
        <Link href="/vidz" className="text-xl font-bold">
          AllInOne Vidz
        </Link>
      </header>

      <main className="mx-auto max-w-2xl p-6">
        <h1 className="mb-6 text-2xl font-bold">Upload Video</h1>
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Title (required)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg bg-[#272727] px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter video title"
              maxLength={100}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg bg-[#272727] px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Tell viewers about your video"
              rows={4}
              maxLength={5000}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Video URL (required)
            </label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="w-full rounded-lg bg-[#272727] px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="https://example.com/video.mp4"
            />
            <p className="mt-1 text-xs text-gray-400">
              Enter a direct link to your video file (MP4, WebM, etc.)
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Thumbnail URL (optional)
            </label>
            <input
              type="url"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              className="w-full rounded-lg bg-[#272727] px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="https://example.com/thumbnail.jpg"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={uploading}
              className="rounded-full bg-indigo-500 px-6 py-2 font-medium hover:bg-indigo-600 disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
            <Link
              href="/vidz"
              className="rounded-full bg-[#272727] px-6 py-2 font-medium hover:bg-[#3f3f3f]"
            >
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
