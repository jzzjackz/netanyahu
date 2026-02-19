"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MessageContentProps {
  content: string;
  currentUsername: string;
}

export default function MessageContent({ content, currentUsername }: MessageContentProps) {
  // Process mentions before markdown
  const processedContent = content.replace(/@(\w+)/g, (match, username) => {
    const isSelf = username === currentUsername;
    return `<span class="${isSelf ? 'bg-yellow-500/20 text-yellow-300 px-1 rounded font-semibold' : 'bg-indigo-500/20 text-indigo-300 px-1 rounded'}">${match}</span>`;
  });

  return (
    <div className="prose prose-invert max-w-none break-words text-[15px] text-gray-200">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Preserve line breaks
          p: ({ children }) => <p className="whitespace-pre-wrap mb-2 last:mb-0">{children}</p>,
          // Style code blocks
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
          // Style links
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
          // Style lists
          ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
          // Style blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-[#4e5058] pl-3 text-gray-400">
              {children}
            </blockquote>
          ),
          // Style headings
          h1: ({ children }) => <h1 className="text-xl font-bold mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-bold mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-bold mb-2">{children}</h3>,
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
