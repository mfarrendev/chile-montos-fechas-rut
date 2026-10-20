/**
 * Montos en formato chileno: punto para los miles, coma para los decimales.
 *
 * La regla de diseño es que parsearMonto nunca inventa un número. Cuando lo
 * que escribió la persona admite dos lecturas razonables ("1.5", "1,500"),
 * devuelve null y el formulario debe pedir que lo corrija. Un error de escala
 * en un monto (leer "1.500" como 1,5 o multiplicar por 10 al mezclar
 * separadores) pasa inadvertido hasta que alguien revisa un balance; un
 * campo rechazado se corrige en el momento.
 */

export type ComaDeTresDigitos = "rechazar" | "decimal";

export interface OpcionesParseo {
  /**
   * Qué hacer con "1,500", "12,345" y similares. Por omisión "rechazar"
   * (devuelve null). "decimal" aplica la convención chilena sin dudar.
   */
  comaDeTresDigitos?: ComaDeTresDigitos;
}

const MILLONES = /\s*(millones|millón|millon|mm)\.?$/i;

/**
 * Convierte el texto de un formulario a número, o null si es ambiguo o no es
 * un monto.
 *
 * Acepta: "1.234.567", "1.234.567,89", "1234567,89", "$ 12.000", "12000",
 * "-3.500", "CLP 4.990", "1,5 millones", "2 MM".
 *
 * Devuelve null para:
 * - "1.5", "1.50", "1.5000": un punto que no separa un grupo de tres dígitos
 *   no es un separador de miles chileno, y leerlo como decimal es adivinar.
 * - "1,500": con una sola coma, de uno a tres dígitos antes y exactamente
 *   tres después, puede ser 1,5 escrito con ceros o 1500 escrito a la
 *   estadounidense. Con `comaDeTresDigitos: "decimal"` se lee como 1,5
 *   (útil cuando el texto viene de formatearMonto o de un sistema chileno).
 * - "1,234.56" y cualquier mezcla con el punto después de la coma.
 * - grupos de miles mal formados ("12.34.567"), dos comas, letras sueltas,
 *   texto vacío y cifras fuera del rango en que un double es exacto.
 */
export function parsearMonto(entrada: string, opciones: OpcionesParseo = {}): number | null {
  if (typeof entrada !== "string") return null;
  let texto = entrada.trim().replace(/[\u00a0\u202f]/g, " ");

  let escala = 0;
  const millones = MILLONES.exec(texto);
  if (millones) {
    escala = 6;
    texto = texto.slice(0, millones.index);
  }

  texto = texto.replace(/^(clp|\$)\s*/i, "");
  let signo = "";
  if (texto.startsWith("-")) {
    signo = "-";
    texto = texto.slice(1).replace(/^(clp|\$)\s*/i, "");
  }
  texto = texto.trim();
  // Se permiten espacios como separador de miles solo si separan grupos de tres.
  if (/\s/.test(texto)) {
    if (!/^\d{1,3}( \d{3})+(,\d+)?$/.test(texto)) return null;
    texto = texto.replace(/ /g, ".");
  }

  const decimal = aDecimalCanonico(texto, opciones.comaDeTresDigitos ?? "rechazar");
  if (decimal === null) return null;

  const [entero, fraccion] = desplazar(decimal.entero, decimal.fraccion, escala);
  const digitosEnteros = entero.replace(/^0+(?=\d)/, "");
  // Un double representa exactos los enteros hasta 2^53 y, con decimales,
  // unos 15 dígitos significativos. Más allá, el número que se guardaría no es
  // el que se escribió: se rechaza en vez de redondear en silencio.
  if (fraccion === "") {
    if (digitosEnteros.length > 16 || Number(digitosEnteros) > Number.MAX_SAFE_INTEGER) return null;
  } else if ((digitosEnteros + fraccion).replace(/^0+/, "").length > 15) {
    return null;
  }

  const valor = Number(`${signo}${digitosEnteros}${fraccion ? "." + fraccion : ""}`);
  if (!Number.isFinite(valor)) return null;
  return Object.is(valor, -0) ? 0 : valor;
}

/** Separa el texto en parte entera y fraccionaria, o null si es ambiguo. */
function aDecimalCanonico(texto: string, comaDeTres: ComaDeTresDigitos): { entero: string; fraccion: string } | null {
  if (texto === "") return null;
  if (!/^[\d.,]+$/.test(texto)) return null;

  const puntos = (texto.match(/\./g) ?? []).length;
  const comas = (texto.match(/,/g) ?? []).length;
  if (comas > 1) return null;

  let parteEntera: string;
  let fraccion = "";
  if (comas === 1) {
    const [izq, der] = texto.split(",") as [string, string];
    if (der === "" || !/^\d+$/.test(der)) return null;
    // "1,500" sin puntos: ¿1,5 o 1500 a la estadounidense? Solo es ambiguo
    // si la parte entera podría ser el primer grupo de miles (1 a 3 dígitos
    // sin cero inicial); "0,500" o "1234,500" no admiten la otra lectura.
    if (puntos === 0 && der.length === 3 && /^[1-9]\d{0,2}$/.test(izq) && comaDeTres === "rechazar") {
      return null;
    }
    parteEntera = izq;
    fraccion = der;
  } else {
    parteEntera = texto;
  }

  if (parteEntera.includes(".")) {
    // Con puntos, todos tienen que separar grupos de exactamente tres dígitos.
    if (!/^\d{1,3}(\.\d{3})+$/.test(parteEntera)) return null;
    parteEntera = parteEntera.replace(/\./g, "");
  } else if (!/^\d+$/.test(parteEntera)) {
    return null;
  }

  fraccion = fraccion.replace(/0+$/, "");
  return { entero: parteEntera, fraccion };
}

/** Multiplica por 10^escala moviendo la coma en el texto, sin pasar por floats. */
function desplazar(entero: string, fraccion: string, escala: number): [string, string] {
  if (escala === 0) return [entero, fraccion];
  const relleno = fraccion.padEnd(escala, "0");
  return [entero + relleno.slice(0, escala), relleno.slice(escala).replace(/0+$/, "")];
}

export interface OpcionesFormato {
  /**
   * Decimales fijos. Si se omite, se escriben los que el número necesita
   * (ninguno para un entero), lo que garantiza el viaje de ida y vuelta.
   */
  decimales?: number;
  /** Antepone "$ ". Por omisión false. */
  simbolo?: boolean;
}

/**
 * Formatea un número como monto chileno: 1234567.5 -> "1.234.567,5".
 *
 * Sin `decimales`, parsearMonto(formatearMonto(x)) === x para todo x finito
 * con a lo más 15 dígitos significativos: se usa la representación más corta
 * que JavaScript garantiza que vuelve al mismo double.
 *
 * Lanza RangeError con NaN, infinitos o números en que un double ya no
 * representa los pesos exactos (|x| >= 1e15 con decimales, o >= 2^53).
 */
export function formatearMonto(valor: number, opciones: OpcionesFormato = {}): string {
  if (!Number.isFinite(valor)) throw new RangeError(`Monto no finito: ${valor}`);
  if (Math.abs(valor) > Number.MAX_SAFE_INTEGER) throw new RangeError(`Monto fuera de rango: ${valor}`);
  const { decimales, simbolo = false } = opciones;
  if (decimales !== undefined && (!Number.isInteger(decimales) || decimales < 0 || decimales > 20)) {
    throw new RangeError(`decimales debe ser un entero entre 0 y 20: ${decimales}`);
  }

  const negativo = valor < 0 || Object.is(valor, -0);
  const absoluto = Math.abs(valor);
  const texto = decimales === undefined ? sinExponente(absoluto) : absoluto.toFixed(decimales);
  const [entero, fraccion = ""] = texto.split(".") as [string, string?];

  const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const cuerpo = fraccion ? `${conMiles},${fraccion}` : conMiles;
  const esCero = /^[0.,]+$/.test(cuerpo);
  const signo = negativo && !esCero ? "-" : "";
  return `${signo}${simbolo ? "$ " : ""}${cuerpo}`;
}

/** String(x) sin notación exponencial, conservando los mismos dígitos. */
function sinExponente(x: number): string {
  const corto = String(x);
  const m = /^(\d)(?:\.(\d+))?e([+-]\d+)$/.exec(corto);
  if (!m) return corto;
  const digitos = m[1]! + (m[2] ?? "");
  const exponente = Number(m[3]);
  if (exponente < 0) return "0." + "0".repeat(-exponente - 1) + digitos;
  return digitos.padEnd(exponente + 1, "0");
}
