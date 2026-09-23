import { useEffect, useState } from "react";
import { buildCommercializationPath, BuildTarget } from "../lib/commercialization";

const API = import.meta.env.VITE_API_BASE ?? "";
async function api<T>(path: string): Promise<T> {
  const response = await fetch(`${API}${path}`);
  if (!response.ok) throw new Error((await response.json()).detail ?? "Request failed");
  return response.json();
}

export function CommercializationPage() {
  const [target, setTarget] = useState<BuildTarget>("family");
  const [audit, setAudit] = useState<any>(null);
  const [error, setError] = useState("");
  async function refresh(nextTarget = target) {
    try { setError(""); setAudit(await api<any>(buildCommercializationPath(nextTarget))); }
    catch (value) { setError(value instanceof Error ? value.message : "commercialization_audit_failed"); }
  }
  useEffect(() => { void refresh(); }, []);
  return <main><header><p className="eyebrow">PHASE 18 · DEVELOPER / ADMIN ONLY</p><h1>Commercialization Readiness</h1><p>License and provenance audit only. This view is not exposed in the parent dashboard and makes no legal or paid-license claim.</p></header>
    <section className="card"><h2>Build target</h2><select aria-label="Commercial build target" value={target} onChange={(event) => { const value = event.target.value as BuildTarget; setTarget(value); void refresh(value); }}><option value="family">Family</option><option value="commercial">Commercial</option></select><button onClick={() => void refresh()}>Refresh audit</button>{error && <p role="alert">{error}</p>}</section>
    {audit && <><section className="grid"><div className="result"><strong>Status</strong><span>{audit.status}</span></div><div className="result"><strong>Dependencies</strong><span>{audit.readiness.dependencies}</span></div><div className="result"><strong>Commercial Ready</strong><span>{audit.readiness.commercial_ready}</span></div><div className="result"><strong>Blockers</strong><span>{audit.commercial_blockers}</span></div><div className="result"><strong>Warnings</strong><span>{audit.warnings}</span></div></section><section className="card"><h2>Resource audit</h2><ul>{audit.resources.map((resource: any) => <li key={resource.resource_id}>{resource.source_name} · {resource.usage_status} · {resource.result} · {resource.reason}</li>)}</ul></section></>}
  </main>;
}
