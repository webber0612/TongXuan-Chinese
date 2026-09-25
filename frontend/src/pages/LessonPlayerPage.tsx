import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import HanziWriter from "hanzi-writer";
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  Globe,
  Headphones,
  Mic,
  PenTool,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  Zap,
} from "lucide-react";

import { useLocale, currentLearningLocale } from "../lib/i18n";
import { BrowserSpeechSynthesisProvider } from "../lib/tts";
import { BrowserMediaRecorderAdapter } from "../lib/readingAloud";
import {
  getLessonPackage,
  getStepsForMode,
  getScaffoldText,
  type LessonPackage,
  type LessonStepDefinition,
  type PedagogyMode,
  type ScaffoldVisibilityMode,
  type CurriculumDomain,
  type ContentReviewStatus,
} from "../data/lessonPackages";

const API = import.meta.env.VITE_API_BASE ?? "";

export interface LessonPlayerProps {
  lessonId?: string;
  activeChildId: number | null;
  onBack: () => void;
  onCompleteLesson?: (lessonId: string, summary: { sessionCompleted: boolean; masteryGranted: boolean }) => void;
  initialMode?: PedagogyMode;
  initialScaffoldMode?: ScaffoldVisibilityMode;
}

const copy = {
  "zh-Hant": {
    back: "返回",
    lessonPlayer: "課堂學習播放器",
    learnMode: "完整學習模式",
    fastTrackMode: "這一課我會了 · 快速挑戰",
    reviewMode: "到期複習模式",
    repairMode: "弱項補強模式",
    fastTrackBtn: "這一課我會了",
    fastTrackHint: "若您已掌握本課內容，可直接進行快速挑戰！",
    step: "步驟",
    of: "／",
    nextStep: "下一步",
    prevStep: "上一步",
    finishLesson: "完成今日課程",
    correct: "答對了！太棒了！",
    wrong: "再想想看，聽聽看提示喔！",
    listenAudio: "播放語音",
    recordStart: "按住開始開口跟讀",
    recordStop: "完成錄音",
    recording: "錄音中… 請大聲說出來",
    speakingSaved: "已記錄開口練習（獨立嘗試完成）",
    speechNote: "錄音僅在裝置端短暫處理，不會上傳或產生未驗證之分數評級。",
    skipWriting: "略過書寫（已掌握或選修）",
    showStroke: "播放筆順提示",
    tapToRevealScaffold: "點擊查看英文輔助說明",
    hideScaffold: "隱藏輔助說明",
    scaffoldFull: "完整顯示",
    scaffoldTap: "點擊查看",
    scaffoldHidden: "隱藏翻譯",
    scaffoldLabel: "母語鷹架",
    sessionSummaryTitle: "今日課堂結算",
    sessionCompletedLabel: "今天的練習完成：",
    lessonPracticedLabel: "本課已練習：",
    masteryStatusLabel: "本課是否達到目前精熟條件：",
    nextReviewLabel: "下一次複習時間：",
    masteredYes: "已達成精熟條件",
    masteredInProgress: "練習中（需累積更多有效領域證據）",
    nextReviewTomorrow: "明天 (SRS 間隔複習)",
    sessionNotice: "注意：課堂完成代表已完成今日練習，精熟度將依各領域客觀作答證據另行獨立判定。",
    reviewStatusApproved: "內容已審核",
    reviewStatusDraft: "自動生成草稿（待審核）",
    activeRole: "活躍使用詞彙 (Active)",
    receptiveRole: "理解辨識詞彙 (Receptive)",
    exitTicketScore: "小挑戰得分",
    fastTrackPassed: "恭喜通過快速挑戰！已為您排入輕量複習排程。",
    fastTrackFailed: "部分領域需要再加強，正在為您安排精準補強練習…",
    domainListening: "聽力理解",
    domainRecognition: "生字認讀",
    domainVocabulary: "生詞理解",
    domainGrammar: "句型運用",
    domainWriting: "筆順書寫",
    domainSpeaking: "開口使用",
    retry: "重試",
    taskFailed: "任務操作失敗，請點擊重試",
    pleaseAnswerQuestion: "請先完成目前題目再繼續",
  },
  "zh-Hans": {
    back: "返回",
    lessonPlayer: "课堂学习播放器",
    learnMode: "完整学习模式",
    fastTrackMode: "这一课我会了 · 快速挑战",
    reviewMode: "到期复习模式",
    repairMode: "弱项补强模式",
    fastTrackBtn: "这一课我会了",
    fastTrackHint: "若您已掌握本课内容，可直接进行快速挑战！",
    step: "步骤",
    of: "／",
    nextStep: "下一步",
    prevStep: "上一步",
    finishLesson: "完成今日课程",
    correct: "答对了！太棒了！",
    wrong: "再想想看，听听看提示喔！",
    listenAudio: "播放语音",
    recordStart: "按住开始开口跟读",
    recordStop: "完成录音",
    recording: "录音中… 请大声说出来",
    speakingSaved: "已记录开口练习（独立尝试完成）",
    speechNote: "录音仅在设备端短暂处理，不会上传或产生未验证之分数评级。",
    skipWriting: "跳过书写（已掌握或选修）",
    showStroke: "播放笔顺提示",
    tapToRevealScaffold: "点击查看英文辅助说明",
    hideScaffold: "隐藏辅助说明",
    scaffoldFull: "完整显示",
    scaffoldTap: "点击查看",
    scaffoldHidden: "隐藏翻译",
    scaffoldLabel: "母语鹰架",
    sessionSummaryTitle: "今日课堂结算",
    sessionCompletedLabel: "今天的练习完成：",
    lessonPracticedLabel: "本课已练习：",
    masteryStatusLabel: "本课是否达到目前熟练条件：",
    nextReviewLabel: "下一次复习时间：",
    masteredYes: "已达成熟练条件",
    masteredInProgress: "练习中（需累积更多有效领域证据）",
    nextReviewTomorrow: "明天 (SRS 间隔复习)",
    sessionNotice: "注意：课堂完成代表已完成今日练习，熟练度将依各领域客观作答证据另行独立判定。",
    reviewStatusApproved: "内容已审核",
    reviewStatusDraft: "自动生成草稿（待审核）",
    activeRole: "活跃使用词汇 (Active)",
    receptiveRole: "理解辨识词汇 (Receptive)",
    exitTicketScore: "小挑战得分",
    fastTrackPassed: "恭喜通过快速挑战！已为您排入轻量复习排程。",
    fastTrackFailed: "部分领域需要再加强，正在为您安排精准补强练习…",
    domainListening: "听力理解",
    domainRecognition: "生字认读",
    domainVocabulary: "生词理解",
    domainGrammar: "句型运用",
    domainWriting: "笔顺书写",
    domainSpeaking: "开口使用",
    retry: "重试",
    taskFailed: "任务操作失败，请点击重试",
    pleaseAnswerQuestion: "请先完成当前题目再继续",
  },
  en: {
    back: "Back",
    lessonPlayer: "Lesson Player",
    learnMode: "Full Learning Mode",
    fastTrackMode: "I Know This · Fast Track",
    reviewMode: "Due Review Mode",
    repairMode: "Targeted Repair Mode",
    fastTrackBtn: "I know this lesson",
    fastTrackHint: "Already familiar with this lesson? Jump straight into the challenge!",
    step: "Step",
    of: "of",
    nextStep: "Next Step",
    prevStep: "Previous Step",
    finishLesson: "Finish Today's Lesson",
    correct: "Correct! Great job!",
    wrong: "Try again! Listen closely to the hint.",
    listenAudio: "Play Audio",
    recordStart: "Hold to record speaking",
    recordStop: "Stop recording",
    recording: "Recording… Speak clearly",
    speakingSaved: "Speaking practice recorded (Attempted Independently)",
    speechNote: "Audio is processed locally and discarded. No unverified speech percentage scores are generated.",
    skipWriting: "Skip writing (Already proficient / Optional)",
    showStroke: "Show stroke order",
    tapToRevealScaffold: "Tap to reveal English explanation",
    hideScaffold: "Hide explanation",
    scaffoldFull: "Full",
    scaffoldTap: "Tap to reveal",
    scaffoldHidden: "Hidden",
    scaffoldLabel: "Scaffold",
    sessionSummaryTitle: "Session Summary & Settlement",
    sessionCompletedLabel: "Today's practice completed:",
    lessonPracticedLabel: "Lesson practiced:",
    masteryStatusLabel: "Mastery criteria met:",
    nextReviewLabel: "Next review scheduled:",
    masteredYes: "Mastered (Verified by domain evidence)",
    masteredInProgress: "In Progress (Domain evidence accumulating)",
    nextReviewTomorrow: "Tomorrow (SRS Interval)",
    sessionNotice: "Note: Session completion marks daily practice. Domain mastery is independently evaluated from valid attempt evidence.",
    reviewStatusApproved: "TongXuan-reviewed",
    reviewStatusDraft: "Generated draft (pending review)",
    activeRole: "Active Vocabulary",
    receptiveRole: "Receptive Vocabulary",
    exitTicketScore: "Exit Ticket Score",
    fastTrackPassed: "Fast Track Passed! Scheduled for lightweight SRS review.",
    fastTrackFailed: "Some domains need reinforcement. Launching targeted repair...",
    domainListening: "Listening",
    domainRecognition: "Recognition",
    domainVocabulary: "Vocabulary",
    domainGrammar: "Sentence Pattern",
    domainWriting: "Handwriting",
    domainSpeaking: "Speaking",
    retry: "Retry",
    taskFailed: "Task operation failed. Please retry.",
    pleaseAnswerQuestion: "Please answer the current question to continue",
  },
  ja: {
    back: "戻る",
    lessonPlayer: "レッスンプレイヤー",
    learnMode: "標準学習モード",
    fastTrackMode: "このレッスンは知っています",
    reviewMode: "復習モード",
    repairMode: "弱点補強モード",
    fastTrackBtn: "このレッスンは知っています",
    fastTrackHint: "すでに知っている場合は、テストに直接挑戦できます！",
    step: "ステップ",
    of: "／",
    nextStep: "次へ",
    prevStep: "前へ",
    finishLesson: "今日の学習を完了",
    correct: "正解です！よくできました！",
    wrong: "もう一度挑戦してみましょう。",
    listenAudio: "音声を聞く",
    recordStart: "長押しで発音録音",
    recordStop: "録音終了",
    recording: "録音中… はっきりと発音してください",
    speakingSaved: "発音練習を記録しました（自主挑戦完了）",
    speechNote: "音声は端末内でのみ処理されます。",
    skipWriting: "書く練習をスキップ",
    showStroke: "筆順を表示",
    tapToRevealScaffold: "タップして解説を表示",
    hideScaffold: "解説を隠す",
    scaffoldFull: "全文表示",
    scaffoldTap: "タップで表示",
    scaffoldHidden: "非表示",
    scaffoldLabel: "言語サポート",
    sessionSummaryTitle: "学習完了サマリー",
    sessionCompletedLabel: "本日の練習完了：",
    lessonPracticedLabel: "練習したレッスン：",
    masteryStatusLabel: "習熟判定：",
    nextReviewLabel: "次回復習日：",
    masteredYes: "習熟達成",
    masteredInProgress: "練習中（領域別の証拠を蓄積中）",
    nextReviewTomorrow: "明日 (SRS復習)",
    sessionNotice: "注：完了と習熟は別個に評価されます。",
    reviewStatusApproved: "確認済みコンテンツ",
    reviewStatusDraft: "ドラフト",
    activeRole: "重要語彙 (Active)",
    receptiveRole: "理解語彙 (Receptive)",
    exitTicketScore: "テストスコア",
    fastTrackPassed: "テスト合格！復習がスケジュールされました。",
    fastTrackFailed: "一部の項目で補強が必要です。",
    domainListening: "リスニング",
    domainRecognition: "文字認識",
    domainVocabulary: "語彙",
    domainGrammar: "文型",
    domainWriting: "書く",
    domainSpeaking: "発音",
    retry: "再試行",
    taskFailed: "操作に失敗しました。再試行してください。",
    pleaseAnswerQuestion: "現在の問題に答えてから進んでください",
  },
  ko: {
    back: "뒤로",
    lessonPlayer: "학습 플레이어",
    learnMode: "정규 학습 모드",
    fastTrackMode: "이 수업은 이미 알아요",
    reviewMode: "복습 모드",
    repairMode: "약점 보강 모드",
    fastTrackBtn: "이 수업은 이미 알아요",
    fastTrackHint: "이미 내용을 알고 있다면 바로 도전에 참여하세요!",
    step: "단계",
    of: "／",
    nextStep: "다음",
    prevStep: "이전",
    finishLesson: "오늘 학습 완료",
    correct: "정답입니다! 잘했어요!",
    wrong: "다시 한 번 생각해 보세요.",
    listenAudio: "음성 듣기",
    recordStart: "누르고 따라 읽기",
    recordStop: "녹음 완료",
    recording: "녹음 중… 큰 소리로 말해보세요",
    speakingSaved: "말하기 연습 기록 완료 (독립 시도 완료)",
    speechNote: "음성은 기기에서만 처리됩니다.",
    skipWriting: "쓰기 건너뛰기",
    showStroke: "획순 보기",
    tapToRevealScaffold: "탭하여 영어 설명 보기",
    hideScaffold: "설명 숨기기",
    scaffoldFull: "전체 표시",
    scaffoldTap: "탭하여 표시",
    scaffoldHidden: "숨기기",
    scaffoldLabel: "언어 지원",
    sessionSummaryTitle: "오늘의 학습 결과",
    sessionCompletedLabel: "오늘 연습 완료:",
    lessonPracticedLabel: "연습한 수업:",
    masteryStatusLabel: "숙달 기준 충족:",
    nextReviewLabel: "다음 복습 일정:",
    masteredYes: "숙달 달성",
    masteredInProgress: "연습 중 (영역별 평가 진행 중)",
    nextReviewTomorrow: "내일 (SRS 간격 복습)",
    sessionNotice: "참고: 수업 완료와 숙달 달성은 별도로 평가됩니다.",
    reviewStatusApproved: "검토 완료 콘텐츠",
    reviewStatusDraft: "초안",
    activeRole: "핵심 어휘 (Active)",
    receptiveRole: "수용 어휘 (Receptive)",
    exitTicketScore: "도전 점수",
    fastTrackPassed: "도전 통과! 가벼운 복습이 예약되었습니다.",
    fastTrackFailed: "일부 영역의 보강이 필요합니다.",
    domainListening: "듣기",
    domainRecognition: "글자 인식",
    domainVocabulary: "어휘",
    domainGrammar: "문형",
    domainWriting: "쓰기",
    domainSpeaking: "말하기",
    retry: "다시 시도",
    taskFailed: "작업에 실패했습니다. 다시 시도해 주세요.",
    pleaseAnswerQuestion: "현재 문제를 먼저 완료하고 계속 진행하세요",
  },
  es: {
    back: "Volver",
    lessonPlayer: "Reproductor de lección",
    learnMode: "Modo de aprendizaje",
    fastTrackMode: "Ya conozco esta lección",
    reviewMode: "Modo de repaso",
    repairMode: "Modo de refuerzo",
    fastTrackBtn: "Ya conozco esta lección",
    fastTrackHint: "¿Ya dominas esta lección? ¡Pasa directo al desafío!",
    step: "Paso",
    of: "de",
    nextStep: "Siguiente",
    prevStep: "Anterior",
    finishLesson: "Terminar lección de hoy",
    correct: "¡Correcto! ¡Muy bien!",
    wrong: "Inténtalo de nuevo.",
    listenAudio: "Escuchar audio",
    recordStart: "Mantén presionado para hablar",
    recordStop: "Terminar grabación",
    recording: "Grabando… habla con claridad",
    speakingSaved: "Práctica oral registrada (Intento independiente)",
    speechNote: "El audio se procesa localmente en el dispositivo.",
    skipWriting: "Omitir escritura",
    showStroke: "Ver orden de trazos",
    tapToRevealScaffold: "Toca para ver la explicación en inglés",
    hideScaffold: "Ocultar explicación",
    scaffoldFull: "Completo",
    scaffoldTap: "Tocar para ver",
    scaffoldHidden: "Oculto",
    scaffoldLabel: "Apoyo en tu idioma",
    sessionSummaryTitle: "Resumen de la lección",
    sessionCompletedLabel: "Práctica de hoy completada:",
    lessonPracticedLabel: "Lección practicada:",
    masteryStatusLabel: "Criterio de dominio alcanzado:",
    nextReviewLabel: "Próximo repaso programado:",
    masteredYes: "Dominado (Verificado por evidencia)",
    masteredInProgress: "En progreso (Acumulando evidencia)",
    nextReviewTomorrow: "Mañana (Repaso SRS)",
    sessionNotice: "Nota: Completar la sesión registra la práctica; el dominio se evalúa por separado.",
    reviewStatusApproved: "Contenido revisado",
    reviewStatusDraft: "Borrador generado",
    activeRole: "Vocabulario activo",
    receptiveRole: "Vocabulario receptivo",
    exitTicketScore: "Puntaje del desafío",
    fastTrackPassed: "¡Desafío rápido aprobado! Programado para repaso ligero.",
    fastTrackFailed: "Algunas áreas necesitan refuerzo.",
    domainListening: "Comprensión auditiva",
    domainRecognition: "Reconocimiento",
    domainVocabulary: "Vocabulario",
    domainGrammar: "Patrón de oración",
    domainWriting: "Escritura",
    domainSpeaking: "Expresión oral",
    retry: "Reintentar",
    taskFailed: "Error en la operación. Intente nuevamente.",
    pleaseAnswerQuestion: "Por favor complete la pregunta actual para continuar",
  },
} as const;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json" }, ...init });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).detail ?? "lesson_player_request_failed");
  return response.json() as Promise<T>;
}

export function LessonPlayerPage({
  lessonId = "book1-l01",
  activeChildId,
  onBack,
  onCompleteLesson,
  initialMode = "LEARN",
  initialScaffoldMode = "FULL",
}: LessonPlayerProps) {
  const { language } = useLocale();
  const text = copy[language] ?? copy.en;
  const locale = currentLearningLocale();
  const speech = useMemo(() => new BrowserSpeechSynthesisProvider(), []);
  const recorder = useMemo(() => new BrowserMediaRecorderAdapter(), []);

  const [mode, setMode] = useState<PedagogyMode>(initialMode);
  const [scaffoldMode, setScaffoldMode] = useState<ScaffoldVisibilityMode>(initialScaffoldMode);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedChoices, setSelectedChoices] = useState<Record<string, string>>({});
  const [speakingAttempted, setSpeakingAttempted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [writingSkipped, setWritingSkipped] = useState(false);
  const [exitTicketAnswers, setExitTicketAnswers] = useState<Record<string, string>>({});
  const [exitTicketSubmitted, setExitTicketSubmitted] = useState(false);
  const [weakDomains, setWeakDomains] = useState<string[]>([]);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [activeCharIndex, setActiveCharIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Authoritative backend session state
  const [session, setSession] = useState<{
    id: string;
    status: string;
    lessonId?: string;
    masteryStatus?: string | null;
    targetMinutes?: number;
    curriculumContext?: { stageId?: string; stageTitle?: string; lessonId?: string; official?: { title?: string; objectiveSummary?: string } };
    tasks?: Array<{ id: string; key: string; taskType: string; sourceQueue: string; lessonId: string; state: string; itemId?: string; taskData?: any }>;
  } | null>(null);
  const [masteryStatus, setMasteryStatus] = useState<string | null>(null);
  const [nextReviewDueAt, setNextReviewDueAt] = useState<string | null>(null);
  const [activeSpeakingAttemptIds, setActiveSpeakingAttemptIds] = useState<{ speaking?: string; pronunciation?: string }>({});
  const activeSpeakingAttemptIdsRef = useRef<{ speaking?: string; pronunciation?: string }>({});

  const writerRef = useRef<HanziWriter | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const submittedAnswersRef = useRef<Record<string, { optionId?: string | null; answersKey?: string }>>({});
  const submittedEvidenceRef = useRef<Record<string, string>>({});
  const submittedSkipsRef = useRef<Record<string, boolean>>({});

  // Canonical lesson ID resolution
  const resolvedLessonId = session?.curriculumContext?.lessonId || session?.lessonId || lessonId || "book1-l01";
  const pkg: LessonPackage | null = useMemo(() => getLessonPackage(resolvedLessonId), [resolvedLessonId]);

  const steps: LessonStepDefinition[] = useMemo(() => {
    if (!pkg) return [];
    return getStepsForMode(pkg, mode, weakDomains);
  }, [pkg, mode, weakDomains]);

  const currentStep = steps[currentStepIndex] ?? null;

  // Authoritative session initialization
  const initSession = useCallback(async () => {
    if (!activeChildId) return;
    setError(null);
    setBusy(true);
    try {
      const current = await api<{
        id: string;
        status: string;
        lessonId?: string;
        masteryStatus?: string | null;
        targetMinutes?: number;
        curriculumContext?: { stageId?: string; stageTitle?: string; lessonId?: string; official?: { title?: string; objectiveSummary?: string } };
        tasks?: Array<{ id: string; key: string; taskType: string; sourceQueue: string; lessonId: string; state: string; itemId?: string; taskData?: any }>;
      } | null>(
        `/api/children/${activeChildId}/learning-sessions/current`
      );
      if (current && (current.status === "IN_PROGRESS" || current.status === "PAUSED")) {
        sessionRef.current = current;
        setSession(current);
        if (current.masteryStatus) setMasteryStatus(current.masteryStatus);
      } else {
        const started = await api<{
          id: string;
          status: string;
          lessonId?: string;
          masteryStatus?: string | null;
          targetMinutes?: number;
          curriculumContext?: { stageId?: string; stageTitle?: string; lessonId?: string; official?: { title?: string; objectiveSummary?: string } };
          tasks?: Array<{ id: string; key: string; taskType: string; sourceQueue: string; lessonId: string; state: string; itemId?: string; taskData?: any }>;
        }>(
          `/api/children/${activeChildId}/learning-sessions`,
          {
            method: "POST",
            body: JSON.stringify({
              lesson_id: lessonId || undefined,
              target_minutes: 18,
              script_mode: locale === "zh-CN" ? "SIMPLIFIED" : "TRADITIONAL",
            }),
          }
        );
        if (started) {
          sessionRef.current = started;
          setSession(started);
          if (started.masteryStatus) setMasteryStatus(started.masteryStatus);
        }
      }
    } catch (err: any) {
      setError(err?.message || text.taskFailed);
    } finally {
      setBusy(false);
    }
  }, [activeChildId, lessonId, locale, text.taskFailed]);

  useEffect(() => {
    void initSession();
  }, [initSession]);

  // Backend task progression helpers with strict error surfacing
  const submitBackendTaskAnswer = async (
    matcher: (t: { id: string; key: string; taskType: string; state: string; itemId?: string; taskData?: any }) => boolean,
    selectedOptionId?: string,
    answers?: Record<string, string>,
    assisted = false
  ): Promise<boolean> => {
    const currentSess = sessionRef.current;
    if (!activeChildId || !currentSess?.id || !currentSess.tasks) return true;
    const matchingTask = currentSess.tasks.find((t) => matcher(t) && t.state !== "COMPLETED" && t.state !== "DEFERRED");
    if (!matchingTask) return true;
    const answersKey = JSON.stringify(answers ?? {});
    const recorded = submittedAnswersRef.current[matchingTask.id];
    if (recorded && recorded.optionId === (selectedOptionId || null) && recorded.answersKey === answersKey) {
      return true; // Already submitted with this exact answer
    }
    try {
      setError(null);
      const updated = await api<typeof session>(
        `/api/children/${activeChildId}/learning-sessions/${currentSess.id}/tasks/${matchingTask.id}/answer`,
        {
          method: "POST",
          body: JSON.stringify({
            selected_option_id: selectedOptionId || null,
            answers: answers ?? {},
            assisted,
          }),
        }
      );
      if (updated) {
        sessionRef.current = updated;
        submittedAnswersRef.current[matchingTask.id] = {
          optionId: selectedOptionId || null,
          answersKey,
        };
        setSession(updated);
        if (updated.masteryStatus) setMasteryStatus(updated.masteryStatus);
      }
      return true;
    } catch (err: any) {
      setError(err?.message || text.taskFailed);
      return false;
    }
  };

  const submitBackendTaskEvidence = async (
    matcher: (t: { id: string; key: string; taskType: string; state: string; itemId?: string; taskData?: any }) => boolean,
    evidenceRef: string
  ): Promise<boolean> => {
    const currentSess = sessionRef.current;
    if (!activeChildId || !currentSess?.id || !currentSess.tasks) return true;
    const matchingTask = currentSess.tasks.find((t) => matcher(t) && t.state !== "COMPLETED" && t.state !== "DEFERRED");
    if (!matchingTask) return true;
    if (submittedEvidenceRef.current[matchingTask.id] === evidenceRef) {
      return true;
    }
    try {
      setError(null);
      const updated = await api<typeof session>(
        `/api/children/${activeChildId}/learning-sessions/${currentSess.id}/tasks/${matchingTask.id}/evidence`,
        {
          method: "POST",
          body: JSON.stringify({
            evidence_ref: evidenceRef,
          }),
        }
      );
      if (updated) {
        sessionRef.current = updated;
        submittedEvidenceRef.current[matchingTask.id] = evidenceRef;
        setSession(updated);
        if (updated.masteryStatus) setMasteryStatus(updated.masteryStatus);
      }
      return true;
    } catch (err: any) {
      setError(err?.message || text.taskFailed);
      return false;
    }
  };

  const skipBackendTask = async (
    matcher: (t: { id: string; key: string; taskType: string; state: string; itemId?: string; taskData?: any }) => boolean
  ): Promise<boolean> => {
    const currentSess = sessionRef.current;
    if (!activeChildId || !currentSess?.id || !currentSess.tasks) return true;
    const matchingTask = currentSess.tasks.find((t) => matcher(t) && t.state !== "COMPLETED" && t.state !== "DEFERRED");
    if (!matchingTask) return true;
    if (submittedSkipsRef.current[matchingTask.id]) {
      return true;
    }
    try {
      setError(null);
      const updated = await api<typeof session>(
        `/api/children/${activeChildId}/learning-sessions/${currentSess.id}/tasks/${matchingTask.id}/skip`,
        {
          method: "POST",
        }
      );
      if (updated) {
        sessionRef.current = updated;
        submittedSkipsRef.current[matchingTask.id] = true;
        setSession(updated);
        if (updated.masteryStatus) setMasteryStatus(updated.masteryStatus);
      }
      return true;
    } catch (err: any) {
      setError(err?.message || text.taskFailed);
      return false;
    }
  };

  // Audio helper
  const playAudio = useCallback((textToPlay: string) => {
    const ttsLocale = locale === "zh-CN" ? "zh-CN" : "zh-TW";
    try {
      speech.speak(
        {
          provider: "browser",
          locale: ttsLocale,
          voice_locale: ttsLocale,
          text: textToPlay,
          text_kind: "sentence",
          rate: 0.85,
          playback_only: true,
          persisted: false,
        },
        {}
      );
    } catch {
      // Audio playback is non-blocking fallback
    }
  }, [locale, speech]);

  // Listening attempt starter & evidence attacher
  const handlePlayListeningAudio = async (textToPlay: string): Promise<boolean> => {
    playAudio(textToPlay);
    if (!activeChildId || !session?.id || !session.tasks) return true;
    const listenTask = session.tasks.find(
      (t) => (t.taskType === "LISTENING" || t.key === "listen") && t.state !== "COMPLETED" && t.state !== "DEFERRED"
    );
    if (listenTask && listenTask.itemId) {
      try {
        const startRes = await api<{ id: string }>(`/api/children/${activeChildId}/listening-attempts`, {
          method: "POST",
          body: JSON.stringify({
            item_id: listenTask.itemId,
            lesson_id: listenTask.lessonId || resolvedLessonId,
          }),
        });
        if (startRes?.id) {
          const completeRes = await api<{ id: string; status: string }>(
            `/api/children/${activeChildId}/listening-attempts/${startRes.id}/complete`,
            {
              method: "POST",
              body: JSON.stringify({ duration_ms: 1500 }),
            }
          );
          if (completeRes?.status === "COMPLETED") {
            const ok = await submitBackendTaskEvidence(
              (t) => t.id === listenTask.id || t.taskType === "LISTENING" || t.key === "listen",
              startRes.id
            );
            return ok;
          }
        }
        return false;
      } catch (err: any) {
        setError(err?.message || text.taskFailed);
        return false;
      }
    }
    return true;
  };

  // Clean up
  useEffect(() => {
    return () => {
      speech.cancel();
      recorder.delete();
    };
  }, [recorder, speech]);

  // HanziWriter initialization for writing step
  useEffect(() => {
    if (currentStep?.stepKey === "writing" && canvasContainerRef.current) {
      canvasContainerRef.current.innerHTML = "";
      const char = pkg?.characters[activeCharIndex]?.char ?? "你";
      try {
        const instance = HanziWriter.create(canvasContainerRef.current, char, {
          width: 200,
          height: 200,
          padding: 15,
          showOutline: true,
          strokeAnimationSpeed: 1,
          delayBetweenStrokes: 200,
          strokeColor: "#2563eb",
          outlineColor: "#cbd5e1",
          drawingColor: "#1d4ed8",
        });
        writerRef.current = instance;
        instance.quiz({
          showHintAfterMisses: 2,
          leniency: 0.65,
          onMistake: () => {
            void handleWritingTrace("incorrect");
          },
          onComplete: () => {
            void handleWritingTrace("correct");
          },
        });
      } catch {
        // Fallback gracefully
      }
    }
  }, [currentStep?.stepKey, activeCharIndex, pkg]);

  const animateStrokes = () => {
    if (writerRef.current) {
      writerRef.current.animateCharacter();
    }
  };

  const handleWritingTrace = async (result: "correct" | "incorrect") => {
    if (activeChildId && pkg) {
      const char = pkg.characters[activeCharIndex]?.char ?? "你";
      const currentSess = sessionRef.current;
      const writingTask = currentSess?.tasks?.find((t) => t.taskType.startsWith("WRITING_") || t.key.startsWith("writing"));
      const phase = writingTask?.taskData?.phase || "guided";
      const scriptMode = writingTask?.taskData?.scriptMode || (locale === "zh-CN" ? "SIMPLIFIED" : "TRADITIONAL");
      const writingRes = await api<{ id?: string; attempt_id?: string }>(`/api/sprint-b/writing/attempts?child_id=${activeChildId}&character=${encodeURIComponent(char)}`, {
        method: "POST",
        body: JSON.stringify({
          trace_result: result,
          assisted: false,
          phase,
          script_mode: scriptMode,
          provider: "HANZI_WRITER",
        }),
      }).catch((err: any) => {
        setError(err?.message || text.taskFailed);
        return undefined;
      });
      if (writingRes && (writingRes.id || writingRes.attempt_id)) {
        await submitBackendTaskEvidence((t) => t.taskType.startsWith("WRITING_") || t.key.startsWith("writing"), (writingRes.id || writingRes.attempt_id)!);
      }
    }
  };

  const handleToggleScaffoldMode = () => {
    setScaffoldMode((prev) => {
      if (prev === "FULL") return "TAP_TO_REVEAL";
      if (prev === "TAP_TO_REVEAL") return "HIDDEN";
      return "FULL";
    });
  };

  const handleRevealTap = (key: string) => {
    setRevealedKeys((prev) => ({ ...prev, [key]: true }));
  };

  const handleStartFastTrack = () => {
    setMode("FAST_TRACK");
    setCurrentStepIndex(0);
    setSelectedChoices({});
    setExitTicketAnswers({});
    setExitTicketSubmitted(false);
    submittedAnswersRef.current = {};
    submittedEvidenceRef.current = {};
    submittedSkipsRef.current = {};
  };

  const handleNextStep = async () => {
    if (!currentStep || !pkg) return;
    const currentSess = sessionRef.current;

    // 1. Context step: ensure listening task is completed
    if (currentStep.stepKey === "context" && activeChildId && currentSess?.tasks) {
      const listenTask = currentSess.tasks.find(
        (t) => (t.taskType === "LISTENING" || t.key === "listen") && t.state !== "COMPLETED" && t.state !== "DEFERRED"
      );
      if (listenTask) {
        const ok = await handlePlayListeningAudio(currentStep.data.audioText || "你好");
        if (!ok) return;
      }
    }

    // 2. Vocabulary step: ensure vocabulary choice was made
    if (currentStep.stepKey === "vocabulary") {
      const selected = selectedChoices["vocab"];
      if (!selected) {
        setError(text.pleaseAnswerQuestion);
        return;
      }
      const sessAfterVocab = sessionRef.current;
      if (activeChildId && sessAfterVocab?.tasks) {
        const vocabTask = sessAfterVocab.tasks.find(
          (t) => (t.taskType === "VOCABULARY" || t.key === "vocabulary") && t.state !== "COMPLETED" && t.state !== "DEFERRED"
        );
        if (vocabTask) {
          const ok = await submitBackendTaskAnswer((t) => t.id === vocabTask.id, selected);
          if (!ok) return;
        }
      }
    }

    // 3. Characters step: ensure all recognition tasks are completed
    if (currentStep.stepKey === "characters") {
      const currentAnswer = selectedChoices[`recog-${activeCharIndex}`];
      if (!currentAnswer) {
        setError(text.pleaseAnswerQuestion);
        return;
      }
      if (activeCharIndex < pkg.characters.length - 1) {
        setActiveCharIndex((prev) => prev + 1);
        setError(null);
        return;
      }
      for (let i = 0; i < pkg.characters.length; i++) {
        if (!selectedChoices[`recog-${i}`]) {
          setError(text.pleaseAnswerQuestion);
          return;
        }
      }
      const sessAfterRecog = sessionRef.current;
      if (activeChildId && sessAfterRecog?.tasks) {
        const pendingRecog = sessAfterRecog.tasks.filter(
          (t) => (t.taskType === "RECOGNITION" || t.taskType === "MINI_CHECK" || t.key.startsWith("recognition-")) &&
                 t.state !== "COMPLETED" && t.state !== "DEFERRED" && t.key !== "mini-check-reflection"
        );
        for (const t of pendingRecog) {
          const idx = t.key === "recognition-1" ? 0 : 1;
          const selected = selectedChoices[`recog-${idx}`];
          if (!selected) {
            setError(text.pleaseAnswerQuestion);
            return;
          }
          const ok = await submitBackendTaskAnswer((task) => task.id === t.id, selected);
          if (!ok) return;
        }
      }
    }

    // 4. Sentence Pattern step: ensure sentence-pattern choice was made
    if (currentStep.stepKey === "sentence_pattern") {
      const selected = selectedChoices["sentence"];
      if (!selected) {
        setError(text.pleaseAnswerQuestion);
        return;
      }
      const sessAfterSent = sessionRef.current;
      if (activeChildId && sessAfterSent?.tasks) {
        const sentTask = sessAfterSent.tasks.find(
          (t) => (t.taskType === "SENTENCE_PATTERN" || t.key === "sentence-pattern") && t.state !== "COMPLETED" && t.state !== "DEFERRED"
        );
        if (sentTask) {
          const ok = await submitBackendTaskAnswer((t) => t.id === sentTask.id, selected);
          if (!ok) return;
        }
      }
    }

    // 5. Speaking step: ensure speaking attempts are completed
    if (currentStep.stepKey === "speaking" && activeChildId && sessionRef.current?.tasks) {
      const sessAfterSpeaking = sessionRef.current;
      const pendingSpeaking = (sessAfterSpeaking?.tasks ?? []).filter(
        (t) => (t.taskType === "SPEAKING_ATTEMPT" || t.taskType === "PRONUNCIATION_ATTEMPT" || t.key === "speaking" || t.key === "pronunciation") &&
               t.state !== "COMPLETED" && t.state !== "DEFERRED"
      );
      if (pendingSpeaking.length > 0) {
        setError(text.taskFailed);
        return;
      }
    }

    // 6. Writing step: if writing is not completed, and user is advancing, skip optional writing
    if (currentStep.stepKey === "writing" && activeChildId && sessionRef.current?.tasks) {
      const sessAfterWriting = sessionRef.current;
      const writingTask = sessAfterWriting?.tasks?.find(
        (t) => t.taskType.startsWith("WRITING_") && t.state !== "COMPLETED" && t.state !== "DEFERRED"
      );
      if (writingTask) {
        const ok = await skipBackendTask((t) => t.id === writingTask.id);
        if (!ok) return;
      }
    }

    // 7. Exit Ticket step in LEARN mode: ensure mini-check reflection is answered
    if (currentStep.stepKey === "exit_ticket" && mode === "LEARN" && activeChildId && sessionRef.current?.tasks) {
      const sessAfterTicket = sessionRef.current;
      const refTask = sessAfterTicket?.tasks?.find(
        (t) => (t.key === "mini-check-reflection" || (t.taskType === "MINI_CHECK" && t.taskData?.mode === "reflection")) &&
               t.state !== "COMPLETED" && t.state !== "DEFERRED"
      );
      if (refTask) {
        const ok = await submitBackendTaskAnswer((t) => t.id === refTask.id, "practiced");
        if (!ok) return;
      }
    }

    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      void handleCompleteSession();
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleRecordSpeaking = async () => {
    if (recording) {
      try {
        await recorder.stop();
        if (activeChildId) {
          const ids = activeSpeakingAttemptIdsRef.current;
          // Complete speaking attempt and attach evidence
          if (ids.speaking) {
            await api(`/api/reading-aloud/attempts/${ids.speaking}/complete?child_id=${activeChildId}`, {
              method: "POST",
              body: JSON.stringify({ duration_ms: 2000 }),
            });
            await submitBackendTaskEvidence(
              (t) => t.taskType === "SPEAKING_ATTEMPT" || t.key === "speaking",
              ids.speaking
            );
          }
          // Complete pronunciation attempt and attach evidence
          if (ids.pronunciation) {
            await api(`/api/reading-aloud/attempts/${ids.pronunciation}/complete?child_id=${activeChildId}`, {
              method: "POST",
              body: JSON.stringify({ duration_ms: 2000 }),
            });
            await submitBackendTaskEvidence(
              (t) => t.taskType === "PRONUNCIATION_ATTEMPT" || t.key === "pronunciation",
              ids.pronunciation
            );
          }
          recorder.delete();
          activeSpeakingAttemptIdsRef.current = {};
          setActiveSpeakingAttemptIds({});
        }
      } catch (err: any) {
        setError(err?.message || text.taskFailed);
      }
      setRecording(false);
      setSpeakingAttempted(true);
    } else {
      try {
        const currentSess = sessionRef.current;
        if (activeChildId && currentSess?.tasks) {
          const speakingTask = currentSess.tasks.find(
            (t) => (t.taskType === "SPEAKING_ATTEMPT" || t.key === "speaking") && t.state !== "COMPLETED"
          );
          const pronTask = currentSess.tasks.find(
            (t) => (t.taskType === "PRONUNCIATION_ATTEMPT" || t.key === "pronunciation") && t.state !== "COMPLETED"
          );
          const ids: { speaking?: string; pronunciation?: string } = {};

          if (speakingTask && speakingTask.itemId) {
            const attempt = await api<{ id: string }>(`/api/reading-aloud/attempts/start?child_id=${activeChildId}`, {
              method: "POST",
              body: JSON.stringify({
                text: speakingTask.taskData?.text || pkg?.curriculumSource.title || "你好",
                text_kind: speakingTask.taskData?.textKind || "character",
                locale: speakingTask.taskData?.locale || (locale === "zh-CN" ? "zh-CN" : "zh-TW"),
                source_type: "CURRICULUM",
                source_id: speakingTask.itemId,
                activity_domain: "speaking",
              }),
            });
            if (attempt?.id) ids.speaking = attempt.id;
          }

          if (pronTask && pronTask.itemId) {
            const attempt = await api<{ id: string }>(`/api/reading-aloud/attempts/start?child_id=${activeChildId}`, {
              method: "POST",
              body: JSON.stringify({
                text: pronTask.taskData?.text || pkg?.curriculumSource.title || "你好",
                text_kind: pronTask.taskData?.textKind || "character",
                locale: pronTask.taskData?.locale || (locale === "zh-CN" ? "zh-CN" : "zh-TW"),
                source_type: "CURRICULUM",
                source_id: pronTask.itemId,
                activity_domain: "pronunciation",
              }),
            });
            if (attempt?.id) ids.pronunciation = attempt.id;
          }

          activeSpeakingAttemptIdsRef.current = ids;
          setActiveSpeakingAttemptIds(ids);
        }
        await recorder.start();
        setRecording(true);
      } catch (err: any) {
        setError(err?.message || text.taskFailed);
        setSpeakingAttempted(true);
      }
    }
  };

  const handleExitTicketSubmit = async () => {
    if (!currentStep?.data.questions) return;
    setExitTicketSubmitted(true);

    const questions = currentStep.data.questions;
    const failedDomains: string[] = [];
    let correctCount = 0;

    for (const q of questions) {
      const selected = exitTicketAnswers[q.id];
      if (selected === q.correctChoiceId) {
        correctCount++;
      } else {
        if (!failedDomains.includes(q.domain)) {
          failedDomains.push(q.domain);
        }
      }
    }

    const allCorrect = correctCount === questions.length;

    if (mode === "FAST_TRACK") {
      if (activeChildId) {
        try {
          const res = await api<{
            passed: boolean;
            weakDomains: string[];
            nextMode: PedagogyMode;
            masteryStatus: string;
            nextReviewDueAt?: string | null;
          }>(`/api/children/${activeChildId}/lesson-packages/${resolvedLessonId}/fast-track`, {
            method: "POST",
            body: JSON.stringify({ answers: exitTicketAnswers }),
          });
          if (res.passed) {
            setWeakDomains([]);
            setNextReviewDueAt(res.nextReviewDueAt ?? null);
            setMasteryStatus(res.masteryStatus);
          } else {
            setWeakDomains(res.weakDomains.length > 0 ? res.weakDomains : failedDomains);
            setMode("REPAIR");
            setCurrentStepIndex(0); // Immediately transition into REPAIR mode tasks!
            setNextReviewDueAt(null);
            setMasteryStatus("IN_PROGRESS");
          }
          return;
        } catch {
          // Fallback to local evaluation
        }
      }

      if (allCorrect) {
        setWeakDomains([]);
        setMasteryStatus("READY_FOR_CHECK");
      } else {
        setWeakDomains(failedDomains);
        setMode("REPAIR");
        setCurrentStepIndex(0);
        setMasteryStatus("IN_PROGRESS");
      }
    } else {
      // In LEARN mode: advance reflection task if available
      void submitBackendTaskAnswer((t) => t.key === "mini-check-reflection" || (t.taskType === "MINI_CHECK" && t.taskData?.mode === "reflection"), "practiced");
      if (allCorrect) {
        setWeakDomains([]);
        setMasteryStatus("READY_FOR_CHECK");
      } else {
        setWeakDomains(failedDomains);
        setMasteryStatus("IN_PROGRESS");
      }
    }
  };

  const handleCompleteSession = async () => {
    if (!activeChildId || !session?.id) {
      setSessionCompleted(true);
      if (onCompleteLesson) {
        onCompleteLesson(resolvedLessonId, {
          sessionCompleted: true,
          masteryGranted: false,
        });
      }
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const completed = await api<{ id: string; status: string; masteryStatus?: string | null }>(
        `/api/children/${activeChildId}/learning-sessions/${session.id}/complete`,
        { method: "POST", body: "{}" }
      );
      if (completed && completed.status === "COMPLETED") {
        setSessionCompleted(true);
        setSession((prev) => (prev ? { ...prev, status: "COMPLETED", masteryStatus: completed.masteryStatus } : null));
        if (completed.masteryStatus) {
          setMasteryStatus(completed.masteryStatus);
        }
        if (onCompleteLesson) {
          onCompleteLesson(resolvedLessonId, {
            sessionCompleted: true,
            masteryGranted: completed.masteryStatus === "MASTERED",
          });
        }
      } else {
        setError(text.taskFailed);
      }
    } catch (err: any) {
      setError(err?.message || text.taskFailed);
      setSessionCompleted(false);
      // DO NOT call onCompleteLesson on error!
    } finally {
      setBusy(false);
    }
  };

  if (!pkg) {
    return (
      <div className="lesson-player-container" role="main">
        <div className="lesson-player-card">
          <h2>課程載入錯誤</h2>
          <p>找不到課堂教材 ({lessonId})</p>
          <button type="button" className="button button-primary" onClick={onBack}>
            {text.back}
          </button>
        </div>
      </div>
    );
  }

  // Helper to render scaffold translation
  const renderScaffold = (scaffoldKey?: string) => {
    if (!scaffoldKey) return null;
    const info = getScaffoldText(pkg, scaffoldKey, scaffoldMode);
    if (!info.visibleText && scaffoldMode === "HIDDEN") return null;

    const isRevealed = revealedKeys[scaffoldKey] || scaffoldMode === "FULL";

    return (
      <div className="scaffold-box" data-review-status={info.reviewStatus}>
        {info.isTapToReveal && !isRevealed ? (
          <button
            type="button"
            className="scaffold-tap-btn"
            onClick={() => handleRevealTap(scaffoldKey)}
            aria-label={text.tapToRevealScaffold}
          >
            <Globe size={14} />
            <span>{text.tapToRevealScaffold}</span>
          </button>
        ) : (
          <div className="scaffold-content">
            <span className="scaffold-text">{info.visibleText}</span>
            {info.notes && <span className="scaffold-notes">({info.notes})</span>}
            <span className="scaffold-status-pill" title={info.reviewStatus === "APPROVED" ? text.reviewStatusApproved : text.reviewStatusDraft}>
              {info.reviewStatus === "APPROVED" ? text.reviewStatusApproved : text.reviewStatusDraft}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <main className="lesson-player-container" role="main" aria-label={text.lessonPlayer}>
      {error && (
        <div className="error-strip" role="alert" style={{ margin: "0.5rem 1rem" }}>
          <span>{error}</span>
          <button type="button" className="button button-text" onClick={() => void initSession()}>
            {text.retry}
          </button>
        </div>
      )}
      {/* Top Header Bar */}
      <header className="lesson-player-topbar">
        <button
          type="button"
          className="button button-text player-back-btn"
          onClick={onBack}
          aria-label={text.back}
        >
          <ArrowLeft size={20} />
          <span>{text.back}</span>
        </button>

        <div className="player-meta-info">
          <span className="player-lesson-badge">
            {session?.curriculumContext?.stageTitle || pkg.curriculumSource.book} · {pkg.curriculumSource.lesson}
          </span>
          <h1 className="player-lesson-title">{session?.curriculumContext?.official?.title || pkg.curriculumSource.title}</h1>
        </div>

        <div className="player-header-actions">
          {/* Scaffold Switcher Button */}
          <button
            type="button"
            className="scaffold-switcher-btn"
            onClick={handleToggleScaffoldMode}
            title={`${text.scaffoldLabel}: ${scaffoldMode === "FULL" ? text.scaffoldFull : scaffoldMode === "TAP_TO_REVEAL" ? text.scaffoldTap : text.scaffoldHidden}`}
            aria-label={`${text.scaffoldLabel}切換`}
          >
            <Globe size={16} />
            <span className="scaffold-mode-label">
              EN: {scaffoldMode === "FULL" ? text.scaffoldFull : scaffoldMode === "TAP_TO_REVEAL" ? text.scaffoldTap : text.scaffoldHidden}
            </span>
          </button>

          {/* Fast Track Trigger in LEARN mode */}
          {mode === "LEARN" && !sessionCompleted && (
            <button
              type="button"
              className="fast-track-trigger-btn"
              onClick={handleStartFastTrack}
              title={text.fastTrackHint}
            >
              <Zap size={16} />
              <span>{text.fastTrackBtn}</span>
            </button>
          )}
        </div>
      </header>

      {/* Mode Badge & Step Progress Indicator */}
      <section className="lesson-player-progress-section" aria-label="進度">
        <div className="progress-header-row">
          <span className={`mode-badge mode-${mode.toLowerCase()}`}>
            {mode === "LEARN" && text.learnMode}
            {mode === "FAST_TRACK" && text.fastTrackMode}
            {mode === "REVIEW" && text.reviewMode}
            {mode === "REPAIR" && text.repairMode}
          </span>
          <span className="step-counter-text">
            {text.step} {currentStepIndex + 1} {text.of} {steps.length}
          </span>
        </div>

        <div className="step-progress-track" role="progressbar" aria-valuenow={currentStepIndex + 1} aria-valuemin={1} aria-valuemax={steps.length}>
          {steps.map((s, idx) => (
            <div
              key={`${s.stepKey}-${idx}`}
              className={`step-segment ${idx === currentStepIndex ? "active" : idx < currentStepIndex ? "completed" : "pending"}`}
              title={`${s.stepNumber}. ${s.title}`}
            />
          ))}
        </div>
      </section>

      {/* Primary Single Column Content View */}
      {currentStep && (
        <article className="lesson-step-card" data-step-key={currentStep.stepKey}>
          <header className="step-card-header">
            <div className="step-badge-pill">
              {currentStep.domain ? (
                <span className="domain-pill">
                  {currentStep.domain === "listening" && text.domainListening}
                  {currentStep.domain === "recognition" && text.domainRecognition}
                  {currentStep.domain === "vocabulary" && text.domainVocabulary}
                  {currentStep.domain === "grammar" && text.domainGrammar}
                  {currentStep.domain === "writing" && text.domainWriting}
                  {currentStep.domain === "speaking" && text.domainSpeaking}
                </span>
              ) : null}
              <span className="step-num-pill">Step {currentStep.stepNumber}</span>
            </div>
            <h2 className="step-card-title">{currentStep.title}</h2>
            <p className="step-card-subtitle">{currentStep.subtitle}</p>
          </header>

          {/* STEP 1: Situational Context */}
          {currentStep.stepKey === "context" && (
            <div className="step-body step-context-body">
              <div className="context-illustration-box">
                <div className="context-visual-scene">
                  <span className="scene-tag">☀️ 情境：早晨遇見朋友</span>
                  <button
                    type="button"
                    className="audio-play-large-btn"
                    onClick={() => void handlePlayListeningAudio(currentStep.data.audioText || "你好")}
                    aria-label={text.listenAudio}
                  >
                    <Volume2 size={32} />
                    <span>聽發音「{currentStep.data.audioText || "你好"}」</span>
                  </button>
                </div>
              </div>

              {renderScaffold("greeting")}

              <p className="interaction-prompt">{currentStep.data.prompt}</p>

              <div className="choices-vertical-list" role="radiogroup">
                {currentStep.data.choices?.map((choice) => {
                  const isSelected = selectedChoices["context"] === choice.id;
                  return (
                    <button
                      key={choice.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className={`choice-card-btn ${isSelected ? "selected" : ""}`}
                      onClick={() => {
                        setSelectedChoices((prev) => ({ ...prev, context: choice.id }));
                        void handlePlayListeningAudio(currentStep.data.audioText || "你好");
                      }}
                    >
                      <span className="choice-label">{choice.label}</span>
                      {choice.subLabel && <span className="choice-sublabel">{choice.subLabel}</span>}
                      {isSelected && choice.isCorrect && <span className="feedback-badge positive">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: Dialogue in Context */}
          {currentStep.stepKey === "dialogue" && (
            <div className="step-body step-dialogue-body">
              <div className="dialogue-lines-container">
                {currentStep.data.dialogueRows?.map((row) => (
                  <div key={row.id} className="dialogue-line-card">
                    <div className="dialogue-speaker-avatar">{row.speaker ? row.speaker[0] : "話"}</div>
                    <div className="dialogue-bubble">
                      <div className="speaker-name">{row.speaker}</div>
                      <div className="dialogue-chinese-text">
                        <span className="char-text">{row.text}</span>
                        {row.zhuyin && <span className="phonetic-zhuyin">{row.zhuyin}</span>}
                        {row.pinyin && <span className="phonetic-pinyin">{row.pinyin}</span>}
                      </div>
                      <button
                        type="button"
                        className="button button-text dialogue-audio-btn"
                        onClick={() => playAudio(row.text)}
                        aria-label={`播放 ${row.speaker} 的語音`}
                      >
                        <Volume2 size={18} />
                        <span>聽這句</span>
                      </button>
                      {renderScaffold(row.scaffoldKey)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: Vocabulary */}
          {currentStep.stepKey === "vocabulary" && (() => {
            const vocabTask = session?.tasks?.find((t) => t.taskType === "VOCABULARY" || t.key === "vocabulary");
            const prompt = vocabTask?.taskData?.prompt || currentStep.data.prompt;
            const choices = vocabTask?.taskData?.choices || currentStep.data.choices;

            return (
              <div className="step-body step-vocab-body">
                <div className="vocab-highlight-card">
                  <div className="vocab-word-large">
                    <span className="vocab-hanzi">你好</span>
                    <span className="vocab-role-pill">{text.activeRole}</span>
                  </div>
                  <div className="vocab-phonetics-row">
                    <span className="pinyin-tag">nǐ hǎo</span>
                    <span className="zhuyin-tag">ㄋㄧˇ ㄏㄠˇ</span>
                    <button
                      type="button"
                      className="button button-icon-subtle"
                      onClick={() => playAudio("你好")}
                      aria-label="播放生詞發音"
                    >
                      <Volume2 size={20} />
                    </button>
                  </div>
                  <div className="vocab-example-sentence">
                    <p><strong>例句：</strong> 你好！我叫大衛。</p>
                  </div>
                  {renderScaffold("greeting")}
                </div>

                <p className="interaction-prompt">{prompt}</p>

                <div className="choices-vertical-list">
                  {choices?.map((choice: { id: string; label: string; isCorrect?: boolean }) => {
                    const isSelected = selectedChoices["vocab"] === choice.id;
                    const isCorrect = choice.id === "opt-hello" || choice.id === "greeting" || choice.isCorrect;
                    return (
                      <button
                        key={choice.id}
                        type="button"
                        className={`choice-card-btn ${isSelected ? "selected" : ""}`}
                        onClick={async () => {
                          setSelectedChoices((prev) => ({ ...prev, vocab: choice.id }));
                          await submitBackendTaskAnswer((t) => t.taskType === "VOCABULARY" || t.key === "vocabulary", choice.id);
                        }}
                      >
                        <span className="choice-label">{choice.label}</span>
                        {isSelected && isCorrect && <span className="feedback-badge positive">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* STEP 4: Characters */}
          {currentStep.stepKey === "characters" && (() => {
            const charObj = pkg.characters[activeCharIndex];
            const charTask = session?.tasks?.find(
              (t) => (t.taskType === "RECOGNITION" || t.taskType === "MINI_CHECK" || t.key.startsWith("recognition-")) &&
                     (t.key === `recognition-${activeCharIndex + 1}` || t.itemId === charObj?.char)
            );
            const prompt = charTask?.taskData?.prompt || currentStep.data.recognitionCheck?.prompt || "聽一聽發音，選出聽到的字：";
            const audioText = charTask?.taskData?.audioText || charObj?.char || "你";
            const choices = charTask?.taskData?.choices || (
              activeCharIndex === 0
                ? [{ id: "opt-ni", label: "你", isCorrect: true }, { id: "opt-hao", label: "好", isCorrect: false }]
                : [{ id: "opt-ni", label: "你", isCorrect: false }, { id: "opt-hao", label: "好", isCorrect: true }]
            );

            return (
              <div className="step-body step-characters-body">
                <div className="character-tabs-row" role="tablist">
                  {pkg.characters.map((c, idx) => {
                    const taskForChar = session?.tasks?.find(
                      (t) => (t.taskType === "RECOGNITION" || t.taskType === "MINI_CHECK" || t.key.startsWith("recognition-")) &&
                             (t.key === `recognition-${idx + 1}` || t.itemId === c.char)
                    );
                    const isDone = taskForChar?.state === "COMPLETED" || Boolean(selectedChoices[`recog-${idx}`]);
                    return (
                      <button
                        key={c.char}
                        type="button"
                        role="tab"
                        aria-selected={activeCharIndex === idx}
                        className={`character-tab-btn ${activeCharIndex === idx ? "active" : ""} ${isDone ? "is-done" : ""}`}
                        onClick={() => setActiveCharIndex(idx)}
                      >
                        <span className="tab-char">{c.char}</span>
                        <span className="tab-pinyin">{c.pronunciation.pinyin}</span>
                        {isDone && <span className="tab-done-indicator">✓</span>}
                      </button>
                    );
                  })}
                </div>

                {charObj && (
                  <div className="character-detail-display">
                    <div className="char-hero-box">
                      <span className="large-char-display">{charObj.char}</span>
                      <button
                        type="button"
                        className="button button-text"
                        onClick={() => playAudio(charObj.char)}
                        aria-label={`播放「${charObj.char}」的發音`}
                      >
                        <Volume2 size={20} />
                        <span>{charObj.pronunciation.pinyin} / {charObj.pronunciation.zhuyin}</span>
                      </button>
                    </div>

                    <div className="char-info-grid">
                      <div className="info-cell">
                        <span className="info-cell-label">部首</span>
                        <strong className="info-cell-val">{charObj.radical} 部</strong>
                      </div>
                      <div className="info-cell">
                        <span className="info-cell-label">筆畫</span>
                        <strong className="info-cell-val">{charObj.strokeCount} 畫</strong>
                      </div>
                      <div className="info-cell">
                        <span className="info-cell-label">字義</span>
                        <strong className="info-cell-val">{charObj.meaning.zh}</strong>
                      </div>
                    </div>

                    {renderScaffold(charObj.char === "你" ? "char_ni" : "char_hao")}
                  </div>
                )}

                {/* Recognition check */}
                <div className="recognition-mini-check">
                  <p className="interaction-prompt">{prompt}</p>
                  <button
                    type="button"
                    className="button button-secondary play-recog-audio-btn"
                    onClick={() => playAudio(audioText)}
                  >
                    <Volume2 size={18} />
                    <span>播放題目音檔「{audioText}」</span>
                  </button>
                  <div className="choices-horizontal-row">
                    {choices?.map((choice: { id: string; label: string; isCorrect?: boolean }) => {
                      const isSelected = selectedChoices[`recog-${activeCharIndex}`] === choice.id || selectedChoices["recog"] === choice.id;
                      const isCorrect = choice.id === (activeCharIndex === 0 ? "opt-ni" : "opt-hao") || choice.isCorrect;
                      return (
                        <button
                          key={choice.id}
                          type="button"
                          className={`char-choice-card ${isSelected ? "selected" : ""}`}
                          onClick={async () => {
                            setSelectedChoices((prev) => ({
                              ...prev,
                              recog: choice.id,
                              [`recog-${activeCharIndex}`]: choice.id,
                            }));
                            await submitBackendTaskAnswer(
                              (t) => t.id === charTask?.id || t.key === `recognition-${activeCharIndex + 1}`,
                              choice.id
                            );
                          }}
                        >
                          <span className="char-choice-text">{choice.label}</span>
                          {isSelected && isCorrect && <span className="feedback-badge positive">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* STEP 5: Sentence Pattern */}
          {currentStep.stepKey === "sentence_pattern" && (() => {
            const sentTask = session?.tasks?.find((t) => t.taskType === "SENTENCE_PATTERN" || t.key === "sentence-pattern");
            const prompt = sentTask?.taskData?.prompt || currentStep.data.prompt;
            const choices = sentTask?.taskData?.choices || currentStep.data.choices;

            return (
              <div className="step-body step-sentence-body">
                <div className="sentence-pattern-card">
                  <span className="pattern-badge">常用句型</span>
                  <h3 className="pattern-formula">你好！我叫 ___。</h3>
                  <p className="pattern-explanation">見面時打招呼並自我介紹名字的萬用句型。</p>
                  {renderScaffold("greeting_intro")}
                </div>

                <p className="interaction-prompt">{prompt}</p>

                <div className="choices-vertical-list">
                  {choices?.map((choice: { id: string; label: string; isCorrect?: boolean }) => {
                    const isSelected = selectedChoices["sentence"] === choice.id;
                    const isCorrect = choice.id === "opt-correct-order" || choice.id === "greeting" || choice.isCorrect;
                    return (
                      <button
                        key={choice.id}
                        type="button"
                        className={`choice-card-btn ${isSelected ? "selected" : ""}`}
                        onClick={async () => {
                          setSelectedChoices((prev) => ({ ...prev, sentence: choice.id }));
                          await submitBackendTaskAnswer((t) => t.taskType === "SENTENCE_PATTERN" || t.key === "sentence-pattern", choice.id);
                        }}
                      >
                        <span className="choice-label">{choice.label}</span>
                        {isSelected && isCorrect && <span className="feedback-badge positive">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* STEP 6: Speaking */}
          {currentStep.stepKey === "speaking" && (
            <div className="step-body step-speaking-body">
              <div className="speaking-prompt-box">
                <p className="speaking-instruction">
                  {currentStep.data.speakingPrompt?.instruction || "請對著麥克風說一次：「你好！」"}
                </p>
                <div className="speaking-target-phrase">「你好！」</div>
              </div>

              <div className="speaking-control-center">
                <button
                  type="button"
                  className={`mic-record-btn ${recording ? "is-recording" : ""} ${speakingAttempted ? "is-attempted" : ""}`}
                  onClick={handleRecordSpeaking}
                  aria-label={recording ? text.recordStop : text.recordStart}
                >
                  <Mic size={36} />
                </button>
                <p className="recording-status-label">
                  {recording ? text.recording : speakingAttempted ? text.speakingSaved : text.recordStart}
                </p>
                <p className="recording-privacy-note">
                  {text.speechNote}
                </p>
              </div>
            </div>
          )}

          {/* STEP 7: Writing */}
          {currentStep.stepKey === "writing" && (
            <div className="step-body step-writing-body">
              <div className="hanzi-writing-card">
                <div className="writing-canvas-frame" ref={canvasContainerRef} />
                <div className="writing-actions-row">
                  <button type="button" className="button button-secondary" onClick={animateStrokes}>
                    <RotateCcw size={16} />
                    <span>{text.showStroke}</span>
                  </button>
                  <button
                    type="button"
                    className="button button-text skip-writing-btn"
                    onClick={async () => {
                      const ok = await skipBackendTask((t) => t.taskType.startsWith("WRITING_") || t.key.startsWith("writing"));
                      if (ok) {
                        setWritingSkipped(true);
                        void handleNextStep();
                      }
                    }}
                  >
                    {text.skipWriting}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 8: Exit Ticket / Mini Check */}
          {currentStep.stepKey === "exit_ticket" && (
            <div className="step-body step-exit-ticket-body">
              <div className="exit-ticket-question-list">
                {currentStep.data.questions?.map((q, qIndex) => {
                  const selected = exitTicketAnswers[q.id];
                  return (
                    <div key={q.id} className="exit-ticket-item-card">
                      <div className="question-header">
                        <span className="q-badge">題目 {qIndex + 1}</span>
                        <span className="domain-sub-badge">{q.domain}</span>
                      </div>
                      <p className="q-prompt">{q.prompt}</p>

                      {q.audioText && (
                        <button
                          type="button"
                          className="button button-secondary q-audio-btn"
                          onClick={() => playAudio(q.audioText || "")}
                        >
                          <Volume2 size={16} />
                          <span>聽題目音檔</span>
                        </button>
                      )}

                      <div className="choices-vertical-list">
                        {q.choices.map((c) => {
                          const isPicked = selected === c.id;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              className={`choice-card-btn ${isPicked ? "selected" : ""}`}
                              onClick={() => setExitTicketAnswers((prev) => ({ ...prev, [q.id]: c.id }))}
                            >
                              <span className="choice-label">{c.label}</span>
                              {exitTicketSubmitted && c.isCorrect && <span className="feedback-badge positive">✓ 正確</span>}
                              {exitTicketSubmitted && isPicked && !c.isCorrect && <span className="feedback-badge negative">✗</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {!exitTicketSubmitted ? (
                <button
                  type="button"
                  className="button button-primary submit-exit-ticket-btn"
                  onClick={handleExitTicketSubmit}
                  disabled={
                    Object.keys(exitTicketAnswers).length !== (currentStep.data.questions?.length ?? 0)
                  }
                >
                  送出小挑戰答案
                </button>
              ) : (
                <div className="exit-ticket-feedback-banner">
                  {weakDomains.length === 0 ? (
                    <p className="feedback-text positive">
                      <Sparkles size={20} />
                      {mode === "FAST_TRACK" ? text.fastTrackPassed : text.correct}
                    </p>
                  ) : (
                    <p className="feedback-text warning">
                      {mode === "FAST_TRACK" ? text.fastTrackFailed : "已記錄作答結果，可繼續進行收尾結算。"}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 9: Wrap-up / Settlement */}
          {currentStep.stepKey === "wrap_up" && (
            <div className="step-body step-wrap-up-body">
              <div className="session-settlement-card">
                <div className="settlement-trophy-icon">
                  <Sparkles size={48} className="sparkle-gold" />
                </div>
                <h3 className="settlement-title">{text.sessionSummaryTitle}</h3>

                <div className="settlement-metrics-grid">
                  <div className="metric-row">
                    <span className="metric-label">{text.sessionCompletedLabel}</span>
                    <strong className="metric-value positive">是 (已獲得 10 顆星星 ⭐)</strong>
                  </div>

                  <div className="metric-row">
                    <span className="metric-label">{text.lessonPracticedLabel}</span>
                    <strong className="metric-value">{session?.curriculumContext?.stageTitle || pkg.curriculumSource.book} · {pkg.curriculumSource.lesson}《{session?.curriculumContext?.official?.title || pkg.curriculumSource.title}》</strong>
                  </div>

                  <div className="metric-row">
                    <span className="metric-label">{text.masteryStatusLabel}</span>
                    <strong className={`metric-value ${masteryStatus === "MASTERED" ? "positive" : "in-progress"}`}>
                      {masteryStatus === "MASTERED" ? text.masteredYes : text.masteredInProgress}
                    </strong>
                  </div>

                  <div className="metric-row">
                    <span className="metric-label">{text.nextReviewLabel}</span>
                    <strong className="metric-value">
                      {nextReviewDueAt ? `${nextReviewDueAt} (SRS)` : text.nextReviewTomorrow}
                    </strong>
                  </div>
                </div>

                <div className="settlement-disclaimer-box">
                  <p>{text.sessionNotice}</p>
                </div>
              </div>
            </div>
          )}

          {/* Step Navigation Controls */}
          <footer className="step-card-footer">
            {currentStepIndex > 0 && (
              <button
                type="button"
                className="button button-secondary"
                onClick={handlePrevStep}
              >
                {text.prevStep}
              </button>
            )}

            <div className="footer-right-action">
              {currentStepIndex < steps.length - 1 ? (
                <button
                  type="button"
                  className="button button-primary next-step-cta-btn"
                  onClick={handleNextStep}
                  disabled={
                    currentStep.stepKey === "exit_ticket" && !exitTicketSubmitted
                  }
                >
                  <span>{text.nextStep}</span>
                  <ChevronRight size={18} />
                </button>
              ) : (
                <button
                  type="button"
                  className="button button-primary finish-session-cta-btn"
                  onClick={handleCompleteSession}
                >
                  <CheckCircle2 size={18} />
                  <span>{text.finishLesson}</span>
                </button>
              )}
            </div>
          </footer>
        </article>
      )}
    </main>
  );
}
