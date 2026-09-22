export type QueueSource = "CURRICULUM" | "SCHOOL_QUEUE" | "REVIEW";

export function nextQueueItem<T extends { source: QueueSource; priority?: number }>(items: T[]): T | undefined {
  return [...items].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
}

export function scoreAnswers(items: Array<{ id: string; character: string }>, answers: Record<string, string>) {
  const correctness = Object.fromEntries(items.map((item) => [item.id, answers[item.id] === item.character]));
  return { correctness, score: Object.values(correctness).filter(Boolean).length, total: items.length };
}
