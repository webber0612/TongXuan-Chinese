import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { BookOpen, ChevronDown, CircleUserRound, Compass, House, Languages, Plus, Settings2, Sparkles, UserRound, X } from "lucide-react";
import { Button as AriaButton, ListBox, ListBoxItem, Popover, Select, SelectValue, Label } from "react-aria-components";
import { ChildPortalPage } from "./pages/ChildPortalPage";
import { CourseZeroPage } from "./pages/CourseZeroPage";
import { FirstLessonPage } from "./pages/FirstLessonPage";
import { Profile, ACTIVE_PROFILE_STORAGE_KEY, defaultProfiles, loadProfiles, reconcileProfiles, saveProfiles, selectProfile } from "./lib/profiles";
import { ANNOTATION_MODE_KEY, currentAnnotationMode, currentLearningLocale, LEARNING_LOCALE_KEY, useLocale, type AnnotationMode, type DisplayLanguage, type LearningLocale } from "./lib/i18n";

const API = import.meta.env.VITE_API_BASE ?? "";
const LearningPage = lazy(async () => ({ default: (await import("./pages/LearningPage")).LearningPage }));
const DashboardPage = lazy(async () => ({ default: (await import("./pages/DashboardPage")).DashboardPage }));
const CurriculumPage = lazy(async () => ({ default: (await import("./pages/CurriculumPage")).CurriculumPage }));
const TutorPage = lazy(async () => ({ default: (await import("./pages/TutorPage")).TutorPage }));
const CommercializationPage = lazy(async () => ({ default: (await import("./pages/CommercializationPage")).CommercializationPage }));
const DiagnosticsPage = lazy(async () => ({ default: (await import("./pages/DiagnosticsPage")).DiagnosticsPage }));
const LearningSessionPage = lazy(async () => ({ default: (await import("./pages/LearningSessionPage")).LearningSessionPage }));
type Child = { id: number; name: string };
type Route = "home" | "practice" | "parent" | "curriculum" | "course-zero" | "first-lesson" | "learning-session" | "tutor" | "me" | "commercialization" | "diagnostics" | "archived-preview";

function appBaseAt(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const githubPagesBase = "/TongXuan-Chinese";
  if (normalized === githubPagesBase || normalized.startsWith(`${githubPagesBase}/`)) return `${githubPagesBase}/`;
  return new URL(import.meta.env.BASE_URL, `${window.location.origin}${pathname}`).pathname;
}

export function routeFromPath(pathname: string): Route {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const appBase = appBaseAt(pathname).replace(/\/+$/, "");
  const appPath = appBase && (normalized === appBase || normalized.startsWith(`${appBase}/`))
    ? normalized.slice(appBase.length) || "/"
    : normalized;
  if (["/kids", "/preview-kids", "/preview-2", "/preview-b"].includes(appPath)) return "home";
  if (["/preview", "/preview-pixel", "/preview-reference", "/preview-directions", "/learning-desk", "/learning-calendar"].includes(appPath)) return "archived-preview";
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
  return "home";
}

const paths: Record<Exclude<Route, "archived-preview">, string> = { home: "/", practice: "/practice", parent: "/parent-dashboard", curriculum: "/curriculum", "course-zero": "/course-zero", "first-lesson": "/first-lesson", "learning-session": "/learning-session", tutor: "/tutor", me: "/me", commercialization: "/admin/commercialization", diagnostics: "/diagnostics" };

export function isCanonicalHomePath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const base = appBaseAt(pathname).replace(/\/+$/, "");
  const appPath = base && (normalized === base || normalized.startsWith(`${base}/`)) ? normalized.slice(base.length) || "/" : normalized;
  return appPath === "/";
}

export function resolveLearningSessionChildId(profiles: Profile[], learnerName: string): number | null {
  const expectedName = learnerName.trim().toLocaleLowerCase();
  const matchingChildren = profiles.filter((profile) => profile.role === "child" && profile.name.trim().toLocaleLowerCase() === expectedName && profile.childId !== null);
  return matchingChildren.length === 1 ? matchingChildren[0].childId : null;
}

function pathAtAppBase(path: string): string {
  const appBase = appBaseAt(window.location.pathname);
  return `${appBase}${path.replace(/^\/+/, "")}`;
}

export function AppShell() {
  const { t, language, setLanguage } = useLocale();
  const [route, setRoute] = useState<Route>(() => routeFromPath(window.location.pathname));
  const [profiles, setProfiles] = useState<Profile[]>(() => loadProfiles());
  const [activeKey, setActiveKey] = useState(() => localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY) ?? "child-a");
  const [children, setChildren] = useState<Child[]>([]);
  const [childrenLoading, setChildrenLoading] = useState(true);
  const [childrenError, setChildrenError] = useState("");
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState("");
  const [creatingChild, setCreatingChild] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const activeProfile = selectProfile(profiles, activeKey);
  const activeChild = activeProfile.role === "child" ? children.find((child) => child.id === activeProfile.childId) ?? null : null;
  const childName = activeProfile.role === "child" ? activeProfile.name : t("childRole");

  useEffect(() => { saveProfiles(profiles); }, [profiles]);
  useEffect(() => { localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, activeProfile.key); }, [activeProfile.key]);
  useEffect(() => { const onPopState = () => setRoute(routeFromPath(window.location.pathname)); window.addEventListener("popstate", onPopState); return () => window.removeEventListener("popstate", onPopState); }, []);

  async function loadChildren() {
    setChildrenLoading(true); setChildrenError("");
    try {
      const response = await fetch(`${API}/api/children`);
      if (!response.ok) throw new Error("children_unavailable");
      const value = await response.json() as Child[];
      setChildren(value);
      const nextProfiles = reconcileProfiles(value, loadProfiles());
      setProfiles(nextProfiles);
      setActiveKey((current) => nextProfiles.some((profile) => profile.key === current) ? current : (nextProfiles.find((profile) => profile.role === "child") ?? nextProfiles.find((profile) => profile.role === "parent")!).key);
    } catch { setChildrenError(t("childrenError")); }
    finally { setChildrenLoading(false); }
  }
  useEffect(() => { void loadChildren(); }, []);

  function navigate(next: Route) { setRoute(next); window.history.pushState({}, "", pathAtAppBase(next === "archived-preview" ? "/" : paths[next])); }
  function chooseProfile(key: string) { const profile = profiles.find((item) => item.key === key); if (!profile) return; setActiveKey(profile.key); setProfileOpen(false); navigate(profile.role === "parent" ? "parent" : "home"); }
  async function addProfile() {
    const cleanName = newName.trim();
    if (!cleanName) { setAddError(t("createError")); return; }
    if (children.some((child) => child.name.trim().toLocaleLowerCase() === cleanName.toLocaleLowerCase())) { setAddError(t("nameExists")); return; }
    setCreatingChild(true); setAddError("");
    try {
      const response = await fetch(`${API}/api/children`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: cleanName }) });
      if (!response.ok) { const detail = await response.json().catch(() => ({})); throw new Error(detail.detail ?? t("createFailed")); }
      const created = await response.json() as Child;
      await loadChildren(); setActiveKey(`child-${created.id}`); setNewName(""); setAddOpen(false); navigate("home");
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

  const isChildPortal = route === "home" || route === "archived-preview" || route === "learning-session";
  const showSessionEntry = isCanonicalHomePath(window.location.pathname);

  return <div className={`app-shell ${isChildPortal ? "app-shell-child-portal" : ""}`}>
    <header className={`app-header ${isChildPortal ? "app-header-hidden" : ""}`}>
      <button className="brand" onClick={() => navigate("home")} aria-label="TongXuan home"><span className="brand-mark" aria-hidden="true">文</span><span><strong>TongXuan</strong><small>Chinese learning</small></span></button>
      <div className="header-actions">
        <div className="profile-select">
          <button className="profile-trigger" aria-expanded={profileOpen} aria-haspopup="menu" onClick={() => setProfileOpen((open) => !open)}><span className={`avatar avatar-${activeProfile.color}`}>{activeProfile.name.slice(-1)}</span><span className="profile-name">{activeProfile.name}</span><ChevronDown size={16}/></button>
          {profileOpen && <div className="app-popover profile-menu" role="menu" aria-label={t("chooseLearner")}>
            {profiles.map((profile) => <button key={profile.key} className="profile-option" role="menuitemradio" aria-checked={profile.key === activeProfile.key} onClick={() => chooseProfile(profile.key)}><span className={`avatar avatar-${profile.color}`}>{profile.name.slice(-1)}</span><span><strong>{profile.name}</strong><small>{profile.role === "parent" ? t("parentRole") : t("childRole")}</small></span>{profile.key === activeProfile.key && <span aria-hidden="true">✓</span>}</button>)}
            <button className="add-profile-action" onClick={() => { setProfileOpen(false); setAddOpen(true); }}><Plus size={18}/>{t("addLearner")}</button>
          </div>}
        </div>
      </div>
    </header>
    <div className="app-frame">
      <div className="main-column">
        {childrenLoading && !isChildPortal && <div className="offline-strip" role="status">{t("loading")}</div>}
        {childrenError && !isChildPortal && <div className="offline-strip error-strip" role="alert">{childrenError} <button className="button button-text" onClick={() => void loadChildren()}>{t("retry")}</button></div>}
        {route === "archived-preview" && <main className="app-page"><PageHeading kicker={t("library")} title={t("previewArchived")} subtitle={t("previewArchivedDescription")} icon={<BookOpen/>}/><button className="button button-primary" onClick={() => navigate("home")}><House size={18}/>{t("today")}</button></main>}
        <Suspense fallback={<AppLoading label={t("loading")} />}>
        {route === "home" && <ChildPortalPage onOpenCurriculum={() => navigate("curriculum")} onStartLearningSession={showSessionEntry ? (learnerName) => {
          const childId = resolveLearningSessionChildId(profiles, learnerName);
          const childProfile = profiles.find((profile) => profile.role === "child" && profile.childId === childId);
          if (!childId || !childProfile) return false;
          setActiveKey(childProfile.key);
          navigate("learning-session");
          return true;
        } : undefined} />}
        {route === "learning-session" && <LearningSessionPage activeChildId={activeChild?.id ?? null} onBack={() => navigate("home")} />}
        {route === "practice" && <div className="app-page practice-page" key={activeProfile.key}><PageHeading kicker={t("practice")} title={t("practiceTitle")} subtitle={t("practiceHint")} icon={<Sparkles/>}/><LearningPage activeChildId={activeChild?.id ?? null} /></div>}
        {route === "parent" && <ParentAreaPage />}
        {route === "curriculum" && <CurriculumPage onOpenCourseZero={() => navigate("course-zero")} />}
        {route === "course-zero" && <CourseZeroPage onBack={() => navigate("curriculum")} onStartFirstLesson={() => navigate("first-lesson")} />}
        {route === "first-lesson" && <FirstLessonPage onBack={() => navigate("curriculum")} onOpenPractice={() => navigate("practice")} />}
        {route === "tutor" && <div className="app-page"><TutorPage /></div>}
        {route === "commercialization" && <div className="app-page"><CommercializationPage /></div>}
        {route === "diagnostics" && <div className="app-page"><DiagnosticsPage /></div>}
        {route === "me" && <SettingsPage profiles={profiles} language={language} setLanguage={setLanguage} onOpenParent={() => { const parent = profiles.find((profile) => profile.role === "parent"); if (parent) { setActiveKey(parent.key); navigate("parent"); } }} />}
        </Suspense>
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

function SettingsPage({ profiles, language, setLanguage, onOpenParent }: { profiles: Profile[]; language: DisplayLanguage; setLanguage: (language: DisplayLanguage) => void; onOpenParent: () => void }) {
  const { t } = useLocale();
  const [learningLocale, setLearningLocale] = useState<LearningLocale>(currentLearningLocale);
  const [annotation, setAnnotation] = useState<AnnotationMode>(currentAnnotationMode);
  function setLearning(value: LearningLocale) { setLearningLocale(value); localStorage.setItem(LEARNING_LOCALE_KEY, value); }
  function setNotation(value: AnnotationMode) { setAnnotation(value); localStorage.setItem(ANNOTATION_MODE_KEY, value); }
  return <main className="app-page settings-page">
    <PageHeading kicker={t("settings")} title={t("settingsTitle")} subtitle={t("settingsIntro")} icon={<Languages/>}/>
    <section className="settings-section"><div className="settings-section-heading"><div><p className="eyebrow">01 · APP LANGUAGE</p><h2>{t("displayLanguage")}</h2></div><Languages/></div><p className="settings-help">{t("beginner")}</p><SettingSelect label={t("displayLanguage")} selectedKey={language} onChange={(value) => { if (value) setLanguage(value as DisplayLanguage); }} options={[["zh-Hant", "繁體中文"], ["zh-Hans", "简体中文"], ["en", "English"], ["ja", "日本語"], ["ko", "한국어"], ["es", "Español"]]} /></section>
    <section className="settings-section"><div className="settings-section-heading"><div><p className="eyebrow">02 · LEARNING CONTENT</p><h2>{t("learningChinese")}</h2></div><BookOpen/></div><SettingSelect label={t("learningChinese")} selectedKey={learningLocale} onChange={(value) => { if (value) setLearning(value as LearningLocale); }} options={[["zh-TW", t("traditional")], ["zh-CN", t("simplified")]]}/><div className="setting-divider"/><SettingSelect label={t("notation")} selectedKey={annotation} onChange={(value) => { if (value) setNotation(value as AnnotationMode); }} options={[["AUTO", t("notationAuto")], ["BOPOMOFO", t("bopomofo")], ["PINYIN", t("pinyin")], ["HIDDEN", t("hide")]]}/><p className="settings-help">{learningLocale === "zh-TW" ? t("traditionalHint") : t("simplifiedHint")}</p></section>
    <section className="settings-section"><div className="settings-section-heading"><div><p className="eyebrow">03 · FAMILY</p><h2>{t("familyMembers")}</h2></div><CircleUserRound/></div><div className="family-list">{profiles.map((profile) => <div className="family-row" key={profile.key}><span className={`avatar avatar-${profile.color}`}>{profile.name.slice(-1)}</span><span><strong>{profile.name}</strong><small>{profile.role === "parent" ? t("parentRole") : t("childRole")}</small></span></div>)}</div></section>
    <section className="settings-note"><div><strong>{t("privacy")}</strong><p>{t("privacyText")}</p></div></section>
    <section className="my-secondary-actions"><button onClick={onOpenParent}><CircleUserRound/><span><strong>{t("parentZone")}</strong><small>{t("parentDescription")}</small></span><ChevronDown/></button><button onClick={() => window.location.assign("/diagnostics")}><Settings2/><span><strong>{t("diagnostics")}</strong><small>{t("privacyText")}</small></span><ChevronDown/></button></section>
  </main>;
}

function SettingSelect({ label, selectedKey, onChange, options }: { label: string; selectedKey: string | number; onChange: (key: string | number | null) => void; options: Array<[string, string]> }) {
  return <Select className="setting-select" aria-label={label} selectedKey={selectedKey} onSelectionChange={onChange}><Label>{label}</Label><AriaButton className="setting-select-button"><SelectValue/><ChevronDown size={18}/></AriaButton><Popover className="app-popover select-popover"><ListBox className="setting-options">{options.map(([id, value]) => <ListBoxItem key={id} id={id} textValue={value} className="setting-option">{value}</ListBoxItem>)}</ListBox></Popover></Select>;
}

function ParentAreaPage() {
  const { t } = useLocale();
  return <><section className="app-page parent-intro"><PageHeading kicker={t("parent")} title={t("parentTitle")} subtitle={t("parentDescription")} icon={<CircleUserRound/>}/><section className="parent-shortcuts"><button onClick={() => document.getElementById("weekly-tests")?.scrollIntoView({ behavior: "smooth", block: "start" })}><BookOpen/><span><strong>{t("scores")}</strong><small>{t("scoresHint")}</small></span><ChevronDown className="shortcut-chevron"/></button><button onClick={() => { window.history.pushState({}, "", paths.me); window.dispatchEvent(new PopStateEvent("popstate")); }}><Settings2/><span><strong>{t("familySettings")}</strong><small>{t("languagePrivacy")}</small></span><ChevronDown className="shortcut-chevron"/></button></section></section><div className="app-page parent-data"><DashboardPage /></div></>;
}
