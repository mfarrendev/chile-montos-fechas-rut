// Mediciones (2026-10-20), 28 pruebas en este archivo, 0 fallan sin defecto:
// - fechaEnChile con instante.toISOString().slice(0, 10) (el error de usar
//   la fecha UTC): caen 4 de 28.
// - Ley 19.668 sin trasladar el jueves al lunes (dow <= 3 en vez de <= 4):
//   cae 1 de 28 (San Pedro y Colón de 2023).
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  diasHabilesEntre,
  domingoDePascua,
  esDiaHabil,
  esFeriado,
  fechaEnChile,
  feriadosDeChile,
  hoyChile,
  sumarDias,
  sumarDiasHabiles,
} from "../src/fechas.js";

describe("hoyChile", () => {
  it("de noche en Chile sigue siendo hoy, aunque en UTC ya sea mañana", () => {
    const instante = new Date("2026-10-21T02:30:00Z"); // 23:30 del 20 en Santiago (UTC-3)
    expect(instante.toISOString().slice(0, 10)).toBe("2026-10-21"); // el error clásico
    expect(hoyChile(instante)).toBe("2026-10-20");
  });

  it("en invierno el desfase es de cuatro horas", () => {
    expect(fechaEnChile(new Date("2026-06-15T03:30:00Z"))).toBe("2026-06-14");
    expect(fechaEnChile(new Date("2026-06-15T04:30:00Z"))).toBe("2026-06-15");
  });

  it("cruza el fin del horario de verano (la hora que se repite)", () => {
    // El 5 de abril de 2026 a las 00:00 los relojes vuelven a las 23:00 del 4.
    expect(fechaEnChile(new Date("2026-04-05T02:30:00Z"))).toBe("2026-04-04");
    expect(fechaEnChile(new Date("2026-04-05T03:30:00Z"))).toBe("2026-04-04");
    expect(fechaEnChile(new Date("2026-04-05T04:30:00Z"))).toBe("2026-04-05");
  });

  it("cruza el inicio del horario de verano (la hora que no existe)", () => {
    // El 6 de septiembre de 2026 las 00:00 pasan a ser la 01:00.
    expect(fechaEnChile(new Date("2026-09-06T03:59:00Z"))).toBe("2026-09-05");
    expect(fechaEnChile(new Date("2026-09-06T04:00:00Z"))).toBe("2026-09-06");
  });

  it("rechaza un Date inválido", () => {
    expect(() => hoyChile(new Date("no es fecha"))).toThrow(RangeError);
  });
});

describe("domingoDePascua", () => {
  it.each([
    [2000, "2000-04-23"],
    [2008, "2008-03-23"],
    [2019, "2019-04-21"],
    [2024, "2024-03-31"],
    [2025, "2025-04-20"],
    [2026, "2026-04-05"],
    [2038, "2038-04-25"],
    [2285, "2285-03-22"],
  ])("%i -> %s", (anio, esperado) => {
    expect(domingoDePascua(anio)).toBe(esperado);
  });

  it("siempre es domingo, entre el 22 de marzo y el 25 de abril", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1583, max: 4099 }), (anio) => {
        const p = domingoDePascua(anio);
        expect(new Date(`${p}T00:00:00Z`).getUTCDay()).toBe(0);
        const mmdd = p.slice(5);
        expect(mmdd >= "03-22" && mmdd <= "04-25").toBe(true);
      }),
    );
  });
});

describe("feriadosDeChile", () => {
  const fechas = (anio: number) => feriadosDeChile(anio).map((f) => f.fecha);

  it("2023: 2 de enero, San Pedro al lunes 26, Colón al 9 e Iglesias Evangélicas al viernes 27", () => {
    const f = fechas(2023);
    expect(f).toContain("2023-01-02");
    expect(f).toContain("2023-04-07");
    expect(f).toContain("2023-04-08");
    expect(f).toContain("2023-06-21");
    expect(f).toContain("2023-06-26");
    expect(f).not.toContain("2023-06-29");
    expect(f).toContain("2023-10-09");
    expect(f).not.toContain("2023-10-12");
    expect(f).toContain("2023-10-27");
    expect(f).not.toContain("2023-10-31");
  });

  it("2024: Semana Santa en marzo, solsticio el 20 y viernes 20 de septiembre", () => {
    const f = fechas(2024);
    expect(f).toEqual([
      "2024-01-01",
      "2024-03-29",
      "2024-03-30",
      "2024-05-01",
      "2024-05-21",
      "2024-06-20",
      "2024-06-29",
      "2024-07-16",
      "2024-08-15",
      "2024-09-18",
      "2024-09-19",
      "2024-09-20",
      "2024-10-12",
      "2024-10-31",
      "2024-11-01",
      "2024-12-08",
      "2024-12-25",
    ]);
  });

  it("2026: la lista completa", () => {
    expect(fechas(2026)).toEqual([
      "2026-01-01",
      "2026-04-03",
      "2026-04-04",
      "2026-05-01",
      "2026-05-21",
      "2026-06-21",
      "2026-06-29",
      "2026-07-16",
      "2026-08-15",
      "2026-09-18",
      "2026-09-19",
      "2026-10-12",
      "2026-10-31",
      "2026-11-01",
      "2026-12-08",
      "2026-12-25",
    ]);
  });

  it("2029: 17 de septiembre en lunes y San Pedro del viernes al lunes siguiente", () => {
    const f = fechas(2029);
    expect(f).toContain("2029-09-17");
    expect(f).toContain("2029-07-02");
  });

  it("fuera del rango tabulado lanza en vez de inventar", () => {
    expect(() => feriadosDeChile(2020)).toThrow(RangeError);
    expect(() => feriadosDeChile(2031)).toThrow(RangeError);
    expect(() => esFeriado("2031-01-01")).toThrow(RangeError);
  });

  it("cada año soportado tiene sus feriados ordenados y sin repetir", () => {
    for (let anio = 2021; anio <= 2030; anio++) {
      const f = fechas(anio);
      expect([...f].sort()).toEqual(f);
      expect(new Set(f).size).toBe(f.length);
      expect(f.length).toBeGreaterThanOrEqual(15);
    }
  });
});

describe("días hábiles", () => {
  it("un fin de semana y un feriado no cuentan", () => {
    expect(esDiaHabil("2026-10-20")).toBe(true);
    expect(esDiaHabil("2026-10-24")).toBe(false); // sábado
    expect(esDiaHabil("2026-10-12")).toBe(false); // feriado lunes
  });

  it("sumar uno a un viernes da el lunes, o el martes si el lunes es feriado", () => {
    expect(sumarDiasHabiles("2026-10-23", 1)).toBe("2026-10-26");
    expect(sumarDiasHabiles("2026-10-09", 1)).toBe("2026-10-13");
  });

  it("Fiestas Patrias de 2026: del miércoles 16 se salta al lunes 21", () => {
    // 17 jueves hábil, 18 y 19 feriados, 20 domingo.
    expect(sumarDiasHabiles("2026-09-16", 1)).toBe("2026-09-17");
    expect(sumarDiasHabiles("2026-09-16", 2)).toBe("2026-09-21");
  });

  it("restar días hábiles cruza Semana Santa hacia atrás", () => {
    expect(sumarDiasHabiles("2026-04-06", -1)).toBe("2026-04-02");
  });

  it("cruza el cambio de año", () => {
    expect(sumarDiasHabiles("2026-12-31", 1)).toBe("2027-01-04"); // 1 feriado viernes, 2-3 fin de semana
  });

  it("con cero devuelve la misma fecha", () => {
    expect(sumarDiasHabiles("2026-10-24", 0)).toBe("2026-10-24");
  });

  it("sumar n y contar los hábiles entre las dos fechas da n", () => {
    const dia = fc.integer({ min: 0, max: 365 * 8 }).map((k) => sumarDias("2021-06-01", k));
    fc.assert(
      fc.property(dia, fc.integer({ min: -60, max: 60 }), (base, n) => {
        const destino = sumarDiasHabiles(base, n);
        expect(diasHabilesEntre(base, destino)).toBe(n);
        if (n !== 0) expect(esDiaHabil(destino)).toBe(true);
      }),
      { numRuns: 300 },
    );
  });

  it("rechaza fechas inexistentes o mal escritas", () => {
    expect(() => sumarDiasHabiles("2026-02-30", 1)).toThrow(RangeError);
    expect(() => sumarDiasHabiles("20/10/2026", 1)).toThrow(RangeError);
    expect(() => sumarDiasHabiles("2026-10-20", 1.5)).toThrow(RangeError);
  });
});
