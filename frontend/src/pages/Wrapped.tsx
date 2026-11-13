import { useState } from "react";
import { useParams } from "react-router-dom";
import { Sparkles, Heart, Images, ListChecks, BookOpen } from "lucide-react";
import { useSpace } from "../lib/store";
import { PageHeading } from "../components/ui";
export default function Wrapped() {
  const { data } = useSpace();
  const params = useParams();
  const [year, setYear] = useState(
    params.year ?? String(new Date().getFullYear()),
  );
  const shared = data!.entries.filter(
    (e) =>
      e.visibility === "shared" &&
      !e.deleted_at &&
      e.occurred_on.startsWith(year),
  );
  const photos = data!.photos.filter(
    (p) =>
      p.visibility === "shared" &&
      !p.deleted_at &&
      p.captured_at.startsWith(year),
  );
  const quests = data!.tasks.filter(
    (t) => t.due_on.startsWith(year) && t.status === "done",
  );
  return (
    <>
      <PageHeading
        eyebrow="NUESTRO AÑO"
        title="El año que construimos juntos"
        text="No es una cifra. Son todos esos momentos que nos trajeron hasta aquí."
        actions={
          <select
            aria-label="Año del resumen"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          >
            {Array.from(
              { length: 5 },
              (_, i) => new Date().getFullYear() - i,
            ).map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        }
      />
      <section className="wrapped-hero sky-panel">
        <Sparkles size={40} />
        <p className="eyebrow">NUESTRO PEQUEÑO UNIVERSO</p>
        <h2>{year}</h2>
        <p>
          Hay años que se miden en días.
          <br />
          El nuestro, en pequeñas cosas compartidas.
        </p>
        <div className="wrapped-stats">
          {[
            [ListChecks, quests.length, "tareas completadas"],
            [Images, photos.length, "recuerdos compartidos"],
            [
              BookOpen,
              shared.filter((e) => e.kind === "journal").length,
              "historias escritas",
            ],
            [
              Heart,
              shared.filter((e) => e.kind === "date" && e.status === "done")
                .length,
              "citas vividas",
            ],
          ].map(([Icon, n, label]) => {
            const C = Icon as typeof Heart;
            return (
              <div key={String(label)}>
                <C size={25} />
                <strong>{String(n)}</strong>
                <span>{String(label)}</span>
              </div>
            );
          })}
        </div>
        <p className="small">
          Los momentos que compartimos durante el año. Las cápsulas selladas
          esperan su fecha de apertura.
        </p>
      </section>
      <p className="home-footnote">
        Y lo mejor… es todo lo que todavía nos queda.
      </p>
    </>
  );
}
