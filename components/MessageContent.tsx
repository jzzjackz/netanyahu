"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MessageContentProps {
  content: string;
  currentUsername: string;
}

export default function MessageContent({ content, currentUsername }: MessageContentProps) {
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<number>>(new Set());

  // Process spoilers and mentions
  const parts: Array<{ type: "text" | "spoiler"; content: string; index: number }> = [];
  let lastIndex = 0;
  let spoilerIndex = 0;

  // Find all spoilers ||text||
  const spoilerRegex = /\|\|(.+?)\|\|/g;
  let match;

  while ((match = spoilerRegex.exec(content)) !== null) {
    // Add text before spoiler
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: content.slice(lastIndex, match.index),
        index: -1,
      });
    }

    // Add spoiler
    parts.push({
      type: "spoiler",
      content: match[1],
      index: spoilerIndex++,
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push({
      type: "text",
      content: content.slice(lastIndex),
      index: -1,
    });
  }

  // If no spoilers, just render normally
  if (parts.length === 0) {
    parts.push({ type: "text", content, index: -1 });
  }

  const processMentions = (text: string) => {
    return text.replace(/@(\w+)/g, (match, username) => {
      const isSelf = username === currentUsername;
      return `<span class="${isSelf ? 'bg-yellow-500/20 text-yellow-300 px-1 rounded font-semibold' : 'bg-indigo-500/20 text-indigo-300 px-1 rounded'}">${match}</span>`;
    });
  };

  return (
    <div className="prose prose-invert max-w-none break-words text-[15px] text-gray-200">
      {parts.map((part, idx) => {
        if (part.type === "spoiler") {
          const isRevealed = revealedSpoilers.has(part.index);
          return (
            <span
              key={idx}
              onClick={() => {
                setRevealedSpoilers((prev) => {
                  const newSet = new Set(prev);
                  if (isRevealed) {
                    newSet.delete(part.index);
                  } else {
                    newSet.add(part.index);
                  }
                  return newSet;
                });
              }}
              className={`cursor-pointer rounded px-1 ${
                isRevealed
                  ? "bg-[#1e1f22] text-gray-200"
                  : "bg-[#1e1f22] text-[#1e1f22] hover:bg-[#2b2d31]"
              }`}
              title={isRevealed ? "Hide spoiler" : "Click to reveal spoiler"}
            >
              {part.content}
            </span>
          );
        }

        const processedContent = processMentions(part.content);

        return (
          <ReactMarkdown
            key={idx}
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <span className="whitespace-pre-wrap">{children}</span>,
              code: ({ inline, children, ...props }: any) => {
                if (inline) {
                  return (
                    <code className="rounded bg-[#1e1f22] px-1.5 py-0.5 text-sm text-[#eb459e]" {...props}>
                      {children}
                    </code>
                  );
                }
                return (
                  <code className="block rounded bg-[#1e1f22] p-2 text-sm overflow-x-auto" {...props}>
                    {children}
                  </code>
                );
              },
              a: ({ children, href }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#00aff4] hover:underline"
                >
                  {children}
                </a>
              ),
              ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-[#4e5058] pl-3 text-gray-400">
                  {children}
                </blockquote>
              ),
              h1: ({ children }) => <h1 className="text-xl font-bold mb-2">{children}</h1>,
              h2: ({ children }) => <h2 className="text-lg font-bold mb-2">{children}</h2>,
              h3: ({ children }) => <h3 className="text-base font-bold mb-2">{children}</h3>,
            }}
          >
            {processedContent}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}
