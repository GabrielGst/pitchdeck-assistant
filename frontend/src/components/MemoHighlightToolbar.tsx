"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, MessageSquare, Users } from "lucide-react";

interface HighlightAction {
  type: "chat-ai" | "comment" | "chat-analyst";
  selectedText: string;
}

interface MemoHighlightToolbarProps {
  containerRef: React.RefObject<HTMLElement | null>;
  onAction: (action: HighlightAction) => void;
}

interface ToolbarPos {
  x: number;
  y: number;
  text: string;
}

export function MemoHighlightToolbar({
  containerRef,
  onAction,
}: MemoHighlightToolbarProps) {
  const [toolbar, setToolbar] = useState<ToolbarPos | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMouseUp(e: MouseEvent) {
      // Ignore clicks inside the toolbar itself
      if (toolbarRef.current?.contains(e.target as Node)) return;

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) {
        setToolbar(null);
        return;
      }

      const text = selection.toString().trim();
      if (text.length < 5) {
        setToolbar(null);
        return;
      }

      // Only show when the selection is inside our container
      const range = selection.getRangeAt(0);
      if (
        containerRef.current &&
        !containerRef.current.contains(range.commonAncestorContainer)
      ) {
        setToolbar(null);
        return;
      }

      const rect = range.getBoundingClientRect();
      setToolbar({
        x: rect.left + rect.width / 2,
        y: rect.top - 8, // just above the selection
        text,
      });
    }

    function handleMouseDown(e: MouseEvent) {
      if (!toolbarRef.current?.contains(e.target as Node)) {
        setToolbar(null);
      }
    }

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [containerRef]);

  function trigger(type: HighlightAction["type"]) {
    if (!toolbar) return;
    onAction({ type, selectedText: toolbar.text });
    window.getSelection()?.removeAllRanges();
    setToolbar(null);
  }

  if (!toolbar) return null;

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 -translate-x-1/2 -translate-y-full pointer-events-auto"
      style={{ left: toolbar.x, top: toolbar.y }}
    >
      <div className="flex items-center gap-0.5 rounded-lg border bg-popover px-1 py-1 shadow-lg shadow-black/10">
        <ToolbarBtn
          icon={<Bot className="size-3.5" />}
          label="Chat with AI"
          onClick={() => trigger("chat-ai")}
          className="text-primary"
        />
        <div className="w-px h-4 bg-border mx-0.5" />
        <ToolbarBtn
          icon={<MessageSquare className="size-3.5" />}
          label="Make a comment"
          onClick={() => trigger("comment")}
        />
        <div className="w-px h-4 bg-border mx-0.5" />
        <ToolbarBtn
          icon={<Users className="size-3.5" />}
          label="Chat with analyst"
          onClick={() => trigger("chat-analyst")}
        />
      </div>
      {/* Caret pointing down */}
      <div className="mx-auto mt-px w-fit">
        <div className="size-2 rotate-45 border-b border-r bg-popover border-border translate-y-[-5px] mx-auto" />
      </div>
    </div>
  );
}

function ToolbarBtn({
  icon,
  label,
  onClick,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onMouseDown={(e) => e.preventDefault()} // prevent selection loss
      onClick={onClick}
      title={label}
      className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors ${className}`}
    >
      {icon}
      {label}
    </button>
  );
}
