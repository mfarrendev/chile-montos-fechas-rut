/**
 * Fechas de calendario en Chile.
 *
 * Todas las fechas de este módulo son textos "AAAA-MM-DD" sin hora ni zona.
 * Un día de calendario no es un instante: representarlo con un Date a
 * medianoche hace que dependa de la zona del proceso, y un servidor en UTC
 * termina estampando el día siguiente. Los cálculos internos usan Date en
 * UTC solo como aritmética de días, nunca para leer "qué día es".
 */

export const ZONA_CHILE = "America/Santiago";

const formateadorDia = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_CHILE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * La fecha de hoy en Chile continental, como "AAAA-MM-DD".
 *
 * No usar `new Date().toISOString().slice(0, 10)`: eso es la fecha en UTC, y
 * entre las 20:00 y las 24:00 de Santiago (21:00 en invierno) ya es mañana.
 * El cambio de horario lo resuelve la base de zonas horarias del motor
 * (ICU), así que no hay que mantener a mano las fechas de cambio.
 */
export function hoyChile(ahora: Date = new Date()): string {
  return fechaEnChile(ahora);
}

/** La fecha de calendario en Chile continental de un instante cualquiera. */
export function fechaEnChile(instante: Date): string {
  if (Number.isNaN(instante.getTime())) throw new RangeError("Fecha inválida");
  // en-CA formatea como AAAA-MM-DD.
  return formateadorDia.format(instante);
}

// ---------------------------------------------------------------------------
// Aritmética de días sobre "AAAA-MM-DD"

const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

function aDiaUTC(fecha: string): Date {
  const m = RE_FECHA.exec(fecha);
  if (!m) throw new RangeError(`Fecha con formato inválido (se espera AAAA-MM-DD): ${fecha}`);
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const fechaUTC = new Date(Date.UTC(a, mes - 1, d));
  if (fechaUTC.getUTCFullYear() !== a || fechaUTC.getUTCMonth() !== mes - 1 || fechaUTC.getUTCDate() !== d) {
    throw new RangeError(`Fecha inexistente: ${fecha}`);
  }
  return fechaUTC;
}

function deDiaUTC(f: Date): string {
  return f.toISOString().slice(0, 10);
}

function fecha(a: number, mes: number, d: number): string {
  return deDiaUTC(new Date(Date.UTC(a, mes - 1, d)));
}

/** Suma días corridos (negativos restan). */
export function sumarDias(fechaBase: string, dias: number): string {
  if (!Number.isInteger(dias)) throw new RangeError(`dias debe ser entero: ${dias}`);
  const f = aDiaUTC(fechaBase);
  f.setUTCDate(f.getUTCDate() + dias);
  return deDiaUTC(f);
}

/** 0 = domingo ... 6 = sábado. */
export function diaDeLaSemana(f: string): number {
  return aDiaUTC(f).getUTCDay();
}

// ---------------------------------------------------------------------------
// Feriados

/**
 * Domingo de Pascua (calendario gregoriano), con el algoritmo anónimo
 * conocido como de Meeus/Jones/Butcher.
 */
export function domingoDePascua(anio: number): string {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return fecha(anio, mes, dia);
}

/**
 * Día Nacional de los Pueblos Indígenas (Ley 21.357): el día del solsticio de
 * invierno, que se fija por decreto cada año. Se tabula la fecha del
 * solsticio en hora de Chile continental; fuera de la tabla no hay cómo
 * saberlo sin un cálculo astronómico, y por eso el rango soportado termina
 * donde termina la tabla.
 */
const SOLSTICIO_DE_INVIERNO: Readonly<Record<number, number>> = {
  2021: 21,
  2022: 21,
  2023: 21,
  2024: 20,
  2025: 20,
  2026: 21,
  2027: 21,
  2028: 20,
  2029: 20,
  2030: 21,
};

export const PRIMER_ANIO_SOPORTADO = 2021;
export const ULTIMO_ANIO_SOPORTADO = 2030;

export interface Feriado {
  fecha: string;
  nombre: string;
}

/**
 * Ley 19.668: si cae martes, miércoles o jueves, pasa al lunes de esa misma
 * semana; si cae viernes, al lunes siguiente. Sábado, domingo y lunes no se
 * mueven.
 */
function trasladarAlLunes(f: string): string {
  const dow = diaDeLaSemana(f);
  if (dow >= 2 && dow <= 4) return sumarDias(f, 1 - dow);
  if (dow === 5) return sumarDias(f, 3);
  return f;
}

/** Ley 20.299: martes pasa al viernes anterior; miércoles, al viernes siguiente. */
function trasladarAlViernes(f: string): string {
  const dow = diaDeLaSemana(f);
  if (dow === 2) return sumarDias(f, -4);
  if (dow === 3) return sumarDias(f, 2);
  return f;
}

/**
 * Feriados legales nacionales de Chile en un año, ordenados por fecha.
 *
 * No incluye feriados regionales (como el 7 de junio en Arica o el 20 de
 * agosto en Chillán), los de elecciones y plebiscitos, que se fijan por ley
 * caso a caso, ni el 31 de diciembre, que es feriado bancario y no legal.
 *
 * Lanza RangeError fuera de PRIMER_ANIO_SOPORTADO..ULTIMO_ANIO_SOPORTADO.
 */
export function feriadosDeChile(anio: number): Feriado[] {
  const solsticio = SOLSTICIO_DE_INVIERNO[anio];
  if (!Number.isInteger(anio) || solsticio === undefined) {
    throw new RangeError(
      `Sin datos de feriados para ${anio}: se soportan ${PRIMER_ANIO_SOPORTADO} a ${ULTIMO_ANIO_SOPORTADO}`,
    );
  }

  const pascua = domingoDePascua(anio);
  const lista: Feriado[] = [
    { fecha: fecha(anio, 1, 1), nombre: "Año Nuevo" },
    { fecha: sumarDias(pascua, -2), nombre: "Viernes Santo" },
    { fecha: sumarDias(pascua, -1), nombre: "Sábado Santo" },
    { fecha: fecha(anio, 5, 1), nombre: "Día Nacional del Trabajo" },
    { fecha: fecha(anio, 5, 21), nombre: "Día de las Glorias Navales" },
    { fecha: fecha(anio, 6, solsticio), nombre: "Día Nacional de los Pueblos Indígenas" },
    { fecha: trasladarAlLunes(fecha(anio, 6, 29)), nombre: "San Pedro y San Pablo" },
    { fecha: fecha(anio, 7, 16), nombre: "Día de la Virgen del Carmen" },
    { fecha: fecha(anio, 8, 15), nombre: "Asunción de la Virgen" },
    { fecha: fecha(anio, 9, 18), nombre: "Independencia Nacional" },
    { fecha: fecha(anio, 9, 19), nombre: "Día de las Glorias del Ejército" },
    { fecha: trasladarAlLunes(fecha(anio, 10, 12)), nombre: "Encuentro de Dos Mundos" },
    { fecha: trasladarAlViernes(fecha(anio, 10, 31)), nombre: "Día de las Iglesias Evangélicas y Protestantes" },
    { fecha: fecha(anio, 11, 1), nombre: "Día de Todos los Santos" },
    { fecha: fecha(anio, 12, 8), nombre: "Inmaculada Concepción" },
    { fecha: fecha(anio, 12, 25), nombre: "Navidad" },
  ];

  // El 17 de septiembre es feriado si cae lunes y el 20 si cae viernes, para
  // no dejar un día hábil suelto entre Fiestas Patrias y el fin de semana.
  const dieciSiete = fecha(anio, 9, 17);
  if (diaDeLaSemana(dieciSiete) === 1) lista.push({ fecha: dieciSiete, nombre: "Fiestas Patrias (17 de septiembre)" });
  const veinte = fecha(anio, 9, 20);
  if (diaDeLaSemana(veinte) === 5) lista.push({ fecha: veinte, nombre: "Fiestas Patrias (20 de septiembre)" });

  // El 2 de enero es feriado cuando cae lunes (el 1 fue domingo).
  const dosDeEnero = fecha(anio, 1, 2);
  if (diaDeLaSemana(dosDeEnero) === 1) lista.push({ fecha: dosDeEnero, nombre: "Feriado de Año Nuevo (2 de enero)" });

  return lista.sort((x, y) => (x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : 0));
}

const cacheFeriados = new Map<number, Set<string>>();

function fechasFeriadas(anio: number): Set<string> {
  let conjunto = cacheFeriados.get(anio);
  if (!conjunto) {
    conjunto = new Set(feriadosDeChile(anio).map((f) => f.fecha));
    cacheFeriados.set(anio, conjunto);
  }
  return conjunto;
}

/** true si la fecha es feriado legal nacional. */
export function esFeriado(f: string): boolean {
  return fechasFeriadas(aDiaUTC(f).getUTCFullYear()).has(f);
}

/** true si es de lunes a viernes y no es feriado. */
export function esDiaHabil(f: string): boolean {
  const dow = diaDeLaSemana(f);
  return dow !== 0 && dow !== 6 && !esFeriado(f);
}

/**
 * Suma días hábiles (lunes a viernes que no son feriado). Con `dias`
 * negativo, resta. Con 0 devuelve la misma fecha aunque no sea hábil.
 *
 * La fecha de partida no cuenta: sumar 1 día hábil a un viernes da el lunes
 * siguiente (o el martes si el lunes es feriado).
 */
export function sumarDiasHabiles(fechaBase: string, dias: number): string {
  if (!Number.isInteger(dias)) throw new RangeError(`dias debe ser entero: ${dias}`);
  aDiaUTC(fechaBase);
  const paso = dias < 0 ? -1 : 1;
  let restantes = Math.abs(dias);
  let actual = fechaBase;
  while (restantes > 0) {
    actual = sumarDias(actual, paso);
    if (esDiaHabil(actual)) restantes--;
  }
  return actual;
}

/**
 * Días hábiles entre dos fechas, con la misma convención que
 * sumarDiasHabiles: si hasta es posterior, cuenta los hábiles en
 * (desde, hasta]; si es anterior, cuenta los de [hasta, desde) y el
 * resultado es negativo. Así sumarDiasHabiles(d, diasHabilesEntre(d, h))
 * vuelve a h cuando h es hábil.
 */
export function diasHabilesEntre(desde: string, hasta: string): number {
  aDiaUTC(desde);
  aDiaUTC(hasta);
  if (desde === hasta) return 0;
  let n = 0;
  if (hasta > desde) {
    for (let f = sumarDias(desde, 1); f <= hasta; f = sumarDias(f, 1)) if (esDiaHabil(f)) n++;
    return n;
  }
  for (let f = hasta; f < desde; f = sumarDias(f, 1)) if (esDiaHabil(f)) n++;
  return n === 0 ? 0 : -n;
}
