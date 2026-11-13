import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, check } from "./supabase";
import type { Snapshot, Profile } from "./types";
const AuthContext = createContext<{
  session: Session | null;
  loading: boolean;
  error: string | null;
}>({ session: null, loading: true, error: null });
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  useEffect(() => {
    let live = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (live) {
        setSession(data.session);
        setError(error?.message ?? null);
        setLoading(false);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
      qc.clear();
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, [qc]);
  return (
    <AuthContext.Provider value={{ session, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
export function useMembership() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["membership", session?.user.id],
    enabled: !!session,
    queryFn: async () =>
      check(
        await supabase
          .from("space_members")
          .select("space_id,user_id")
          .eq("user_id", session!.user.id)
          .maybeSingle(),
      ) as { space_id: string; user_id: string } | null,
  });
}
export function useRealtime() {
  const { session } = useAuth();
  const membership = useMembership();
  const qc = useQueryClient();
  useEffect(() => {
    if (!membership.data) return;
    const channel = supabase
      .channel(`space-updates-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${session!.user.id}`,
        },
        () => qc.invalidateQueries({ queryKey: ["snapshot"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => qc.invalidateQueries({ queryKey: ["snapshot"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calendar_events" },
        () => qc.invalidateQueries({ queryKey: ["snapshot"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [membership.data, session?.user.id, qc]);
}
export function useSnapshot() {
  const { session } = useAuth();
  const membership = useMembership();
  return useQuery<Snapshot>({
    queryKey: ["snapshot", session?.user.id],
    enabled: !!membership.data,
    refetchInterval: 60000,
    queryFn: async () => {
      const tables = [
        "profiles",
        "tasks",
        "task_progress",
        "task_verifications",
        "entries",
        "calendar_events",
        "photos",
        "notifications",
        "questions",
        "answers",
      ] as const;
      const results = await Promise.all(
        tables.map(async (table) => {
          const rows: Record<string, unknown>[] = [];
          for (let offset = 0; ; offset += 500) {
            const result = await supabase
              .from(table)
              .select(table === "entries" ? "*,entry_bodies(content)" : "*")
              .order("id")
              .range(offset, offset + 499);
            const page =
              (check(result) as unknown as Record<string, unknown>[] | null) ??
              [];
            rows.push(...page);
            if (page.length < 500) break;
          }
          if (
            [
              "tasks",
              "task_progress",
              "task_verifications",
              "notifications",
              "entries",
            ].includes(table)
          )
            rows.sort((a, b) =>
              String(b.created_at).localeCompare(String(a.created_at)),
            );
          return [table, rows];
        }),
      );
      return Object.fromEntries(results) as Snapshot;
    },
  });
}
export function useSpace() {
  const { session } = useAuth();
  const membership = useMembership();
  const query = useSnapshot();
  const data = query.data;
  const me = data?.profiles.find((p) => p.id === session?.user.id) as Profile;
  const partner = data?.profiles.find((p) => p.id !== session?.user.id);
  return {
    session,
    spaceId: membership.data?.space_id ?? "",
    data,
    me,
    partner,
    query,
  };
}
export function useAction() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run<T>(fn: () => Promise<T>, success?: () => void) {
    setBusy(true);
    setError("");
    try {
      const value = await fn();
      await qc.invalidateQueries({ queryKey: ["snapshot"] });
      success?.();
      return value;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo guardar. Intenta otra vez.",
      );
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run, setError };
}
