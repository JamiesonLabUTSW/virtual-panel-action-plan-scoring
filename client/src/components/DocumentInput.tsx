import { type ChangeEvent, useCallback, useRef, useState } from "react";
import { EXAMPLE_ACTION_ITEMS, type ExampleActionItem } from "../data/example-action-items";

const MAX_CHARS = 20_000;
const WARN_CHARS = 15_000;
const DANGER_CHARS = 18_000;

interface DocumentInputProps {
  onSubmit: (title: string, text: string) => void;
  disabled?: boolean;
}

function DifficultyBadge({ difficulty }: { difficulty: ExampleActionItem["difficulty"] }) {
  const colors = {
    Basic: "bg-green-500/20 text-green-400",
    Moderate: "bg-yellow-500/20 text-yellow-400",
    Comprehensive: "bg-orange-500/20 text-orange-400",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[difficulty]}`}>
      {difficulty}
    </span>
  );
}

function ExampleCard({
  item,
  onSelect,
}: {
  item: ExampleActionItem;
  onSelect: (item: ExampleActionItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="group text-left rounded-xl border border-surface-700 bg-surface-800 p-4
        hover:border-accent/60 hover:shadow-lg hover:shadow-accent/5
        hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-2xl" role="img" aria-label={item.specialty}>
          {item.icon}
        </span>
        <DifficultyBadge difficulty={item.difficulty} />
      </div>
      <h3 className="text-sm font-semibold text-text-primary mb-1 group-hover:text-accent-light transition-colors">
        {item.specialty}
      </h3>
      <p className="text-xs text-text-secondary mb-2">{item.contentArea}</p>
      <p className="text-xs text-text-secondary/70 line-clamp-2 leading-relaxed">{item.preview}</p>
    </button>
  );
}

export default function DocumentInput({ onSubmit, disabled }: DocumentInputProps) {
  const [mode, setMode] = useState<"gallery" | "editor">("gallery");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const charCount = text.length;
  const isOverLimit = charCount > MAX_CHARS;
  const charPercent = Math.min((charCount / MAX_CHARS) * 100, 100);
  const barColor =
    charCount > DANGER_CHARS
      ? "bg-red-500"
      : charCount > WARN_CHARS
        ? "bg-yellow-500"
        : "bg-green-500";

  const handleSelectExample = useCallback((item: ExampleActionItem) => {
    setTitle(item.specialty);
    setText(item.fullText);
    setMode("editor");
  }, []);

  const handleFileUpload = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        setText(content);
        if (!title) setTitle(file.name.replace(/\.(txt|md)$/, ""));
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [title]
  );

  const handleSubmit = useCallback(() => {
    if (text.trim().length === 0 || isOverLimit || disabled) return;
    onSubmit(title || "Untitled Proposal", text);
  }, [text, title, isOverLimit, disabled, onSubmit]);

  if (mode === "gallery") {
    return (
      <div className="animate-fade-in">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-text-primary mb-2">Choose an Action Item</h2>
          <p className="text-text-secondary">
            Select a medical specialty example or upload your own document
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {EXAMPLE_ACTION_ITEMS.map((item) => (
            <ExampleCard key={item.id} item={item} onSelect={handleSelectExample} />
          ))}
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setTitle("");
              setText("");
              setMode("editor");
            }}
            className="text-sm text-accent hover:text-accent-light transition-colors underline underline-offset-4"
          >
            Or write your own proposal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={() => setMode("gallery")}
          className="text-sm text-text-secondary hover:text-text-primary transition-colors
            flex items-center gap-1.5"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Examples
        </button>

        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="text-sm text-text-secondary hover:text-text-primary transition-colors
              border border-surface-600 rounded-lg px-3 py-1.5 hover:border-surface-500
              disabled:opacity-50"
          >
            Upload File
          </button>
        </div>
      </div>

      {/* Title input */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Proposal title (optional)"
        disabled={disabled}
        className="w-full bg-surface-800 border border-surface-700 rounded-lg px-4 py-3
          text-text-primary placeholder:text-text-secondary/50 mb-4
          focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30
          disabled:opacity-50 transition-colors"
      />

      {/* Text area */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste or type your action item proposal here..."
        disabled={disabled}
        rows={16}
        className="w-full bg-surface-800 border border-surface-700 rounded-lg px-4 py-3
          text-text-primary placeholder:text-text-secondary/50 font-mono text-sm leading-relaxed
          focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30
          disabled:opacity-50 transition-colors resize-y"
      />

      {/* Character counter bar */}
      <div className="mt-2 mb-6">
        <div className="flex justify-between text-xs text-text-secondary mb-1">
          <span className={isOverLimit ? "text-red-400 font-medium" : ""}>
            {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters
          </span>
          {isOverLimit && <span className="text-red-400">Over limit</span>}
        </div>
        <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${charPercent}%` }}
          />
        </div>
      </div>

      {/* Submit button */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || text.trim().length === 0 || isOverLimit}
        className="w-full bg-accent hover:bg-accent-light text-white font-semibold py-3 px-6
          rounded-xl transition-all duration-200
          disabled:opacity-40 disabled:cursor-not-allowed
          enabled:hover:shadow-lg enabled:hover:shadow-accent/20
          flex items-center justify-center gap-2"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v2m0 14v2m-7-9H3m18 0h-2M5.636 5.636l1.414 1.414m9.9 9.9l1.414 1.414M5.636 18.364l1.414-1.414m9.9-9.9l1.414-1.414"
          />
        </svg>
        {disabled ? "Grading in Progress..." : "Start Evaluation"}
      </button>
    </div>
  );
}
