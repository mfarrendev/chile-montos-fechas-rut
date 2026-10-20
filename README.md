# utilidades-chile

Funciones pequeñas, en TypeScript y sin dependencias, para tres cosas que el
software hecho en Chile suele resolver mal: montos escritos a mano, fechas en
la zona horaria de Santiago y el RUT.

## Por qué existe

Hay tres errores que aparecen una y otra vez y que no se notan en las
pruebas, sino semanas después en un informe:

1. **Montos con un error de escala.** `Number("1.500")` es `1.5` y
   `parseFloat("1.234.567")` es `1.234`. El arreglo rápido (borrar todos los
   puntos y cambiar la coma por punto) funciona hasta que alguien escribe
   `1.5` queriendo decir uno coma cinco y se guardan 15 pesos, o copia
   `1,500` desde una planilla en inglés. Un monto mal leído no da error:
   queda guardado.
2. **"Hoy" en UTC.** `new Date().toISOString().slice(0, 10)` devuelve la
   fecha en UTC. En Santiago, desde las 20:00 en verano (21:00 en invierno),
   eso ya es mañana, y los registros de la noche quedan con la fecha del día
   siguiente.
3. **Días hábiles sin feriados chilenos.** Sumar cinco días hábiles
   saltándose solo sábados y domingos falla en Semana Santa, en Fiestas
   Patrias y en los feriados que la ley mueve al lunes o al viernes.

El RUT viene de regalo: validarlo es fácil, pero conviene tenerlo en el mismo
lugar y con la misma regla de rechazar lo dudoso.

## Instalación

Requiere Node 24 o superior. Es un paquete ESM.

```sh
npm install utilidades-chile
```

(El paquete no está publicado en npm todavía; mientras tanto se puede
instalar desde el repositorio.)

```ts
import { parsearMonto, hoyChile, formatearRut } from "utilidades-chile";
// o por módulo
import { parsearMonto } from "utilidades-chile/montos";
```

## Montos

```ts
parsearMonto("1.234.567");       // 1234567
parsearMonto("1.234.567,89");    // 1234567.89
parsearMonto("$ 12.000");        // 12000
parsearMonto("CLP 4.990");       // 4990
parsearMonto("-3.500");          // -3500
parsearMonto("1,5 millones");    // 1500000
parsearMonto("1.5");             // null: en Chile el punto no es decimal
parsearMonto("1,500");           // null: ¿1,5 o 1500 a la estadounidense?
parsearMonto("1,234.56");        // null: formato estadounidense
parsearMonto("12.34.567");       // null: grupos de miles mal formados

formatearMonto(1234567.5);                      // "1.234.567,5"
formatearMonto(1234.5, { decimales: 2 });       // "1.234,50"
formatearMonto(12000, { simbolo: true });       // "$ 12.000"
```

`"1,500"` es el único caso que depende del contexto. Si el texto viene de un
sistema que siempre usa la coma como decimal (por ejemplo, de
`formatearMonto`), se puede pedir la lectura chilena:

```ts
parsearMonto("1,500", { comaDeTresDigitos: "decimal" }); // 1.5
```

El viaje de ida y vuelta está probado por propiedades con fast-check:
`parsearMonto(formatearMonto(x), { comaDeTresDigitos: "decimal" }) === x`
para todo entero seguro y todo número con hasta 15 dígitos significativos.
Con las opciones por omisión el resultado es `x` o `null`, nunca otro número.

## Fechas

Las fechas son textos `"AAAA-MM-DD"`. Un día de calendario no es un
instante, y guardarlo como `Date` a medianoche lo hace depender de la zona del
servidor.

```ts
hoyChile();                                        // "2026-10-20"
hoyChile(new Date("2026-10-21T02:30:00Z"));        // "2026-10-20" (23:30 en Santiago)
fechaEnChile(new Date("2026-04-05T03:30:00Z"));    // "2026-04-04" (la hora repetida al salir del horario de verano)

sumarDiasHabiles("2026-10-09", 1);    // "2026-10-13": el lunes 12 es feriado
sumarDiasHabiles("2026-09-16", 2);    // "2026-09-21": Fiestas Patrias y domingo
sumarDiasHabiles("2026-04-06", -1);   // "2026-04-02": antes de Semana Santa
diasHabilesEntre("2026-10-09", "2026-10-13");   // 1
esDiaHabil("2026-10-12");             // false
esFeriado("2026-06-21");              // true

domingoDePascua(2027);                // "2027-03-28"
feriadosDeChile(2026);                // [{ fecha: "2026-01-01", nombre: "Año Nuevo" }, ...]
```

El cambio de horario lo resuelve la base de zonas horarias que trae Node
(ICU), así que no hay fechas de cambio que mantener a mano.

Los feriados incluidos son los legales nacionales: los fijos, Viernes y
Sábado Santo (a partir de la Pascua calculada con el algoritmo anónimo
gregoriano), el Día de los Pueblos Indígenas en el solsticio de invierno, San
Pedro y San Pablo y el 12 de octubre trasladados al lunes según la Ley
19.668, el 31 de octubre trasladado al viernes según la Ley 20.299, el 17 de
septiembre cuando cae lunes, el 20 de septiembre cuando cae viernes y el 2 de
enero cuando cae lunes.

## RUT

```ts
validarRut("12.345.678-5");     // true
normalizarRut("12.345.678-5");  // "12345678-5"
normalizarRut("10000013k");     // "10000013-K"
formatearRut("123456785");      // "12.345.678-5"
formatearRut("12.345.678-6");   // null: dígito verificador incorrecto
digitoVerificador("12345678");  // "5"
generarRut();                   // un RUT válido al azar, para datos de prueba
generarRut(() => 0.5);          // "15.500.000-7", determinista con el mismo generador
```

## Decisiones

- **null antes que adivinar.** Cuando un texto admite dos lecturas, la
  función devuelve `null` y es el formulario el que pide corregir. Un campo
  rechazado se arregla en un segundo; un monto multiplicado por mil se
  descubre en el cierre de mes.
- **Excepciones solo para errores de programación.** `parsearMonto` y
  `normalizarRut` reciben texto de personas y responden `null`. Las funciones
  que reciben datos del programa (`formatearMonto(NaN)`, una fecha
  `"2026-02-30"`, un año sin datos de feriados) lanzan `RangeError`.
- **Sin precisión inventada.** Un monto con más de 15 dígitos significativos
  y decimales, o un entero mayor que 2^53, se rechaza: el `number` que
  quedaría guardado ya no sería el que se escribió.
- **Sin dependencias en tiempo de ejecución.** fast-check, vitest y
  TypeScript son solo de desarrollo.

## Limitaciones

- **Los feriados cubren de 2021 a 2030.** La fecha del Día de los Pueblos
  Indígenas se fija cada año por decreto según el solsticio y está tabulada;
  fuera de ese rango las funciones de feriados lanzan en vez de suponer.
- **Los feriados de años futuros pueden cambiar por ley.** En Chile se
  agregan y mueven feriados con frecuencia, a veces con pocas semanas de
  aviso. La tabla refleja la legislación conocida al escribirla; antes de
  depender de una fecha lejana, conviene revisarla.
- No incluye feriados regionales, los de elecciones o plebiscitos (se fijan
  caso a caso) ni el 31 de diciembre, que es feriado bancario.
- `hoyChile` es la hora de Chile continental. Isla de Pascua y Magallanes
  tienen otras zonas (`Pacific/Easter`, `America/Punta_Arenas`).
- No convierte UF ni UTM: eso requiere consultar una fuente en línea.

## Desarrollo

```sh
npm install
npm test          # vitest
npm run typecheck
npm run build     # tsc a dist/, con tipos
```

Las pruebas son de conducta y varias son por propiedades. Las que vigilan los
errores clásicos se midieron introduciendo el defecto a mano: la medición
está anotada al comienzo de cada archivo de prueba.

## Licencia

MIT. Ver [LICENSE](LICENSE).
