// Medición (2026-10-20): con el ciclo de factores roto a mano en
// digitoVerificador (reiniciar en 8 en vez de 7), caen 4 de las 10 pruebas
// de este archivo; con el código correcto pasan las 10.
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { digitoVerificador, formatearRut, generarRut, normalizarRut, validarRut } from "../src/rut.js";

describe("digitoVerificador", () => {
  it("calcula el módulo 11 de RUT conocidos", () => {
    expect(digitoVerificador("12345678")).toBe("5");
    expect(digitoVerificador(11111111)).toBe("1");
    expect(digitoVerificador("10000013")).toBe("K");
    expect(digitoVerificador("6")).toBe("K");
    expect(digitoVerificador("1")).toBe("9");
    expect(digitoVerificador("28")).toBe("0");
  });

  it("rechaza un cuerpo que no es numérico", () => {
    expect(() => digitoVerificador("12a45")).toThrow(TypeError);
  });
});

describe("normalizarRut y validarRut", () => {
  it("acepta las formas habituales y devuelve la canónica", () => {
    for (const forma of ["12.345.678-5", "12345678-5", "123456785", " 12.345.678-5 ", "12 345 678-5"]) {
      expect(normalizarRut(forma)).toBe("12345678-5");
    }
    expect(normalizarRut("10.000.013-k")).toBe("10000013-K");
  });

  it("rechaza dígito verificador incorrecto", () => {
    expect(validarRut("12.345.678-6")).toBe(false);
    expect(validarRut("10.000.013-0")).toBe(false);
  });

  it("rechaza basura, puntos mal puestos y ceros a la izquierda", () => {
    for (const malo of ["", "-", "abc", "12.345.678", "1.2345.678-5", "12,345,678-5", "012345678-5", "0-0", "12.345.678-55"]) {
      expect(normalizarRut(malo), malo).toBeNull();
    }
  });

  it("detecta cualquier cambio de un dígito del cuerpo", () => {
    // Módulo 11 con factores 2..7 detecta todo error de un solo dígito.
    fc.assert(
      fc.property(fc.integer({ min: 1_000_000, max: 99_999_999 }), fc.nat(7), fc.integer({ min: 1, max: 9 }), (n, pos, delta) => {
        const cuerpo = String(n);
        const i = pos % cuerpo.length;
        const cambiado = cuerpo.slice(0, i) + String((Number(cuerpo[i]) + delta) % 10) + cuerpo.slice(i + 1);
        if (cambiado.startsWith("0")) return;
        expect(validarRut(`${cambiado}-${digitoVerificador(cuerpo)}`)).toBe(false);
      }),
    );
  });
});

describe("formatearRut", () => {
  it("pone puntos de miles y K mayúscula", () => {
    expect(formatearRut("123456785")).toBe("12.345.678-5");
    expect(formatearRut("10000013k")).toBe("10.000.013-K");
    expect(formatearRut("6-k")).toBe("6-K");
    expect(formatearRut("12345678-0")).toBeNull();
  });

  it("formatear y volver a normalizar no cambia el RUT", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 999_999_999 }), (n) => {
        const canonico = `${n}-${digitoVerificador(n)}`;
        expect(normalizarRut(formatearRut(canonico)!)).toBe(canonico);
      }),
    );
  });
});

describe("generarRut", () => {
  it("siempre genera RUT válidos y formateados", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true }), (u) => {
        const rut = generarRut(() => u);
        expect(validarRut(rut)).toBe(true);
        expect(rut).toMatch(/^\d{1,2}\.\d{3}\.\d{3}-[\dK]$/);
      }),
    );
  });

  it("es determinista con el mismo generador", () => {
    expect(generarRut(() => 0.5)).toBe(generarRut(() => 0.5));
  });
});
