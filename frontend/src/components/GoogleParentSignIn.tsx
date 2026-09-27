import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/apiFetch";
import { useLocale } from "../lib/i18n";
import { parentAuthCopy } from "../lib/parentAuthCopy";

type ParentIdentity = { id: number; email: string; displayName: string };
type GoogleCredential = { credential?: string };
type GoogleIdApi = {
  initialize(options: { client_id: string; callback: (response: GoogleCredential) => void; auto_select: false }): void;
  renderButton(element: HTMLElement, options: { theme: "outline"; size: "large"; text: "signin_with"; shape: "rectangular" }): void;
};
type GoogleCredentialHandler = (response: GoogleCredential) => void | Promise<void>;

let initializedGoogleApi: GoogleIdApi | null = null;
let initializedGoogleClientId = "";
let activeCredentialHandler: GoogleCredentialHandler | null = null;

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

const API = import.meta.env.VITE_API_BASE ?? "";
const GOOGLE_SCRIPT = "https://accounts.google.com/gsi/client";

async function ensureGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts.id) return;
  await new Promise<void>((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_SCRIPT}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = GOOGLE_SCRIPT;
      script.async = true;
      script.defer = true;
      document.head.append(script);
    }
    const timeout = window.setTimeout(() => reject(new Error("google_script_timeout")), 12000);
    script.addEventListener("load", () => {
      window.clearTimeout(timeout);
      window.google?.accounts.id ? resolve() : reject(new Error("google_script_unavailable"));
    }, { once: true });
    script.addEventListener("error", () => {
      window.clearTimeout(timeout);
      reject(new Error("google_script_unavailable"));
    }, { once: true });
  });
}

export function GoogleParentSignIn({ onSignedIn }: { onSignedIn: (parent: ParentIdentity) => void | Promise<void> }) {
  const { language } = useLocale();
  const copy = parentAuthCopy(language);
  const buttonHost = useRef<HTMLDivElement>(null);
  const onSignedInRef = useRef(onSignedIn);
  const submittingRef = useRef(false);
  const credentialHandlerRef = useRef<GoogleCredentialHandler | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  onSignedInRef.current = onSignedIn;

  useEffect(() => {
    let disposed = false;
    setStatus("loading");
    setError("");
    async function prepare() {
      try {
        const csrfResponse = await apiFetch(`${API}/api/auth/google/csrf`);
        if (!csrfResponse.ok) throw new Error(csrfResponse.status === 503 ? "google_sign_in_unavailable" : "google_csrf_unavailable");
        const configuration = await csrfResponse.json() as { csrfToken?: unknown; clientId?: unknown };
        if (typeof configuration.csrfToken !== "string" || typeof configuration.clientId !== "string" || !configuration.clientId) {
          throw new Error("google_sign_in_unavailable");
        }
        await ensureGoogleIdentityScript();
        if (disposed || !buttonHost.current || !window.google?.accounts.id) return;
        const handleCredential: GoogleCredentialHandler = async ({ credential }) => {
          if (!credential || submittingRef.current) return;
          submittingRef.current = true;
          setSubmitting(true);
          setStatus("loading");
          setError("");
          try {
            const response = await apiFetch(`${API}/api/auth/google`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ credential, g_csrf_token: configuration.csrfToken }),
            });
            if (!response.ok) throw new Error(response.status === 403 ? "google_csrf_or_origin_invalid" : "google_sign_in_failed");
            const body = await response.json() as { authenticated?: boolean; parent?: ParentIdentity };
            if (body.authenticated !== true || !body.parent || !Number.isSafeInteger(body.parent.id)) throw new Error("google_sign_in_failed");
            await onSignedInRef.current(body.parent);
          } catch {
            setError(copy.signInFailed);
            setStatus("error");
          } finally {
            submittingRef.current = false;
            setSubmitting(false);
          }
        };
        credentialHandlerRef.current = handleCredential;
        activeCredentialHandler = handleCredential;
        if (initializedGoogleApi !== window.google.accounts.id || initializedGoogleClientId !== configuration.clientId) {
          window.google.accounts.id.initialize({
            client_id: configuration.clientId,
            auto_select: false,
            callback: (response) => { void activeCredentialHandler?.(response); },
          });
          initializedGoogleApi = window.google.accounts.id;
          initializedGoogleClientId = configuration.clientId;
        }
        window.google.accounts.id.renderButton(buttonHost.current, { theme: "outline", size: "large", text: "signin_with", shape: "rectangular" });
        setStatus("ready");
      } catch (cause) {
        if (disposed) return;
        const code = cause instanceof Error ? cause.message : "google_sign_in_failed";
        setError(code === "google_sign_in_unavailable" ? copy.unavailable : copy.signInFailed);
        setStatus("error");
      }
    }
    void prepare();
    return () => {
      disposed = true;
      if (activeCredentialHandler === credentialHandlerRef.current) activeCredentialHandler = null;
      credentialHandlerRef.current = null;
    };
  }, [retryKey, language]);

  return <div className="parent-google-sign-in">
    {status === "loading" && <p role="status">{submitting ? copy.signingIn : copy.loading}</p>}
    <div ref={buttonHost} aria-label={copy.signIn} />
    {error && <p role="alert">{error}</p>}
    {status === "error" && <button className="button button-secondary" type="button" onClick={() => setRetryKey((value) => value + 1)}>{copy.retry}</button>}
  </div>;
}
