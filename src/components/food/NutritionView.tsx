import { useMemo, useState } from "react";
import { useMeals, useRecipes } from "../../hooks/useMenu";
import {
  mealId,
  parseYmd,
  portions,
  weekDays,
  weekStart,
  type Meal,
  type Recipe,
} from "../../lib/menu";
import {
  COLORS,
  COLOR_ORDER,
  dishNutrition,
  estimateRecipe,
  weekBalance,
  type DishColor,
} from "../../lib/nutrition";
import type { PersonId } from "../../lib/types";
import { ColorDot, WeekBar } from "./Nutrition";
import { RecipeEditor } from "./RecipeEditor";
import { toRecipeDraft } from "./RecipesView";

const WEEKS = 4;
const DOW = ["L", "M", "X", "J", "V", "S", "D"];
const shortFmt = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
});
const WEEK_LABEL = [
  "Esta semana",
  "La semana pasada",
  "Hace 2 semanas",
  "Hace 3 semanas",
];

/** De un vistazo: los colores de los platos de las últimas semanas y las recetas por color. */
export function NutritionView({
  me,
  onError,
}: {
  me: PersonId;
  onError: (m: string) => void;
}) {
  const weeks = useMemo(() => {
    const m = weekStart(new Date());
    return Array.from({ length: WEEKS }, (_, i) =>
      weekDays(new Date(m.getFullYear(), m.getMonth(), m.getDate() - i * 7)),
    );
  }, []);
  const { meals, loading } = useMeals(weeks[WEEKS - 1][0], weeks[0][6]);
  const recipes = useRecipes();
  const [editing, setEditing] = useState<Recipe | null>(null);
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const byId = new Map(meals.map((m) => [m.id, m]));
  const colorOfMeal = (m: Meal) =>
    dishNutrition(m, m.recipeId ? recipeById.get(m.recipeId) : null).color;
  const recipeColor = (r: Recipe): DishColor | null =>
    r.nutrition.color ?? estimateRecipe(r).color;

  return (
    <div className="space-y-5">
      {loading ? (
        <div className="h-60 animate-pulse rounded-3xl bg-surface/70" />
      ) : (
        weeks.map((days, i) => {
          const list = meals.filter(
            (m) =>
              m.date >= days[0] && m.date <= days[6] && portions(m.eat) > 0,
          );
          const balance = weekBalance(list.map(colorOfMeal));
          return (
            <section
              key={days[0]}
              className="space-y-3 rounded-3xl bg-surface p-4 shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-extrabold">{WEEK_LABEL[i]}</h3>
                <span className="text-xs text-muted">
                  {shortFmt.format(parseYmd(days[0]))} –{" "}
                  {shortFmt.format(parseYmd(days[6]))}
                </span>
              </div>
              {list.length > 0 && (
                <div className="grid grid-cols-7 gap-1 text-center">
                  {days.map((date, k) => (
                    <div key={date} className="space-y-1">
                      <span className="block text-[10px] font-bold text-muted">
                        {DOW[k]}
                      </span>
                      {(["comida", "cena"] as const).map((slot) => {
                        const m = byId.get(mealId(date, slot));
                        if (!m || portions(m.eat) === 0)
                          return (
                            <span key={slot} className="mx-auto block h-5" />
                          );
                        const c = colorOfMeal(m);
                        return (
                          <span
                            key={slot}
                            title={`${slot === "cena" ? "Cena" : "Comida"}: ${m.title}`}
                            className="mx-auto grid h-5 place-items-center"
                          >
                            <ColorDot
                              color={c}
                              className={slot === "cena" ? "size-3" : "size-4"}
                            />
                          </span>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
              {list.length > 0 ? (
                <>
                  <WeekBar balance={balance} />
                  <p
                    className={`text-sm font-bold ${balance.verdict === "heavy" ? "text-rose-700" : balance.verdict === "light" ? "text-emerald-700" : ""}`}
                  >
                    {balance.text}
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted">
                  No hay nada apuntado en el menú.
                </p>
              )}
            </section>
          );
        })
      )}

      <section className="space-y-3">
        <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted">
          Vuestras recetas por color
        </h2>
        {recipes.length === 0 ? (
          <p className="px-1 text-sm text-muted">
            Cuando tengáis recetas en el recetario, aquí las veréis por color.
          </p>
        ) : (
          [...COLOR_ORDER, null].map((c) => {
            const list = recipes.filter((r) => recipeColor(r) === c);
            if (!list.length) return null;
            return (
              <div
                key={c ?? "none"}
                className="rounded-3xl bg-surface p-3.5 shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]"
              >
                <p className="flex items-center gap-2 text-sm font-bold">
                  <ColorDot color={c} />{" "}
                  {c ? COLORS[c].label : "Sin datos (toca para ponerle color)"}
                </p>
                {c && (
                  <p className="mb-2 ml-5 text-xs text-muted">
                    {COLORS[c].hint}
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {list.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setEditing(r)}
                      className="rounded-full bg-stone-100 px-3 py-1.5 text-sm font-semibold active:scale-95"
                    >
                      {r.emoji} {r.title}
                      {r.nutrition.color && (
                        <span className="ml-1 text-[10px] text-muted">✋</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </section>

      <details className="rounded-3xl bg-surface/60 p-4 text-sm">
        <summary className="cursor-pointer font-bold">
          ¿Cómo lo calculo?
        </summary>
        <div className="mt-2 space-y-2 text-muted">
          <p>
            Miro los ingredientes de cada receta y sus cantidades, y estimo las
            calorías por ración con una tabla de alimentos de casa. Es
            aproximado: sirve para ver tendencias, no para contar.
          </p>
          <p>
            <b className="text-ink">🟢 Ligero</b>: pocas calorías, o mucha
            verdura y legumbre. <b className="text-ink">🟡 Normal</b>: un plato
            completo de los de siempre.{" "}
            <b className="text-ink">🔴 Contundente</b>: muchas calorías, mucha
            grasa o embutido, nata, fritos…
          </p>
          <p>
            Los platos sin receta los adivino por el nombre («ensalada»,
            «pizza»…). Si no te cuadra, tócalo y corrígelo: lo que pongas a mano
            manda (✋).
          </p>
        </div>
      </details>

      {editing && (
        <RecipeEditor
          draft={toRecipeDraft(editing)}
          me={me}
          onClose={() => setEditing(null)}
          onError={onError}
        />
      )}
    </div>
  );
}
