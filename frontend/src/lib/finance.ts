import type { Entry, Profile } from "./types";

/** "" means de los dos (the common pot). */
export const BOTH = "";

/**
 * Whose a movement is: the person recorded on it, "" for both of us, or — for movements
 * saved before this existed — whoever registered it.
 */
export function personOf(e: Entry): string {
  return "person" in e.details ? String(e.details.person ?? "") : e.owner_id;
}

/** "Pagó José Luis", "Ingreso de Glenny", "Ahorro de los dos"… */
export function personLine(e: Entry, profiles: Profile[], meId: string) {
  const who = personOf(e);
  const name =
    who === BOTH
      ? "los dos"
      : who === meId
        ? "ti"
        : (profiles.find((p) => p.id === who)?.display_name.split(" ")[0] ?? "?");
  switch (e.details.direction) {
    case "income":
      return who === BOTH ? "Ingreso de los dos" : `Ingreso de ${name}`;
    case "saving":
      return who === BOTH ? "Ahorro de los dos" : `Ahorro de ${name}`;
    default:
      return who === BOTH
        ? "Pagado del fondo común"
        : who === meId
          ? "Pagaste tú"
          : `Pagó ${name}`;
  }
}

export function personLabel(direction: string) {
  return direction === "income"
    ? "¿De quién es el ingreso?"
    : direction === "saving"
      ? "¿Quién ahorra?"
      : "¿Quién pagó?";
}
