import { useState } from "react";
import { Plus, Orbit, ArrowRight, Shuffle } from "lucide-react";
import { useSpace, useAction } from "../lib/store";
import { check, supabase } from "../lib/supabase";
import {
  Button,
  PageHeading,
  ErrorMessage,
  Avatar,
  Modal,
  Empty,
} from "../components/ui";
export default function Universe() {
  const { data, me, partner, spaceId } = useSpace();
  const [tab, setTab] = useState("Preguntas");
  const [category, setCategory] = useState("Todas");
  const [answer, setAnswer] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState(false);
  const [title, setTitle] = useState(""),
    [newCategory, setNewCategory] = useState("Nosotros");
  const [trivia, setTrivia] = useState<string | null>(null);
  const [guess, setGuess] = useState("");
  const [revealed, setRevealed] = useState(false);
  const action = useAction();
  const categories = [
    "Todas",
    ...new Set(data!.questions.map((q) => q.category)),
  ];
  const questions = data!.questions.filter(
    (q) => category === "Todas" || q.category === category,
  );
  const triviaQuestions = data!.questions.filter((q) =>
    data!.answers.some(
      (a) => a.question_id === q.id && a.respondent_id !== me.id,
    ),
  );
  const triviaAnswer = data!.answers.find(
    (a) => a.question_id === trivia && a.respondent_id !== me.id,
  );
  return (
    <>
      <PageHeading
        eyebrow="NOSOTROS"
        title="Nuestro Universo"
        text="Siempre queda algo nuevo por descubrir de ti."
        actions={
          <Button onClick={() => setNewQuestion(true)}>
            <Plus size={18} />
            Nuestra pregunta
          </Button>
        }
      />
      <div className="segments">
        {["Perfiles", "Preguntas", "Comparar", "Trivia"].map((t) => (
          <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <ErrorMessage error={action.error} />
      {tab === "Perfiles" ? (
        <div className="profile-grid">
          {data!.profiles.map((p) => (
            <section
              className={`card profile-card ${p.id !== me.id ? "partner-profile" : ""}`}
              key={p.id}
            >
              <Avatar name={p.display_name} partner={p.id !== me.id} />
              <p className="eyebrow">
                {p.id === me.id ? "TU PEQUEÑO UNIVERSO" : "SU PEQUEÑO UNIVERSO"}
              </p>
              <h2>{p.display_name}</h2>
              <p className="muted">
                {String(
                  p.preferences.bio ?? "Todavía nos queda mucho por descubrir.",
                )}
              </p>
              <h3>Mis cosas favoritas</h3>
              <p className="entry-content">
                {String(
                  p.preferences.favorites ??
                    "Un espacio para gustos y pequeños detalles.",
                )}
              </p>
              {p.id === me.id && (
                <a href="/ajustes" className="text-link">
                  Editar mi perfil <ArrowRight size={16} />
                </a>
              )}
            </section>
          ))}
        </div>
      ) : tab === "Trivia" ? (
        <section className="card trivia-card">
          <Orbit size={44} />
          <h2>¿Cuánto conoces su universo?</h2>
          <p className="muted">
            Adivina la respuesta de{" "}
            {partner?.display_name.split(" ")[0] ?? "tu pareja"} y descubre si
            pensaron lo mismo.
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              if (triviaQuestions.length) {
                setTrivia(
                  triviaQuestions[
                    crypto.getRandomValues(new Uint32Array(1))[0] %
                      triviaQuestions.length
                  ].id,
                );
                setGuess("");
                setRevealed(false);
              }
            }}
          >
            <Shuffle size={18} />
            Elegir una pregunta
          </Button>
          {!triviaQuestions.length && (
            <p>Primero necesitan guardar alguna respuesta para jugar.</p>
          )}
          {trivia && (
            <div className="trivia-question">
              <h3>{data!.questions.find((q) => q.id === trivia)?.title}</h3>
              <label className="field">
                Creo que respondería…
                <textarea
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                />
              </label>
              <Button
                disabled={!guess.trim()}
                onClick={() => setRevealed(true)}
              >
                Descubrir su respuesta
              </Button>
              {revealed && <blockquote>{triviaAnswer?.answer}</blockquote>}
            </div>
          )}
        </section>
      ) : (
        <>
          <div className="segments category-tabs">
            {categories.map((c) => (
              <button
                key={c}
                aria-pressed={c === category}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="collection-grid">
            {questions.map((q) => {
              const own = data!.answers.find(
                (a) => a.question_id === q.id && a.respondent_id === me.id,
              );
              const other = data!.answers.find(
                (a) => a.question_id === q.id && a.respondent_id !== me.id,
              );
              return (
                <section className="card universe-question" key={q.id}>
                  <div className="row between">
                    <p className="eyebrow">{q.category}</p>
                    <Orbit size={22} />
                  </div>
                  <h2>{q.title}</h2>
                  {own ? (
                    <>
                      <div className="answer own">
                        <small>Tu respuesta</small>
                        <p>{own.answer}</p>
                      </div>
                      {other ? (
                        <div className="answer partner">
                          <small>{partner?.display_name}</small>
                          <p>{other.answer}</p>
                        </div>
                      ) : (
                        <p className="muted">Su respuesta está por llegar.</p>
                      )}
                    </>
                  ) : (
                    <p className="muted">
                      Responde primero para descubrir su respuesta. Un pequeño
                      juego entre los dos.
                    </p>
                  )}
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSelected(q.id);
                      setAnswer(own?.answer ?? "");
                    }}
                  >
                    {own ? "Editar mi respuesta" : "Compartir mi respuesta"}{" "}
                    <ArrowRight size={16} />
                  </Button>
                </section>
              );
            })}
          </div>
          {!questions.length && <Empty title="Una nueva conversación" />}
        </>
      )}
      <Modal
        title="Un pedacito de tu universo"
        open={!!selected}
        onOpenChange={() => setSelected(null)}
      >
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(
              async () => {
                const existing=data!.answers.find(a=>a.question_id===selected&&a.respondent_id===me.id);
                return check(await (existing?supabase.from('answers').update({answer:answer.trim()}).eq('id',existing.id):supabase.from('answers').insert({question_id:selected,space_id:spaceId,respondent_id:me.id,answer:answer.trim()})));
              },
              () => setSelected(null),
            );
          }}
        >
          <h3>{data!.questions.find((q) => q.id === selected)?.title}</h3>
          <label className="field">
            Tu respuesta
            <textarea
              autoFocus
              required
              maxLength={2000}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
          </label>
          <p className="small muted">
            Las respuestas se comparten con tu pareja.
          </p>
          <ErrorMessage error={action.error} />
          <Button type="submit" busy={action.busy}>
            Guardar respuesta
          </Button>
        </form>
      </Modal>
      <Modal
        title="Una pregunta nuestra"
        open={newQuestion}
        onOpenChange={setNewQuestion}
      >
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(
              async () =>
                check(
                  await supabase.from("questions").insert({
                    space_id: spaceId,
                    title: title.trim(),
                    category: newCategory,
                  }),
                ),
              () => {
                setNewQuestion(false);
                setTitle("");
              },
            );
          }}
        >
          <label className="field">
            ¿Qué te gustaría preguntar?
            <textarea
              required
              minLength={3}
              maxLength={240}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="field">
            Tema
            <input
              required
              value={newCategory}
              maxLength={60}
              onChange={(e) => setNewCategory(e.target.value)}
            />
          </label>
          <ErrorMessage error={action.error} />
          <Button type="submit" busy={action.busy}>
            Guardar pregunta
          </Button>
        </form>
      </Modal>
    </>
  );
}
