import { useEffect, useState } from "react";
import { apiFetch } from "../lib/apiFetch";
import type { DisplayLanguage } from "../lib/i18n";

const API = import.meta.env.VITE_API_BASE ?? "";
const STARTS = ["STARTER", "BASIC", "BOOK_1"] as const;
const METHODS = ["NOT_ASSESSED", "PARENT_OBSERVATION", "DIAGNOSTIC"] as const;

type PlacementStart = typeof STARTS[number];
type AssessmentMethod = typeof METHODS[number];
type PlacementProfile = {
  childId: number;
  mainCurriculumStart: PlacementStart;
  assessmentMethod: AssessmentMethod;
};
type Copy = {
  title: string;
  noChild: string;
  signIn: string;
  loading: string;
  unavailable: string;
  retry: string;
  notAssessed: string;
  starterDefaultNote: string;
  curriculumStart: string;
  assessmentMethod: string;
  starts: Record<PlacementStart, string>;
  methods: Record<Exclude<AssessmentMethod, "NOT_ASSESSED">, string>;
};

const COPY: Record<DisplayLanguage, Copy> = {
  "zh-Hant": {
    title: "學習起點",
    noChild: "請先選取孩子資料以查看學習起點。",
    signIn: "請使用家長帳戶登入以查看學習起點。",
    loading: "正在載入學習起點…",
    unavailable: "目前無法取得學習起點。每日學習佇列仍可使用原有入門冊預設。",
    retry: "再試一次",
    notAssessed: "預設入門冊・尚未評估",
    starterDefaultNote: "目前每日學習佇列仍使用入門冊預設。",
    curriculumStart: "課程起點",
    assessmentMethod: "評估方式",
    starts: { STARTER: "入門冊", BASIC: "基礎冊", BOOK_1: "第 1 冊" },
    methods: { PARENT_OBSERVATION: "家長觀察", DIAGNOSTIC: "診斷評估" },
  },
  "zh-Hans": {
    title: "学习起点",
    noChild: "请先选择孩子资料以查看学习起点。",
    signIn: "请使用家长账户登录以查看学习起点。",
    loading: "正在加载学习起点…",
    unavailable: "目前无法取得学习起点。每日学习队列仍可使用原有入门册默认值。",
    retry: "重试",
    notAssessed: "默认入门册・尚未评估",
    starterDefaultNote: "目前每日学习队列仍使用入门册默认值。",
    curriculumStart: "课程起点",
    assessmentMethod: "评估方式",
    starts: { STARTER: "入门册", BASIC: "基础册", BOOK_1: "第 1 册" },
    methods: { PARENT_OBSERVATION: "家长观察", DIAGNOSTIC: "诊断评估" },
  },
  en: {
    title: "Learning start",
    noChild: "Select a child profile to view its learning start.",
    signIn: "Sign in with the parent account to view the learning start.",
    loading: "Loading learning start…",
    unavailable: "Placement status is unavailable. The Daily Queue can still use its existing Starter default.",
    retry: "Try again",
    notAssessed: "Starter default — not assessed",
    starterDefaultNote: "The Daily Queue remains available with its existing Starter default.",
    curriculumStart: "Curriculum start",
    assessmentMethod: "Assessment method",
    starts: { STARTER: "Starter", BASIC: "Basic", BOOK_1: "Book 1" },
    methods: { PARENT_OBSERVATION: "Parent observation", DIAGNOSTIC: "Diagnostic" },
  },
  ja: {
    title: "学習開始レベル",
    noChild: "学習開始レベルを確認するには、子どものプロフィールを選択してください。",
    signIn: "学習開始レベルを確認するには、保護者アカウントでログインしてください。",
    loading: "学習開始レベルを読み込み中…",
    unavailable: "配置状況を取得できません。今日の学習キューでは既存の入門レベルを引き続き利用できます。",
    retry: "再試行",
    notAssessed: "入門レベル（未評価）",
    starterDefaultNote: "今日の学習キューでは既存の入門レベルを引き続き利用できます。",
    curriculumStart: "カリキュラム開始",
    assessmentMethod: "評価方法",
    starts: { STARTER: "入門編", BASIC: "基礎編", BOOK_1: "第 1 冊" },
    methods: { PARENT_OBSERVATION: "保護者の観察", DIAGNOSTIC: "診断評価" },
  },
  ko: {
    title: "학습 시작 단계",
    noChild: "학습 시작 단계를 보려면 자녀 프로필을 선택하세요.",
    signIn: "학습 시작 단계를 보려면 보호자 계정으로 로그인하세요.",
    loading: "학습 시작 단계를 불러오는 중…",
    unavailable: "배치 상태를 불러올 수 없습니다. 오늘의 학습 대기열은 기존 입문 기본값으로 계속 이용할 수 있습니다.",
    retry: "다시 시도",
    notAssessed: "입문 기본값 — 평가되지 않음",
    starterDefaultNote: "오늘의 학습 대기열은 기존 입문 기본값으로 계속 이용할 수 있습니다.",
    curriculumStart: "과정 시작",
    assessmentMethod: "평가 방식",
    starts: { STARTER: "입문 과정", BASIC: "기초 과정", BOOK_1: "1권" },
    methods: { PARENT_OBSERVATION: "보호자 관찰", DIAGNOSTIC: "진단 평가" },
  },
  es: {
    title: "Inicio de aprendizaje",
    noChild: "Selecciona un perfil infantil para ver su inicio de aprendizaje.",
    signIn: "Inicia sesión con la cuenta de adulto para ver el inicio de aprendizaje.",
    loading: "Cargando el inicio de aprendizaje…",
    unavailable: "El estado de ubicación no está disponible. La cola diaria aún puede usar su nivel inicial predeterminado.",
    retry: "Reintentar",
    notAssessed: "Nivel inicial predeterminado — sin evaluar",
    starterDefaultNote: "La cola diaria sigue disponible con su nivel inicial predeterminado.",
    curriculumStart: "Inicio del currículo",
    assessmentMethod: "Método de evaluación",
    starts: { STARTER: "Nivel inicial", BASIC: "Nivel básico", BOOK_1: "Libro 1" },
    methods: { PARENT_OBSERVATION: "Observación del adulto", DIAGNOSTIC: "Diagnóstico" },
  },
};

function parsePlacementProfile(value: unknown, expectedChildId: number): PlacementProfile | null {
  if (!value || typeof value !== "object") return null;
  const profile = value as Record<string, unknown>;
  if (profile.childId !== expectedChildId) return null;
  if (!STARTS.includes(profile.mainCurriculumStart as PlacementStart)) return null;
  if (!METHODS.includes(profile.assessmentMethod as AssessmentMethod)) return null;
  if (profile.assessmentMethod === "NOT_ASSESSED" && profile.mainCurriculumStart !== "STARTER") return null;
  return {
    childId: expectedChildId,
    mainCurriculumStart: profile.mainCurriculumStart as PlacementStart,
    assessmentMethod: profile.assessmentMethod as AssessmentMethod,
  };
}

export function PlacementStatus({ childId, authenticatedParent, language }: {
  childId: number | null;
  authenticatedParent: boolean;
  language: DisplayLanguage;
}) {
  const copy = COPY[language];
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [profile, setProfile] = useState<PlacementProfile | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (childId === null || !authenticatedParent) return;
    let current = true;
    setStatus("loading");
    setProfile(null);
    void apiFetch(`${API}/api/children/${childId}/placement-profile`)
      .then(async (response) => {
        if (!response.ok) throw new Error("placement_profile_unavailable");
        const parsed = parsePlacementProfile(await response.json(), childId);
        if (!parsed) throw new Error("placement_profile_invalid");
        if (current) {
          setProfile(parsed);
          setStatus("loaded");
        }
      })
      .catch(() => {
        if (current) {
          setProfile(null);
          setStatus("error");
        }
      });
    return () => { current = false; };
  }, [childId, authenticatedParent, retryCount]);

  return <div className="placement-status" aria-labelledby="placement-status-title">
    <div className="setting-divider" />
    <h3 id="placement-status-title">{copy.title}</h3>
    {childId === null
      ? <p className="settings-help">{copy.noChild}</p>
      : !authenticatedParent
        ? <p className="settings-help">{copy.signIn}</p>
        : status === "loading"
          ? <p className="settings-help" role="status">{copy.loading}</p>
          : status === "error" || !profile
            ? <div><p className="settings-help" role="alert">{copy.unavailable}</p><button type="button" className="button button-text" onClick={() => setRetryCount((count) => count + 1)}>{copy.retry}</button></div>
            : profile.assessmentMethod === "NOT_ASSESSED"
              ? <div><p><strong>{copy.notAssessed}</strong></p><p className="settings-help">{copy.starterDefaultNote}</p></div>
              : <div><p><strong>{copy.curriculumStart}:</strong> {copy.starts[profile.mainCurriculumStart]}</p><p className="settings-help"><strong>{copy.assessmentMethod}:</strong> {copy.methods[profile.assessmentMethod]}</p></div>}
  </div>;
}
