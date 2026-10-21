import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as todo from "../src/index.js";

describe("punto de entrada", () => {
  it("exporta las funciones de los tres módulos", () => {
    for (const nombre of ["parsearMonto", "formatearMonto", "hoyChile", "sumarDiasHabiles", "feriadosDeChile", "validarRut", "formatearRut", "generarRut"]) {
      expect(typeof (todo as Record<string, unknown>)[nombre], nombre).toBe("function");
    }
  });

  it.runIf(existsSync("dist/index.js"))("el build se importa por el nombre del paquete", () => {
    const salida = execFileSync(
      process.execPath,
      ["--input-type=module", "-e", 'import { formatearRut } from "chile-montos-fechas-rut"; import { parsearMonto } from "chile-montos-fechas-rut/montos"; console.log(formatearRut("123456785"), parsearMonto("1.500"))'],
      { encoding: "utf8" },
    );
    expect(salida.trim()).toBe("12.345.678-5 1500");
  });
});
