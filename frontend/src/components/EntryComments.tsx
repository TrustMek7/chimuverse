import { useState } from "react";
import { MessageCircle, Send, Trash2 } from "lucide-react";
import { useAction } from "../lib/store";
import { check, supabase } from "../lib/supabase";
import type { Entry, EntryComment, Profile } from "../lib/types";

export function EntryComments({
  entry,
  comments,
  profiles,
  userId,
}: {
  entry: Entry;
  comments: EntryComment[];
  profiles: Profile[];
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const action = useAction();
  const thread = comments
    .filter((comment) => comment.entry_id === entry.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  async function send() {
    const message = body.trim();
    if (!message) return;
    await action.run(async () => {
      check(
        await supabase.from("entry_comments").insert({
          entry_id: entry.id,
          author_id: userId,
          body: message,
        }),
      );
      setBody("");
      setOpen(true);
    });
  }

  return (
    <section className="entry-comments" aria-label="Comentarios">
      <button
        className="comments-toggle"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <MessageCircle size={16} />
        <span>Comentarios{thread.length ? ` · ${thread.length}` : ""}</span>
        <span className="comments-toggle-action">
          {open ? "Cerrar" : thread.length ? "Ver respuestas" : "Responder"}
        </span>
      </button>
      {open && (
        <div className="comments-thread">
          {thread.length ? (
            thread.map((comment) => {
              const author = profiles.find((profile) => profile.id === comment.author_id);
              return (
                <article className="entry-comment" key={comment.id}>
                  <div className="row between gap">
                    <strong>{author?.display_name ?? "Nosotros"}</strong>
                    <time dateTime={comment.created_at}>
                      {new Intl.DateTimeFormat("es", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(comment.created_at))}
                    </time>
                  </div>
                  <p>{comment.body}</p>
                  {comment.author_id === userId && (
                    <button
                      className="comment-delete"
                      type="button"
                      aria-label="Borrar mi comentario"
                      title="Borrar comentario"
                      disabled={action.busy}
                      onClick={() =>
                        void action.run(async () => {
                          check(
                            await supabase
                              .from("entry_comments")
                              .delete()
                              .eq("id", comment.id)
                              .eq("author_id", userId),
                          );
                        })
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </article>
              );
            })
          ) : (
            <p className="comments-empty">Todavía no hay respuestas. Puedes empezar tú.</p>
          )}
          <form
            className="comment-composer"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <textarea
              aria-label="Escribe un comentario"
              placeholder="Escribe una respuesta…"
              value={body}
              maxLength={1000}
              rows={2}
              onChange={(event) => setBody(event.target.value)}
            />
            <button
              className="comment-send"
              type="submit"
              aria-label="Enviar comentario"
              title="Enviar comentario"
              disabled={action.busy || !body.trim()}
            >
              <Send size={16} />
            </button>
          </form>
          {action.error && <span className="comment-error" role="alert">{action.error}</span>}
        </div>
      )}
    </section>
  );
}
