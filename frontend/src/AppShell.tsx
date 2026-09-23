import { useEffect, useMemo, useRef, useState } from "react";
import { ChildHomePage } from "./pages/ChildHomePage";
import { LearningPage } from "./pages/LearningPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CurriculumPage } from "./pages/CurriculumPage";
import { TutorPage } from "./pages/TutorPage";
import { CommercializationPage } from "./pages/CommercializationPage";
import { DiagnosticsPage } from "./pages/DiagnosticsPage";
import { Profile, ACTIVE_PROFILE_STORAGE_KEY, addChildProfile, defaultProfiles, loadProfiles, saveProfiles, selectProfile } from "./lib/profiles";

const API = import.meta.env.VITE_API_BASE ?? "";
type Child = { id: number; name: string };
type Route = "home" | "practice" | "parent" | "curriculum" | "tutor" | "settings" | "commercialization" | "diagnostics";

function routeFromPath(pathname: string): Route {
  if (pathname === "/parent-dashboard") return "parent";
  if (pathname === "/curriculum") return "curriculum";
  if (pathname === "/tutor") return "tutor";
  if (pathname === "/admin/commercialization") return "commercialization";
  if (pathname === "/diagnostics") return "diagnostics";
  if (pathname === "/practice") return "practice";
  if (pathname === "/settings") return "settings";
  return "home";
}

export function AppShell() {
  const [route, setRoute] = useState<Route>(() => routeFromPath(window.location.pathname));
  const [profiles, setProfiles] = useState<Profile[]>(() => loadProfiles());
  const [activeKey, setActiveKey] = useState(() => localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY) ?? "child-a");
  const [children, setChildren] = useState<Child[]>([]);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [apiNotice, setApiNotice] = useState("");
  const addTrigger = useRef<HTMLElement | null>(null);

  const activeProfile = selectProfile(profiles, activeKey);
  const activeChild = activeProfile.role === "child" ? children.find((child) => child.id === activeProfile.childId) ?? (children[0] && activeProfile.key === "child-a" ? children[0] : null) : null;

  useEffect(() => { saveProfiles(profiles); }, [profiles]);
  useEffect(() => { localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, activeProfile.key); }, [activeProfile.key]);
  useEffect(() => {
    if (!addOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") { setAddOpen(false); addTrigger.current?.focus(); } };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [addOpen]);
  useEffect(() => {
    fetch(`${API}/api/children`).then(async (response) => { if (!response.ok) throw new Error("children_unavailable"); return response.json() as Promise<Child[]>; }).then((value) => {
      setChildren(value); setProfiles((current) => current.map((profile, index) => profile.role === "child" ? { ...profile, childId: value[index]?.id ?? profile.childId, name: value[index]?.name ?? profile.name } : profile));
    }).catch(() => setApiNotice("尚未連線到家庭資料；你仍可先瀏覽介面。"));
  }, []);

  function navigate(next: Route) { setRoute(next); setProfileMenuOpen(false); const paths: Record<Route, string> = { home: "/", practice: "/practice", parent: "/parent-dashboard", curriculum: "/curriculum", tutor: "/tutor", settings: "/settings", commercialization: "/admin/commercialization", diagnostics: "/diagnostics" }; window.history.pushState({}, "", paths[next]); }
  function chooseProfile(profile: Profile) { setActiveKey(profile.key); navigate(profile.role === "parent" ? "parent" : "home"); }
  function addProfile() { const updated = addChildProfile(profiles, newName); if (updated.length !== profiles.length) { setProfiles(updated); setNewName(""); setAddOpen(false); setActiveKey(updated[updated.length - 1].key); navigate("home"); } }
  function closeAddProfile() { setAddOpen(false); setNewName(""); addTrigger.current?.focus(); }

  const childName = activeProfile.role === "child" ? activeProfile.name : "小學習者";
  const navItems = useMemo(() => activeProfile.role === "parent" ? [{ id: "parent" as Route, label: "家庭進度", icon: "◌" }, { id: "curriculum" as Route, label: "課程", icon: "▤" }, { id: "settings" as Route, label: "設定", icon: "⚙" }] : [{ id: "home" as Route, label: "今天學什麼", icon: "⌂" }, { id: "practice" as Route, label: "練習區", icon: "✎" }, { id: "curriculum" as Route, label: "我的課程", icon: "▤" }, { id: "tutor" as Route, label: "問問老師", icon: "☼" }], [activeProfile.role]);

  return <div className="app-shell">
    <header className="app-header"><a className="brand" href="/" onClick={(event) => { event.preventDefault(); navigate("home"); }}><span className="brand-mark" aria-hidden="true">文</span><span><strong>TongXuan</strong><small>家庭中文</small></span></a><div className="header-actions"><div className="profile-switcher"><button className="profile-trigger" aria-expanded={profileMenuOpen} aria-haspopup="listbox" onClick={() => setProfileMenuOpen((open) => !open)}><span className={`avatar avatar-${activeProfile.color}`}>{activeProfile.name.slice(-1)}</span><span>{activeProfile.name}</span><span aria-hidden="true">⌄</span></button>{profileMenuOpen && <div className="profile-menu" role="listbox" aria-label="切換使用者">{profiles.map((profile) => <button role="option" aria-selected={profile.key === activeProfile.key} key={profile.key} onClick={() => chooseProfile(profile)}><span className={`avatar avatar-${profile.color}`}>{profile.name.slice(-1)}</span><span><strong>{profile.name}</strong><small>{profile.role === "parent" ? "家長管理者" : "學習者"}</small></span>{profile.key === activeProfile.key && <span aria-label="目前使用中">✓</span>}</button>)}<button className="add-profile" ref={addTrigger as React.RefObject<HTMLButtonElement>} onClick={() => { addTrigger.current = document.activeElement as HTMLElement; setAddOpen(true); setProfileMenuOpen(false); }}>＋ 新增學習者</button></div>}</div>{activeProfile.role === "child" && <button className="parent-link" onClick={() => chooseProfile(profiles.find((profile) => profile.role === "parent") ?? defaultProfiles[2])}>家長區</button>}</div></header>
    <div className="app-frame"><aside className="side-nav" aria-label="主要導覽"><p className="nav-label">{activeProfile.role === "parent" ? "家長視角" : "學習空間"}</p>{navItems.map((item) => <button className={route === item.id ? "nav-item active" : "nav-item"} key={item.id} onClick={() => navigate(item.id)}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}{activeProfile.role === "parent" && <button className="nav-item" onClick={() => { navigate("practice"); }}><span aria-hidden="true">↩</span>學習者視角</button>}</aside><div className="main-column">{apiNotice && <div className="offline-strip" role="status">{apiNotice}</div>}{route === "home" && <ChildHomePage child={activeChild} childName={childName} onOpenPractice={() => navigate("practice")} />}{route === "practice" && <main className="legacy-page"><LearningPage /></main>}{route === "parent" && <ParentAreaPage />} {route === "curriculum" && <main className="legacy-page"><CurriculumPage /></main>}{route === "tutor" && <main className="legacy-page"><TutorPage /></main>}{route === "commercialization" && <main className="legacy-page"><CommercializationPage /></main>}{route === "diagnostics" && <main className="legacy-page"><DiagnosticsPage /></main>}{route === "settings" && <SettingsPage profiles={profiles} />}</div></div>
    <nav className="mobile-nav" aria-label="快速導覽">{navItems.slice(0, 4).map((item) => <button className={route === item.id ? "active" : ""} key={item.id} onClick={() => navigate(item.id)}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}</nav>
    {addOpen && <div className="dialog-backdrop" role="presentation"><div className="dialog" role="dialog" aria-modal="true" aria-labelledby="add-profile-title"><button className="dialog-close" aria-label="關閉新增學習者視窗" onClick={closeAddProfile}>×</button><p className="eyebrow">新增使用者</p><h2 id="add-profile-title">建立一個新的學習者</h2><p>名字只保存在這台裝置上，之後仍可由後端家庭帳戶管理。</p><label htmlFor="new-profile-name">學習者名稱</label><input id="new-profile-name" autoFocus value={newName} onChange={(event) => setNewName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addProfile(); }} placeholder="例如：小安" /><div className="dialog-actions"><button className="button button-secondary" onClick={closeAddProfile}>取消</button><button className="button button-primary" disabled={!newName.trim()} onClick={addProfile}>建立學習者</button></div></div></div>}
  </div>;
}

function SettingsPage({ profiles }: { profiles: Profile[] }) {
  return <main className="page-content"><section className="page-intro"><p className="eyebrow">家庭設定</p><h1>讓每個人都有舒服的學習位置</h1><p className="lead">這裡只管理本機介面偏好；學習資料仍由後端的 child scope 與權限邊界保護。</p></section><section className="soft-panel settings-list"><h2>家庭成員</h2>{profiles.map((profile) => <div className="setting-row" key={profile.key}><span className={`avatar avatar-${profile.color}`}>{profile.name.slice(-1)}</span><div><strong>{profile.name}</strong><small>{profile.role === "parent" ? "家長管理者" : "學習者"}</small></div></div>)}</section><section className="soft-panel"><h2>隱私提醒</h2><p className="muted">本機 profile 選擇會保存在瀏覽器。Dashboard、課程與商業準備度讀取不會建立學習事件；真正的安全邊界仍在 backend。</p></section></main>;
}

function ParentAreaPage() {
  return <><main className="page-content parent-area"><section className="page-intro"><p className="eyebrow">家長視角 · 只讀</p><h1>看見孩子的學習節奏</h1><p className="lead">先選孩子，再查看事件型進度。這裡不會建立練習、改寫 mastery，或替任何技能打分。</p><div className="parent-tools"><article className="soft-panel"><p className="eyebrow">SCREEN TIME</p><h2>學習時間摘要</h2><p className="muted">時間摘要會在後端提供可稽核活動時顯示；目前不以猜測補上分鐘數。</p></article><article className="soft-panel"><p className="eyebrow">LOOKUP</p><h2>成就與分數查找</h2><p className="muted">下方技能摘要與 Weekly Tests 會保留每個技能的獨立紀錄，方便按孩子與時間範圍查找。</p></article></div></section></main><main className="legacy-page"><DashboardPage /></main></>;
}
