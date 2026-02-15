"use client";

import { useState, useEffect, useRef } from "react";

interface GifResult {
  id: string;
  filename: string;
  title: string;
  url: string;
  preview: string;
  size: number;
  uploadDate: string;
}

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}

const NSFW_GIFS = [
  "m2-res_396p-1768694438299-370936830.gif",
  "straight-1768688660306-663797651.gif",
  "astolfo-1768850004127-553419032.jpg",
  "e7392d2809cd5c9272c9e08a0a3bb17a-1768849930034-291004006.gif"
];

export default function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showNsfw, setShowNsfw] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadGifs = async (searchQuery: string, pageNum: number, append = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "20",
      });
      if (searchQuery) {
        params.append("search", searchQuery);
      }

      const response = await fetch(`https://yallah-flax.vercel.app/api/gifs?${params}`);
      const data = await response.json();

      // Filter NSFW GIFs if showNsfw is false
      const filteredResults = showNsfw 
        ? data.results 
        : data.results.filter((gif: GifResult) => !NSFW_GIFS.includes(gif.filename));

      if (append) {
        setGifs((prev) => [...prev, ...filteredResults]);
      } else {
        setGifs(filteredResults);
      }
      setHasMore(data.pagination.hasMore);
    } catch (error) {
      console.error("Failed to load GIFs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGifs("", 1);
  }, []);

  useEffect(() => {
    // Reload GIFs when NSFW toggle changes
    setPage(1);
    loadGifs(search, 1);
  }, [showNsfw]);

  const handleSearch = (value: string) => {
    setSearch(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
      loadGifs(value, 1);
    }, 500);
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadGifs(search, nextPage, true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="flex h-[600px] w-[500px] flex-col rounded-lg bg-[#2b2d31] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#1e1f22] p-4">
          <h2 className="text-lg font-semibold text-white">Select a GIF</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 p-4">
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search GIFs..."
            className="w-full rounded-lg bg-[#404249] px-4 py-2 text-sm text-white outline-none placeholder:text-gray-500 focus:ring-2 focus:ring-indigo-500"
          />
          
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={showNsfw}
              onChange={(e) => setShowNsfw(e.target.checked)}
              className="h-4 w-4 rounded border-gray-600 bg-[#404249] text-indigo-500 focus:ring-2 focus:ring-indigo-500"
            />
            <span>Show NSFW content</span>
          </label>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-2">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                onClick={() => onSelect(gif.url)}
                className="group relative aspect-square overflow-hidden rounded-lg bg-[#404249] hover:ring-2 hover:ring-indigo-500"
              >
                <img
                  src={gif.preview}
                  alt={gif.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="text-sm font-medium text-white">Select</span>
                </div>
              </button>
            ))}
          </div>

          {loading && (
            <div className="mt-4 text-center text-gray-400">Loading...</div>
          )}

          {!loading && hasMore && gifs.length > 0 && (
            <button
              onClick={handleLoadMore}
              className="mt-4 w-full rounded-lg bg-indigo-500 py-2 text-sm font-medium hover:bg-indigo-600"
            >
              Load More
            </button>
          )}

          {!loading && gifs.length === 0 && (
            <div className="mt-8 text-center text-gray-400">
              No GIFs found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
