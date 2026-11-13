import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { check, supabase } from "./supabase";

/**
 * Device notification state, from the point of view of this browser:
 * - unsupported: the browser cannot receive Web Push.
 * - install: iPhone/iPad in Safari; push requires adding the app to the home screen.
 * - denied: the person blocked the permission; only the browser settings can undo it.
 * - off: not yet enabled on this device.
 * - active: this device is subscribed and saved for the signed-in member.
 */
export type PushState = "unsupported" | "install" | "denied" | "off" | "active";

const ua = () => navigator.userAgent;
export const isAppleMobile = () =>
  /iPhone|iPad|iPod/.test(ua()) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
const supported = () =>
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

export function deviceLabel() {
  const u = ua();
  const browser = /Edg\//.test(u)
    ? "Edge"
    : /Firefox\//.test(u)
      ? "Firefox"
      : /Chrome\/|CriOS\//.test(u)
        ? "Chrome"
        : /Safari\//.test(u)
          ? "Safari"
          : "Navegador";
  const os = /Android/.test(u)
    ? "Android"
    : /iPhone|iPod/.test(u)
      ? "iPhone"
      : /iPad/.test(u) || (isAppleMobile() && /Mac/.test(u))
        ? "iPad"
        : /Windows/.test(u)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(u)
            ? "macOS"
            : /Linux/.test(u)
              ? "Linux"
              : "";
  return isStandalone() && /iPhone|iPad/.test(os)
    ? `Chimuverse · ${os}`
    : [browser, os].filter(Boolean).join(" · ");
}

const b64ToBytes = (s: string) => {
  const raw = atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "="));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
const bytesToB64 = (b: ArrayBuffer | null) =>
  b ? btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : "";

async function registration() {
  return (
    (await navigator.serviceWorker.getRegistration("/")) ??
    (await navigator.serviceWorker.register("/sw.js", { scope: "/" }))
  );
}
async function save(sub: PushSubscription) {
  check(
    await supabase.rpc("save_push_subscription", {
      p_endpoint: sub.endpoint,
      p_p256dh: bytesToB64(sub.getKey("p256dh")),
      p_auth: bytesToB64(sub.getKey("auth")),
      p_label: deviceLabel(),
    }),
  );
}

/** Reads the state and, when permission already exists, silently re-links this device. */
export async function readPushState(): Promise<PushState> {
  if (isAppleMobile() && !isStandalone()) return "install";
  if (!supported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "off";
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    // Permission was given before (or the browser rotated the endpoint): subscribe without asking again.
    try {
      sub = await subscribe(reg);
    } catch {
      return "off";
    }
  }
  await save(sub);
  return "active";
}
async function subscribe(reg: ServiceWorkerRegistration) {
  const { data, error } = await supabase.functions.invoke("push", { body: { action: "key" } });
  if (error || !data?.publicKey) throw new Error("Las notificaciones aún no están disponibles en el servidor.");
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: b64ToBytes(data.publicKey),
  });
}

/** Must run from a click: browsers only show the permission prompt after a user gesture. */
export async function enablePush(): Promise<PushState> {
  if (isAppleMobile() && !isStandalone()) return "install";
  if (!supported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission === "denied") return "denied";
  if (permission !== "granted") return "off";
  const reg = await registration();
  const sub = (await reg.pushManager.getSubscription()) ?? (await subscribe(reg));
  await save(sub);
  return "active";
}

/** Removes this device; used when turning it off and when signing out. */
export async function disablePush() {
  if (!supported()) return;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase.rpc("remove_push_subscription", { p_endpoint: sub.endpoint });
  await sub.unsubscribe().catch(() => undefined);
}

/** Signing out stops this device from receiving the account's notifications. */
export async function signOut() {
  try {
    await Promise.race([disablePush(), new Promise((r) => setTimeout(r, 3000))]);
  } finally {
    await supabase.auth.signOut();
  }
}

export async function currentEndpoint() {
  if (!supported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription())?.endpoint ?? null;
}

export function usePush() {
  const qc = useQueryClient();
  const state = useQuery({
    queryKey: ["push-state"],
    queryFn: readPushState,
    // Re-read when returning to the tab: the person may have changed the permission meanwhile.
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: false,
  });
  useEffect(() => {
    // Chrome and Firefox report permission changes live; Safari falls back to the focus refetch.
    let status: PermissionStatus | undefined;
    const refresh = () => void qc.invalidateQueries({ queryKey: ["push-state"] });
    navigator.permissions
      ?.query({ name: "notifications" as PermissionName })
      .then((s) => {
        status = s;
        s.addEventListener("change", refresh);
      })
      .catch(() => undefined);
    return () => status?.removeEventListener("change", refresh);
  }, [qc]);
  const set = (s: PushState) => qc.setQueryData(["push-state"], s);
  return {
    state: state.data,
    error: state.error,
    async enable() {
      set(await enablePush());
      await qc.invalidateQueries({ queryKey: ["push-devices"] });
    },
    async disable() {
      await disablePush();
      set(supported() && Notification.permission === "denied" ? "denied" : "off");
      await qc.invalidateQueries({ queryKey: ["push-devices"] });
    },
    async test() {
      const { data, error } = await supabase.functions.invoke("push", { body: { action: "test" } });
      if (error) throw new Error("No se pudo enviar la prueba.");
      return data as { sent: number; removed: number; failed: number };
    },
  };
}

export const PUSH_DISMISSED = "chimu-push-dismissed";
export function dismissed() {
  try {
    return localStorage.getItem(PUSH_DISMISSED) === "1";
  } catch {
    return false;
  }
}
export function setDismissed(value: boolean) {
  try {
    if (value) localStorage.setItem(PUSH_DISMISSED, "1");
    else localStorage.removeItem(PUSH_DISMISSED);
  } catch {
    // Storage can be unavailable (private mode); the card simply shows again.
  }
}
