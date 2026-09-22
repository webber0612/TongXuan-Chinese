export type WritingTraceEvent = {
  trace_result: "correct" | "incorrect";
  provider: "HANZI_WRITER";
};

/** Client adapter boundary for the Hanzi Writer trace/quiz event. */
export function hanziWriterTraceEvent(traceResult: WritingTraceEvent["trace_result"] = "correct"): WritingTraceEvent {
  return { trace_result: traceResult, provider: "HANZI_WRITER" };
}
