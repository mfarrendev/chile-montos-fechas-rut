/**
 * RUT chileno: cuerpo numérico más dígito verificador (0-9 o K),
 * calculado con módulo 11 sobre los dígitos del cuerpo leídos de derecha
 * a izquierda con los factores 2, 3, 4, 5, 6, 7, 2, 3, ...
 */

/** Calcula el dígito verificador de un cuerpo de RUT ("12345678" -> "5"). */
export function digitoVerificador(cuerpo: string | number): string {
  const texto = String(cuerpo);
  if (!/^\d+$/.test(texto)) {
    throw new TypeError(`El cuerpo del RUT debe ser solo dígitos: ${texto}`);
  }
  let suma = 0;
  let factor = 2;
  for (let i = texto.length - 1; i >= 0; i--) {
    suma += Number(texto[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return "0";
  if (resto === 10) return "K";
  return String(resto);
}

/**
 * Deja un RUT en la forma canónica "12345678-5" (sin puntos, K mayúscula)
 * si el dígito verificador es correcto. Devuelve null en cualquier otro caso.
 *
 * Acepta puntos, guion, espacios alrededor y k minúscula. No acepta letras
 * en el cuerpo ni ceros a la izquierda que cambien el número ("012.345.678-5"
 * se rechaza: nadie escribe así un RUT y suele ser un error de copia).
 */
export function normalizarRut(entrada: string): string | null {
  if (typeof entrada !== "string") return null;
  const limpio = entrada.trim().replace(/\./g, "").replace(/\s+/g, "");
  const m = /^(\d{1,9})-?([\dkK])$/.exec(limpio);
  if (!m) return null;
  const cuerpo = m[1]!;
  const dv = m[2]!.toUpperCase();
  if (cuerpo.length > 1 && cuerpo.startsWith("0")) return null;
  if (Number(cuerpo) === 0) return null;
  // Si había puntos, tienen que estar en su lugar (grupos de tres).
  const conPuntos = entrada.trim().split("-")[0]!;
  if (conPuntos.includes(".") && !/^\d{1,3}(\.\d{3})+[\dkK]?$/.test(conPuntos.replace(/\s+/g, ""))) {
    return null;
  }
  if (digitoVerificador(cuerpo) !== dv) return null;
  return `${cuerpo}-${dv}`;
}

/** true si el RUT es válido en cualquiera de las formas que acepta normalizarRut. */
export function validarRut(entrada: string): boolean {
  return normalizarRut(entrada) !== null;
}

/** Formatea un RUT válido como "12.345.678-5". Devuelve null si no es válido. */
export function formatearRut(entrada: string): string | null {
  const normal = normalizarRut(entrada);
  if (normal === null) return null;
  const [cuerpo, dv] = normal.split("-") as [string, string];
  const conPuntos = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${conPuntos}-${dv}`;
}

/**
 * Genera un RUT válido para datos de prueba. Recibe un generador de números
 * en [0, 1) para poder fijar la semilla en las pruebas; por omisión usa
 * Math.random. El cuerpo queda entre 1.000.000 y 29.999.999, el rango
 * habitual de personas naturales. No sirve como dato real de nadie.
 */
export function generarRut(azar: () => number = Math.random): string {
  const cuerpo = 1_000_000 + Math.floor(azar() * 29_000_000);
  return formatearRut(`${cuerpo}-${digitoVerificador(cuerpo)}`)!;
}
