import type { ReactNode, ButtonHTMLAttributes } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Lock,
  Users,
  Hourglass,
  Sparkles,
  X,
  AlertCircle,
  Star,
} from "lucide-react";
import { statusNames } from "../lib/utils";
import type { Visibility } from "../lib/types";
export function Button({
  children,
  variant = "primary",
  busy,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: string;
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={`btn btn-${variant} ${props.className ?? ""}`}
      aria-busy={busy || undefined}
    >
      {busy ? "Guardando…" : children}
    </button>
  );
}
export function ErrorMessage({ error }: { error: unknown }) {
  return error ? (
    <div className="banner error" role="alert">
      <AlertCircle size={20} />
      <span>{error instanceof Error ? error.message : String(error)}</span>
    </div>
  ) : null;
}
export function Empty({
  title = "Aquí empieza algo bonito",
  text = "Todavía no hay registros. Crea el primero cuando quieras.",
  children,
}: {
  title?: string;
  text?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Sparkles size={32} />
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status" aria-label="Cargando">
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
      <p>Preparando nuestro universo…</p>
    </div>
  );
}
export function VisibilityPill({ value }: { value: Visibility }) {
  const Icon =
    value === "private" ? Lock : value === "capsule" ? Hourglass : Users;
  return (
    <span className={`pill visibility ${value}`}>
      <Icon size={13} />
      {value === "private"
        ? "Solo yo"
        : value === "capsule"
          ? "Cápsula"
          : "Compartido"}
    </span>
  );
}
export function VisibilityPicker({
  value,
  onChange,
  capsule = false,
}: {
  value: Visibility;
  onChange: (v: Visibility) => void;
  capsule?: boolean;
}) {
  return (
    <div className="field">
      <span>Visibilidad</span>
      <div className="segments">
        {(
          ["private", "shared", ...(capsule ? ["capsule"] : [])] as Visibility[]
        ).map((v) => (
          <button
            type="button"
            key={v}
            aria-pressed={v === value}
            onClick={() => onChange(v)}
          >
            <VisibilityPill value={v} />
          </button>
        ))}
      </div>
    </div>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span className={`pill status ${value}`}>
      <Star size={14} fill={value === "done" ? "currentColor" : "none"} />
      {statusNames[value] ?? value}
    </span>
  );
}
export function DualProgress({
  reported,
  verified,
}: {
  reported: number;
  verified: number;
}) {
  return (
    <div className="dual-progress" role="group" aria-label="Avance de la tarea">
      {[
        ["Reportado", reported, "reported"],
        ["Verificado", verified, "verified"],
      ].map(([label, value, cls]) => (
        <div key={label}>
          <div className="row between">
            <span>{label}</span>
            <strong>{value} %</strong>
          </div>
          <div
            role="meter"
            aria-label={String(label)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Number(value)}
            className="track"
          >
            <span className={`fill ${cls}`} style={{ width: `${value}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="scrim" />
        <Dialog.Content className="dialog" aria-describedby={undefined}>
          <header className="row between">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close className="icon-button" aria-label="Cerrar">
              <X size={22} />
            </Dialog.Close>
          </header>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function PageHeading({
  eyebrow,
  title,
  text,
  actions,
}: {
  eyebrow: string;
  title: string;
  text?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-heading row between wrap">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {text && <p className="muted">{text}</p>}
      </div>
      {actions}
    </header>
  );
}
export function Avatar({
  name,
  partner = false,
}: {
  name: string;
  partner?: boolean;
}) {
  return (
    <span className={`avatar ${partner ? "partner" : ""}`} title={name}>
      {name
        .split(" ")
        .slice(0, 2)
        .map((s) => s[0])
        .join("")}
    </span>
  );
}
