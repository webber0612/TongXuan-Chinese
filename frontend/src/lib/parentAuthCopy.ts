import type { DisplayLanguage } from "./i18n";

export type ParentAuthCopy = {
  heading: string;
  description: string;
  signIn: string;
  loading: string;
  signingIn: string;
  signInFailed: string;
  unavailable: string;
  signedInAs: string;
  signOut: string;
  addChild: string;
  noChildren: string;
  chooseChild: string;
  selected: string;
  childLoginNote: string;
  retry: string;
};

const copy: Record<DisplayLanguage, ParentAuthCopy> = {
  "zh-Hant": {
    heading: "家長 Google 帳戶",
    description: "家長登入後可建立並管理自己的孩子資料。孩子不需要個別登入。",
    signIn: "使用 Google 登入",
    loading: "正在載入 Google 登入…",
    signingIn: "正在驗證家長帳戶…",
    signInFailed: "無法登入。請檢查連線後再試一次。",
    unavailable: "此部署尚未設定 Google 登入。",
    signedInAs: "已登入",
    signOut: "登出家長帳戶",
    addChild: "新增孩子資料",
    noChildren: "此家長帳戶還沒有孩子資料。",
    chooseChild: "選取這個孩子",
    selected: "目前選取",
    childLoginNote: "孩子使用已建立的學習者資料，不需要 Google 帳戶。",
    retry: "再試一次",
  },
  "zh-Hans": {
    heading: "家长 Google 账户",
    description: "家长登录后可创建并管理自己的孩子资料。孩子不需要单独登录。",
    signIn: "使用 Google 登录",
    loading: "正在加载 Google 登录…",
    signingIn: "正在验证家长账户…",
    signInFailed: "无法登录。请检查网络后重试。",
    unavailable: "此部署尚未配置 Google 登录。",
    signedInAs: "已登录",
    signOut: "退出家长账户",
    addChild: "新增孩子资料",
    noChildren: "此家长账户还没有孩子资料。",
    chooseChild: "选择这个孩子",
    selected: "当前选中",
    childLoginNote: "孩子使用已创建的学习者资料，不需要 Google 账户。",
    retry: "重试",
  },
  en: {
    heading: "Parent Google account",
    description: "A parent signs in to create and manage the family’s learner profiles. Children do not sign in individually.",
    signIn: "Sign in with Google",
    loading: "Loading Google sign-in…",
    signingIn: "Verifying the parent account…",
    signInFailed: "Sign-in failed. Check your connection and try again.",
    unavailable: "Google sign-in is not configured for this deployment.",
    signedInAs: "Signed in",
    signOut: "Sign out of parent account",
    addChild: "Add a child profile",
    noChildren: "This parent account has no child profiles yet.",
    chooseChild: "Select this child",
    selected: "Currently selected",
    childLoginNote: "Children use their learner profile and do not need a Google account.",
    retry: "Try again",
  },
  ja: {
    heading: "保護者の Google アカウント",
    description: "保護者がログインして家族の学習者プロフィールを管理します。子どもの個別ログインは不要です。",
    signIn: "Google でログイン",
    loading: "Google ログインを読み込み中…",
    signingIn: "保護者アカウントを確認中…",
    signInFailed: "ログインできませんでした。接続を確認して再試行してください。",
    unavailable: "この環境では Google ログインが設定されていません。",
    signedInAs: "ログイン中",
    signOut: "保護者アカウントからログアウト",
    addChild: "子どものプロフィールを追加",
    noChildren: "この保護者アカウントにはプロフィールがありません。",
    chooseChild: "この子どもを選択",
    selected: "選択中",
    childLoginNote: "子どもは学習者プロフィールを使い、Google アカウントは不要です。",
    retry: "再試行",
  },
  ko: {
    heading: "보호자 Google 계정",
    description: "보호자가 로그인하여 가족 학습자 프로필을 관리합니다. 자녀는 개별 로그인하지 않습니다.",
    signIn: "Google로 로그인",
    loading: "Google 로그인을 불러오는 중…",
    signingIn: "보호자 계정을 확인하는 중…",
    signInFailed: "로그인하지 못했습니다. 연결을 확인하고 다시 시도하세요.",
    unavailable: "이 배포에는 Google 로그인이 설정되지 않았습니다.",
    signedInAs: "로그인됨",
    signOut: "보호자 계정 로그아웃",
    addChild: "자녀 프로필 추가",
    noChildren: "이 보호자 계정에는 자녀 프로필이 없습니다.",
    chooseChild: "이 자녀 선택",
    selected: "현재 선택됨",
    childLoginNote: "자녀는 학습자 프로필을 사용하며 Google 계정이 필요하지 않습니다.",
    retry: "다시 시도",
  },
  es: {
    heading: "Cuenta de Google del adulto",
    description: "El adulto inicia sesión para crear y administrar los perfiles de aprendizaje. Los niños no necesitan iniciar sesión.",
    signIn: "Iniciar sesión con Google",
    loading: "Cargando el inicio de sesión de Google…",
    signingIn: "Verificando la cuenta del adulto…",
    signInFailed: "No se pudo iniciar sesión. Comprueba la conexión e inténtalo de nuevo.",
    unavailable: "Google no está configurado para este despliegue.",
    signedInAs: "Sesión iniciada",
    signOut: "Cerrar sesión de la cuenta del adulto",
    addChild: "Añadir perfil de un niño",
    noChildren: "Esta cuenta todavía no tiene perfiles de niños.",
    chooseChild: "Seleccionar este perfil",
    selected: "Seleccionado",
    childLoginNote: "Los niños usan su perfil de aprendizaje y no necesitan una cuenta de Google.",
    retry: "Reintentar",
  },
};

export function parentAuthCopy(language: DisplayLanguage): ParentAuthCopy {
  return copy[language];
}
