import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import HanziWriter from "hanzi-writer";
import { ArrowLeft, CheckCircle2, Headphones, Mic, Pause, Play, Sparkles, Volume2 } from "lucide-react";
import { useLocale, currentLearningLocale } from "../lib/i18n";
import { BrowserSpeechSynthesisProvider } from "../lib/tts";
import { BrowserMediaRecorderAdapter } from "../lib/readingAloud";

const API = import.meta.env.VITE_API_BASE ?? "";
type LearningTask = {
  id: string; key: string; taskType: string; state: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "DEFERRED";
  required: boolean; estimatedMinutes: number; failureCount: number; attemptCount: number; itemId: string | null; sourceQueue: string; taskData: Record<string, any>;
};
type LearningSession = {
  id: string; status: "IN_PROGRESS" | "PAUSED" | "COMPLETED"; targetMinutes: number; activeSeconds: number;
  tasks: LearningTask[]; curriculumContext: { official: { title: string; objectiveSummary: string }; stageTitle: string };
  terminationReason?: string | null; reward: { points: number; earned: boolean }; masteryStatus?: string | null;
};
type SessionPlan = { targetMinutes: number; curriculumContext: LearningSession["curriculumContext"]; tasks: LearningTask[]; composition: Record<string, number> };

const copy = {
  "zh-Hant": { back: "回到首頁", title: "今天的中文學習", intro: "先複習到期內容，再完成今天的一小段課程。", loading: "正在準備今日學習…", start: "開始今日學習", resume: "繼續今日學習", pause: "先休息", listening: "聽一聽", recognition: "聽完後選一個字", vocabulary: "選出這句話的用途", phonetics: "選出正確的注音與拼音", speaking: "請跟著課文讀一次", reflection: "今天的練習感覺如何？", practiced: "我練習過了", more: "下次再練一次", submit: "送出答案", record: "開始跟讀錄音", stopRecord: "完成跟讀", skip: "略過這個選修書寫練習", finish: "完成今日練習", sessionDone: "今天的練習完成", practicedDone: "這一課已練習，精熟度會依有效證據另行判定。", mastered: "這一課已達到目前設定的精熟條件。", points: "今日獲得星星", due: "到期複習", current: "本課任務", task: "任務", of: "／", error: "暫時無法載入學習流程。請確認網路後重試。", retry: "重試", audioLocal: "錄音只在此裝置短暫處理，完成後立即刪除；不會上傳或評分。", optional: "選修", pauseNotice: "學習已暫停，可以休息後再繼續。", complete: "完成", wrong: "再試一次，慢慢聽、慢慢選。", writingHint: "跟著筆順完成這個字；此練習不會替其他課程加分。", showStroke: "播放筆順提示", notReady: "請先選擇一位學習者。" },
  "zh-Hans": { back: "返回首页", title: "今天的中文学习", intro: "先复习到期内容，再完成今天的一小段课程。", loading: "正在准备今日学习…", start: "开始今日学习", resume: "继续今日学习", pause: "先休息", listening: "听一听", recognition: "听完后选一个字", vocabulary: "选出这句话的用途", phonetics: "选出正确的注音与拼音", speaking: "请跟着课文读一次", reflection: "今天的练习感觉如何？", practiced: "我练习过了", more: "下次再练一次", submit: "提交答案", record: "开始跟读录音", stopRecord: "完成跟读", skip: "跳过这个选修书写练习", finish: "完成今日练习", sessionDone: "今天的练习完成", practicedDone: "这一课已练习，熟练度会依有效证据另行判定。", mastered: "这一课已达到目前设定的熟练条件。", points: "今日获得星星", due: "到期复习", current: "本课任务", task: "任务", of: "／", error: "暂时无法载入学习流程。请确认网络后重试。", retry: "重试", audioLocal: "录音只在此设备短暂处理，完成后立即删除；不会上传或评分。", optional: "选修", pauseNotice: "学习已暂停，可以休息后再继续。", complete: "完成", wrong: "再试一次，慢慢听、慢慢选。", writingHint: "跟着笔顺完成这个字；此练习不会替其他课程加分。", showStroke: "播放笔顺提示", notReady: "请先选择一位学习者。" },
  en: { back: "Back to home", title: "Today's Chinese lesson", intro: "Review what is due, then take one small step in today's lesson.", loading: "Preparing today's lesson…", start: "Start today's lesson", resume: "Continue today's lesson", pause: "Take a break", listening: "Listen", recognition: "Choose the character you heard", vocabulary: "Choose what this phrase is used for", phonetics: "Match the Zhuyin and Pinyin", speaking: "Read the lesson aloud once", reflection: "How did today's practice feel?", practiced: "I practiced today", more: "I will practice more next time", submit: "Submit answers", record: "Start reading aloud", stopRecord: "Finish reading", skip: "Skip this optional writing practice", finish: "Finish today's practice", sessionDone: "Today's practice is complete", practicedDone: "Lesson practiced. Mastery is assessed separately from valid evidence.", mastered: "This lesson meets the current mastery criteria.", points: "Stars earned today", due: "Due review", current: "Lesson tasks", task: "Task", of: "of", error: "The learning session could not load. Check your connection and try again.", retry: "Retry", audioLocal: "Audio is processed briefly on this device, then deleted. It is never uploaded or scored.", optional: "Optional", pauseNotice: "The session is paused. Take a break and continue when ready.", complete: "Complete", wrong: "Try once more. Listen carefully and take your time.", writingHint: "Follow the stroke order. This optional practice does not add a score to another lesson.", showStroke: "Show stroke order", notReady: "Choose a learner first." },
  ja: { back: "ホームへ戻る", title: "今日の中国語レッスン", intro: "復習してから、今日のレッスンを少し進めましょう。", loading: "準備中…", start: "今日の学習を始める", resume: "学習を続ける", pause: "休憩する", listening: "聞く", recognition: "聞こえた漢字を選ぶ", vocabulary: "使い方を選ぶ", phonetics: "注音とピンインを合わせる", speaking: "声に出して読む", reflection: "今日の練習はどうでしたか？", practiced: "練習しました", more: "また練習します", submit: "回答する", record: "録音を始める", stopRecord: "読み終える", skip: "任意の書く練習をスキップ", finish: "今日の練習を完了", sessionDone: "今日の練習が完了しました", practicedDone: "練習を記録しました。習熟度は別途判定されます。", mastered: "現在の習熟条件を満たしました。", points: "獲得スター", due: "復習", current: "レッスン課題", task: "課題", of: "/", error: "読み込めません。接続を確認して再試行してください。", retry: "再試行", audioLocal: "録音は端末内だけで処理し、完了後に削除します。送信・採点はしません。", optional: "任意", pauseNotice: "一時停止中です。休憩後に続けられます。", complete: "完了", wrong: "もう一度、ゆっくり選んでみましょう。", writingHint: "筆順に沿って書きましょう。この練習は別の課題の得点になりません。", showStroke: "筆順を見る", notReady: "学習者を選んでください。" },
  ko: { back: "홈으로", title: "오늘의 중국어 학습", intro: "복습할 내용을 먼저 보고 오늘의 짧은 수업을 진행해요.", loading: "오늘 학습을 준비하는 중…", start: "오늘 학습 시작", resume: "학습 계속하기", pause: "잠시 쉬기", listening: "듣기", recognition: "들은 글자를 고르세요", vocabulary: "이 표현의 용도를 고르세요", phonetics: "주음과 병음을 연결하세요", speaking: "소리 내어 읽으세요", reflection: "오늘 연습은 어땠나요?", practiced: "오늘 연습했어요", more: "다음에 더 연습할래요", submit: "답변 제출", record: "읽기 녹음 시작", stopRecord: "읽기 완료", skip: "선택 쓰기 연습 건너뛰기", finish: "오늘 연습 완료", sessionDone: "오늘 연습을 마쳤어요", practicedDone: "연습을 기록했어요. 숙달도는 별도 증거로 평가해요.", mastered: "현재 숙달 기준을 충족했어요.", points: "오늘 받은 별", due: "복습", current: "수업 과제", task: "과제", of: "/", error: "학습을 불러오지 못했어요. 연결을 확인하고 다시 시도하세요.", retry: "다시 시도", audioLocal: "녹음은 기기에서 잠시 처리한 뒤 삭제해요. 업로드하거나 점수화하지 않아요.", optional: "선택", pauseNotice: "학습이 멈췄어요. 쉬고 다시 이어갈 수 있어요.", complete: "완료", wrong: "천천히 다시 들어보고 골라 보세요.", writingHint: "획순을 따라 써 보세요. 다른 수업의 점수에는 반영되지 않아요.", showStroke: "획순 보기", notReady: "먼저 학습자를 선택하세요." },
  es: { back: "Volver al inicio", title: "Lección de chino de hoy", intro: "Repasa lo pendiente y luego avanza un poco en la lección de hoy.", loading: "Preparando la lección…", start: "Empezar la lección de hoy", resume: "Continuar la lección", pause: "Tomar un descanso", listening: "Escuchar", recognition: "Elige el carácter que oíste", vocabulary: "Elige el uso de esta frase", phonetics: "Relaciona Zhuyin y Pinyin", speaking: "Lee la lección en voz alta", reflection: "¿Cómo te fue hoy?", practiced: "Practiqué hoy", more: "Practicaré más después", submit: "Enviar respuestas", record: "Empezar a grabar", stopRecord: "Terminar lectura", skip: "Omitir escritura opcional", finish: "Terminar la práctica de hoy", sessionDone: "Práctica de hoy completada", practicedDone: "Práctica registrada. El dominio se evalúa por separado.", mastered: "La lección cumple los criterios actuales de dominio.", points: "Estrellas obtenidas", due: "Repaso pendiente", current: "Tareas de la lección", task: "Tarea", of: "de", error: "No se pudo cargar la sesión. Comprueba la conexión y reintenta.", retry: "Reintentar", audioLocal: "El audio se procesa brevemente en este dispositivo y se elimina. No se sube ni se califica.", optional: "Opcional", pauseNotice: "La sesión está en pausa. Descansa y continúa cuando quieras.", complete: "Completar", wrong: "Prueba otra vez, escucha con calma y elige.", writingHint: "Sigue el orden de los trazos. Esta práctica no suma puntos a otra lección.", showStroke: "Ver orden de trazos", notReady: "Primero elige un estudiante." },
} as const;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json" }, ...init });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).detail ?? "learning_session_request_failed");
  return response.json() as Promise<T>;
}

function taskPath(childId: number, sessionId: string, taskId: string, action: string) {
  return `/api/children/${childId}/learning-sessions/${sessionId}/tasks/${encodeURIComponent(taskId)}/${action}`;
}

export function LearningSessionPage({ activeChildId, onBack }: { activeChildId: number | null; onBack: () => void }) {
  const { language } = useLocale();
  const text = copy[language];
  const locale = currentLearningLocale();
  const scriptMode = locale === "zh-CN" ? "SIMPLIFIED" : "TRADITIONAL";
  const speech = useMemo(() => new BrowserSpeechSynthesisProvider(), []);
  const recorder = useMemo(() => new BrowserMediaRecorderAdapter(), []);
  const readingAttemptId = useRef<string | null>(null);
  const readingStartedAt = useRef<number | null>(null);
  const flowTaskRef = useRef<{ sessionId: string; taskId: string } | null>(null);
  const [session, setSession] = useState<LearningSession | null>(null);
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!activeChildId) { setSession(null); setPlan(null); setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const current = await api<LearningSession | null>(`/api/children/${activeChildId}/learning-sessions/current`);
      if (current) { setSession(current); setPlan(null); }
      else {
        setSession(null);
        setPlan(await api<SessionPlan>(`/api/children/${activeChildId}/learning-sessions/plan`, { method: "POST", body: JSON.stringify({ target_minutes: 18, script_mode: scriptMode }) }));
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : text.error); }
    finally { setLoading(false); }
  }, [activeChildId, scriptMode, text.error]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => () => {
    speech.cancel();
    recorder.delete();
    const childId = activeChildId;
    const attemptId = readingAttemptId.current;
    const activeTask = flowTaskRef.current;
    if (childId && attemptId && activeTask) {
      void api(`/api/reading-aloud/attempts/${attemptId}/abort?child_id=${childId}`, { method: "POST", body: "{}" }).then(() =>
        api(taskPath(childId, activeTask.sessionId, activeTask.taskId, "abort"), { method: "POST", body: JSON.stringify({ evidence_ref: attemptId }) })).catch(() => undefined);
    }
  }, [activeChildId, recorder, speech]);

  const startOrResume = async () => {
    if (!activeChildId) return;
    setBusy(true); setError("");
    try {
      setSession(await api<LearningSession>(`/api/children/${activeChildId}/learning-sessions`, { method: "POST", body: JSON.stringify({ target_minutes: 18, script_mode: scriptMode }) }));
      setPlan(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : text.error); }
    finally { setBusy(false); }
  };

  const activeTask = session?.tasks.find((task) => task.state === "IN_PROGRESS" || task.state === "PENDING") ?? null;
  const completeTask = async (task: LearningTask, attemptId: string) => {
    if (!activeChildId || !session) return;
    const updated = await api<LearningSession>(taskPath(activeChildId, session.id, task.id, "evidence"), { method: "POST", body: JSON.stringify({ evidence_ref: attemptId }) });
    setSession(updated); setFeedback("");
  };
  const beginTask = async (task: LearningTask) => {
    if (!activeChildId || !session || task.state === "IN_PROGRESS") return;
    setSession(await api<LearningSession>(taskPath(activeChildId, session.id, task.id, "start"), { method: "POST", body: "{}" }));
  };
  const submitOption = async (task: LearningTask, optionId: string) => {
    if (!activeChildId || !session) return;
    setBusy(true); setError(""); setFeedback("");
    try {
      await beginTask(task);
      const updated = await api<LearningSession>(taskPath(activeChildId, session.id, task.id, "answer"), { method: "POST", body: JSON.stringify({ selected_option_id: optionId }) });
      setSession(updated);
      setFeedback(updated.status === "PAUSED" ? text.pauseNotice : task.taskData.mode === "reflection" || updated.tasks.find((item) => item.id === task.id)?.state === "COMPLETED" ? "" : text.wrong);
    } catch (cause) { setError(cause instanceof Error ? cause.message : text.error); }
    finally { setBusy(false); }
  };

  const playReference = async (value: string, onDone?: () => void) => {
    try {
      const payload = await api<any>("/api/tts/speak", { method: "POST", body: JSON.stringify({ text: value, text_kind: "character", locale, rate: 0.85 }) });
      speech.speak(payload, { onEnd: onDone, onError: () => { if (onDone) setError(text.error); } });
    } catch (cause) { setError(cause instanceof Error ? cause.message : text.error); }
  };

  const startListening = async (task: LearningTask) => {
    if (!activeChildId || !session) return;
    setBusy(true); setError("");
    try {
      await beginTask(task);
      const started = await api<{ id: string }>(`/api/children/${activeChildId}/listening-attempts`, { method: "POST", body: JSON.stringify({ item_id: task.itemId }) });
      const payload = await api<any>("/api/tts/speak", { method: "POST", body: JSON.stringify({ text: task.taskData.text, text_kind: "character", locale, rate: 0.9, child_id: activeChildId, source_type: "CURRICULUM", source_id: task.itemId }) });
      const startedAt = Date.now();
      try {
        speech.speak(payload, {
          onEnd: () => { void api(`/api/children/${activeChildId}/listening-attempts/${started.id}/complete`, { method: "POST", body: JSON.stringify({ duration_ms: Date.now() - startedAt }) }).then(() => completeTask(task, started.id)).catch((cause) => setError(cause instanceof Error ? cause.message : text.error)).finally(() => setBusy(false)); },
          onError: () => { void api(`/api/children/${activeChildId}/listening-attempts/${started.id}/abort`, { method: "POST", body: "{}" }).catch(() => undefined).finally(() => { setError(text.error); setBusy(false); }); },
        });
      } catch (cause) {
        await api(`/api/children/${activeChildId}/listening-attempts/${started.id}/abort`, { method: "POST", body: "{}" }).catch(() => undefined);
        setError(cause instanceof Error ? cause.message : text.error); setBusy(false);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : text.error); setBusy(false); }
  };

  const startReading = async (task: LearningTask) => {
    if (!activeChildId || !session) return;
    setBusy(true); setError("");
    const domain = task.taskType === "PRONUNCIATION_ATTEMPT" ? "pronunciation" : "speaking";
    try {
      await beginTask(task);
      const attempt = await api<{ id: string }>(`/api/reading-aloud/attempts/start?child_id=${activeChildId}`, { method: "POST", body: JSON.stringify({ text: task.taskData.text, text_kind: "character", locale, source_type: "CURRICULUM", source_id: task.itemId, activity_domain: domain }) });
      try { await recorder.start(); } catch (cause) {
        await api(`/api/reading-aloud/attempts/${attempt.id}/abort?child_id=${activeChildId}`, { method: "POST", body: "{}" });
        await api<LearningSession>(taskPath(activeChildId, session.id, task.id, "abort"), { method: "POST", body: JSON.stringify({ evidence_ref: attempt.id }) }).then(setSession);
        throw cause;
      }
      readingAttemptId.current = attempt.id;
      readingStartedAt.current = Date.now();
      flowTaskRef.current = { sessionId: session.id, taskId: task.id };
      setRecording(true); setFeedback("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : text.error); }
    finally { setBusy(false); }
  };

  const finishReading = async (task: LearningTask) => {
    if (!activeChildId || !session || !readingAttemptId.current) return;
    setBusy(true); setError("");
    try {
      const localAudio = await recorder.stop();
      void localAudio.size;
      const attemptId = readingAttemptId.current;
      await api(`/api/reading-aloud/attempts/${attemptId}/complete?child_id=${activeChildId}`, { method: "POST", body: JSON.stringify({ duration_ms: readingStartedAt.current ? Date.now() - readingStartedAt.current : null }) });
      recorder.delete();
      readingAttemptId.current = null; readingStartedAt.current = null; flowTaskRef.current = null; setRecording(false);
      await completeTask(task, attemptId);
    } catch (cause) {
      const attemptId = readingAttemptId.current;
      const flowTask = flowTaskRef.current;
      if (attemptId) {
        await api(`/api/reading-aloud/attempts/${attemptId}/abort?child_id=${activeChildId}`, { method: "POST", body: "{}" }).catch(() => undefined);
        if (flowTask) await api(taskPath(activeChildId, flowTask.sessionId, flowTask.taskId, "abort"), { method: "POST", body: JSON.stringify({ evidence_ref: attemptId }) }).catch(() => undefined);
      }
      recorder.delete(); readingAttemptId.current = null; flowTaskRef.current = null; setRecording(false); setError(cause instanceof Error ? cause.message : text.error);
    }
    finally { setBusy(false); }
  };

  const recordWriting = async (task: LearningTask, traceResult: "correct" | "incorrect", phase: string, mode: string) => {
    if (!activeChildId || !session) return;
    const saved = await api<{ attempt_id: string }>(`/api/sprint-b/writing/attempts?child_id=${activeChildId}&character=${encodeURIComponent(task.taskData.character)}`, { method: "POST", body: JSON.stringify({ trace_result: traceResult, assisted: phase !== "independent", phase, script_mode: mode, provider: "HANZI_WRITER" }) });
    const updated = await api<LearningSession>(taskPath(activeChildId, session.id, task.id, "evidence"), { method: "POST", body: JSON.stringify({ evidence_ref: saved.attempt_id }) });
    if (traceResult === "correct") setSession(updated);
  };

  const skipOptionalWriting = async (task: LearningTask) => {
    if (!activeChildId || !session) return;
    setBusy(true);
    try { setSession(await api<LearningSession>(taskPath(activeChildId, session.id, task.id, "skip"), { method: "POST", body: "{}" })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : text.error); }
    finally { setBusy(false); }
  };

  const finishSession = async () => {
    if (!activeChildId || !session) return;
    setBusy(true); setError("");
    try { setSession(await api<LearningSession>(`/api/children/${activeChildId}/learning-sessions/${session.id}/complete`, { method: "POST", body: "{}" })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : text.error); }
    finally { setBusy(false); }
  };

  const leaveSession = async () => {
    if (activeChildId && recording && readingAttemptId.current && session && activeTask) {
      const attemptId = readingAttemptId.current;
      try {
        await api(`/api/reading-aloud/attempts/${attemptId}/abort?child_id=${activeChildId}`, { method: "POST", body: "{}" });
        await api(taskPath(activeChildId, session.id, activeTask.id, "abort"), { method: "POST", body: JSON.stringify({ evidence_ref: attemptId }) });
      } catch { /* a later session refresh will show the persisted state */ }
      recorder.delete(); readingAttemptId.current = null; flowTaskRef.current = null; setRecording(false);
    }
    if (activeChildId && session?.status === "IN_PROGRESS") {
      try { setSession(await api<LearningSession>(`/api/children/${activeChildId}/learning-sessions/${session.id}/stop`, { method: "POST", body: JSON.stringify({ reason: "USER_EXIT" }) })); } catch { /* navigation remains available */ }
    }
    onBack();
  };

  const visibleTasks = session?.tasks ?? plan?.tasks ?? [];
  const currentIndex = session && activeTask ? session.tasks.indexOf(activeTask) + 1 : 0;
  if (loading) return <main className="app-page learning-session-page"><p role="status">{text.loading}</p></main>;

  return <main className="app-page learning-session-page">
    <header className="learning-session-header">
      <button className="learning-back" type="button" onClick={() => void leaveSession()}><ArrowLeft size={18}/>{text.back}</button>
      <p className="eyebrow">{session?.curriculumContext.stageTitle ?? plan?.curriculumContext.stageTitle ?? "TongXuan"}</p>
      <h1>{text.title}</h1>
      <p className="lead">{text.intro}</p>
    </header>
    {error && <div className="learning-session-error" role="alert">{error}<button type="button" onClick={() => void refresh()}>{text.retry}</button></div>}
    {!activeChildId && <p className="learning-session-notice" role="status">{text.notReady}</p>}
    {plan && activeChildId && <section className="learning-session-card learning-session-start-card" aria-labelledby="learning-session-lesson-title">
      <div className="learning-session-mark"><Sparkles aria-hidden="true"/></div>
      <p className="eyebrow">{text.current}</p><h2 id="learning-session-lesson-title">{plan.curriculumContext.official.title}</h2>
      <p>{plan.curriculumContext.official.objectiveSummary}</p>
      <p className="learning-session-time"><Pause size={16}/>{plan.targetMinutes} min</p>
      <button className="button button-primary button-large" type="button" onClick={() => void startOrResume()} disabled={busy}>{busy ? text.loading : text.start}</button>
    </section>}
    {session?.status === "PAUSED" && <section className="learning-session-notice" role="status"><p>{text.pauseNotice}</p><button className="button button-primary" type="button" onClick={() => void startOrResume()} disabled={busy}>{text.resume}</button></section>}
    {session?.status === "IN_PROGRESS" && activeTask && <>
      <div className="learning-session-progress" aria-label={`${text.task} ${currentIndex} ${text.of} ${visibleTasks.length}`}><span>{text.task} {currentIndex} {text.of} {visibleTasks.length}</span><span>{session.targetMinutes} min</span></div>
      <section className="learning-session-card learning-task-card" aria-live="polite">
        {activeTask.sourceQueue === "REVIEW" && <span className="learning-task-source">{text.due}</span>}
        {!activeTask.required && <span className="learning-task-source">{text.optional}</span>}
        {activeTask.taskType === "LISTENING" && <>
          <Headphones className="learning-task-icon" aria-hidden="true"/><h2>{text.listening}</h2><p className="learning-task-prompt">{activeTask.taskData.text}</p>
          <button className="button button-primary" type="button" onClick={() => void startListening(activeTask)} disabled={busy}><Play size={18}/>{text.listening}</button>
        </>}
        {["RECOGNITION", "REVIEW_RECOGNITION", "VOCABULARY", "SENTENCE_PATTERN", "MINI_CHECK"].includes(activeTask.taskType) && <>
          <Sparkles className="learning-task-icon" aria-hidden="true"/><h2>{activeTask.taskData.mode === "reflection" ? text.reflection : activeTask.taskType === "VOCABULARY" || activeTask.taskType === "SENTENCE_PATTERN" ? text.vocabulary : text.recognition}</h2>
          {activeTask.taskData.prompt && <p className="learning-task-prompt">{activeTask.taskData.prompt}</p>}
          {activeTask.taskData.audioText && <button className="learning-audio-button" type="button" onClick={() => void playReference(activeTask.taskData.audioText)}><Volume2 size={18}/>{text.listening}: {activeTask.taskData.audioText}</button>}
          <div className="learning-choice-list">{activeTask.taskData.choices?.map((choice: any) => <button type="button" className="learning-choice" key={choice.id} onClick={() => void submitOption(activeTask, choice.id)} disabled={busy}>{choice.label}</button>)}</div>
        </>}
        {activeTask.taskType === "PHONETICS" && <>
          <Headphones className="learning-task-icon" aria-hidden="true"/><h2>{text.phonetics}</h2><p className="learning-task-prompt">{activeTask.taskData.prompt}</p>
          <div className="learning-phonetics-list">{activeTask.taskData.questions?.map((question: any) => <fieldset key={question.id}><legend>{question.character} · {question.script === "TRADITIONAL" ? "注音" : "Pinyin"}</legend>{question.choices.map((choice: any) => <label key={choice.id}><input type="radio" name={question.id} value={choice.id} checked={answers[question.id] === choice.id} onChange={() => setAnswers((prior) => ({ ...prior, [question.id]: choice.id }))}/>{choice.label}</label>)}</fieldset>)}</div>
          <button className="button button-primary" type="button" onClick={async () => { if (!activeChildId || !session) return; setBusy(true); try { await beginTask(activeTask); setSession(await api<LearningSession>(taskPath(activeChildId, session.id, activeTask.id, "answer"), { method: "POST", body: JSON.stringify({ answers }) })); setAnswers({}); } catch (cause) { setError(cause instanceof Error ? cause.message : text.error); } finally { setBusy(false); } }} disabled={busy || Object.keys(answers).length !== activeTask.taskData.questions?.length}>{text.submit}</button>
        </>}
        {["SPEAKING_ATTEMPT", "PRONUNCIATION_ATTEMPT"].includes(activeTask.taskType) && <>
          <Mic className="learning-task-icon" aria-hidden="true"/><h2>{text.speaking}</h2><p className="learning-task-prompt">{activeTask.taskData.text}</p>
          {!recording ? <button className="button button-primary" type="button" onClick={() => void startReading(activeTask)} disabled={busy}><Mic size={18}/>{text.record}</button> : <button className="button button-primary" type="button" onClick={() => void finishReading(activeTask)} disabled={busy}>{text.stopRecord}</button>}
          <small>{text.audioLocal}</small>
        </>}
        {activeTask.taskType.startsWith("WRITING_") && <>
          <h2>{activeTask.taskData.character}</h2><p className="learning-task-prompt">{text.writingHint}</p>
          <WritingPractice key={`${activeTask.id}:${activeTask.attemptCount}`} task={activeTask} label={text.showStroke} onTrace={(result) => recordWriting(activeTask, result, activeTask.taskData.phase, activeTask.taskData.scriptMode).catch((cause) => setError(cause instanceof Error ? cause.message : text.error))}/>
          <button className="button button-secondary" type="button" onClick={() => void skipOptionalWriting(activeTask)} disabled={busy}>{text.skip}</button>
        </>}
        {activeTask.taskType === "LESSON_WRAP_UP" && <>
          <CheckCircle2 className="learning-task-icon" aria-hidden="true"/><h2>{text.finish}</h2><p>{activeTask.taskData.masteryNotice}</p><button className="button button-primary button-large" type="button" onClick={() => void finishSession()} disabled={busy}>{busy ? text.loading : text.complete}</button>
        </>}
        {feedback && <p className="learning-session-feedback" role="status">{feedback}</p>}
      </section>
      <button className="learning-session-stop" type="button" onClick={() => void leaveSession()} disabled={busy}>{text.pause}</button>
    </>}
    {session?.status === "IN_PROGRESS" && !activeTask && <section className="learning-session-card"><h2>{text.finish}</h2><button className="button button-primary" onClick={() => void finishSession()} disabled={busy}>{text.complete}</button></section>}
    {session?.status === "COMPLETED" && <section className="learning-session-card learning-session-done" role="status"><CheckCircle2 className="learning-task-icon"/><h2>{text.sessionDone}</h2><p>{session.masteryStatus === "MASTERED" ? text.mastered : text.practicedDone}</p><p className="learning-session-time">{text.points}: ⭐ {session.reward.points}</p><button className="button button-primary" type="button" onClick={onBack}>{text.back}</button></section>}
  </main>;
}

function WritingPractice({ task, label, onTrace }: { task: LearningTask; label: string; onTrace: (result: "correct" | "incorrect") => void }) {
  const host = useRef<HTMLDivElement | null>(null);
  const writer = useRef<HanziWriter | null>(null);
  const sentMistake = useRef(false);
  const phase = task.taskData.phase as string;
  useEffect(() => {
    if (!host.current) return;
    let mounted = true;
    const instance = HanziWriter.create(host.current, task.taskData.character, { width: 240, height: 240, padding: 18, showOutline: phase !== "independent", showCharacter: phase !== "independent", strokeAnimationSpeed: 1.2 });
    writer.current = instance;
    instance.quiz({ showHintAfterMisses: phase === "guided" ? 1 : 3, leniency: 0.65, highlightOnComplete: false, onMistake: () => { if (!sentMistake.current && mounted) { sentMistake.current = true; onTrace("incorrect"); } }, onComplete: () => { if (mounted) onTrace("correct"); } });
    return () => { mounted = false; instance.cancelQuiz(); writer.current = null; };
  }, [task.taskData.character, phase, onTrace]);
  return <div className="learning-writing-practice"><div ref={host} className="learning-writing-canvas" aria-label={`Hanzi Writer ${task.taskData.character}`}/><button className="button button-secondary" type="button" onClick={() => writer.current?.animateCharacter()}><Play size={16}/>{label}</button><p className="learning-session-feedback">{phase === "guided" ? "描紅階段" : phase === "reduced_hint" ? "減少提示" : "獨立書寫"}</p></div>;
}
