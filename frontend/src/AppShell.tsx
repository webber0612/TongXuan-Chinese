import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BookOpen, ChevronDown, CircleUserRound, Compass, House, Languages, Plus, Settings2, Sparkles, UserRound, X } from "lucide-react";
import { Button as AriaButton, ListBox, ListBoxItem, Popover, Select, SelectValue, Label } from "react-aria-components";
import { ChildPortalPage } from "./pages/ChildPortalPage";
import { CourseZeroPage } from "./pages/CourseZeroPage";
import { FirstLessonPage } from "./pages/FirstLessonPage";
import { Profile, ACTIVE_PROFILE_STORAGE_KEY, BackendChild, defaultProfiles, isValidBackendChildId, loadProfiles, normalizeBackendChildren, reconcileProfiles, saveProfiles, selectedBackendChild, selectProfile } from "./lib/profiles";
import { apiFetch, setApiCsrfToken } from "./lib/apiFetch";
import { ANNOTATION_MODE_KEY, currentAnnotationMode, currentLearningLocale, LEARNING_LOCALE_KEY, useLocale, type AnnotationMode, type DisplayLanguage, type LearningLocale } from "./lib/i18n";
import { GoogleParentSignIn } from "./components/GoogleParentSignIn";
import { PlacementStatus } from "./components/PlacementStatus";
import { parentAuthCopy } from "./lib/parentAuthCopy";

const API = import.meta.env.VITE_API_BASE ?? "";
const LearningPage = lazy(async () => ({ default: (await import("./pages/LearningPage")).LearningPage }));
const DashboardPage = lazy(async () => ({ default: (await import("./pages/DashboardPage")).DashboardPage }));
const CurriculumPage = lazy(async () => ({ default: (await import("./pages/CurriculumPage")).CurriculumPage }));
const TutorPage = lazy(async () => ({ default: (await import("./pages/TutorPage")).TutorPage }));
const CommercializationPage = lazy(async () => ({ default: (await import("./pages/CommercializationPage")).CommercializationPage }));
const DiagnosticsPage = lazy(async () => ({ default: (await import("./pages/DiagnosticsPage")).DiagnosticsPage }));
const LessonPlayerPage = lazy(async () => ({ default: (await import("./pages/LessonPlayerPage")).LessonPlayerPage }));
type Child = BackendChild;
type ParentIdentity = { id: number; email: string; displayName: string };
type ParentSession = { authRequired: boolean; authenticated: boolean; role: string | null; parent: ParentIdentity | null };
const LOCAL_SESSION: ParentSession = { authRequired: false, authenticated: false, role: null, parent: null };
type Route = "home" | "practice" | "parent" | "curriculum" | "course-zero" | "first-lesson" | "learning-session" | "tutor" | "me" | "commercialization" | "diagnostics" | "legacy-tombstone" | "redirect-home";

function appBaseAt(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const githubPagesBase = "/TongXuan-Chinese";
  if (normalized === githubPagesBase || normalized.startsWith(`${githubPagesBase}/`)) return `${githubPagesBase}/`;
  return new URL(import.meta.env.BASE_URL, `${window.location.origin}${pathname}`).pathname;
}

function appPathAt(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const appBase = appBaseAt(pathname).replace(/\/+$/, "");
  return appBase && (normalized === appBase || normalized.startsWith(`${appBase}/`))
    ? normalized.slice(appBase.length) || "/"
    : normalized;
}

export function canonicalRedirectPath(pathname: string): string | null {
  return appPathAt(pathname) === "/kids" ? appBaseAt(pathname) : null;
}

export function routeFromPath(pathname: string): Route {
  const appPath = appPathAt(pathname);
  if (appPath === "/") return "home";
  if (appPath === "/kids") return "redirect-home";
  if (["/preview-kids", "/preview-2", "/preview-b", "/preview", "/preview-pixel", "/preview-reference", "/preview-directions", "/learning-desk", "/learning-calendar"].includes(appPath)) return "legacy-tombstone";
  if (appPath === "/parent-dashboard") return "parent";
  if (appPath === "/curriculum") return "curriculum";
  if (appPath === "/course-zero") return "course-zero";
  if (appPath === "/first-lesson") return "first-lesson";
  if (appPath === "/learning-session") return "learning-session";
  if (appPath === "/tutor") return "tutor";
  if (appPath === "/admin/commercialization") return "commercialization";
  if (appPath === "/diagnostics") return "diagnostics";
  if (appPath === "/practice") return "practice";
  if (appPath === "/settings" || appPath === "/me") return "me";
  return "legacy-tombstone";
}

const paths: Record<Exclude<Route, "legacy-tombstone" | "redirect-home">, string> = { home: "/", practice: "/practice", parent: "/parent-dashboard", curriculum: "/curriculum", "course-zero": "/course-zero", "first-lesson": "/first-lesson", "learning-session": "/learning-session", tutor: "/tutor", me: "/me", commercialization: "/admin/commercialization", diagnostics: "/diagnostics" };

export function isCanonicalHomePath(pathname: string): boolean {
  return appPathAt(pathname) === "/";
}

function pathAtAppBase(path: string): string {
  const appBase = appBaseAt(window.location.pathname);
  return `${appBase}${path.replace(/^\/+/, "")}`;
}

export function AppShell() {
  const { t, language, setLanguage } = useLocale();
  const [route, setRoute] = useState<Route>(() => routeFromPath(window.location.pathname));
  const routeRef = useRef(route);
  const activeLessonSessionRef = useRef(false);
  const [profiles, setProfiles] = useState<Profile[]>(() => loadProfiles());
  const [activeKey, setActiveKey] = useState(() => localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY) ?? "child-a");
  const [learningSessionLessonId, setLearningSessionLessonId] = useState<string | undefined>(undefined);
  const [learningSessionMode, setLearningSessionMode] = useState<"LEARN" | "REVIEW">("LEARN");
  const [children, setChildren] = useState<Child[]>([]);
  const [childrenLoading, setChildrenLoading] = useState(true);
  const [childrenError, setChildrenError] = useState("");
  const [parentSession, setParentSession] = useState<ParentSession>(LOCAL_SESSION);
  const [authLoading, setAuthLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState("");
  const [creatingChild, setCreatingChild] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const childrenRequestSerial = useRef(0);
  const authTransitionSerial = useRef(0);
  const authRequestSerial = useRef(0);
  const parentSessionRef = useRef(parentSession);

  function updateParentSession(session: ParentSession) {
    parentSessionRef.current = session;
    setParentSession(session);
  }

  const activeProfile = selectProfile(profiles, activeKey);
  const activeChild = selectedBackendChild(activeProfile, children);
  const childName = activeChild?.name;
  const internalSession = parentSession.authenticated && (parentSession.role === "developer" || parentSession.role === "admin");
  const canManageChildren = !parentSession.authRequired || parentSession.authenticated && parentSession.role === "parent" || internalSession;

  useEffect(() => { saveProfiles(profiles); }, [profiles]);
  useEffect(() => {
    if (profiles.some((profile) => profile.key === activeKey)) localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, activeKey);
  }, [activeKey, profiles]);
  useEffect(() => {
    const handleLessonSessionGuard = (event: Event) => {
      activeLessonSessionRef.current = (event as CustomEvent<{ active?: boolean }>).detail?.active === true;
    };
    const syncRoute = () => {
      const redirectPath = canonicalRedirectPath(window.location.pathname);
      if (redirectPath) {
        window.history.replaceState({}, "", redirectPath);
        const redirectedRoute = routeFromPath(redirectPath);
        routeRef.current = redirectedRoute;
        setRoute(redirectedRoute);
        setLearningSessionMode("LEARN");
        return;
      }
      const nextRoute = routeFromPath(window.location.pathname);
      if (routeRef.current === "learning-session" && nextRoute !== "learning-session" && activeLessonSessionRef.current) {
        window.history.replaceState({}, "", pathAtAppBase(paths["learning-session"]));
        window.dispatchEvent(new Event("tongxuan:lesson-exit-request"));
        return;
      }
      const latestSession = parentSessionRef.current;
      const sessionAllowed = !latestSession.authRequired || latestSession.authenticated && (latestSession.role === "parent" || latestSession.role === "developer" || latestSession.role === "admin");
      if (!sessionAllowed && nextRoute !== "parent" && nextRoute !== "me") {
        window.history.replaceState({}, "", pathAtAppBase(paths.parent));
        routeRef.current = "parent";
        setRoute("parent");
        setLearningSessionMode("LEARN");
        return;
      }
      routeRef.current = nextRoute;
      setRoute(nextRoute);
      if (nextRoute !== "learning-session") setLearningSessionMode("LEARN");
    };
    syncRoute();
    window.addEventListener("tongxuan:lesson-session-guard", handleLessonSessionGuard);
    window.addEventListener("popstate", syncRoute);
    return () => {
      window.removeEventListener("tongxuan:lesson-session-guard", handleLessonSessionGuard);
      window.removeEventListener("popstate", syncRoute);
    };
  }, []);

  async function fetchParentSession(): Promise<ParentSession> {
    const requestSerial = ++authRequestSerial.current;
    try {
      const response = await apiFetch(API + "/api/auth/session");
      if (!response.ok) throw new Error("auth_session_unavailable");
      const value: unknown = await response.json();
      if (!value || typeof value !== "object") throw new Error("auth_session_invalid");
      const session = value as Record<string, unknown>;
      if (typeof session.authRequired !== "boolean") {
        if (import.meta.env.MODE === "test") return LOCAL_SESSION;
        throw new Error("auth_session_invalid");
      }
      const authenticated = session.authenticated === true;
      if (requestSerial === authRequestSerial.current) setApiCsrfToken(typeof session.csrfToken === "string" ? session.csrfToken : null);
      const parentValue = session.parent;
      const parent = parentValue && typeof parentValue === "object" ? parentValue as Record<string, unknown> : null;
      const identity = parent && Number.isSafeInteger(parent.id) && typeof parent.email === "string" && typeof parent.displayName === "string"
        ? { id: parent.id as number, email: parent.email, displayName: parent.displayName }
        : null;
      if (authenticated && session.role === "parent" && !identity) throw new Error("auth_session_invalid");
      return { authRequired: session.authRequired, authenticated, role: typeof session.role === "string" ? session.role : null, parent: identity };
    } catch {
      if (requestSerial === authRequestSerial.current) setApiCsrfToken(null);
      return { authRequired: true, authenticated: false, role: null, parent: null };
    }
  }

  async function loadChildren(session: ParentSession = parentSession) {
    const permittedSession = !session.authRequired || session.authenticated && (session.role === "parent" || session.role === "developer" || session.role === "admin");
    if (!permittedSession) {
      childrenRequestSerial.current += 1;
      setChildren([]); setChildrenError(""); setChildrenLoading(false);
      setProfiles(reconcileProfiles([], loadProfiles()));
      return;
    }
    const requestSerial = ++childrenRequestSerial.current;
    setChildrenLoading(true); setChildrenError(""); setChildren([]);
    try {
      const response = await apiFetch(API + "/api/children");
      if (requestSerial !== childrenRequestSerial.current) return;
      if (response.status === 401 && session.authRequired) {
        updateParentSession({ authRequired: true, authenticated: false, role: null, parent: null });
        setChildren([]); setChildrenError(""); setProfiles(reconcileProfiles([], loadProfiles()));
        return;
      }
      if (!response.ok) throw new Error("children_unavailable");
      const value: unknown = await response.json();
      if (requestSerial !== childrenRequestSerial.current) return;
      if (!Array.isArray(value)) throw new Error("children_invalid");
      const nextChildren = normalizeBackendChildren(value);
      setChildren(nextChildren);
      const nextProfiles = reconcileProfiles(nextChildren, loadProfiles());
      setProfiles(nextProfiles);
      // Keep an unresolved profile unresolved. Selecting the first returned child
      // here would silently redirect Home to someone other than the saved learner.
    } catch { if (requestSerial === childrenRequestSerial.current) { setChildren([]); setChildrenError(t("childrenError")); } }
    finally { if (requestSerial === childrenRequestSerial.current) setChildrenLoading(false); }
  }
  useEffect(() => {
    let cancelled = false;
    const bootstrapSerial = authTransitionSerial.current;
    void (async () => {
      const session = await fetchParentSession();
      if (cancelled || bootstrapSerial !== authTransitionSerial.current) return;
      updateParentSession(session);
      setAuthLoading(false);
      const permitted = !session.authRequired || session.authenticated && (session.role === "parent" || session.role === "developer" || session.role === "admin");
      if (permitted) {
        await loadChildren(session);
      } else {
        childrenRequestSerial.current += 1;
        setChildren([]); setChildrenError(""); setChildrenLoading(false);
        setProfiles(reconcileProfiles([], loadProfiles())); setActiveKey("parent");
        if (routeFromPath(window.location.pathname) !== "me" && routeFromPath(window.location.pathname) !== "parent") {
          window.history.replaceState({}, "", pathAtAppBase(paths.parent));
          routeRef.current = "parent";
          setRoute("parent");
        }
      }
    })();
    return () => { cancelled = true; authRequestSerial.current += 1; childrenRequestSerial.current += 1; };
  }, []);

  async function onParentSignedIn(parent: ParentIdentity) {
    const transitionSerial = ++authTransitionSerial.current;
    const verified = await fetchParentSession();
    if (transitionSerial !== authTransitionSerial.current) return;
    if (!verified.authenticated || verified.role !== "parent" || !verified.parent || verified.parent.id !== parent.id) {
      throw new Error("parent_session_not_confirmed");
    }
    const session = verified;
    updateParentSession(session);
    setAuthLoading(false);
    await loadChildren(session);
    if (transitionSerial !== authTransitionSerial.current) return;
    setActiveKey("parent");
    navigate("me");
  }

  async function onParentSignOut() {
    const transitionSerial = ++authTransitionSerial.current;
    childrenRequestSerial.current += 1;
    setApiCsrfToken(null);
    const signedOut: ParentSession = { authRequired: parentSessionRef.current.authRequired, authenticated: false, role: null, parent: null };
    updateParentSession(signedOut); setChildren([]); setChildrenError(""); setChildrenLoading(false); setProfiles(reconcileProfiles([], loadProfiles())); setActiveKey("parent");
    await apiFetch(API + "/api/auth/logout", { method: "POST" }).catch(() => undefined);
    if (transitionSerial !== authTransitionSerial.current) return;
    navigate("parent");
  }

  function navigate(next: Route) {
    if (next === "legacy-tombstone" || next === "redirect-home") return;
    const sessionAllowed = !parentSession.authRequired || parentSession.authenticated && (parentSession.role === "parent" || parentSession.role === "developer" || parentSession.role === "admin");
    if (!sessionAllowed && next !== "parent" && next !== "me") next = "parent";
    if (next !== "learning-session") setLearningSessionMode("LEARN");
    routeRef.current = next;
    setRoute(next);
    window.history.pushState({}, "", pathAtAppBase(paths[next]));
  }
  function chooseProfile(key: string) { const profile = profiles.find((item) => item.key === key); if (!profile) return; setActiveKey(profile.key); setProfileOpen(false); navigate(profile.role === "parent" ? "parent" : "home"); }
  async function addProfile() {
    if (!canManageChildren) { setAddError(parentAuthCopy(language).signIn); return; }
    const cleanName = newName.trim();
    if (!cleanName) { setAddError(t("createError")); return; }
    if (children.some((child) => child.name.trim().toLocaleLowerCase() === cleanName.toLocaleLowerCase())) { setAddError(t("nameExists")); return; }
    setCreatingChild(true); setAddError("");
    try {
      const response = await apiFetch(`${API}/api/children`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: cleanName }) });
      if (!response.ok) { const detail = await response.json().catch(() => ({})); throw new Error(detail.detail ?? t("createFailed")); }
      const created = await response.json() as Child;
      await loadChildren(parentSession); setActiveKey("child-" + created.id); setNewName(""); setAddOpen(false); navigate("home");
    } catch (value) { setAddError(value instanceof Error ? value.message : t("createFailed")); }
    finally { setCreatingChild(false); }
  }

  const navItems = useMemo(() => activeProfile.role === "parent" ? [
    { id: "parent" as Route, label: t("parent"), icon: CircleUserRound },
    { id: "curriculum" as Route, label: t("library"), icon: BookOpen },
    { id: "me" as Route, label: t("mySpace"), icon: UserRound },
  ] : [
    { id: "home" as Route, label: t("today"), icon: House },
    { id: "practice" as Route, label: t("practice"), icon: Sparkles },
    { id: "curriculum" as Route, label: t("library"), icon: Compass },
    { id: "me" as Route, label: t("mySpace"), icon: UserRound },
  ], [activeProfile.role, language]);

  const isChildPortal = route === "home" || route === "legacy-tombstone" || route === "redirect-home" || route === "learning-session";
  const showSessionEntry = isCanonicalHomePath(window.location.pathname);

  return <div className={`app-shell ${isChildPortal ? "app-shell-child-portal" : ""}`}>
    <header className={`app-header ${isChildPortal ? "app-header-hidden" : ""}`}>
      <button className="brand" onClick={() => navigate("home")} aria-label="TongXuan home"><span className="brand-mark" aria-hidden="true">文</span><span><strong>TongXuan</strong><small>Chinese learning</small></span></button>
      <div className="header-actions">
        <div className="profile-select">
          <button className="profile-trigger" aria-expanded={profileOpen} aria-haspopup="menu" onClick={() => setProfileOpen((open) => !open)}><span className={`avatar avatar-${activeProfile.color}`}>{activeProfile.name.slice(-1)}</span><span className="profile-name">{activeProfile.name}</span><ChevronDown size={16}/></button>
          {profileOpen && <div className="app-popover profile-menu" role="menu" aria-label={t("chooseLearner")}>
            {profiles.map((profile) => <button key={profile.key} className="profile-option" role="menuitemradio" aria-checked={profile.key === activeProfile.key} onClick={() => chooseProfile(profile.key)}><span className={`avatar avatar-${profile.color}`}>{profile.name.slice(-1)}</span><span><strong>{profile.name}</strong><small>{profile.role === "parent" ? t("parentRole") : t("childRole")}</small></span>{profile.key === activeProfile.key && <span aria-hidden="true">✓</span>}</button>)}
          </div>}
        </div>
      </div>
    </header>
    <div className="app-frame">
      <div className="main-column">
        {authLoading ? <AppLoading label={t("loading")} /> : <>
        {childrenLoading && !isChildPortal && <div className="offline-strip" role="status">{t("loading")}</div>}
        {childrenError && !isChildPortal && <div className="offline-strip error-strip" role="alert">{childrenError} <button className="button button-text" onClick={() => void loadChildren()}>{t("retry")}</button></div>}
        {route === "legacy-tombstone" && <main className="app-page"><PageHeading kicker={t("today")} title={t("legacyRouteTitle")} subtitle={t("legacyRouteDescription")} icon={<BookOpen/>}/><button className="button button-primary" onClick={() => navigate("home")}><House size={18}/>{t("today")}</button></main>}
        <Suspense fallback={<AppLoading label={t("loading")} />}>
        {route === "home" && <ChildPortalPage key={activeChild?.id ?? "unresolved-child"} activeChildId={activeChild?.id ?? null} activeChildName={childName} onOpenCurriculum={() => navigate("curriculum")} onOpenCourseZero={() => navigate("course-zero")} onStartLearningSession={showSessionEntry ? (requestedChildId, targetLessonId, mode) => {
          if (!isValidBackendChildId(requestedChildId) || !activeChild || requestedChildId !== activeChild.id) return false;
          setLearningSessionLessonId(targetLessonId);
          setLearningSessionMode(mode);
          navigate("learning-session");
          return true;
        } : undefined} />}
        {route === "learning-session" && <LessonPlayerPage lessonId={learningSessionLessonId} activeChildId={activeChild?.id ?? null} initialMode={learningSessionMode} onBack={() => { setLearningSessionMode("LEARN"); navigate("home"); }} />}
        {route === "practice" && <div className="app-page practice-page" key={activeProfile.key}><PageHeading kicker={t("practice")} title={t("practiceTitle")} subtitle={t("practiceHint")} icon={<Sparkles/>}/><LearningPage activeChildId={activeChild?.id ?? null} /></div>}
        {route === "parent" && <ParentAreaPage parentSession={parentSession} onSignedIn={onParentSignedIn} onSignOut={() => void onParentSignOut()} onOpenSettings={() => navigate("me")} />}
        {route === "curriculum" && <CurriculumPage onOpenCourseZero={() => navigate("course-zero")} />}
        {route === "course-zero" && <CourseZeroPage onBack={() => navigate("curriculum")} onStartFirstLesson={() => navigate("first-lesson")} />}
        {route === "first-lesson" && <FirstLessonPage onBack={() => navigate("curriculum")} onOpenPractice={() => navigate("practice")} />}
        {route === "tutor" && <div className="app-page"><TutorPage /></div>}
        {route === "commercialization" && <div className="app-page"><CommercializationPage /></div>}
        {route === "diagnostics" && <div className="app-page"><DiagnosticsPage /></div>}
        {route === "me" && <SettingsPage children={children} activeChildId={activeChild?.id ?? null} parentSession={parentSession} canManageChildren={canManageChildren} childrenLoading={childrenLoading} onSignedIn={onParentSignedIn} onSignOut={() => void onParentSignOut()} onSelectChild={(id) => {
          const profile = profiles.find((item) => item.role === "child" && item.childId === id);
          if (!profile || !isValidBackendChildId(id)) return;
          setActiveKey(profile.key); navigate("home");
        }} onAddChild={() => { setAddError(""); setAddOpen(true); }} language={language} setLanguage={setLanguage} onOpenParent={() => { setActiveKey("parent"); navigate("parent"); }} />}
        </Suspense>
        </>}
      </div>
    </div>
    <nav className={`app-tabbar ${isChildPortal ? "app-tabbar-hidden" : ""}`} aria-label={activeProfile.role === "parent" ? t("parent") : t("today")}>
      {navItems.map(({ id, label, icon: Icon }) => <button key={id} className={route === id ? "app-tab active" : "app-tab"} aria-current={route === id ? "page" : undefined} onClick={() => navigate(id)}><Icon size={22} strokeWidth={route === id ? 2.5 : 2}/><span>{label}</span></button>)}
      {activeProfile.role === "parent" && <button className="app-tab" onClick={() => navigate("practice")}><Sparkles size={22}/><span>{t("practice")}</span></button>}
    </nav>
    {addOpen && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !creatingChild) setAddOpen(false); }}><section className="dialog add-learner-dialog" role="dialog" aria-modal="true" aria-labelledby="add-profile-title"><button className="dialog-close" aria-label={t("close")} onClick={() => setAddOpen(false)} disabled={creatingChild}><X/></button><div className="dialog-icon"><Plus/></div><p className="eyebrow">{t("addLearner")}</p><h2 id="add-profile-title">{t("addTitle")}</h2><label htmlFor="new-profile-name">{t("nameLabel")}</label><input id="new-profile-name" autoFocus value={newName} disabled={creatingChild} onChange={(event) => { setNewName(event.target.value); setAddError(""); }} onKeyDown={(event) => { if (event.key === "Enter") void addProfile(); }} placeholder={t("namePlaceholder")} />{addError && <p className="field-error" role="alert">{addError}</p>}<div className="dialog-actions"><button className="button button-secondary" onClick={() => setAddOpen(false)} disabled={creatingChild}>{t("cancel")}</button><button className="button button-primary" onClick={() => void addProfile()} disabled={creatingChild || !newName.trim()}>{creatingChild ? t("loading") : t("create")}</button></div></section></div>}
  </div>;
}

function ButtonProfile({ name, color }: { name: string; color: string }) {
  return <AriaButton className="profile-trigger"><span className={`avatar avatar-${color}`}>{name.slice(-1)}</span><span className="profile-name">{name}</span><ChevronDown size={16}/></AriaButton>;
}

function AppLoading({ label }: { label: string }) {
  return <div className="app-loading" role="status"><span className="app-loading-dot"/>{label}</div>;
}

function PageHeading({ kicker, title, subtitle, icon }: { kicker: string; title: string; subtitle: string; icon: ReactNode }) {
  return <header className="page-heading"><div className="page-heading-icon">{icon}</div><div><p className="eyebrow">{kicker}</p><h1>{title}</h1><p className="lead">{subtitle}</p></div></header>;
}

function SettingsPage({ children, activeChildId, parentSession, canManageChildren, childrenLoading, onSignedIn, onSignOut, onSelectChild, onAddChild, language, setLanguage, onOpenParent }: {
  children: Child[];
  activeChildId: number | null;
  parentSession: ParentSession;
  canManageChildren: boolean;
  childrenLoading: boolean;
  onSignedIn: (parent: ParentIdentity) => void | Promise<void>;
  onSignOut: () => void;
  onSelectChild: (childId: number) => void;
  onAddChild: () => void;
  language: DisplayLanguage;
  setLanguage: (language: DisplayLanguage) => void;
  onOpenParent: () => void;
}) {
  const { t } = useLocale();
  const authCopy = parentAuthCopy(language);
  const [learningLocale, setLearningLocale] = useState<LearningLocale>(currentLearningLocale);
  const [annotation, setAnnotation] = useState<AnnotationMode>(currentAnnotationMode);
  function setLearning(value: LearningLocale) { setLearningLocale(value); localStorage.setItem(LEARNING_LOCALE_KEY, value); }
  function setNotation(value: AnnotationMode) { setAnnotation(value); localStorage.setItem(ANNOTATION_MODE_KEY, value); }
  return <main className="app-page settings-page">
    <PageHeading kicker={t("settings")} title={t("settingsTitle")} subtitle={t("settingsIntro")} icon={<Languages/>}/>
    <section className="settings-section"><div className="settings-section-heading"><div><p className="eyebrow">01 · APP LANGUAGE</p><h2>{t("displayLanguage")}</h2></div><Languages/></div><p className="settings-help">{t("beginner")}</p><SettingSelect label={t("displayLanguage")} selectedKey={language} onChange={(value) => { if (value) setLanguage(value as DisplayLanguage); }} options={[["zh-Hant", "繁體中文"], ["zh-Hans", "简体中文"], ["en", "English"], ["ja", "日本語"], ["ko", "한국어"], ["es", "Español"]]} /></section>
    <section className="settings-section"><div className="settings-section-heading"><div><p className="eyebrow">02 · LEARNING CONTENT</p><h2>{t("learningChinese")}</h2></div><BookOpen/></div><SettingSelect label={t("learningChinese")} selectedKey={learningLocale} onChange={(value) => { if (value) setLearning(value as LearningLocale); }} options={[["zh-TW", t("traditional")], ["zh-CN", t("simplified")]]}/><div className="setting-divider"/><SettingSelect label={t("notation")} selectedKey={annotation} onChange={(value) => { if (value) setNotation(value as AnnotationMode); }} options={[["AUTO", t("notationAuto")], ["BOPOMOFO", t("bopomofo")], ["PINYIN", t("pinyin")], ["HIDDEN", t("hide")]]}/><p className="settings-help">{learningLocale === "zh-TW" ? t("traditionalHint") : t("simplifiedHint")}</p></section>
    <section className="settings-section">
      <div className="settings-section-heading"><div><p className="eyebrow">03 · FAMILY</p><h2>{t("familyMembers")}</h2></div><CircleUserRound/></div>
      {parentSession.authRequired && !parentSession.authenticated && <div className="parent-auth-block"><h3>{authCopy.heading}</h3><p className="settings-help">{authCopy.description}</p><GoogleParentSignIn onSignedIn={onSignedIn}/></div>}
      {parentSession.authRequired && parentSession.authenticated && parentSession.role === "parent" && <div className="parent-auth-status"><p><strong>{authCopy.signedInAs}:</strong> {parentSession.parent?.email}</p><button className="button button-text" onClick={onSignOut}>{authCopy.signOut}</button></div>}
      {childrenLoading && <p role="status" className="settings-help">{t("loading")}</p>}
      {!childrenLoading && children.length === 0 && canManageChildren && <p className="settings-help">{authCopy.noChildren}</p>}
      <div className="family-list">{children.map((child, index) => <button type="button" className="family-row family-row-button" key={child.id} aria-pressed={child.id === activeChildId} onClick={() => onSelectChild(child.id)}><span className={"avatar avatar-" + (index % 2 ? "mint" : "coral")}>{child.name.slice(-1)}</span><span><strong>{child.name}</strong><small>{child.id === activeChildId ? authCopy.selected : authCopy.chooseChild}</small></span>{child.id === activeChildId && <span aria-hidden="true">✓</span>}</button>)}</div>
      <PlacementStatus key={activeChildId ?? "no-active-child"} childId={activeChildId} authenticatedParent={parentSession.authenticated && parentSession.role === "parent"} language={language} />
      {canManageChildren && <button type="button" className="button button-secondary" onClick={onAddChild}><Plus size={18}/>{authCopy.addChild}</button>}
      <p className="settings-help">{authCopy.childLoginNote}</p>
    </section>
    <section className="settings-note"><div><strong>{t("privacy")}</strong><p>{t("privacyText")}</p></div></section>
    <section className="my-secondary-actions"><button onClick={onOpenParent}><CircleUserRound/><span><strong>{t("parentZone")}</strong><small>{t("parentDescription")}</small></span><ChevronDown/></button><button onClick={() => window.location.assign("/diagnostics")}><Settings2/><span><strong>{t("diagnostics")}</strong><small>{t("privacyText")}</small></span><ChevronDown/></button></section>
  </main>;
}

function SettingSelect({ label, selectedKey, onChange, options }: { label: string; selectedKey: string | number; onChange: (key: string | number | null) => void; options: Array<[string, string]> }) {
  return <Select className="setting-select" aria-label={label} selectedKey={selectedKey} onSelectionChange={onChange}><Label>{label}</Label><AriaButton className="setting-select-button"><SelectValue/><ChevronDown size={18}/></AriaButton><Popover className="app-popover select-popover"><ListBox className="setting-options">{options.map(([id, value]) => <ListBoxItem key={id} id={id} textValue={value} className="setting-option">{value}</ListBoxItem>)}</ListBox></Popover></Select>;
}

function ParentAreaPage({ parentSession, onSignedIn, onSignOut, onOpenSettings }: { parentSession: ParentSession; onSignedIn: (parent: ParentIdentity) => void | Promise<void>; onSignOut: () => void; onOpenSettings: () => void }) {
  const { t, language } = useLocale();
  const authCopy = parentAuthCopy(language);
  const needsParentSignIn = parentSession.authRequired && !(parentSession.authenticated && (parentSession.role === "parent" || parentSession.role === "developer" || parentSession.role === "admin"));
  if (needsParentSignIn) return <main className="app-page parent-intro"><PageHeading kicker={t("parent")} title={authCopy.heading} subtitle={authCopy.description} icon={<CircleUserRound/>}/><section className="settings-section parent-auth-block"><GoogleParentSignIn onSignedIn={onSignedIn}/><button className="button button-text" onClick={onOpenSettings}>{t("settings")}</button></section></main>;
  return <><section className="app-page parent-intro"><PageHeading kicker={t("parent")} title={t("parentTitle")} subtitle={t("parentDescription")} icon={<CircleUserRound/>}/><section className="parent-shortcuts"><button onClick={() => document.getElementById("weekly-tests")?.scrollIntoView({ behavior: "smooth", block: "start" })}><BookOpen/><span><strong>{t("scores")}</strong><small>{t("scoresHint")}</small></span><ChevronDown className="shortcut-chevron"/></button><button onClick={onOpenSettings}><Settings2/><span><strong>{t("familySettings")}</strong><small>{t("languagePrivacy")}</small></span><ChevronDown className="shortcut-chevron"/></button></section>{parentSession.role === "parent" && <button className="button button-text" onClick={onSignOut}>{authCopy.signOut}</button>}</section><div className="app-page parent-data"><DashboardPage /></div></>;
}
