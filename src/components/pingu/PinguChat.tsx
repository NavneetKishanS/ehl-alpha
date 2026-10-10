"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { api } from "@/lib/api-client";
import type { ChartSpec, ChatTurn } from "@/lib/pingu/types";
import { PinguChart } from "./PinguChart";

// Floating assistant: a penguin button bottom-right that opens a chat panel.
// Pingu answers from the ingested src/data/*.json (see src/lib/pingu).
// Styling follows the light pages: white surfaces, square corners, bmw-blue accent.

interface Message extends ChatTurn {
  charts?: ChartSpec[];
  error?: boolean;
}

const EXAMPLES = [
  "Which 5 Series themes do customers dislike most?",
  "Chart sales volume by market for the 5 Series",
  "What do BEV owners complain about vs ICE owners?",
  "Compare customer satisfaction across the 1, 5 and 7 Series",
  "What do customers say about the head-up display?",
];

const WELCOME: Message = {
  role: "assistant",
  content:
    "Hi, I'm Pingu 🐧 I know the customer feedback, sales volumes and customer-study scores for the BMW 1, 5 and 7 Series. Ask me anything about the data, or ask for a chart.",
};

export function PinguChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next: Message[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      // Skip the welcome bubble and error bubbles; the model only needs the real turns.
      const history = next.filter((m) => m !== WELCOME && !m.error).map(({ role, content }) => ({ role, content }));
      const res = await api.chat(history);
      setMessages([...next, { role: "assistant", content: res.reply, charts: res.charts }]);
    } catch (err) {
      setMessages([...next, { role: "assistant", content: err instanceof Error ? err.message : "Something went wrong.", error: true }]);
    } finally {
      setBusy(false);
    }
  }

  const showExamples = messages.length === 1;

  return (
    <>
      {open && (
        <section
          aria-label="Pingu assistant"
          className="fixed inset-x-3 bottom-24 z-50 flex h-[min(640px,calc(100vh-11rem))] flex-col border border-neutral-300 bg-white text-neutral-900 shadow-2xl sm:inset-x-auto sm:right-6 sm:w-[420px]"
        >
          <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-bmw-blue text-base" aria-hidden>
                🐧
              </span>
              <div>
                <p className="text-sm font-semibold leading-tight">Pingu</p>
                <p className="text-[11px] leading-tight text-neutral-500">Ask the data · charts on demand</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="px-2 py-1 text-lg leading-none text-neutral-500 hover:text-neutral-900">
              ×
            </button>
          </header>

          <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto bg-neutral-50 px-4 py-4">
            {messages.map((m, i) => (
              <div key={i} className={clsx("flex flex-col gap-2", m.role === "user" ? "items-end" : "items-start")}>
                <div
                  className={clsx(
                    "max-w-[88%] whitespace-pre-wrap px-3 py-2 text-[13px] leading-relaxed",
                    m.role === "user" ? "bg-bmw-blue text-white" : m.error ? "border border-red-200 bg-red-50 text-red-800" : "border border-neutral-200 bg-white text-neutral-800",
                  )}
                >
                  {m.content}
                </div>
                {m.charts?.map((c, ci) => (
                  <div key={ci} className="w-full">
                    <PinguChart chart={c} />
                  </div>
                ))}
              </div>
            ))}
            {busy && (
              <div className="flex items-start">
                <div className="border border-neutral-200 bg-white px-3 py-2 text-[13px] text-neutral-500">Pingu is thinking…</div>
              </div>
            )}
            {showExamples && (
              <div className="pt-1">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-neutral-500">Try asking</p>
                <div className="flex flex-col gap-1.5">
                  {EXAMPLES.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="border border-neutral-300 bg-white px-3 py-2 text-left text-xs text-neutral-800 transition-colors hover:border-bmw-blue hover:text-bmw-blue"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2 border-t border-neutral-200 bg-white p-3"
          >
            <textarea
              ref={inputRef}
              value={input}
              rows={1}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ask about feedback, sales, satisfaction…"
              className="max-h-28 flex-1 resize-none border border-neutral-300 px-3 py-2 text-[13px] outline-none focus:border-bmw-blue"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="bg-bmw-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0653b6] disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              Send
            </button>
          </form>
        </section>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close Pingu chat" : "Chat with Pingu"}
        title="Chat with Pingu"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-bmw-blue text-2xl text-white shadow-xl transition-transform hover:scale-105 hover:bg-[#0653b6]"
      >
        {open ? <span className="text-xl leading-none">×</span> : <span aria-hidden>🐧</span>}
      </button>
    </>
  );
}
