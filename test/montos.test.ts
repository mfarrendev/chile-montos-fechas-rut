import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { formatearMonto, parsearMonto } from "../src/montos.js";

describe("parsearMonto: lo que se acepta", () => {
  const casos: Array<[string, number]> = [
    ["12000", 12000],
    ["1.500", 1500],
    ["1.234.567", 1234567],
    ["1.234.567,89", 1234567.89],
    ["1234567,89", 1234567.89],
    ["1234,5", 1234.5],
    ["0,75", 0.75],
    [",5".replace(",", "0,"), 0.5],
    ["$ 12.000", 12000],
    ["$12.000", 12000],
    ["CLP 4.990", 4990],
    ["-3.500", -3500],
    ["-$ 3.500", -3500],
    ["  7.000  ", 7000],
    ["1 234 567", 1234567],
    ["1,5 millones", 1_500_000],
    ["1,25 millones", 1_250_000],
    ["2 MM", 2_000_000],
    ["1.200 millones", 1_200_000_000],
    ["1 millón", 1_000_000],
    ["0,1234567 millones", 123456.7],
    ["10,50", 10.5],
    ["9.007.199.254.740.991", Number.MAX_SAFE_INTEGER],
  ];
  it.each(casos)("%s -> %d", (texto, esperado) => {
    expect(parsearMonto(texto)).toBe(esperado);
  });

  it("acepta el espacio duro que dejan algunas planillas al copiar", () => {
    expect(parsearMonto(`1${String.fromCharCode(0xa0)}234${String.fromCharCode(0xa0)}567`)).toBe(1234567);
  });

  it("no devuelve -0", () => {
    expect(Object.is(parsearMonto("-0"), 0)).toBe(true);
  });
});

describe("parsearMonto: lo que se rechaza en vez de adivinar", () => {
  const ambiguos = [
    "1.5", // ¿1,5 escrito con punto o un error de tipeo?
    "1.50",
    "1.5000",
    "1,500", // ¿1,5 o 1500 a la estadounidense?
    "1,234.56", // formato estadounidense
    "1.234,567.8",
    "12.34.567", // grupos de miles mal formados
    "1.2345",
    ".500",
    "1.",
    "1,",
    "1,2,3",
    "1,5 millones extra",
    "1.5 millones",
    "",
    "   ",
    "$",
    "-",
    "abc",
    "12a",
    "1e6",
    "0x10",
    "Infinity",
    "NaN",
    "--5",
    "1 23 456",
    "9.007.199.254.740.993", // más que 2^53: el double no lo representa
    "12345678901234,56", // 16 dígitos: más de 15 significativos con decimales es el tope
  ];
  it.each(ambiguos)("%j -> null", (texto) => {
    expect(parsearMonto(texto)).toBeNull();
  });

  it("nunca lee un monto con puntos de miles como diez o mil veces menor", () => {
    // El error clásico: Number("1.500") === 1.5 o parseFloat("1.234.567") === 1.234.
    fc.assert(
      fc.property(fc.integer({ min: 1000, max: 999_999_999_999 }), (n) => {
        const conPuntos = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        expect(parsearMonto(conPuntos)).toBe(n);
      }),
    );
  });

  it("no lanza con texto arbitrario y, si acepta, devuelve un número finito", () => {
    fc.assert(
      fc.property(fc.string({ unit: fc.constantFrom(..."0123456789.,$- kmMl") }), (texto) => {
        const v = parsearMonto(texto);
        expect(v === null || Number.isFinite(v)).toBe(true);
      }),
      { numRuns: 2000 },
    );
  });
});

describe("formatearMonto", () => {
  it("usa punto de miles y coma decimal", () => {
    expect(formatearMonto(1234567)).toBe("1.234.567");
    expect(formatearMonto(1234567.5)).toBe("1.234.567,5");
    expect(formatearMonto(999)).toBe("999");
    expect(formatearMonto(-3500)).toBe("-3.500");
    expect(formatearMonto(0.1 + 0.2)).toBe("0,30000000000000004");
    expect(formatearMonto(1e-7)).toBe("0,0000001");
    expect(formatearMonto(-0)).toBe("0");
  });

  it("respeta decimales fijos y el símbolo", () => {
    expect(formatearMonto(1234.5, { decimales: 2 })).toBe("1.234,50");
    expect(formatearMonto(1234.5, { decimales: 0 })).toBe("1.235");
    expect(formatearMonto(12000, { simbolo: true })).toBe("$ 12.000");
    expect(formatearMonto(-12000, { simbolo: true })).toBe("-$ 12.000");
    expect(formatearMonto(-0.001, { decimales: 2 })).toBe("0,00");
  });

  it("rechaza lo que no es un monto representable", () => {
    expect(() => formatearMonto(Number.NaN)).toThrow(RangeError);
    expect(() => formatearMonto(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => formatearMonto(2 ** 53 + 2)).toThrow(RangeError);
    expect(() => formatearMonto(1, { decimales: 1.5 })).toThrow(RangeError);
  });
});

describe("coma con tres decimales", () => {
  it("por omisión se rechaza solo cuando admite la lectura estadounidense", () => {
    expect(parsearMonto("1,500")).toBeNull();
    expect(parsearMonto("999,999")).toBeNull();
    expect(parsearMonto("0,500")).toBe(0.5);
    expect(parsearMonto("1234,567")).toBe(1234.567);
    expect(parsearMonto("1.234,567")).toBe(1234.567);
  });

  it("con comaDeTresDigitos: \"decimal\" se lee a la chilena", () => {
    expect(parsearMonto("1,500", { comaDeTresDigitos: "decimal" })).toBe(1.5);
    expect(parsearMonto("1,5 millones", { comaDeTresDigitos: "decimal" })).toBe(1_500_000);
  });
});

const decimal = { comaDeTresDigitos: "decimal" } as const;

describe("viaje de ida y vuelta", () => {
  it("por omisión devuelve el mismo número o null, nunca otro", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1e9, max: 1e9 }), fc.integer({ min: 0, max: 4 }), (n, d) => {
        const x = n / 10 ** d;
        const v = parsearMonto(formatearMonto(x));
        expect(v === null || v === (x === 0 ? 0 : x)).toBe(true);
      }),
      { numRuns: 2000 },
    );
  });

  // Desde acá, con comaDeTresDigitos: "decimal": el texto sale de
  // formatearMonto, que siempre escribe la coma como decimal.
  it("enteros: parsear(formatear(n)) === n en todo el rango seguro", () => {
    fc.assert(
      fc.property(fc.integer({ min: -Number.MAX_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER }), (n) => {
        expect(parsearMonto(formatearMonto(n))).toBe(n === 0 ? 0 : n);
      }),
      { numRuns: 2000 },
    );
  });

  it("montos con centavos: parsear(formatear(x)) === x", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1e12, max: 1e12 }), fc.integer({ min: 0, max: 3 }), (centavos, d) => {
        const x = centavos / 10 ** d;
        expect(parsearMonto(formatearMonto(x), decimal)).toBe(x === 0 ? 0 : x);
      }),
      { numRuns: 2000 },
    );
  });

  it("cualquier double con hasta 15 dígitos significativos vuelve igual", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e14, max: 1e14, noNaN: true, noDefaultInfinity: true }),
        fc.integer({ min: 1, max: 15 }),
        (bruto, precision) => {
          const x = Number(bruto.toPrecision(precision));
          expect(parsearMonto(formatearMonto(x), decimal)).toBe(x === 0 ? 0 : x);
        },
      ),
      { numRuns: 3000 },
    );
  });

  it("con decimales fijos vuelve el número redondeado a esos decimales", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1e11, max: 1e11 }), fc.integer({ min: 0, max: 4 }), (n, d) => {
        const x = n / 1000;
        const esperado = Number(Math.abs(x).toFixed(d)) * Math.sign(x);
        expect(parsearMonto(formatearMonto(x, { decimales: d }), decimal)).toBe(esperado === 0 ? 0 : esperado);
      }),
      { numRuns: 2000 },
    );
  });

  it("formatear lo que se parseó deja un texto estable", () => {
    fc.assert(
      fc.property(fc.string({ unit: fc.constantFrom(..."0123456789.,- ") }), (texto) => {
        const v = parsearMonto(texto);
        if (v === null) return;
        const f = formatearMonto(v);
        expect(formatearMonto(parsearMonto(f, decimal)!)).toBe(f);
      }),
      { numRuns: 3000 },
    );
  });
});
