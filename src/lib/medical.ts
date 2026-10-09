// Citas médicas de la agenda: se reconocen por la marca `health` (creadas desde Médico) o por el título.
// Puro y testeado (tests/medical.test.ts).

const MEDICAL_RE =
  /(?<!\p{L})(m[eé]dic|doctor|dra?\.|dentista|odont|ginec|matrona|oculista|oftalm|[oó]ptic|dermat|fisio|osteop|an[aá]lisis|anal[ií]tica|extracci[oó]n de sangre|vacuna|pediatr|traumat|cardi[oó]log|psic[oó]log|psiquiatr|urgencias|hospital|ambulatorio|centro de salud|endocrin|nutricionista|otorrino|pod[oó]log|ur[oó]log|neur[oó]log|alerg[oó]log|digestivo|mamograf|ecograf|radiograf|resonancia|chequeo|cita m[eé]dica)/iu

/** ¿Es una cita médica? (las creadas desde Médico llevan `health: true`). */
export const isMedical = (p: { title: string; health?: boolean }) => p.health === true || MEDICAL_RE.test(p.title)
