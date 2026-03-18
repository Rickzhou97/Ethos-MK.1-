"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { useLayout } from "@/components/layout/layout-context"
import {
  Sparkles,
  X,
  Send,
  Loader2,
  MessageSquare,
  Trash2,
  Maximize2,
  Minimize2,
  PanelRight,
  MessageCircle,
} from "lucide-react"

type ViewMode = "float" | "sidebar" | "fullscreen"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

export function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>("float")
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { theme } = useLayout()
  const isCyber = theme === "cyberpunk"

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open, viewMode])

  // Escape key handling
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (viewMode === "fullscreen") setViewMode("float")
        else if (open) setOpen(false)
      }
    }
    window.addEventListener("keydown", handleEsc)
    return () => window.removeEventListener("keydown", handleEsc)
  }, [open, viewMode])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setLoading(true)

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "auto"
    }

    try {
      const chatHistory = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chatHistory }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to get response")
      }

      const aiMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, aiMsg])
    } catch {
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Sorry, I couldn't process that request. Please try again.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([])
  }

  // View mode button styles
  const modeBtn = (mode: ViewMode, active: boolean) =>
    cn(
      "rounded-md p-1.5 transition-colors",
      active
        ? isCyber
          ? "bg-[#FCE300]/20 text-[#FCE300]"
          : "bg-neutral-200 text-neutral-900"
        : isCyber
          ? "hover:bg-[#FCE300]/10 text-neutral-500"
          : "hover:bg-neutral-100 text-neutral-400"
    )

  // Panel position/size classes based on view mode
  const panelClasses = cn(
    "fixed z-[999] flex flex-col overflow-hidden shadow-2xl transition-all duration-300 ease-in-out",
    // Theme
    isCyber
      ? "bg-[#1A1A1E] border border-[#FCE300]/30"
      : "bg-white border border-neutral-200",
    // View mode specific
    viewMode === "float" && "bottom-6 right-6 w-[400px] h-[580px] rounded-2xl",
    viewMode === "sidebar" && "top-0 right-0 bottom-0 w-[420px] sm:w-[480px] rounded-l-2xl border-r-0",
    viewMode === "fullscreen" && "inset-0 sm:inset-6 md:inset-10 lg:inset-16 rounded-none sm:rounded-2xl",
    // Mobile: always full screen
    "max-sm:!inset-0 max-sm:!w-full max-sm:!h-full max-sm:!rounded-none",
    // Open/close
    open
      ? "opacity-100 translate-x-0 translate-y-0 scale-100"
      : viewMode === "sidebar"
        ? "opacity-0 translate-x-full pointer-events-none"
        : "opacity-0 scale-95 translate-y-4 pointer-events-none"
  )

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "fixed bottom-6 right-6 z-[999] flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95",
          isCyber
            ? "bg-[#FCE300] text-[#1A1A1E] hover:bg-[#e6cf00]"
            : "bg-neutral-900 text-white hover:bg-neutral-800",
          open && "!opacity-0 !pointer-events-none !scale-75"
        )}
      >
        <Sparkles className="h-5 w-5" />
      </button>

      {/* Backdrop for fullscreen and sidebar */}
      {open && (viewMode === "fullscreen" || viewMode === "sidebar") && (
        <div
          className={cn(
            "fixed inset-0 z-[998] transition-opacity duration-300",
            viewMode === "fullscreen" ? "bg-black/50 backdrop-blur-sm" : "bg-black/20"
          )}
          onClick={() => {
            if (viewMode === "fullscreen") setViewMode("float")
            else setOpen(false)
          }}
        />
      )}

      {/* Chat panel */}
      <div className={panelClasses}>
        {/* Header */}
        <div
          className={cn(
            "flex items-center justify-between px-4 py-3 border-b shrink-0",
            isCyber
              ? "border-[#FCE300]/20 bg-[#1A1A1E]"
              : "border-neutral-100 bg-neutral-50"
          )}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg",
                isCyber ? "bg-[#FCE300] text-[#1A1A1E]" : "bg-neutral-900 text-white"
              )}
            >
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3
                className={cn(
                  "text-sm font-semibold leading-none",
                  isCyber ? "text-[#FCE300]" : "text-neutral-900"
                )}
              >
                UPEE AI
              </h3>
              <p
                className={cn(
                  "text-[10px] mt-0.5",
                  isCyber ? "text-neutral-500" : "text-neutral-400"
                )}
              >
                {viewMode === "fullscreen"
                  ? "Full screen · Esc to close"
                  : viewMode === "sidebar"
                    ? "Side panel"
                    : "Ask me anything"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-0.5">
            {/* View mode switcher */}
            <div
              className={cn(
                "flex items-center gap-0.5 rounded-lg p-0.5 mr-1",
                isCyber ? "bg-[#2A2A2E]" : "bg-neutral-100"
              )}
            >
              <button
                onClick={() => setViewMode("float")}
                className={modeBtn("float", viewMode === "float")}
                title="Float window"
              >
                <MessageCircle className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode("sidebar")}
                className={cn(modeBtn("sidebar", viewMode === "sidebar"), "max-sm:hidden")}
                title="Side panel"
              >
                <PanelRight className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode("fullscreen")}
                className={cn(modeBtn("fullscreen", viewMode === "fullscreen"), "max-sm:hidden")}
                title="Full screen"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className={cn(
                  "rounded-lg p-1.5 transition-colors",
                  isCyber
                    ? "hover:bg-[#FCE300]/10 text-neutral-400"
                    : "hover:bg-neutral-100 text-neutral-400"
                )}
                title="Clear chat"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => { setOpen(false); setViewMode("float") }}
              className={cn(
                "rounded-lg p-1.5 transition-colors",
                isCyber
                  ? "hover:bg-[#FCE300]/10 text-neutral-400"
                  : "hover:bg-neutral-100 text-neutral-400"
              )}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div
          className={cn(
            "flex-1 overflow-y-auto px-4 py-3 space-y-3",
            viewMode === "fullscreen" && "px-6 md:px-16 lg:px-24 py-4"
          )}
        >
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div
                className={cn(
                  "flex items-center justify-center rounded-2xl mb-4",
                  viewMode === "fullscreen" ? "h-16 w-16" : "h-12 w-12",
                  isCyber
                    ? "bg-[#FCE300]/10 text-[#FCE300]"
                    : "bg-neutral-100 text-neutral-400"
                )}
              >
                <MessageSquare className={viewMode === "fullscreen" ? "h-8 w-8" : "h-6 w-6"} />
              </div>
              <p
                className={cn(
                  "font-medium",
                  viewMode === "fullscreen" ? "text-lg" : "text-sm",
                  isCyber ? "text-neutral-300" : "text-neutral-600"
                )}
              >
                How can I help you?
              </p>
              <p
                className={cn(
                  "mt-1",
                  viewMode === "fullscreen" ? "text-sm" : "text-xs",
                  isCyber ? "text-neutral-500" : "text-neutral-400"
                )}
              >
                I have access to your projects, design cards, production data, and more
              </p>

              {/* Quick suggestions */}
              <div
                className={cn(
                  "flex flex-wrap gap-2 mt-5 justify-center",
                  viewMode === "fullscreen" && "max-w-2xl gap-3"
                )}
              >
                {[
                  "How many active projects do we have?",
                  "Show designer workload",
                  "What are the production stages?",
                  "Which projects are high priority?",
                  ...(viewMode === "fullscreen"
                    ? [
                        "Plan design work for next week",
                        "Show open NCRs",
                      ]
                    : []),
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInput(suggestion)
                      inputRef.current?.focus()
                    }}
                    className={cn(
                      "rounded-full border transition-colors",
                      viewMode === "fullscreen"
                        ? "text-sm px-4 py-2"
                        : "text-xs px-3 py-1.5",
                      isCyber
                        ? "border-[#FCE300]/20 text-neutral-400 hover:bg-[#FCE300]/10 hover:text-[#FCE300]"
                        : "border-neutral-200 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700"
                    )}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start",
                viewMode === "fullscreen" && "max-w-4xl mx-auto w-full"
              )}
            >
              <div
                className={cn(
                  "rounded-2xl px-3.5 py-2.5 leading-relaxed",
                  viewMode === "fullscreen"
                    ? "max-w-[70%] text-[15px]"
                    : "max-w-[85%] text-sm",
                  msg.role === "user"
                    ? isCyber
                      ? "bg-[#FCE300] text-[#1A1A1E] rounded-br-md"
                      : "bg-neutral-900 text-white rounded-br-md"
                    : isCyber
                      ? "bg-[#2A2A2E] text-neutral-200 rounded-bl-md"
                      : "bg-neutral-100 text-neutral-800 rounded-bl-md"
                )}
              >
                <MessageContent content={msg.content} />
              </div>
            </div>
          ))}

          {loading && (
            <div
              className={cn(
                "flex justify-start",
                viewMode === "fullscreen" && "max-w-4xl mx-auto w-full"
              )}
            >
              <div
                className={cn(
                  "rounded-2xl rounded-bl-md px-4 py-3",
                  isCyber ? "bg-[#2A2A2E]" : "bg-neutral-100"
                )}
              >
                <div className="flex gap-1">
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className={cn(
                        "h-2 w-2 rounded-full animate-bounce",
                        isCyber ? "bg-[#FCE300]" : "bg-neutral-400"
                      )}
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div
          className={cn(
            "border-t px-3 py-3 shrink-0",
            isCyber ? "border-[#FCE300]/20" : "border-neutral-100",
            viewMode === "fullscreen" && "px-6 md:px-16 lg:px-24"
          )}
        >
          <div
            className={cn(
              "flex items-end gap-2 rounded-xl border px-3 py-2",
              viewMode === "fullscreen" && "max-w-4xl mx-auto",
              isCyber
                ? "border-[#FCE300]/20 bg-[#2A2A2E] focus-within:border-[#FCE300]/50"
                : "border-neutral-200 bg-neutral-50 focus-within:border-neutral-300"
            )}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about projects, design, production..."
              rows={1}
              className={cn(
                "flex-1 resize-none bg-transparent outline-none placeholder:text-neutral-400",
                viewMode === "fullscreen"
                  ? "text-[15px] max-h-[200px]"
                  : "text-sm max-h-[100px]",
                isCyber ? "text-neutral-200" : "text-neutral-800"
              )}
              style={{
                height: "auto",
                minHeight: "24px",
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = "auto"
                const maxH = viewMode === "fullscreen" ? 200 : 100
                target.style.height = Math.min(target.scrollHeight, maxH) + "px"
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className={cn(
                "flex shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-30",
                viewMode === "fullscreen" ? "h-8 w-8" : "h-7 w-7",
                isCyber
                  ? "bg-[#FCE300] text-[#1A1A1E] hover:bg-[#e6cf00]"
                  : "bg-neutral-900 text-white hover:bg-neutral-700"
              )}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          <p
            className={cn(
              "text-[10px] mt-1.5 text-center",
              isCyber ? "text-neutral-600" : "text-neutral-400"
            )}
          >
            Powered by Claude · Has access to project data · May not always be accurate
          </p>
        </div>
      </div>
    </>
  )
}

function MessageContent({ content }: { content: string }) {
  const parts = content.split(/(\*\*.*?\*\*|`.*?`|\n)/g)

  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          )
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={i}
              className="rounded bg-black/10 px-1 py-0.5 text-xs font-mono"
            >
              {part.slice(1, -1)}
            </code>
          )
        }
        if (part === "\n") {
          return <br key={i} />
        }
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}
