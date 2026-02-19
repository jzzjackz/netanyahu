"use client";

interface FormattingToolbarProps {
  onInsert: (before: string, after: string) => void;
}

export default function FormattingToolbar({ onInsert }: FormattingToolbarProps) {
  return (
    <div className="flex items-center gap-1 border-b border-[#1e1f22] px-2 py-1">
      <button
        type="button"
        onClick={() => onInsert("**", "**")}
        className="rounded px-2 py-1 text-sm font-bold text-gray-400 hover:bg-white/5 hover:text-white"
        title="Bold"
      >
        B
      </button>
      <button
        type="button"
        onClick={() => onInsert("*", "*")}
        className="rounded px-2 py-1 text-sm italic text-gray-400 hover:bg-white/5 hover:text-white"
        title="Italic"
      >
        I
      </button>
      <button
        type="button"
        onClick={() => onInsert("~~", "~~")}
        className="rounded px-2 py-1 text-sm text-gray-400 hover:bg-white/5 hover:text-white line-through"
        title="Strikethrough"
      >
        S
      </button>
      <button
        type="button"
        onClick={() => onInsert("`", "`")}
        className="rounded px-2 py-1 font-mono text-sm text-gray-400 hover:bg-white/5 hover:text-white"
        title="Code"
      >
        {"</>"}
      </button>
      <button
        type="button"
        onClick={() => onInsert("||", "||")}
        className="rounded px-2 py-1 text-sm text-gray-400 hover:bg-white/5 hover:text-white"
        title="Spoiler"
      >
        👁️
      </button>
      <button
        type="button"
        onClick={() => onInsert("> ", "")}
        className="rounded px-2 py-1 text-sm text-gray-400 hover:bg-white/5 hover:text-white"
        title="Quote"
      >
        "
      </button>
      <button
        type="button"
        onClick={() => onInsert("```\n", "\n```")}
        className="rounded px-2 py-1 text-sm text-gray-400 hover:bg-white/5 hover:text-white"
        title="Code Block"
      >
        {"{ }"}
      </button>
    </div>
  );
}
