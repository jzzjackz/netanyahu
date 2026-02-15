"use client";

import { useState, useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";

interface GifResult {
  id: string;
  filename: string;
  title: string;
  url: string;
  preview: string;
  size: number;
  uploadDate: string;
  source: "custom" | "giphy";
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

// GIPHY API - Using public demo key (limited rate)
// For production, get your own key at https://developers.giphy.com/
const GIPHY_API_KEY = "sXpGFDGZs0Dv1mmNFvYaGUvYwKX0PWIh"; // Public demo key

export default function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showNsfw, setShowNsfw] = useState(false);
  const [selectedSource, setSelectedSource] = useState<"all" | "custom" | "giphy" | "favorites">("all");
  const [favorites, setFavorites] = useState<GifResult[]>([]);
  const [favoriteUrls, setFavoriteUrls] = useState<Set<string>>(new Set());
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const supabase = createSupabaseBrowserClient();

  const loadCustomGifs = async (searchQuery: string, pageNum: number) => {
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

      const results = data.results.map((gif: any) => ({
        ...gif,
        source: "custom" as const,
      }));

      // Filter NSFW GIFs if showNsfw is false
      const filteredResults = showNsfw 
        ? results 
        : results.filter((gif: GifResult) => !NSFW_GIFS.includes(gif.filename));

      return {
        results: filteredResults,
        hasMore: data.pagination.hasMore,
      };
    } catch (error) {
      console.error("Failed to load custom GIFs:", error);
      return { results: [], hasMore: false };
    }
  };

  const loadGiphyGifs = async (searchQuery: string, pageNum: number) => {
    try {
      const limit = 20;
      const offset = (pageNum - 1) * limit;
      
      const endpoint = searchQuery 
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(searchQuery)}&limit=${limit}&offset=${offset}&rating=${showNsfw ? 'r' : 'pg-13'}`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=${limit}&offset=${offset}&rating=${showNsfw ? 'r' : 'pg-13'}`;

      console.log("Fetching from GIPHY:", endpoint);

      const response = await fetch(endpoint);

      console.log("GIPHY response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("GIPHY API error:", response.status, errorText);
        throw new Error(`GIPHY API error: ${response.status}`);
      }

      const data = await response.json();
      console.log("GIPHY data:", data);

      const results = (data.data || []).map((gif: any) => ({
        id: gif.id,
        filename: gif.id,
        title: gif.title || "GIF",
        url: gif.images?.original?.url || gif.images?.downsized?.url || "",
        preview: gif.images?.fixed_width_small?.url || gif.images?.downsized_small?.url || gif.images?.original?.url || "",
        size: 0,
        uploadDate: gif.import_datetime || new Date().toISOString(),
        source: "giphy" as const,
      })).filter((gif: GifResult) => gif.url);

      console.log("GIPHY processed results:", results.length);

      return {
        results,
        hasMore: data.pagination && data.pagination.total_count > (offset + limit),
      };
    } catch (error) {
      console.error("Failed to load GIPHY GIFs:", error);
      return { results: [], hasMore: false };
    }
  };

  const loadFavorites = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("favorite_gifs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) {
      const favGifs = data.map((fav: any) => ({
        id: fav.id,
        filename: fav.id,
        title: fav.gif_title || "GIF",
        url: fav.gif_url,
        preview: fav.gif_preview_url || fav.gif_url,
        size: 0,
        uploadDate: fav.created_at,
        source: "custom" as const,
      }));
      setFavorites(favGifs);
      setFavoriteUrls(new Set(data.map((fav: any) => fav.gif_url)));
    }
  };

  const toggleFavorite = async (gif: GifResult) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (favoriteUrls.has(gif.url)) {
      // Remove from favorites
      await supabase
        .from("favorite_gifs")
        .delete()
        .eq("user_id", user.id)
        .eq("gif_url", gif.url);
      
      setFavoriteUrls(prev => {
        const newSet = new Set(prev);
        newSet.delete(gif.url);
        return newSet;
      });
      setFavorites(prev => prev.filter(f => f.url !== gif.url));
    } else {
      // Add to favorites
      await supabase
        .from("favorite_gifs")
        .insert({
          user_id: user.id,
          gif_url: gif.url,
          gif_title: gif.title,
          gif_preview_url: gif.preview,
        });
      
      setFavoriteUrls(prev => new Set(prev).add(gif.url));
      setFavorites(prev => [gif, ...prev]);
    }
  };

  const loadGifs = async (searchQuery: string, pageNum: number, append = false) => {
    if (selectedSource === "favorites") {
      setGifs(favorites);
      setHasMore(false);
      return;
    }

    setLoading(true);
    try {
      let allResults: GifResult[] = [];
      let hasMoreResults = false;

      if (selectedSource === "all" || selectedSource === "custom") {
        const customData = await loadCustomGifs(searchQuery, pageNum);
        allResults = [...allResults, ...customData.results];
        hasMoreResults = hasMoreResults || customData.hasMore;
      }

      if (selectedSource === "all" || selectedSource === "giphy") {
        const giphyData = await loadGiphyGifs(searchQuery, pageNum);
        allResults = [...allResults, ...giphyData.results];
        hasMoreResults = hasMoreResults || giphyData.hasMore;
      }

      if (append) {
        setGifs((prev) => [...prev, ...allResults]);
      } else {
        setGifs(allResults);
      }
      setHasMore(hasMoreResults);
    } catch (error) {
      console.error("Failed to load GIFs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGifs("", 1);
    loadFavorites();
  }, []);

  useEffect(() => {
    // Reload GIFs when NSFW toggle or source changes
    setPage(1);
    if (selectedSource === "favorites") {
      setGifs(favorites);
      setHasMore(false);
    } else {
      loadGifs(search, 1);
    }
  }, [showNsfw, selectedSource]);

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
          
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedSource("all")}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                selectedSource === "all"
                  ? "bg-indigo-500 text-white"
                  : "bg-[#404249] text-gray-300 hover:bg-[#4f5058]"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedSource("favorites")}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                selectedSource === "favorites"
                  ? "bg-indigo-500 text-white"
                  : "bg-[#404249] text-gray-300 hover:bg-[#4f5058]"
              }`}
            >
              ⭐ Favs
            </button>
            <button
              onClick={() => setSelectedSource("custom")}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                selectedSource === "custom"
                  ? "bg-indigo-500 text-white"
                  : "bg-[#404249] text-gray-300 hover:bg-[#4f5058]"
              }`}
            >
              Custom
            </button>
            <button
              onClick={() => setSelectedSource("giphy")}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                selectedSource === "giphy"
                  ? "bg-indigo-500 text-white"
                  : "bg-[#404249] text-gray-300 hover:bg-[#4f5058]"
              }`}
            >
              GIPHY
            </button>
          </div>
          
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
              <div key={gif.id} className="group relative">
                <button
                  onClick={() => onSelect(gif.url)}
                  className="relative aspect-square w-full overflow-hidden rounded-lg bg-[#404249] hover:ring-2 hover:ring-indigo-500"
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
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(gif);
                  }}
                  className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-lg opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
                  title={favoriteUrls.has(gif.url) ? "Remove from favorites" : "Add to favorites"}
                >
                  {favoriteUrls.has(gif.url) ? "⭐" : "☆"}
                </button>
              </div>
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
