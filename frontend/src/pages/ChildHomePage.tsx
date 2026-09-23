import { useEffect, useRef, useState } from "react";
import { Reward, PARENT_GATE_NOTE, validateParentPassword } from "../lib/parentGate";

const API = import.meta.env.VITE_API_BASE ?? "";
type QueueItem = { id: string; character: string; source?: string; source_detail?: string; priority?: number };
type Child = { id: number; name: string };

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json" }, ...options });
  if (!response.ok) {
    let detail = "Request failed";
    try { detail = (await response.json()).detail ?? detail; } catch { /* preserve a useful generic error */ }
    throw new Error(detail);
  }
  return response.json();
}

type ChildHomeProps = { child: Child | null; childName: string; onOpenPractice: () => void };

export function ChildHomePage({ child, childName, onOpenPractice }: ChildHomeProps) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [points, setPoints] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [gateReward, setGateReward] = useState<Reward | null>(null);
  const [password, setPassword] = useState("");
  const [gateError, setGateError] = useState("");
  const lastFocused = useRef<HTMLElement | null>(null);

  async function refresh() {
    if (!child) { setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const [next, balance] = await Promise.all([
        api<QueueItem[]>(`/api/daily-queue?child_id=${child.id}`),
        api<any>(`/api/points?child_id=${child.id}`),
      ]);
      setQueue(next); setPoints(balance);
    } catch (value) { setError(value instanceof Error ? value.message : "今日內容載入失敗"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, [child?.id]);
  useEffect(() => {
    if (!gateReward) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") { setGateReward(null); setPassword(""); lastFocused.current?.focus(); } };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [gateReward]);

  function closeGate() { setGateReward(null); setPassword(""); setGateError(""); lastFocused.current?.focus(); }

  async function redeem() {
    if (!child || !gateReward) return;
    if (!validateParentPassword(password)) { setGateError("請輸入家長密語「家長」以確認兌換。"); return; }
    try {
      await api(`/api/points/redeem/${gateReward.id}?child_id=${child.id}`, { method: "POST", body: "{}" });
      setMessage(`已送出「${gateReward.name}」兌換，後端已完成權限檢查。`);
      setGateReward(null); setPassword(""); setGateError(""); await refresh();
    } catch (value) { setGateError(value instanceof Error ? value.message : "兌換失敗，請稍後再試。"); }
  }

  const next = [...queue].sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0))[0];
  return <main className="page-content child-home" aria-labelledby="child-home-title">
    <section className="welcome-band">
      <div><p className="eyebrow">今天的中文小任務</p><h1 id="child-home-title">嗨，{childName}</h1><p className="lead">一次完成一小步，今天也會更懂一點。</p></div>
      <div className="streak-mark" aria-label="今日學習鼓勵">✦<span>慢慢來</span></div>
    </section>
    {error && <div className="notice notice-error" role="alert">{error} <button className="button button-text" onClick={() => void refresh()}>再試一次</button></div>}
    {loading ? <section className="soft-panel loading-state" aria-live="polite"><span className="loader" />正在準備今天的內容…</section> : <>
      <section className="daily-focus" aria-labelledby="daily-focus-title">
        <div className="section-heading"><div><p className="eyebrow">PRIMARY DAILY ROUTE</p><h2 id="daily-focus-title">今天先做這一件事</h2></div><span className="status-chip">{queue.length ? `${queue.length} 個小任務` : "準備好了"}</span></div>
        {next ? <div className="focus-row"><div className="hanzi-bubble" aria-hidden="true">{next.character}</div><div className="focus-copy"><p className="focus-source">{next.source_detail ?? next.source ?? "中文練習"}</p><h3>認識「{next.character}」</h3><p>看一看、讀一讀，完成後再去探索更多。</p></div><button className="button button-primary button-large" onClick={onOpenPractice}>開始練習 <span aria-hidden="true">→</span></button></div> : <div className="empty-state"><span className="empty-icon" aria-hidden="true">○</span><div><h3>今天還沒有安排內容</h3><p>可以先到練習區準備一些中文小任務。</p></div><button className="button button-secondary" onClick={onOpenPractice}>前往練習區</button></div>}
      </section>
      <section className="home-columns">
        <article className="soft-panel progress-panel"><div className="section-heading"><div><p className="eyebrow">進度</p><h2>你的學習步伐</h2></div><span className="progress-ring" aria-label="今日完成度">{queue.length ? "0%" : "—"}</span></div><p className="muted">練習結果會照技能分開記錄，不會把不同能力混在一起。</p><button className="button button-text" onClick={onOpenPractice}>查看全部技能 <span aria-hidden="true">→</span></button></article>
      <article className="soft-panel reward-panel"><div className="section-heading"><div><p className="eyebrow">小小獎勵</p><h2>點數 {points?.balance ?? "—"}</h2></div><span className="reward-star" aria-hidden="true">★</span></div>{points?.rewards?.length ? <div className="reward-list">{points.rewards.slice(0, 2).map((reward: Reward) => <div className="reward-row" key={reward.id}><div><strong>{reward.name}</strong><small>{reward.description ?? "完成練習後兌換"}</small></div><button className="button button-secondary" disabled={!child || (points?.balance ?? 0) < reward.cost} onClick={(event) => { lastFocused.current = event.currentTarget; setGateReward(reward); setGateError(""); }}>兌換 {reward.cost}</button></div>)}</div> : <p className="muted">完成學習後，這裡會出現你的獎勵。</p>}</article>
      </section>
    </>}
    {gateReward && <div className="dialog-backdrop" role="presentation"><div className="dialog" role="dialog" aria-modal="true" aria-labelledby="reward-dialog-title"><button className="dialog-close" aria-label="關閉家長確認視窗" onClick={closeGate}>×</button><p className="eyebrow">家長確認</p><h2 id="reward-dialog-title">兌換「{gateReward.name}」</h2><p>請請家長確認這次兌換。這個確認只在本機介面使用。</p><label htmlFor="parent-password">家長密語</label><input id="parent-password" autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void redeem(); }} placeholder="輸入家長" />{gateError && <p className="field-error" role="alert">{gateError}</p>}<p className="dialog-note">{PARENT_GATE_NOTE}</p><div className="dialog-actions"><button className="button button-secondary" onClick={closeGate}>先不要</button><button className="button button-primary" onClick={() => void redeem()}>確認兌換</button></div></div></div>}
    {message && <p className="sr-status" role="status">{message}</p>}
  </main>;
}
