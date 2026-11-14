import { useState } from "react";
import { useAction } from "../lib/store";
import { check, supabase } from "../lib/supabase";
import type { Entry } from "../lib/types";

type Reaction = {
  entry_id: string;
  user_id: string;
  emoji: string;
};

const journalReactions = [
  { emoji: "❤️", label: "Me encanta" },
  { emoji: "🥹", label: "Me llegó" },
  { emoji: "😂", label: "Me dio risa" },
  { emoji: "✨", label: "Es especial" },
];
const moodReactions = [
  { emoji: "❤️", label: "Te acompaño" },
  { emoji: "🤍", label: "Aquí estoy" },
  { emoji: "🫂", label: "Te mando un abrazo" },
];

export function EntryReactions({
  entry,
  reactions,
  userId,
}: {
  entry: Entry;
  reactions: Reaction[];
  userId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const action = useAction();
  const choices = entry.kind === "mood" ? moodReactions : journalReactions;
  const current = reactions.filter((reaction) => reaction.entry_id === entry.id);

  async function toggle(emoji: string) {
    const mine = current.some(
      (reaction) => reaction.user_id === userId && reaction.emoji === emoji,
    );
    await action.run(async () => {
      if (mine) {
        return check(
          await supabase
            .from("entry_reactions")
            .delete()
            .eq("entry_id", entry.id)
            .eq("user_id", userId)
            .eq("emoji", emoji),
        );
      }
      return check(
        await supabase.from("entry_reactions").insert({
          entry_id: entry.id,
          user_id: userId,
          emoji,
        }),
      );
    });
    setExpanded(false);
  }

  return (
    <div className="entry-reactions" aria-label="Reacciones">
      {choices.map(({ emoji, label }) => {
        const matching = current.filter((reaction) => reaction.emoji === emoji);
        const mine = matching.some((reaction) => reaction.user_id === userId);
        if (!matching.length) return null;
        return (
          <button
            className={`reaction-count${mine ? " selected" : ""}`}
            key={emoji}
            type="button"
            aria-pressed={mine}
            aria-label={`${mine ? "Quitar" : "Ver"} reacción ${label}: ${matching.length}`}
            title={label}
            disabled={action.busy}
            onClick={() => void toggle(emoji)}
          >
            <span aria-hidden="true">{emoji}</span>
            <span>{matching.length}</span>
          </button>
        );
      })}
      <button
        className="reaction-open"
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? "Cerrar" : "Reaccionar"}
      </button>
      {expanded && (
        <div className="reaction-options" aria-label="Elige una reacción">
          {choices.map(({ emoji, label }) => {
            const mine = current.some(
              (reaction) => reaction.user_id === userId && reaction.emoji === emoji,
            );
            return (
              <button
                className={`reaction-option${mine ? " selected" : ""}`}
                key={emoji}
                type="button"
                aria-pressed={mine}
                disabled={action.busy}
                onClick={() => void toggle(emoji)}
              >
                <span aria-hidden="true">{emoji}</span> {label}
              </button>
            );
          })}
        </div>
      )}
      {action.error && (
        <span className="reaction-error" role="alert">
          {action.error}
        </span>
      )}
    </div>
  );
}
