// Shared between the /api/chat route and the Pingu chat UI.

export interface ChartSpec {
  type: "bar" | "hbar";
  title: string;
  unit?: string;
  categories: string[];
  series: { name: string; values: number[] }[];
  note?: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatReply {
  reply: string;
  charts: ChartSpec[];
}
