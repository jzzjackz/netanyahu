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
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !videoFile) {
      setError("Title and video file are required");
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be logged in");
      setUploading(false);
      return;
    }

    try {
      // Upload video file
      const videoFileName = `${user.id}/${Date.now()}-${videoFile.name}`;
      setUploadProgress(25);
      
      const { data: videoData, error: videoError } = await supabase.storage
        .from("videos")
        .upload(videoFileName, videoFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (videoError) throw videoError;
      setUploadProgress(50);

      // Get public URL for video
      const { data: { publicUrl: videoUrl } } = supabase.storage
        .from("videos")
        .getPublicUrl(videoFileName);

      // Upload thumbnail if provided
      let thumbnailUrl = null;
      if (thumbnailFile) {
        const thumbnailFileName = `${user.id}/${Date.now()}-${thumbnailFile.name}`;
        setUploadProgress(65);
        
        const { data: thumbnailData, error: thumbnailError } = await supabase.storage
          .from("thumbnails")
          .upload(thumbnailFileName, thumbnailFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (!thumbnailError) {
          const { data: { publicUrl } } = supabase.storage
            .from("thumbnails")
            .getPublicUrl(thumbnailFileName);
          thumbnailUrl = publicUrl;
        }
      }
      setUploadProgress(80);

      // Create video record in database
      const { data, error: dbError } = await supabase
        .from("videos")
        .insert({
          uploader_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
        })
        .select()
        .single();

      setUploadProgress(100);

      if (dbError) throw dbError;

      router.push(`/vidz/watch/${data.id}`);
    } catch (err: any) {
      setError(err.message || "Upload failed");
      setUploading(false);
      setUploadProgress(0);
    }
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
              Video File (required)
            </label>
            <input
              type="file"
              accept="video/*"
              onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
              className="w-full rounded-lg bg-[#272727] px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {videoFile && (
              <p className="mt-1 text-xs text-gray-400">
                Selected: {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Thumbnail (optional)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
              className="w-full rounded-lg bg-[#272727] px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {thumbnailFile && (
              <p className="mt-1 text-xs text-gray-400">
                Selected: {thumbnailFile.name}
              </p>
            )}
          </div>

          {uploading && (
            <div className="rounded-lg bg-[#272727] p-4">
              <div className="mb-2 flex justify-between text-sm">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#0f0f0f]">
                <div
                  className="h-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

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
