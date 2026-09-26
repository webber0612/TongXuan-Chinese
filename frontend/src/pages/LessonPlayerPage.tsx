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
  buildAuthoritativeLearnSteps,
  getLessonPackage,
  getStepsForMode,
  getScaffoldText,
  selectReviewTasksForDueItems,
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

export interface TaskWriteResult {
  persisted: boolean;
  deduped: boolean;
  taskId?: string;
  taskState?: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "DEFERRED" | "UNKNOWN";
  attemptCount?: number;
  failureCount?: number;
  completedAt?: string | null;
}

export function optionalWritingSkipResult(
  task: { id?: string; state?: unknown; attemptCount?: number; failureCount?: number; completedAt?: string | null },
  deduped: boolean
): TaskWriteResult {
  const taskState = task.state === "COMPLETED" || task.state === "DEFERRED" ? task.state : "UNKNOWN";
  return {
    persisted: taskState !== "UNKNOWN",
    deduped,
    taskId: task.id,
    taskState,
    attemptCount: task.attemptCount,
    failureCount: task.failureCount,
    completedAt: task.completedAt ?? null,
  };
}

export function isValidBackendTimestamp(val: unknown): boolean {
  if (typeof val !== "string" || !val.trim()) return false;
  const isoPattern = /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
  if (!isoPattern.test(val)) return false;

  const parsed = Date.parse(val);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return false;

  const dateMatch = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!dateMatch) return false;
  const year = parseInt(dateMatch[1], 10);
  const month = parseInt(dateMatch[2], 10);
  const day = parseInt(dateMatch[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const dateObj = new Date(Date.UTC(year, month - 1, day));
  if (
    dateObj.getUTCFullYear() !== year ||
    dateObj.getUTCMonth() !== month - 1 ||
    dateObj.getUTCDate() !== day
  ) {
    return false;
  }

  const timeMatch = val.match(/[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (timeMatch) {
    const hour = parseInt(timeMatch[1], 10);
    const minute = parseInt(timeMatch[2], 10);
    const second = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
      return false;
    }
  }

  return true;
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
    reviewCompletedTitle: "本輪複習完成",
    reviewCompletedNotice: "到期項目已記錄。原本的課程進度會保留在今日學習中。",
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
    noDueReviews: "目前沒有到期的複習項目",
    noDueReviewsDesc: "太棒了！所有進度都已掌握，暫時沒有需要檢索複習的生字或詞彙。",
    noDueReviewsNotice: "系統依據 SRS 遺忘曲線管理複習進度。當有生字到期時，會自動出現在今日複習中。",
    backToToday: "返回今日學習",
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
    reviewCompletedTitle: "本轮复习完成",
    reviewCompletedNotice: "到期项目已记录。原本的课程进度会保留在今日学习中。",
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
    noDueReviews: "目前没有到期的复习项目",
    noDueReviewsDesc: "太棒了！所有进度都已掌握，暂时没有需要检索复习的生字或词汇。",
    noDueReviewsNotice: "系统依据 SRS 遗忘曲线管理复习进度。当有生字到期时，会自动出现在今日复习中。",
    backToToday: "返回今日学习",
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
    reviewCompletedTitle: "Review Complete",
    reviewCompletedNotice: "Your due reviews are recorded. Your current lesson progress remains in Today's Learning.",
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
    noDueReviews: "No due reviews right now",
    noDueReviewsDesc: "Great job! All items are up to date. There are no due SRS retrieval items.",
    noDueReviewsNotice: "The system schedules retrieval practice according to the SRS memory curve. Due items will automatically appear here.",
    backToToday: "Back to Today's Learning",
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
    reviewCompletedTitle: "復習完了",
    reviewCompletedNotice: "期限の来た項目を記録しました。今日の学習の続きは保持されています。",
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
    noDueReviews: "現在、復習期日の項目はありません",
    noDueReviewsDesc: "素晴らしい！現在復習が必要な項目はありません。",
    noDueReviewsNotice: "SRS間隔に基づいて復習がスケジュールされます。",
    backToToday: "今日の学習に戻る",
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
    reviewCompletedTitle: "복습 완료",
    reviewCompletedNotice: "복습 항목을 기록했어요. 오늘 학습의 진행 상태는 그대로 유지됩니다.",
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
    noDueReviews: "현재 복습할 항목이 없습니다",
    noDueReviewsDesc: "훌륭합니다! 모든 항목이 최신 상태입니다.",
    noDueReviewsNotice: "SRS 주기에 따라 복습 항목이 자동으로 표시됩니다.",
    backToToday: "오늘의 학습으로 돌아가기",
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
    reviewCompletedTitle: "Repaso completado",
    reviewCompletedNotice: "Los repasos pendientes quedaron registrados. El progreso de la lección de hoy se conserva.",
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
    noDueReviews: "No hay repasos pendientes en este momento",
    noDueReviewsDesc: "¡Excelente! Todo está al día.",
    noDueReviewsNotice: "El sistema programa repasos espaciados (SRS) automáticamente.",
    backToToday: "Volver al aprendizaje de hoy",
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
  const { language, t } = useLocale();
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
  const [repairTaskIds, setRepairTaskIds] = useState<string[]>([]);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [activeCharIndex, setActiveCharIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingRepairResume, setPendingRepairResume] = useState<{
    sessionId: string;
    lessonId: string;
    weakDomains: string[];
  } | null>(null);

  // Authoritative backend session state
  const [session, setSession] = useState<{
    id: string;
    sessionId?: string;
    childId?: number;
    status: string;
    lessonId?: string;
    masteryStatus?: string | null;
    targetMinutes?: number;
    curriculumContext?: { stageId?: string; stageTitle?: string; lessonId?: string; lessonMasteredBeforeSession?: boolean; official?: { title?: string; objectiveSummary?: string } };
    tasks?: Array<{
      id: string;
      key: string;
      taskType: string;
      sourceQueue: string;
      lessonId: string;
      state: string;
      required?: boolean;
      skillDomain?: string | null;
      itemId?: string;
      taskData?: any;
      attemptCount?: number;
      failureCount?: number;
      completedAt?: string | null;
    }>;
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

  const [dailyQueueDueItems, setDailyQueueDueItems] = useState<any[]>([]);
  const [dailyQueueStatus, setDailyQueueStatus] = useState<"IDLE" | "SUCCESS" | "ERROR">("IDLE");
  const [dailyQueueZeroDue, setDailyQueueZeroDue] = useState<boolean>(false);
  const [reviewSessionTasks, setReviewSessionTasks] = useState<any[]>([]);

  // Canonical lesson ID resolution
  const resolvedLessonId = session?.curriculumContext?.lessonId || session?.lessonId || lessonId || "book1-l01";
  const pkg: LessonPackage | null = useMemo(() => getLessonPackage(resolvedLessonId), [resolvedLessonId]);

  const authoritativeLearnPlan = useMemo(
    () => mode === "LEARN" && activeChildId && pkg
      ? buildAuthoritativeLearnSteps(pkg, session?.tasks, session?.curriculumContext?.lessonMasteredBeforeSession)
      : null,
    [mode, activeChildId, pkg, session?.tasks, session?.curriculumContext?.lessonMasteredBeforeSession],
  );

  // Authoritative due review items extraction: strictly from executable session review tasks
  const authoritativeReviewTasks = useMemo(() => {
    if (mode !== "REVIEW" || !pkg || dailyQueueStatus !== "SUCCESS") return null;
    const currentTasks = selectReviewTasksForDueItems(session?.tasks, dailyQueueDueItems, pkg, resolvedLessonId);
    if (!currentTasks) return null;
    if (reviewSessionTasks.length === 0) return currentTasks;

    const expectedIds = reviewSessionTasks.map((task) => task.id);
    if (expectedIds.some((id) => typeof id !== "string" || !id) || new Set(expectedIds).size !== expectedIds.length) return null;
    if (expectedIds.length !== currentTasks.length || !expectedIds.every((id) => currentTasks.some((task) => task.id === id))) return null;
    return currentTasks;
  }, [mode, reviewSessionTasks, session?.tasks, dailyQueueDueItems, dailyQueueStatus, pkg, resolvedLessonId]);
  const authoritativeDueItems = authoritativeReviewTasks ?? [];

  const steps: LessonStepDefinition[] = useMemo(() => {
    if (!pkg) return [];
    if (mode === "LEARN" && activeChildId) return authoritativeLearnPlan?.steps ?? [];
    return getStepsForMode(pkg, mode, weakDomains, authoritativeDueItems, mode === "REPAIR" ? session?.tasks : undefined, mode === "REPAIR" ? repairTaskIds : undefined);
  }, [pkg, mode, activeChildId, authoritativeLearnPlan, weakDomains, authoritativeDueItems, session?.tasks, repairTaskIds]);

  const currentStep = steps[currentStepIndex] ?? null;
  const learnPlanValid = !activeChildId || mode !== "LEARN" || authoritativeLearnPlan?.valid === true;
  const learnSessionReady = mode !== "LEARN" || !activeChildId || (session?.status === "IN_PROGRESS" && learnPlanValid);
  const repairSessionReady = mode !== "REPAIR" || !activeChildId || (
    session?.status === "IN_PROGRESS" && repairTaskIds.length > 0 && new Set(repairTaskIds).size === repairTaskIds.length
  );
  const playerSessionReady = learnSessionReady && repairSessionReady && pendingRepairResume === null;

  useEffect(() => {
    if (mode === "LEARN" && activeChildId && session?.status === "IN_PROGRESS" && !learnPlanValid) {
      setError(text.taskFailed);
    }
  }, [mode, activeChildId, session?.status, learnPlanValid, text.taskFailed]);

  useEffect(() => {
    if (mode === "REPAIR" && activeChildId && !busy && session?.status === "IN_PROGRESS" && steps.length === 0) {
      setError(text.taskFailed);
    }
  }, [mode, activeChildId, busy, session?.status, steps.length, text.taskFailed]);

  useEffect(() => {
    if (mode === "REVIEW" && !busy && dailyQueueStatus === "SUCCESS" && session && pkg && authoritativeReviewTasks === null) {
      setError(text.taskFailed);
    }
  }, [mode, busy, dailyQueueStatus, session, pkg, authoritativeReviewTasks, text.taskFailed]);

  const handleCompleteReview = () => {
    if (!activeChildId) {
      onBack();
      return;
    }
    const currentSess = sessionRef.current;
    const expectedIds = reviewSessionTasks.map((task) => task.id).filter((id): id is string => typeof id === "string" && id.length > 0);
    if (!currentSess?.id || expectedIds.length === 0 || new Set(expectedIds).size !== expectedIds.length) {
      setError(text.taskFailed);
      return;
    }
    const exactTasks = currentSess.tasks?.filter((task) => expectedIds.includes(task.id)) ?? [];
    // Reconciled REVIEW tasks are required and currently have no deferral policy; only exact authoritative COMPLETED tasks may end this round.
    if (exactTasks.length !== expectedIds.length || exactTasks.some((task) => task.sourceQueue !== "REVIEW" || task.state !== "COMPLETED")) {
      setError(text.taskFailed);
      return;
    }
    onBack();
  };

  const handleCompleteRepair = () => {
    if (!activeChildId) {
      onBack();
      return;
    }
    const currentSess = sessionRef.current;
    const ids = repairTaskIds;
    const exactTasks = currentSess?.tasks?.filter((task) => ids.includes(task.id)) ?? [];
    if (
      !currentSess?.id || currentSess.status !== "IN_PROGRESS" || ids.length === 0 ||
      new Set(ids).size !== ids.length || exactTasks.length !== ids.length ||
      exactTasks.some((task) => task.sourceQueue !== "CURRICULUM" || task.lessonId !== resolvedLessonId ||
        !task.skillDomain || !weakDomains.includes(task.skillDomain) ||
        (task.state !== "COMPLETED" && !(task.state === "DEFERRED" && task.taskType.startsWith("WRITING_"))))
    ) {
      setError(text.taskFailed);
      return;
    }
    // REPAIR reconciles exact existing curriculum tasks only. It must not settle
    // the parent LEARN session or trigger whole-session rewards/mastery.
    onBack();
  };

  const resumeFastTrackRepair = useCallback(async (target: { sessionId: string; lessonId: string; weakDomains: string[] }) => {
    if (!activeChildId) {
      setError(text.taskFailed);
      return false;
    }
    setBusy(true);
    setError(null);
    setPendingRepairResume(target);
    try {
      const resumed = await api<NonNullable<typeof session>>(
        `/api/children/${activeChildId}/learning-sessions`,
        {
          method: "POST",
          body: JSON.stringify({
            lesson_id: target.lessonId,
            expected_session_id: target.sessionId,
            target_minutes: 18,
            script_mode: locale === "zh-CN" ? "SIMPLIFIED" : "TRADITIONAL",
          }),
        },
      );
      const returnedId = resumed?.sessionId || resumed?.id;
      const returnedLessonId = resumed?.curriculumContext?.lessonId || resumed?.lessonId;
      if (
        !resumed || returnedId !== target.sessionId || resumed.id !== target.sessionId ||
        resumed.childId !== activeChildId ||
        returnedLessonId !== target.lessonId || resumed.status !== "IN_PROGRESS" ||
        !Array.isArray(resumed.tasks)
      ) throw new Error(text.taskFailed);

      sessionRef.current = resumed;
      setSession(resumed);
      setWeakDomains(target.weakDomains);
      const repairPkg = getLessonPackage(target.lessonId);
      const initialRepairSteps = repairPkg
        ? getStepsForMode(repairPkg, "REPAIR", target.weakDomains, [], resumed.tasks)
        : [];
      setRepairTaskIds(initialRepairSteps
        .filter((step) => step.stepKey !== "wrap_up")
        .flatMap((step) => step.data.taskId ? [step.data.taskId as string] : Array.isArray(step.data.taskIds) ? step.data.taskIds as string[] : []));
      setCurrentStepIndex(0);
      setNextReviewDueAt(null);
      setMasteryStatus(resumed.masteryStatus || "IN_PROGRESS");
      setPendingRepairResume(null);
      setMode("REPAIR");
      return true;
    } catch (err: any) {
      setError(err?.message || text.taskFailed);
      return false;
    } finally {
      setBusy(false);
    }
  }, [activeChildId, locale, text.taskFailed]);

  // Authoritative session initialization
  const initSession = useCallback(async () => {
    if (!activeChildId) return;
    setError(null);
    setBusy(true);
    if (mode === "REVIEW" || initialMode === "REVIEW") {
      setDailyQueueStatus("IDLE");
      setDailyQueueZeroDue(false);
      setDailyQueueDueItems([]);
      setReviewSessionTasks([]);
    }
    try {
      const current = await api<{
        id: string;
        status: string;
        lessonId?: string;
        masteryStatus?: string | null;
        targetMinutes?: number;
    curriculumContext?: { stageId?: string; stageTitle?: string; lessonId?: string; lessonMasteredBeforeSession?: boolean; official?: { title?: string; objectiveSummary?: string } };
        tasks?: Array<{ id: string; key: string; taskType: string; sourceQueue: string; lessonId: string; state: string; itemId?: string; taskData?: any }>;
      } | null>(
        `/api/children/${activeChildId}/learning-sessions/current`
      );
      let activeSession = current;
      if (current?.status === "PAUSED" && mode === "LEARN") {
        // LEARN task mutations require an active session. The start endpoint is also
        // the authoritative resume operation for an existing paused session.
        activeSession = await api<NonNullable<typeof current>>(
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
        if (!activeSession || activeSession.id !== current.id || activeSession.status !== "IN_PROGRESS") {
          sessionRef.current = null;
          setSession(null);
          setError(text.taskFailed);
          return;
        }
      }
      if (activeSession && (activeSession.status === "IN_PROGRESS" || (activeSession.status === "PAUSED" && mode !== "LEARN"))) {
        sessionRef.current = activeSession;
        setSession(activeSession);
        if (activeSession.masteryStatus) setMasteryStatus(activeSession.masteryStatus);
      } else {
        const started = await api<{
          id: string;
          status: string;
          lessonId?: string;
          masteryStatus?: string | null;
          targetMinutes?: number;
          curriculumContext?: { stageId?: string; stageTitle?: string; lessonId?: string; lessonMasteredBeforeSession?: boolean; official?: { title?: string; objectiveSummary?: string } };
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
        if (started && started.id) {
          sessionRef.current = started;
          setSession(started);
          if (started.masteryStatus) setMasteryStatus(started.masteryStatus);
        } else {
          sessionRef.current = null;
          setSession(null);
          setError(text.taskFailed);
        }
      }

      if (mode === "REVIEW" || initialMode === "REVIEW") {
        const tasksForDueItems = (s: typeof session, dueItems: unknown) => {
          if (!s) return null;
          const sessionLessonId = s.curriculumContext?.lessonId || s.lessonId || lessonId || "book1-l01";
          const reviewPkg = getLessonPackage(sessionLessonId);
          return reviewPkg ? selectReviewTasksForDueItems(s.tasks, dueItems, reviewPkg, sessionLessonId) : null;
        };

        try {
          const dq = await api<{
            review?: {
              sourceQueue?: string;
              dueCount?: number;
              items?: Array<{ id: string; character: string; lessonId: string; dueAt: string }>;
            };
          }>(`/api/children/${activeChildId}/learning-daily-queue`);

          if (
            !dq ||
            typeof dq !== "object" ||
            !dq.review ||
            dq.review.sourceQueue !== "REVIEW" ||
            typeof dq.review.dueCount !== "number" ||
            !Array.isArray(dq.review.items) ||
            dq.review.dueCount !== dq.review.items.length
          ) {
            setDailyQueueStatus("ERROR");
            setDailyQueueZeroDue(false);
            setError(text.taskFailed);
            return;
          } else {
            setDailyQueueStatus("SUCCESS");
            setDailyQueueDueItems(dq.review.items);

            if (dq.review.dueCount === 0 && dq.review.items.length === 0) {
              setDailyQueueZeroDue(true);
              setReviewSessionTasks([]);
            } else {
              setDailyQueueZeroDue(false);
              if (dq.review.items.length === 0) {
                setError(text.taskFailed);
                return;
              }
              let effectiveSession = sessionRef.current;
              let exactTasks = tasksForDueItems(effectiveSession, dq.review.items);
              if (!exactTasks) {
                try {
                  const sessionLessonId = effectiveSession?.curriculumContext?.lessonId || effectiveSession?.lessonId || lessonId || "book1-l01";
                  // The reconciliation endpoint is scoped to the active session's lesson.
                  // Out-of-scope due rows therefore remain unmatched and fail closed below.
                  if (dq.review.items.some((item) => item?.lessonId !== sessionLessonId)) {
                    setError(text.taskFailed);
                    return;
                  }
                  const targetSessionId = effectiveSession?.id || "current";
                  const reconciled = await api<typeof session>(
                    `/api/children/${activeChildId}/learning-sessions/${targetSessionId}/reconcile-reviews`,
                    {
                      method: "POST",
                      body: "{}",
                    }
                  );
                  if (reconciled && reconciled.id && reconciled.id === effectiveSession?.id) {
                    effectiveSession = reconciled;
                    sessionRef.current = reconciled;
                    setSession(reconciled);
                    if (reconciled.masteryStatus) setMasteryStatus(reconciled.masteryStatus);
                  } else {
                    setError(text.taskFailed);
                    return;
                  }
                } catch {
                  setError(text.taskFailed);
                  return;
                }
                exactTasks = tasksForDueItems(effectiveSession, dq.review.items);
              }

              if (!exactTasks || exactTasks.length !== dq.review.dueCount) {
                setError(text.taskFailed);
                return;
              }
              setReviewSessionTasks(exactTasks);
            }
          }
        } catch (err: any) {
          setDailyQueueStatus("ERROR");
          setDailyQueueZeroDue(false);
          setError(err?.message || text.taskFailed);
          return;
        }
      }
    } catch (err: any) {
      sessionRef.current = null;
      setSession(null);
      setError(err?.message || text.taskFailed);
    } finally {
      setBusy(false);
    }
  }, [activeChildId, lessonId, locale, mode, initialMode, text.taskFailed]);

  useEffect(() => {
    void initSession();
  }, [initSession]);

  // Backend task progression helpers with strict error surfacing and authoritative task state return
  const submitBackendTaskAnswer = async (
    matcher: (t: { id: string; key: string; taskType: string; state: string; sourceQueue?: string; itemId?: string; taskData?: any; attemptCount?: number; failureCount?: number; completedAt?: string | null }) => boolean,
    selectedOptionId?: string,
    answers?: Record<string, string>,
    assisted = false
  ): Promise<TaskWriteResult> => {
    const currentSess = sessionRef.current;
    if (!activeChildId || !currentSess?.id || !currentSess.tasks) {
      setError(text.taskFailed);
      return { persisted: false, deduped: false, taskState: "UNKNOWN" };
    }
    const matchingTask = currentSess.tasks.find((t) => matcher(t));
    if (!matchingTask) {
      setError(text.taskFailed);
      return { persisted: false, deduped: false, taskState: "UNKNOWN" };
    }
    if (matchingTask.state === "COMPLETED" || matchingTask.state === "DEFERRED") {
      return {
        persisted: true,
        deduped: true,
        taskId: matchingTask.id,
        taskState: matchingTask.state as any,
        attemptCount: matchingTask.attemptCount,
        failureCount: matchingTask.failureCount,
        completedAt: matchingTask.completedAt ?? null,
      };
    }
    const answersKey = JSON.stringify(answers ?? {});
    const recorded = submittedAnswersRef.current[matchingTask.id];
    if (recorded && recorded.optionId === (selectedOptionId || null) && recorded.answersKey === answersKey) {
      // Re-query latest authoritative state from sessionRef.current
      const latestTask = sessionRef.current?.tasks?.find((t) => t.id === matchingTask.id) ?? matchingTask;
      return {
        persisted: true,
        deduped: true,
        taskId: latestTask.id,
        taskState: latestTask.state as any,
        attemptCount: latestTask.attemptCount,
        failureCount: latestTask.failureCount,
        completedAt: latestTask.completedAt ?? null,
      };
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
      if (updated && updated.tasks) {
        sessionRef.current = updated;
        submittedAnswersRef.current[matchingTask.id] = {
          optionId: selectedOptionId || null,
          answersKey,
        };
        setSession(updated);
        if (updated.masteryStatus) setMasteryStatus(updated.masteryStatus);
        const postTask = updated.tasks.find((t) => t.id === matchingTask.id);
        if (!postTask) {
          setError(text.taskFailed);
          return {
            persisted: false,
            deduped: false,
            taskId: matchingTask.id,
            taskState: "UNKNOWN",
          };
        }
        return {
          persisted: true,
          deduped: false,
          taskId: postTask.id,
          taskState: (postTask.state ?? "IN_PROGRESS") as any,
          attemptCount: postTask.attemptCount,
          failureCount: postTask.failureCount,
          completedAt: postTask.completedAt ?? null,
        };
      }
      setError(text.taskFailed);
      return {
        persisted: false,
        deduped: false,
        taskId: matchingTask.id,
        taskState: "UNKNOWN",
      };
    } catch (err: any) {
      setError(err?.message || text.taskFailed);
      return {
        persisted: false,
        deduped: false,
        taskId: matchingTask.id,
        taskState: "UNKNOWN",
      };
    }
  };

  const submitBackendTaskEvidence = async (
    matcher: (t: { id: string; key: string; taskType: string; state: string; itemId?: string; taskData?: any; attemptCount?: number; failureCount?: number; completedAt?: string | null }) => boolean,
    evidenceRef: string,
    durationMs?: number
  ): Promise<TaskWriteResult> => {
    const currentSess = sessionRef.current;
    if (!activeChildId || !currentSess?.id || !currentSess.tasks) {
      setError(text.taskFailed);
      return { persisted: false, deduped: false, taskState: "UNKNOWN" };
    }
    const matchingTask = currentSess.tasks.find((t) => matcher(t));
    if (!matchingTask) {
      setError(text.taskFailed);
      return { persisted: false, deduped: false, taskState: "UNKNOWN" };
    }
    if (matchingTask.state === "COMPLETED" || matchingTask.state === "DEFERRED") {
      return {
        persisted: true,
        deduped: true,
        taskId: matchingTask.id,
        taskState: matchingTask.state as any,
        attemptCount: matchingTask.attemptCount,
        failureCount: matchingTask.failureCount,
        completedAt: matchingTask.completedAt ?? null,
      };
    }
    if (submittedEvidenceRef.current[matchingTask.id] === evidenceRef) {
      const latestTask = sessionRef.current?.tasks?.find((t) => t.id === matchingTask.id) ?? matchingTask;
      return {
        persisted: true,
        deduped: true,
        taskId: latestTask.id,
        taskState: latestTask.state as any,
        attemptCount: latestTask.attemptCount,
        failureCount: latestTask.failureCount,
        completedAt: latestTask.completedAt ?? null,
      };
    }
    try {
      setError(null);
      const updated = await api<typeof session>(
        `/api/children/${activeChildId}/learning-sessions/${currentSess.id}/tasks/${matchingTask.id}/evidence`,
        {
          method: "POST",
          body: JSON.stringify({
            evidence_ref: evidenceRef,
            ...(durationMs === undefined ? {} : { duration_ms: durationMs }),
          }),
        }
      );
      if (updated && updated.tasks) {
        sessionRef.current = updated;
        submittedEvidenceRef.current[matchingTask.id] = evidenceRef;
        setSession(updated);
        if (updated.masteryStatus) setMasteryStatus(updated.masteryStatus);
        const postTask = updated.tasks.find((t) => t.id === matchingTask.id);
        if (!postTask) {
          setError(text.taskFailed);
          return {
            persisted: false,
            deduped: false,
            taskId: matchingTask.id,
            taskState: "UNKNOWN",
          };
        }
        return {
          persisted: true,
          deduped: false,
          taskId: postTask.id,
          taskState: (postTask.state ?? "IN_PROGRESS") as any,
          attemptCount: postTask.attemptCount,
          failureCount: postTask.failureCount,
          completedAt: postTask.completedAt ?? null,
        };
      }
      setError(text.taskFailed);
      return {
        persisted: false,
        deduped: false,
        taskId: matchingTask.id,
        taskState: "UNKNOWN",
      };
    } catch (err: any) {
      setError(err?.message || text.taskFailed);
      return {
        persisted: false,
        deduped: false,
        taskId: matchingTask.id,
        taskState: "UNKNOWN",
      };
    }
  };

  const skipBackendTask = async (
    matcher: (t: { id: string; key: string; taskType: string; state: string; itemId?: string; taskData?: any; attemptCount?: number; failureCount?: number; completedAt?: string | null }) => boolean
  ): Promise<TaskWriteResult> => {
    const currentSess = sessionRef.current;
    if (!activeChildId || !currentSess?.id || !currentSess.tasks) {
      setError(text.taskFailed);
      return { persisted: false, deduped: false, taskState: "UNKNOWN" };
    }
    const matchingTask = currentSess.tasks.find((t) => matcher(t));
    if (!matchingTask) {
      setError(text.taskFailed);
      return { persisted: false, deduped: false, taskState: "UNKNOWN" };
    }
    if (matchingTask.state === "COMPLETED" || matchingTask.state === "DEFERRED") {
      return optionalWritingSkipResult(matchingTask, true);
    }
    if (submittedSkipsRef.current[matchingTask.id]) {
      const latestTask = sessionRef.current?.tasks?.find((t) => t.id === matchingTask.id) ?? matchingTask;
      const result = optionalWritingSkipResult(latestTask, true);
      if (!result.persisted) setError(text.taskFailed);
      return result;
    }
    try {
      setError(null);
      const updated = await api<typeof session>(
        `/api/children/${activeChildId}/learning-sessions/${currentSess.id}/tasks/${matchingTask.id}/skip`,
        {
          method: "POST",
        }
      );
      if (updated && updated.tasks) {
        sessionRef.current = updated;
        setSession(updated);
        if (updated.masteryStatus) setMasteryStatus(updated.masteryStatus);
        const postTask = updated.tasks.find((t) => t.id === matchingTask.id);
        if (!postTask) {
          setError(text.taskFailed);
          return {
            persisted: false,
            deduped: false,
            taskId: matchingTask.id,
            taskState: "UNKNOWN",
          };
        }
        const result = optionalWritingSkipResult(postTask, false);
        if (result.persisted) {
          submittedSkipsRef.current[matchingTask.id] = true;
        } else {
          setError(text.taskFailed);
        }
        return result;
      }
      setError(text.taskFailed);
      return {
        persisted: false,
        deduped: false,
        taskId: matchingTask.id,
        taskState: "UNKNOWN",
      };
    } catch (err: any) {
      setError(err?.message || text.taskFailed);
      return {
        persisted: false,
        deduped: false,
        taskId: matchingTask.id,
        taskState: "UNKNOWN",
      };
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
  const handlePlayListeningAudio = async (textToPlay: string, exactTaskId?: string): Promise<boolean> => {
    playAudio(textToPlay);
    if (!activeChildId) return true;
    const currentSess = sessionRef.current;
    if (!currentSess?.id || !currentSess.tasks || currentSess.tasks.length === 0) {
      setError(text.taskFailed);
      return false;
    }
    const listenTask = currentSess.tasks.find((t) => exactTaskId
      ? t.id === exactTaskId
      : (t.taskType === "LISTENING" || t.key === "listen"));
    if (!listenTask) {
      setError(text.taskFailed);
      return false;
    }
    if (listenTask.state === "COMPLETED" || listenTask.state === "DEFERRED") {
      return true;
    }
    if (listenTask.itemId) {
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
            const writeResult = await submitBackendTaskEvidence(
              (t) => t.id === listenTask.id || t.taskType === "LISTENING" || t.key === "listen",
              startRes.id
            );
            return writeResult.taskState === "COMPLETED" || writeResult.taskState === "DEFERRED";
          }
        }
        setError(text.taskFailed);
        return false;
      } catch (err: any) {
        setError(err?.message || text.taskFailed);
        return false;
      }
    }
    setError(text.taskFailed);
    return false;
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
      const char = currentStep?.data.character || pkg?.characters[activeCharIndex]?.char || "你";
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
      const char = currentStep?.data.character || pkg.characters[activeCharIndex]?.char || "你";
      const currentSess = sessionRef.current;
      const writingTask = currentSess?.tasks?.find((t) => currentStep?.data.taskId
        ? t.id === currentStep.data.taskId
        : t.taskType.startsWith("WRITING_") || t.key.startsWith("writing"));
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
        await submitBackendTaskEvidence((t) => currentStep?.data.taskId
          ? t.id === currentStep.data.taskId
          : t.taskType.startsWith("WRITING_") || t.key.startsWith("writing"), (writingRes.id || writingRes.attempt_id)!);
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
    setRepairTaskIds([]);
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

    if (mode === "REPAIR") {
      if (pendingRepairResume || !repairSessionReady) {
        setError(text.taskFailed);
        return;
      }
      const currentSess = sessionRef.current;
      if (!currentSess?.id || currentSess.status !== "IN_PROGRESS") {
        setError(text.taskFailed);
        return;
      }
      const ids = currentStep.data.taskId
        ? [currentStep.data.taskId as string]
        : Array.isArray(currentStep.data.taskIds) ? currentStep.data.taskIds as string[] : [];
      if (currentStep.stepKey !== "wrap_up") {
        const exactTasks = currentSess.tasks?.filter((task) => ids.includes(task.id)) ?? [];
        if (!ids.length || exactTasks.length !== ids.length || exactTasks.some((task) =>
          task.sourceQueue !== "CURRICULUM" || task.lessonId !== resolvedLessonId ||
          !task.skillDomain || !weakDomains.includes(task.skillDomain) ||
          (task.state !== "PENDING" && task.state !== "IN_PROGRESS" && task.state !== "COMPLETED" && task.state !== "DEFERRED")
        )) {
          setError(text.taskFailed);
          return;
        }
      }
    }

    if (activeChildId) {
      const currentSess = sessionRef.current;
      if (!currentSess || !currentSess.id) {
        setError(text.taskFailed);
        return;
      }
      if (mode === "LEARN" && currentSess.status !== "IN_PROGRESS") {
        setError(text.taskFailed);
        return;
      }
      if (mode === "LEARN" && !learnPlanValid) {
        setError(text.taskFailed);
        return;
      }
    }

    // 1. Context step: ensure listening task is completed
    if (currentStep.stepKey === "context" && activeChildId) {
      const currentSess = sessionRef.current;
      if (!currentSess?.tasks) {
        setError(text.taskFailed);
        return;
      }
      const listenTask = currentSess.tasks.find((t) => currentStep.data.taskId
        ? t.id === currentStep.data.taskId
        : (t.taskType === "LISTENING" || t.key === "listen"));
      if (!listenTask) {
        setError(text.taskFailed);
        return;
      }
      if (listenTask.state !== "COMPLETED" && listenTask.state !== "DEFERRED") {
        const ok = await handlePlayListeningAudio(currentStep.data.audioText || "你好", listenTask.id);
        if (!ok) {
          setError(text.taskFailed);
          return;
        }
      }
      const postListenTask = sessionRef.current?.tasks?.find((t) => t.id === listenTask.id);
      if (!postListenTask || (postListenTask.state !== "COMPLETED" && postListenTask.state !== "DEFERRED")) {
        setError(text.taskFailed);
        return;
      }
    }

    // 2. Vocabulary step: ensure vocabulary choice was made and task is COMPLETED / DEFERRED
    if (currentStep.stepKey === "vocabulary") {
      const selected = selectedChoices["vocab"];
      if (!selected) {
        setError(text.pleaseAnswerQuestion);
        return;
      }
      if (activeChildId) {
        const sessAfterVocab = sessionRef.current;
        if (!sessAfterVocab || !sessAfterVocab.id || !sessAfterVocab.tasks) {
          setError(text.taskFailed);
          return;
        }
        const vocabTask = sessAfterVocab.tasks.find((t) => currentStep.data.taskId
          ? t.id === currentStep.data.taskId
          : (t.taskType === "VOCABULARY" || t.key === "vocabulary"));
        if (!vocabTask) {
          setError(text.taskFailed);
          return;
        }
        if (vocabTask.state !== "COMPLETED" && vocabTask.state !== "DEFERRED") {
          const res = await submitBackendTaskAnswer((t) => t.id === vocabTask.id, selected);
          if (res.taskState !== "COMPLETED" && res.taskState !== "DEFERRED") {
            setError(text.taskFailed);
            return;
          }
        }
        const postVocabTask = sessionRef.current?.tasks?.find((t) => t.id === vocabTask.id);
        if (!postVocabTask || (postVocabTask.state !== "COMPLETED" && postVocabTask.state !== "DEFERRED")) {
          setError(text.taskFailed);
          return;
        }
      }
    }

    // 3. Characters step: ensure recognition tasks are completed authoritatively
    if (currentStep.stepKey === "characters") {
      const isReviewMode = mode === "REVIEW";
      const dueChar = currentStep.data?.dueCharacter;
      const charObj = currentStep.data?.charObj || (isReviewMode
        ? (pkg.characters.find((c) => c.char === dueChar) || { char: dueChar || "你" })
        : pkg.characters[activeCharIndex]);
      const exactTaskId = currentStep.data?.taskId || currentStep.data?.dueItem?.id;
      const reviewChoiceKey = `recog-rev-${exactTaskId || charObj?.char}`;
      const currentAnswer = isReviewMode
        ? (selectedChoices[reviewChoiceKey] || (exactTaskId ? selectedChoices[`recog-${exactTaskId}`] : selectedChoices["recog"]))
        : (exactTaskId ? selectedChoices[`recog-${exactTaskId}`] : selectedChoices[`recog-${activeCharIndex}`]);

      if (!currentAnswer) {
        setError(text.pleaseAnswerQuestion);
        return;
      }

      if (activeChildId) {
        const currentSessChar = sessionRef.current;
        if (!currentSessChar || !currentSessChar.id || !currentSessChar.tasks) {
          setError(text.taskFailed);
          return;
        }

        const charTask = exactTaskId
          ? currentSessChar.tasks.find((t) => t.id === exactTaskId)
          : isReviewMode
          ? null
          : currentSessChar.tasks.find(
              (t) => (t.taskType === "RECOGNITION" || t.taskType === "MINI_CHECK" || t.key.startsWith("recognition-")) &&
                     (t.key === `recognition-${activeCharIndex + 1}` || (charObj && t.itemId === charObj.char)) &&
                     t.key !== "mini-check-reflection"
            );

        if (!charTask) {
          setError(text.taskFailed);
          return; // Char task missing -> fail closed, block advance!
        }

        if (charTask.state !== "COMPLETED" && charTask.state !== "DEFERRED") {
          const res = await submitBackendTaskAnswer((t) => t.id === charTask.id, currentAnswer);
          if (res.taskState !== "COMPLETED" && res.taskState !== "DEFERRED") {
            setError(text.taskFailed);
            return;
          }
        }
        const postCharTask = sessionRef.current?.tasks?.find((t) => t.id === charTask.id);
        if (!postCharTask || (postCharTask.state !== "COMPLETED" && postCharTask.state !== "DEFERRED")) {
          setError(text.taskFailed);
          return; // Remain on current character tab
        }
      }

      // In LEARN mode, if there are more characters, advance tab
      if (!isReviewMode && !exactTaskId && activeCharIndex < pkg.characters.length - 1) {
        setActiveCharIndex((prev) => prev + 1);
        setError(null);
        return;
      }

      // If on the last character tab in LEARN mode, ensure ALL recognition tasks are COMPLETED / DEFERRED before advancing step
      if (!isReviewMode && activeChildId && !exactTaskId) {
        const sessAfterRecog = sessionRef.current;
        if (!sessAfterRecog || !sessAfterRecog.id || !sessAfterRecog.tasks) {
          setError(text.taskFailed);
          return;
        }
        const pendingRecog = sessAfterRecog.tasks.filter(
          (t) => (t.taskType === "RECOGNITION" || t.taskType === "REVIEW_RECOGNITION" || t.taskType === "MINI_CHECK" || t.key.startsWith("recognition-") || t.key.startsWith("review-")) &&
                 t.state !== "COMPLETED" && t.state !== "DEFERRED" && t.key !== "mini-check-reflection"
        );
        if (pendingRecog.length > 0) {
          setError(text.taskFailed);
          return;
        }
      }
    }

    // 4. Sentence Pattern step: ensure sentence-pattern choice was made and task is COMPLETED / DEFERRED
    if (currentStep.stepKey === "sentence_pattern") {
      const selected = selectedChoices["sentence"];
      if (!selected) {
        setError(text.pleaseAnswerQuestion);
        return;
      }
      if (activeChildId) {
        const sessAfterSent = sessionRef.current;
        if (!sessAfterSent || !sessAfterSent.id || !sessAfterSent.tasks) {
          setError(text.taskFailed);
          return;
        }
        const sentTask = sessAfterSent.tasks.find((t) => currentStep.data.taskId
          ? t.id === currentStep.data.taskId
          : (t.taskType === "SENTENCE_PATTERN" || t.key === "sentence-pattern"));
        if (!sentTask) {
          setError(text.taskFailed);
          return;
        }
        if (sentTask.state !== "COMPLETED" && sentTask.state !== "DEFERRED") {
          const res = await submitBackendTaskAnswer((t) => t.id === sentTask.id, selected);
          if (res.taskState !== "COMPLETED" && res.taskState !== "DEFERRED") {
            setError(text.taskFailed);
            return;
          }
        }
        const postSentTask = sessionRef.current?.tasks?.find((t) => t.id === sentTask.id);
        if (!postSentTask || (postSentTask.state !== "COMPLETED" && postSentTask.state !== "DEFERRED")) {
          setError(text.taskFailed);
          return;
        }
      }
    }

    // 5. Speaking step: ensure speaking attempts are completed
    if (currentStep.stepKey === "speaking") {
      const sessAfterSpeaking = sessionRef.current;
      const stepTaskIds: string[] = currentStep.data.taskIds ?? [];
      const speakingTasks = (sessAfterSpeaking?.tasks ?? []).filter((t) => stepTaskIds.length
        ? stepTaskIds.includes(t.id)
        : t.taskType === "SPEAKING_ATTEMPT" || t.taskType === "PRONUNCIATION_ATTEMPT" || t.key === "speaking" || t.key === "pronunciation");
      const allCompleted = speakingTasks.length > 0 && speakingTasks.every((t) => t.state === "COMPLETED" || t.state === "DEFERRED");
      if (!allCompleted) {
        setError(text.taskFailed);
        return;
      }
      if (activeChildId) {
        if (!sessAfterSpeaking || !sessAfterSpeaking.id || !sessAfterSpeaking.tasks) {
          setError(text.taskFailed);
          return;
        }
      }
    }

    // 6. Writing step: if writing is not completed, and user is advancing, skip optional writing
    if (currentStep.stepKey === "writing" && activeChildId) {
      const sessAfterWriting = sessionRef.current;
      if (!sessAfterWriting || !sessAfterWriting.id || !sessAfterWriting.tasks) {
        setError(text.taskFailed);
        return;
      }
      const writingTask = sessAfterWriting.tasks.find((t) => (currentStep.data.taskId
        ? t.id === currentStep.data.taskId
        : t.taskType.startsWith("WRITING_")) && t.state !== "COMPLETED" && t.state !== "DEFERRED");
      if (writingTask) {
        const skipRes = await skipBackendTask((t) => t.id === writingTask.id);
        if (!skipRes.persisted || (skipRes.taskState !== "COMPLETED" && skipRes.taskState !== "DEFERRED")) {
          setError(text.taskFailed);
          return;
        }
        const postWritingTask = sessionRef.current?.tasks?.find((t) => t.id === writingTask.id);
        if (!postWritingTask || (postWritingTask.state !== "COMPLETED" && postWritingTask.state !== "DEFERRED")) {
          setError(text.taskFailed);
          return;
        }
      }
    }

    // 7. Exit Ticket step: ensure submitted before advancing
    if (currentStep.stepKey === "exit_ticket") {
      if (!exitTicketSubmitted) {
        setError(text.pleaseAnswerQuestion);
        return;
      }
      if (mode === "LEARN" && activeChildId && currentStep.data.taskId) {
        const task = sessionRef.current?.tasks?.find((candidate) => candidate.id === currentStep.data.taskId);
        if (!task || (task.state !== "COMPLETED" && task.state !== "DEFERRED")) {
          setError(text.taskFailed);
          return;
        }
      } else if (mode === "LEARN" && activeChildId) {
        const sessAfterTicket = sessionRef.current;
        if (!sessAfterTicket || !sessAfterTicket.id || !sessAfterTicket.tasks) {
          setError(text.taskFailed);
          return;
        }
        const refTask = sessAfterTicket.tasks.find(
          (t) => (t.key === "mini-check-reflection" || (t.taskType === "MINI_CHECK" && t.taskData?.mode === "reflection"))
        );
        if (!refTask) {
          setError(text.taskFailed);
          return;
        }
        if (refTask.state !== "COMPLETED" && refTask.state !== "DEFERRED") {
          const res = await submitBackendTaskAnswer((t) => t.id === refTask.id, "practiced");
          if (res.taskState !== "COMPLETED" && res.taskState !== "DEFERRED") {
            setError(text.taskFailed);
            return;
          }
        }
        const postRefTask = sessionRef.current?.tasks?.find((t) => t.id === refTask.id);
        if (!postRefTask || (postRefTask.state !== "COMPLETED" && postRefTask.state !== "DEFERRED")) {
          setError(text.taskFailed);
          return;
        }
      }
    }

    if (currentStep.stepKey === "mini_check" && activeChildId) {
      const taskId = currentStep.data.taskId;
      const task = sessionRef.current?.tasks?.find((candidate) => candidate.id === taskId);
      if (!taskId || !task || (task.state !== "COMPLETED" && task.state !== "DEFERRED")) {
        setError(text.taskFailed);
        return;
      }
    }

    if (mode === "REPAIR" && activeChildId && currentStep.stepKey !== "wrap_up") {
      const ids = currentStep.data.taskId
        ? [currentStep.data.taskId as string]
        : Array.isArray(currentStep.data.taskIds) ? currentStep.data.taskIds as string[] : [];
      const exactTasks = sessionRef.current?.tasks?.filter((task) => ids.includes(task.id)) ?? [];
      if (!ids.length || exactTasks.length !== ids.length || exactTasks.some((task) =>
        task.state !== "COMPLETED" && !(task.state === "DEFERRED" && task.taskType.startsWith("WRITING_"))
      )) {
        setError(text.taskFailed);
        return;
      }
    }

    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      if (mode === "REVIEW") handleCompleteReview();
      else if (mode === "REPAIR") handleCompleteRepair();
      else void handleCompleteSession();
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const cleanupAndAbortSpeakingAttempts = async (ids: { speaking?: string; pronunciation?: string }) => {
    const currentSess = sessionRef.current;
    if (activeChildId) {
      if (ids.speaking) {
        await api(`/api/reading-aloud/attempts/${ids.speaking}/abort?child_id=${activeChildId}`, {
          method: "POST",
          body: "{}",
        }).catch(() => undefined);
        const speakingTask = currentSess?.tasks?.find(
          (t) => t.taskType === "SPEAKING_ATTEMPT" || t.key === "speaking"
        );
        if (currentSess?.id && speakingTask?.id) {
          const updated = await api<typeof session>(
            `/api/children/${activeChildId}/learning-sessions/${currentSess.id}/tasks/${speakingTask.id}/abort`,
            {
              method: "POST",
              body: JSON.stringify({ evidence_ref: ids.speaking }),
            }
          ).catch(() => undefined);
          if (updated && updated.tasks) {
            sessionRef.current = updated;
            setSession(updated);
          }
        }
      }
      if (ids.pronunciation) {
        await api(`/api/reading-aloud/attempts/${ids.pronunciation}/abort?child_id=${activeChildId}`, {
          method: "POST",
          body: "{}",
        }).catch(() => undefined);
        const pronTask = currentSess?.tasks?.find(
          (t) => t.taskType === "PRONUNCIATION_ATTEMPT" || t.key === "pronunciation"
        );
        if (currentSess?.id && pronTask?.id) {
          const updated = await api<typeof session>(
            `/api/children/${activeChildId}/learning-sessions/${currentSess.id}/tasks/${pronTask.id}/abort`,
            {
              method: "POST",
              body: JSON.stringify({ evidence_ref: ids.pronunciation }),
            }
          ).catch(() => undefined);
          if (updated && updated.tasks) {
            sessionRef.current = updated;
            setSession(updated);
          }
        }
      }
    }
    recorder.delete();
    activeSpeakingAttemptIdsRef.current = {};
    setActiveSpeakingAttemptIds({});
  };

  const handleRecordSpeaking = async () => {
    if (recording) {
      setError(null);
      const ids = { ...activeSpeakingAttemptIdsRef.current };
      const uncommittedIds = { ...ids };
      try {
        await recorder.stop();
        if (!activeChildId || (!ids.speaking && !ids.pronunciation)) {
          throw new Error(text.taskFailed);
        }
        if (activeChildId) {
          // The learning-flow evidence operation atomically completes provider and curriculum evidence.
          const plannedSpeakingTaskIds: string[] = currentStep?.data.taskIds ?? [];
          if (ids.speaking) {
            const res = await submitBackendTaskEvidence(
              (t) => plannedSpeakingTaskIds.includes(t.id) && t.taskType === "SPEAKING_ATTEMPT",
              ids.speaking,
              2000
            );
            if (!res.persisted || (res.taskState !== "COMPLETED" && res.taskState !== "DEFERRED")) {
              throw new Error(text.taskFailed);
            }
            delete uncommittedIds.speaking;
          }
          if (ids.pronunciation) {
            const res = await submitBackendTaskEvidence(
              (t) => plannedSpeakingTaskIds.includes(t.id) && t.taskType === "PRONUNCIATION_ATTEMPT",
              ids.pronunciation,
              2000
            );
            if (!res.persisted || (res.taskState !== "COMPLETED" && res.taskState !== "DEFERRED")) {
              throw new Error(text.taskFailed);
            }
            delete uncommittedIds.pronunciation;
          }
          recorder.delete();
          activeSpeakingAttemptIdsRef.current = {};
          setActiveSpeakingAttemptIds({});
        }
        setRecording(false);
        setSpeakingAttempted(true);
      } catch (err: any) {
        setRecording(false);
        setSpeakingAttempted(false);
        setError(err?.message || text.taskFailed);
        await cleanupAndAbortSpeakingAttempts(uncommittedIds);
      }
    } else {
      setError(null);
      const ids: { speaking?: string; pronunciation?: string } = {};
      try {
        const currentSess = sessionRef.current;
        if (activeChildId && currentSess?.tasks) {
          const plannedSpeakingIds: string[] = currentStep?.data.taskIds ?? [];
          const speakingTask = currentSess.tasks.find(
            (t) => plannedSpeakingIds.includes(t.id) && t.taskType === "SPEAKING_ATTEMPT" && t.state !== "COMPLETED" && t.state !== "DEFERRED"
          );
          const pronTask = currentSess.tasks.find(
            (t) => plannedSpeakingIds.includes(t.id) && t.taskType === "PRONUNCIATION_ATTEMPT" && t.state !== "COMPLETED" && t.state !== "DEFERRED"
          );

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
        setRecording(false);
        setSpeakingAttempted(false);
        setError(err?.message || text.taskFailed);
        await cleanupAndAbortSpeakingAttempts(ids);
      }
    }
  };

  const handleExitTicketSubmit = async () => {
    if (!currentStep?.data.questions) return;
    setError(null);

    if (mode === "LEARN" && activeChildId) {
      const taskId = currentStep.data.taskId;
      const task = sessionRef.current?.tasks?.find((candidate) => candidate.id === taskId);
      if (!taskId || !task) {
        setError(text.taskFailed);
        return;
      }
      const questions = currentStep.data.questions;
      if (Object.keys(exitTicketAnswers).length !== questions.length || questions.some((question: any) => !exitTicketAnswers[question.id])) {
        setError(text.pleaseAnswerQuestion);
        return;
      }
      const result = task.taskType === "PHONETICS"
        ? await submitBackendTaskAnswer((candidate) => candidate.id === taskId, undefined, exitTicketAnswers)
        : task.taskType === "MINI_CHECK" && task.taskData?.mode === "reflection"
        ? await submitBackendTaskAnswer((candidate) => candidate.id === taskId, exitTicketAnswers[taskId])
        : { persisted: false, deduped: false, taskState: "UNKNOWN" as const };
      const postTask = sessionRef.current?.tasks?.find((candidate) => candidate.id === taskId);
      if (
        !result.persisted ||
        (result.taskState !== "COMPLETED" && result.taskState !== "DEFERRED") ||
        !postTask || (postTask.state !== "COMPLETED" && postTask.state !== "DEFERRED")
      ) {
        setError(text.taskFailed);
        return;
      }
      setExitTicketSubmitted(true);
      return;
    }

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
        const currentSess = sessionRef.current;
        const currentLessonId = currentSess?.curriculumContext?.lessonId || currentSess?.lessonId || resolvedLessonId;
        if (!currentSess?.id || currentSess.status !== "IN_PROGRESS" || currentLessonId !== resolvedLessonId || pendingRepairResume) {
          setError(text.taskFailed);
          return;
        }
        setBusy(true);
        try {
          const res = await api<any>(
            `/api/children/${activeChildId}/lesson-packages/${resolvedLessonId}/fast-track`,
            {
              method: "POST",
              body: JSON.stringify({ session_id: currentSess.id, answers: exitTicketAnswers }),
            }
          );

          if (!res || typeof res !== "object" || typeof res.passed !== "boolean") {
            setError(text.taskFailed);
            return;
          }

          const exactIdentity = res.childId === activeChildId && res.sessionId === currentSess.id && res.lessonId === resolvedLessonId;

          if (res.passed === true) {
            const validWeakDomains = Array.isArray(res.weakDomains) &&
              res.weakDomains.length === 0 &&
              res.weakDomains.every((d: any) => typeof d === "string");
            const validMastery = res.masteryStatus === "READY_FOR_CHECK";
            const validNextMode = res.nextMode === "REVIEW";
            const validNextReviewDueAt = res.nextReviewDueAt !== undefined && (
              res.nextReviewDueAt === null || isValidBackendTimestamp(res.nextReviewDueAt)
            );

            if (!validWeakDomains || !validMastery || !validNextMode || !validNextReviewDueAt) {
              setError(text.taskFailed);
              return;
            }

            setExitTicketSubmitted(true);
            setWeakDomains([]);
            setNextReviewDueAt(res.nextReviewDueAt);
            setMasteryStatus("READY_FOR_CHECK");
            return;
          }

          if (res.passed === false) {
            const validWeakDomains = Array.isArray(res.weakDomains) &&
              res.weakDomains.length > 0 &&
              res.weakDomains.every((d: any) => typeof d === "string" && d.trim().length > 0);
            const validMastery = res.masteryStatus === "IN_PROGRESS";
            const validNextMode = res.nextMode === "REPAIR";
            const validNextReviewDueAt = res.nextReviewDueAt === null;

            if (!exactIdentity || res.sessionStatus !== "PAUSED" || res.terminationReason !== "FAST_TRACK_FAILED" || !validWeakDomains || !validMastery || !validNextMode || !validNextReviewDueAt) {
              setError(text.taskFailed);
              return;
            }

            setExitTicketSubmitted(true);
            setPendingRepairResume({ sessionId: currentSess.id, lessonId: resolvedLessonId, weakDomains: res.weakDomains });
            setNextReviewDueAt(null);
            setMasteryStatus("IN_PROGRESS");
            await resumeFastTrackRepair({ sessionId: currentSess.id, lessonId: resolvedLessonId, weakDomains: res.weakDomains });
            return;
          }

          setError(text.taskFailed);
          return;
        } catch (err: any) {
          // FAIL CLOSED! No local fallback!
          setError(err?.message || text.taskFailed);
          return;
        } finally {
          setBusy(false);
        }
      }

      // Local unauthenticated practice mode only (!activeChildId)
      setExitTicketSubmitted(true);
      if (allCorrect) {
        setWeakDomains([]);
        setMasteryStatus("READY_FOR_CHECK");
      } else {
        setWeakDomains(failedDomains);
        setMode("REPAIR");
        setCurrentStepIndex(0);
        setMasteryStatus("IN_PROGRESS");
      }
      return;
    }

    // In LEARN mode:
    if (activeChildId) {
      const currentSess = sessionRef.current;
      if (!currentSess || !currentSess.id || !currentSess.tasks) {
        setError(text.taskFailed);
        return;
      }

      const refTask = currentSess.tasks.find(
        (t) => (t.key === "mini-check-reflection" || (t.taskType === "MINI_CHECK" && t.taskData?.mode === "reflection"))
      );

      if (!refTask) {
        setError(text.taskFailed);
        return;
      }

      if (refTask.state !== "COMPLETED" && refTask.state !== "DEFERRED") {
        const writeRes = await submitBackendTaskAnswer((t) => t.id === refTask.id, "practiced");
        if (writeRes.taskState !== "COMPLETED" && writeRes.taskState !== "DEFERRED") {
          setError(text.taskFailed);
          return;
        }
      }
      const postRefTask = sessionRef.current?.tasks?.find((t) => t.id === refTask.id);
      if (!postRefTask || (postRefTask.state !== "COMPLETED" && postRefTask.state !== "DEFERRED")) {
        setError(text.taskFailed);
        return;
      }

      setExitTicketSubmitted(true);
      setWeakDomains(failedDomains);
      // NOTE: Only backend authoritative write sets masteryStatus.
      // Frontend NEVER sets READY_FOR_CHECK or IN_PROGRESS directly!
      return;
    }

    // Local unauthenticated practice mode only (!activeChildId)
    setExitTicketSubmitted(true);
    setWeakDomains(failedDomains);
    if (allCorrect) {
      setMasteryStatus("READY_FOR_CHECK");
    } else {
      setMasteryStatus("IN_PROGRESS");
    }
  };

  const handleCompleteSession = async () => {
    if (mode === "REPAIR") {
      setError(text.taskFailed);
      return;
    }
    if (!activeChildId) {
      setSessionCompleted(true);
      if (onCompleteLesson) {
        onCompleteLesson(resolvedLessonId, {
          sessionCompleted: true,
          masteryGranted: false,
        });
      }
      return;
    }

    const currentSess = sessionRef.current;
    if (!currentSess?.id) {
      setError(text.taskFailed);
      return;
    }
    if (mode === "LEARN") {
      const wrapUpTaskId = currentStep?.stepKey === "wrap_up" ? currentStep.data.taskId : undefined;
      const wrapUpTask = currentSess.tasks?.find((task) => task.id === wrapUpTaskId && task.taskType === "LESSON_WRAP_UP");
      const pendingRequired = currentSess.tasks?.some((task) =>
        task.required && task.taskType !== "LESSON_WRAP_UP" && task.state !== "COMPLETED" && task.state !== "DEFERRED"
      );
      if (!learnPlanValid || !wrapUpTask || pendingRequired) {
        setError(text.taskFailed);
        return;
      }
    }

    setBusy(true);
    setError(null);
    try {
      const completed = await api<{ id: string; status: string; masteryStatus?: string | null }>(
        `/api/children/${activeChildId}/learning-sessions/${currentSess.id}/complete`,
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
          <button type="button" className="button button-text" onClick={() => pendingRepairResume
            ? void resumeFastTrackRepair(pendingRepairResume)
            : void initSession()}>
            {text.retry}
          </button>
        </div>
      )}
      {mode === "LEARN" && activeChildId && !learnSessionReady && busy && (
        <div className="app-loading" role="status">{t("loading")}</div>
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
              disabled={!learnSessionReady}
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
            {steps.length === 0
              ? (mode === "REVIEW" && dailyQueueStatus === "SUCCESS" && dailyQueueZeroDue && !error ? text.noDueReviews : "")
              : `${text.step} ${currentStepIndex + 1} ${text.of} ${steps.length}`}
          </span>
        </div>

        <div className="step-progress-track" role="progressbar" aria-valuenow={currentStepIndex + 1} aria-valuemin={1} aria-valuemax={steps.length || 1}>
          {steps.map((s, idx) => (
            <div
              key={`${s.stepKey}-${idx}`}
              className={`step-segment ${idx === currentStepIndex ? "active" : idx < currentStepIndex ? "completed" : "pending"}`}
              title={`${s.stepNumber}. ${s.title}`}
            />
          ))}
        </div>
      </section>

      {/* Empty State when in REVIEW mode with confirmed zero due SRS items */}
      {mode === "REVIEW" && steps.length === 0 && dailyQueueStatus === "SUCCESS" && dailyQueueZeroDue && !error && (
        <article className="lesson-step-card empty-review-card" data-step-key="empty_review">
          <header className="step-card-header">
            <h2 className="step-card-title">{text.noDueReviews}</h2>
            <p className="step-card-subtitle">{text.noDueReviewsDesc}</p>
          </header>
          <div className="step-body empty-review-body" style={{ textAlign: "center", padding: "2rem 1rem" }}>
            <p className="empty-review-notice" style={{ marginBottom: "1.5rem", color: "var(--color-text-secondary, #666)" }}>
              {text.noDueReviewsNotice}
            </p>
            <button
              type="button"
              className="button button-primary back-to-today-btn"
              onClick={onBack}
            >
              {text.backToToday}
            </button>
          </div>
        </article>
      )}

      {/* Primary Single Column Content View */}
      {currentStep && playerSessionReady && (
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
                    onClick={() => void handlePlayListeningAudio(currentStep.data.audioText || "你好", currentStep.data.taskId)}
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
                        void handlePlayListeningAudio(currentStep.data.audioText || "你好", currentStep.data.taskId);
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
            const vocabTask = session?.tasks?.find((t) => currentStep.data.taskId
              ? t.id === currentStep.data.taskId
              : t.taskType === "VOCABULARY" || t.key === "vocabulary");
            const prompt = currentStep.data.taskId ? currentStep.data.prompt : vocabTask?.taskData?.prompt || currentStep.data.prompt;
            const choices = currentStep.data.taskId ? currentStep.data.choices : vocabTask?.taskData?.choices || currentStep.data.choices;

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
                          await submitBackendTaskAnswer((t) => currentStep.data.taskId
                            ? t.id === currentStep.data.taskId
                            : t.taskType === "VOCABULARY" || t.key === "vocabulary", choice.id);
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
            const isReviewMode = mode === "REVIEW";
            const dueChar = currentStep.data?.dueCharacter;
            const charObj = currentStep.data?.charObj || (isReviewMode
              ? pkg.characters.find((c) => c.char === dueChar)
              : pkg.characters[activeCharIndex]);

            const exactTaskId = currentStep.data?.taskId || currentStep.data?.dueItem?.id;
            const charTask = exactTaskId
              ? session?.tasks?.find((t) => t.id === exactTaskId)
              : isReviewMode
              ? (exactTaskId ? session?.tasks?.find((t) => t.id === exactTaskId) : null)
              : session?.tasks?.find(
                  (t) => (t.taskType === "RECOGNITION" || t.taskType === "MINI_CHECK" || t.key.startsWith("recognition-")) &&
                         (t.key === `recognition-${activeCharIndex + 1}` || t.itemId === charObj?.char)
                );

            const prompt = isReviewMode
              ? charTask?.taskData?.prompt ?? ""
              : charTask?.taskData?.prompt || currentStep.data.recognitionCheck?.prompt || "聽一聽發音，選出聽到的字：";
            const audioText = isReviewMode
              ? charTask?.taskData?.audioText ?? ""
              : charTask?.taskData?.audioText || currentStep.data?.dueCharacter || charObj?.char || "你";
            const choices = isReviewMode
              ? charTask?.taskData?.choices ?? []
              : charTask?.taskData?.choices || currentStep.data.recognitionCheck?.choices || (
                  charObj?.char === "好"
                    ? [{ id: "opt-ni", label: "你", isCorrect: false }, { id: "opt-hao", label: "好", isCorrect: true }]
                    : [{ id: "opt-ni", label: "你", isCorrect: true }, { id: "opt-hao", label: "好", isCorrect: false }]
                );

            const reviewChoiceKey = `recog-rev-${exactTaskId || charObj?.char}`;
            const selectedChoiceVal = isReviewMode
              ? (selectedChoices[reviewChoiceKey] || (exactTaskId ? selectedChoices[`recog-${exactTaskId}`] : selectedChoices["recog"]))
              : (exactTaskId ? selectedChoices[`recog-${exactTaskId}`] : selectedChoices[`recog-${activeCharIndex}`]);

            return (
              <div className="step-body step-characters-body">
                {!isReviewMode && !exactTaskId && (
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
                )}

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
                        <span>{charObj.pronunciation?.pinyin || ""} / {charObj.pronunciation?.zhuyin || ""}</span>
                      </button>
                    </div>

                    <div className="char-info-grid">
                      <div className="info-cell">
                        <span className="info-cell-label">部首</span>
                        <strong className="info-cell-val">{charObj.radical || "一"} 部</strong>
                      </div>
                      <div className="info-cell">
                        <span className="info-cell-label">筆畫</span>
                        <strong className="info-cell-val">{charObj.strokeCount || 1} 畫</strong>
                      </div>
                      <div className="info-cell">
                        <span className="info-cell-label">字義</span>
                        <strong className="info-cell-val">{charObj.meaning?.zh || ""}</strong>
                      </div>
                    </div>

                    {charObj.char && renderScaffold(charObj.char === "你" ? "char_ni" : "char_hao")}
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
                      const isSelected = selectedChoiceVal === choice.id || (!isReviewMode && selectedChoices["recog"] === choice.id);
                      const isCorrect = choice.id === (charObj?.char === "好" ? "opt-hao" : "opt-ni") || choice.isCorrect;
                      return (
                        <button
                          key={choice.id}
                          type="button"
                          className={`char-choice-card ${isSelected ? "selected" : ""}`}
                          onClick={async () => {
                            setSelectedChoices((prev) => ({
                              ...prev,
                              recog: choice.id,
                              [reviewChoiceKey]: choice.id,
                              ...(exactTaskId ? { [`recog-${exactTaskId}`]: choice.id } : {}),
                              [`recog-${activeCharIndex}`]: choice.id,
                            }));
                            if (isReviewMode) {
                              if (!exactTaskId) {
                                setError(text.taskFailed);
                                return;
                              }
                              await submitBackendTaskAnswer(
                                (t) => t.id === exactTaskId,
                                choice.id
                              );
                            } else {
          await submitBackendTaskAnswer(
            (t) => exactTaskId
              ? t.id === exactTaskId
              : t.id === charTask?.id || t.key === `recognition-${activeCharIndex + 1}`,
            choice.id
          );
                            }
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
            const sentTask = session?.tasks?.find((t) => currentStep.data.taskId
              ? t.id === currentStep.data.taskId
              : t.taskType === "SENTENCE_PATTERN" || t.key === "sentence-pattern");
            const prompt = currentStep.data.taskId ? currentStep.data.prompt : sentTask?.taskData?.prompt || currentStep.data.prompt;
            const choices = currentStep.data.taskId ? currentStep.data.choices : sentTask?.taskData?.choices || currentStep.data.choices;

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
                          await submitBackendTaskAnswer((t) => currentStep.data.taskId
                            ? t.id === currentStep.data.taskId
                            : t.taskType === "SENTENCE_PATTERN" || t.key === "sentence-pattern", choice.id);
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
                <div className="speaking-target-phrase">「{currentStep.data.speakingPrompt?.expectedText || "你好！"}」</div>
              </div>

              <div className="speaking-control-center">
                <button
                  type="button"
                  className={`mic-record-btn ${recording ? "is-recording" : ""} ${speakingAttempted ? "is-attempted" : ""}`}
                  onClick={handleRecordSpeaking}
                  disabled={!recording && !(session?.tasks ?? []).some((task) => (currentStep.data.taskIds ?? []).includes(task.id) && task.state !== "COMPLETED" && task.state !== "DEFERRED")}
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
                      const result = await skipBackendTask((t) => currentStep.data.taskId
                        ? t.id === currentStep.data.taskId
                        : t.taskType.startsWith("WRITING_") || t.key.startsWith("writing"));
                      if (result.persisted && (result.taskState === "COMPLETED" || result.taskState === "DEFERRED")) {
                        setWritingSkipped(true);
                        void handleNextStep();
                      } else {
                        setWritingSkipped(false);
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
                        disabled={busy || pendingRepairResume !== null}
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
                  disabled={busy || pendingRepairResume !== null ||
                    Object.keys(exitTicketAnswers).length !== (currentStep.data.questions?.length ?? 0)
                  }
                >
                  送出小挑戰答案
                </button>
              ) : (
                <div className="exit-ticket-feedback-banner">
                  {mode === "LEARN" && activeChildId && currentStep.data.taskId ? (
                    <p className="feedback-text positive">{"已記錄作答結果，可繼續進行收尾結算。"}</p>
                  ) : weakDomains.length === 0 ? (
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

          {currentStep.stepKey === "mini_check" && (
            <div className="step-body step-exit-ticket-body">
              <p className="interaction-prompt">{currentStep.data.prompt}</p>
              <div className="choices-vertical-list">
                {currentStep.data.choices?.map((choice: { id: string; label: string }) => {
                  const taskId = currentStep.data.taskId;
                  const selected = selectedChoices[taskId] === choice.id;
                  return (
                    <button
                      key={choice.id}
                      type="button"
                      className={`choice-card-btn ${selected ? "selected" : ""}`}
                      onClick={async () => {
                        if (!taskId) {
                          setError(text.taskFailed);
                          return;
                        }
                        setSelectedChoices((previous) => ({ ...previous, [taskId]: choice.id }));
                        const result = await submitBackendTaskAnswer((task) => task.id === taskId, choice.id);
                        if (result.taskState !== "COMPLETED" && result.taskState !== "DEFERRED") setError(text.taskFailed);
                      }}
                    >
                      <span className="choice-label">{choice.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 9: Wrap-up / Settlement */}
          {currentStep.stepKey === "wrap_up" && mode === "REVIEW" && (
            <div className="step-body step-wrap-up-body">
              <div className="session-settlement-card">
                <div className="settlement-trophy-icon">
                  <CheckCircle2 size={44} />
                </div>
                <h3 className="settlement-title">{text.reviewCompletedTitle}</h3>
                <p>{text.reviewCompletedNotice}</p>
              </div>
            </div>
          )}

          {currentStep.stepKey === "wrap_up" && mode === "REPAIR" && (
            <div className="step-body step-wrap-up-body">
              <div className="session-settlement-card">
                <div className="settlement-trophy-icon"><CheckCircle2 size={44} /></div>
                <h3 className="settlement-title">補強練習完成</h3>
                <p>本輪指定補強已記錄；原課程進度會保留在今日學習中。</p>
              </div>
            </div>
          )}

          {currentStep.stepKey === "wrap_up" && mode !== "REVIEW" && mode !== "REPAIR" && (
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
                    !playerSessionReady ||
                    (currentStep.stepKey === "exit_ticket" && !exitTicketSubmitted) ||
                    (currentStep.stepKey === "mini_check" && !selectedChoices[currentStep.data.taskId])
                  }
                >
                  <span>{text.nextStep}</span>
                  <ChevronRight size={18} />
                </button>
              ) : (
                <button
                  type="button"
                  className="button button-primary finish-session-cta-btn"
                  onClick={mode === "REVIEW" ? handleCompleteReview : mode === "REPAIR" ? handleCompleteRepair : handleCompleteSession}
                >
                  <CheckCircle2 size={18} />
                  <span>{mode === "REVIEW" ? text.backToToday : text.finishLesson}</span>
                </button>
              )}
            </div>
          </footer>
        </article>
      )}
    </main>
  );
}
