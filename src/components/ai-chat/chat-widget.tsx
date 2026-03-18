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
} from "lucide-react"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

export function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
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
      inputRef.current.focus()
    }
  }, [open])

  // Close expanded on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (expanded) setExpanded(false)
        else if (open) setOpen(false)
      }
    }
    window.addEventListener("keydown", handleEsc)
    return () => window.removeEventListener("keydown", handleEsc)
  }, [open, expanded])

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
          open && "rotate-90 opacity-0 pointer-events-none"
        )}
      >
        <Sparkles className="h-5 w-5" />
      </button>

      {/* Backdrop for expanded mode */}
      {open && expanded && (
        <div
          className="fixed inset-0 z-[998] bg-black/40 backdrop-blur-sm transition-opacity"
          onClick={() => setExpanded(false)}
        />
      )}

      {/* Chat panel */}
      <div
        className={cn(
          "fixed z-[999] flex flex-col overflow-hidden shadow-2xl transition-all duration-300",
          // Expanded vs compact sizing
          expanded
            ? "inset-4 sm:inset-8 md:inset-12 lg:left-[15%] lg:right-[15%] lg:top-8 lg:bottom-8 rounded-2xl"
            : "bottom-6 right-6 w-[380px] h-[560px] rounded-2xl",
          // Mobile always full screen
          "max-sm:bottom-0 max-sm:right-0 max-sm:left-0 max-sm:top-0 max-sm:w-full max-sm:h-full max-sm:rounded-none",
          // Theme
          isCyber
            ? "bg-[#1A1A1E] border border-[#FCE300]/30"
            : "bg-white border border-neutral-200",
          // Open/close animation
          open
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 translate-y-4 pointer-events-none"
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "flex items-center justify-between px-4 py-3 border-b shrink-0",
            isCyber
              ? "border-[#FCE300]/20 bg-[#1A1A1E]"
              : "border-neutral-100 bg-neutral-50"
          )}
        >
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg",
                isCyber ? "bg-[#FCE300] text-[#1A1A1E]" : "bg-neutral-900 text-white"
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
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
                  isCyber ? "text-neutral-400" : "text-neutral-500"
                )}
              >
                {expanded ? "Full view · Press Esc to minimize" : "Ask me anything"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
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
              onClick={() => setExpanded(!expanded)}
              className={cn(
                "rounded-lg p-1.5 transition-colors max-sm:hidden",
                isCyber
                  ? "hover:bg-[#FCE300]/10 text-neutral-400"
                  : "hover:bg-neutral-100 text-neutral-400"
              )}
              title={expanded ? "Minimize" : "Expand"}
            >
              {expanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={() => { setOpen(false); setExpanded(false) }}
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
        <div className={cn(
          "flex-1 overflow-y-auto px-4 py-3 space-y-3",
          expanded && "px-6 md:px-12 lg:px-20 py-4"
        )}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-2xl mb-3",
                  isCyber
                    ? "bg-[#FCE300]/10 text-[#FCE300]"
                    : "bg-neutral-100 text-neutral-400"
                )}
              >
                <MessageSquare className="h-6 w-6" />
              </div>
              <p
                className={cn(
                  "text-sm font-medium",
                  isCyber ? "text-neutral-300" : "text-neutral-600"
                )}
              >
                How can I help you?
              </p>
              <p
                className={cn(
                  "text-xs mt-1",
                  isCyber ? "text-neutral-500" : "text-neutral-400"
                )}
              >
                I have access to your project data — ask about projects, production, or anything else
              </p>

              {/* Quick suggestions */}
              <div className={cn(
                "flex flex-wrap gap-2 mt-4 justify-center",
                expanded && "max-w-xl"
              )}>
                {[
                  "How many active projects do we have?",
                  "What are the production stages?",
                  "Show me projects in production",
                  "Which projects are high priority?",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInput(suggestion)
                      inputRef.current?.focus()
                    }}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-full border transition-colors",
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
                expanded && "max-w-3xl mx-auto w-full"
              )}
            >
              <div
                className={cn(
                  "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                  expanded ? "max-w-[75%]" : "max-w-[85%]",
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
            <div className={cn(
              "flex justify-start",
              expanded && "max-w-3xl mx-auto w-full"
            )}>
              <div
                className={cn(
                  "rounded-2xl rounded-bl-md px-4 py-3",
                  isCyber ? "bg-[#2A2A2E]" : "bg-neutral-100"
                )}
              >
                <div className="flex gap-1">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full animate-bounce",
                      isCyber ? "bg-[#FCE300]" : "bg-neutral-400"
                    )}
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full animate-bounce",
                      isCyber ? "bg-[#FCE300]" : "bg-neutral-400"
                    )}
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full animate-bounce",
                      isCyber ? "bg-[#FCE300]" : "bg-neutral-400"
                    )}
                    style={{ animationDelay: "300ms" }}
                  />
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
            expanded && "px-6 md:px-12 lg:px-20"
          )}
        >
          <div
            className={cn(
              "flex items-end gap-2 rounded-xl border px-3 py-2",
              expanded && "max-w-3xl mx-auto",
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
              placeholder="Type a message..."
              rows={1}
              className={cn(
                "flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-neutral-400",
                expanded ? "max-h-[200px]" : "max-h-[100px]",
                isCyber ? "text-neutral-200" : "text-neutral-800"
              )}
              style={{
                height: "auto",
                minHeight: "24px",
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = "auto"
                const maxH = expanded ? 200 : 100
                target.style.height = Math.min(target.scrollHeight, maxH) + "px"
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-30",
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
  // Simple markdown-like rendering: bold, code, line breaks
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
