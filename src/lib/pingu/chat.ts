// Pingu's LLM loop: system prompt + data context + chat history, with a small
// tool-calling loop. Talks to the OpenAI chat completions endpoint over plain
// fetch (no SDK dependency). Server-side only — the key never reaches the client.

import { buildContext } from "./context";
import { queryFeedback, searchVerbatims, TOOL_DEFINITIONS, validateChart } from "./tools";
import type { ChartSpec, ChatReply, ChatTurn } from "./types";

const MAX_TOOL_ROUNDS = 4;
const MAX_HISTORY = 12;
const TIMEOUT_MS = 60_000;

const SYSTEM_PROMPT = `You are Pingu, the penguin mascot and data assistant inside PM Kompass. You help product managers explore customer feedback, sales volumes and customer-study scores for the BMW 1, 5 and 7 Series.

Rules:
- Answer ONLY from the DATA below and from tool results. If the data does not cover the question, say so plainly and suggest what you can answer instead. Never invent numbers.
- Questions unrelated to this data: politely decline in one sentence and offer example questions.
- Use query_feedback for exact counts or filtered rankings (country, engine type, feedback type). Use search_verbatims to quote customers. The tables in DATA are pre-aggregated; prefer tools when a filter is involved.
- When asked for a graph/chart/plot (or when a comparison is clearly visual), call show_chart with numbers from the data, then add a one- or two-sentence takeaway. Do not describe the chart's every bar in text.
- Be concise and friendly: short paragraphs or bullets, real numbers, name the vehicle and market. Mention caveats (US study scores are derived; sample sizes; feedback is mostly US).
- The report is a customer-feedback tool, not an engineering spec: do not speculate about causes beyond what the verbatims say.

DATA
`;

interface ApiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

export class PinguConfigError extends Error {}

export async function runPingu(history: ChatTurn[]): Promise<ChatReply> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || apiKey === "your-key-here") {
    throw new PinguConfigError("OPENAI_API_KEY is not set. Add it to .env.local (see .env.example) and restart.");
  }
  const baseUrl = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4.1-mini";

  const messages: ApiMessage[] = [
    { role: "system", content: SYSTEM_PROMPT + buildContext() },
    ...history.slice(-MAX_HISTORY).map((t) => ({ role: t.role, content: t.content })),
  ];
  const charts: ChartSpec[] = [];

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages,
        tools: TOOL_DEFINITIONS,
        // After the last allowed round, force a plain-text answer.
        tool_choice: round === MAX_TOOL_ROUNDS ? "none" : "auto",
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      throw new Error(`OpenAI request failed (${res.status}): ${detail}`);
    }
    const json = await res.json();
    const msg = json.choices?.[0]?.message as ApiMessage | undefined;
    if (!msg) throw new Error("OpenAI returned no message.");

    if (!msg.tool_calls?.length) {
      return { reply: msg.content?.trim() || "Sorry, I came up empty. Try rephrasing?", charts };
    }

    messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls });
    for (const call of msg.tool_calls) {
      messages.push({ role: "tool", tool_call_id: call.id, content: execute(call.function.name, call.function.arguments, charts) });
    }
  }
  return { reply: "I got stuck on that one. Try a narrower question?", charts };
}

function execute(name: string, rawArgs: string, charts: ChartSpec[]): string {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(rawArgs || "{}");
  } catch {
    return JSON.stringify({ error: "invalid JSON arguments" });
  }
  switch (name) {
    case "query_feedback":
      return queryFeedback(args);
    case "search_verbatims":
      return searchVerbatims(args);
    case "show_chart": {
      const chart = validateChart(args);
      if (typeof chart === "string") return JSON.stringify({ error: chart });
      charts.push(chart);
      return JSON.stringify({ ok: true, shown: chart.title });
    }
    default:
      return JSON.stringify({ error: `unknown tool ${name}` });
  }
}
