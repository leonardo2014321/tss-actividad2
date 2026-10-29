// Simulación Monte Carlo de la oferta de posgrado: compara el escenario base con el escenario con becas.

import { $, esc, num, NOMBRE_FUENTE } from "./util.js";
import { bloque, columnas, distSvg } from "./graficos.js";

let interesEditado = false;

/** Envía los parámetros a /api/simulacion y devuelve el resultado. */
async function llamar(ctx, cuerpo) {
  const r = await fetch("/api/simulacion?datos=" + ctx.fuente, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  if (!r.ok) throw new Error("simulación");
  return r.json();
}

/** Prellena la probabilidad de interés con el valor de la encuesta, salvo que la persona ya la haya editado. */
export function ajustarInteres(s) {
  if (s.nTitulados && !interesEditado) {
    $("pi").value = Math.max(0.01, s.pctInteres);
    $("piHint").textContent = `Valor de la encuesta: ${num(s.pctInteres * 100, 0)} %`;
  }
}

const indicador = (clase, titulo, r) =>
  `<div class="ind ${clase}"><b>${num(r.probApertura * 100, 0)} %</b><span>${titulo}: probabilidad de abrir</span>` +
  `<em>${num(r.media, 0)} inscritos en promedio (rango del 90 %: ${num(r.p5, 0)} a ${num(r.p95, 0)})</em></div>`;

async function ejecutar(ctx, guardar) {
  const corrida = "c" + Date.now().toString(36);
  const b = {
    poblacion: +$("pob").value,
    probInteres: +$("pi").value,
    probInscribe: +$("pr").value,
    minimo: +$("mn").value,
    iteraciones: 5000,
    guardar: guardar ? 1 : 0,
    corrida,
  };
  const bono = +$("bono").value;
  const base = await llamar(ctx, { ...b, escenario: "base" });
  const becas = await llamar(ctx, { ...b, escenario: "becas", probInscribe: Math.min(1, b.probInscribe + bono) });

  const origen =
    base.origenInteres === "datos"
      ? `Interés tomado de ${base.nTitulados} respuestas de titulados (${NOMBRE_FUENTE[base.datos] || base.datos}).`
      : "Interés escrito a mano.";

  const porArea =
    base.porArea && base.porArea.length
      ? bloque({
          titulo: "Resultado por área de posgrado",
          meta: "Participación entre los titulados interesados",
          cuerpo:
            `<div class="scroll"><table class="tabla"><tr><th>Área</th><th>Participación</th><th>Inscritos (base)</th><th>Abre (base)</th><th>Inscritos (becas)</th><th>Abre (becas)</th></tr>` +
            base.porArea
              .map((x, i) => {
                const y = (becas.porArea || [])[i] || x;
                return `<tr><td>${esc(x.area)}</td><td>${num(x.participacion * 100, 0)} %</td><td>${num(x.media, 0)}</td><td>${num(x.probApertura * 100, 0)} %</td><td>${num(y.media, 0)}</td><td>${num(y.probApertura * 100, 0)} %</td></tr>`;
              })
              .join("") +
            "</table></div>",
          nota: "Un área con poca participación rara vez reúne el mínimo por sí sola: conviene ofrecer pocos programas o módulos comunes.",
          ancho: true,
          sinRelleno: true,
        })
      : "";

  $("simres").innerHTML =
    `<div class="escenarios">${indicador("base", "Escenario base", base)}${indicador("becas", "Con becas", becas)}</div>` +
    columnas(
      bloque({
        titulo: "Distribución de inscritos",
        meta: "5 000 simulaciones",
        cuerpo: distSvg(base, becas, b.minimo),
        nota: `${origen} Con becas, la probabilidad de alcanzar ${b.minimo} inscritos pasa de ${num(base.probApertura * 100, 0)} % a ${num(becas.probApertura * 100, 0)} %.${base.guardada ? " Guardada la comparación: escenario base y con becas." : ""}`,
        ancho: true,
      }),
      porArea
    );
  if (guardar) await historial(ctx);
}

export async function simular(ctx, guardar = false) {
  try {
    await ejecutar(ctx, guardar);
  } catch {
    $("simres").innerHTML = '<p class="aviso">No se pudo calcular la simulación. Revise que el servidor esté activo e inténtelo de nuevo.</p>';
  }
}

/**
 * Últimas comparaciones guardadas del origen de datos actual. Cada vez que se guarda, el servidor registra juntos el
 * escenario base y el escenario con becas (misma corrida): aquí se muestran como UNA fila para no parecer un duplicado.
 */
export async function historial(ctx) {
  const h = $("hist");
  try {
    const r = await fetch("/api/simulaciones?datos=" + ctx.fuente);
    if (!r.ok) throw new Error("historial");
    const corridas = new Map(); // corrida -> filas del programa en general (una por escenario)
    for (const x of (await r.json()).filter((x) => !x.area)) {
      if (!corridas.has(x.corrida)) corridas.set(x.corrida, []);
      corridas.get(x.corrida).push(x);
    }
    const pct = (x) => (x ? `${num(x.probApertura * 100, 0)} %` : "—");
    h.innerHTML = corridas.size
      ? columnas(
          bloque({
            titulo: "Simulaciones guardadas",
            meta: `Cada guardado compara base y becas · últimas 10 de ${corridas.size}`,
            cuerpo:
              `<div class="scroll"><table class="tabla"><tr><th>Fecha</th><th>Titulados usados</th><th>Interés</th><th>Inscripción base → becas</th><th>Mínimo</th><th>Abre (base)</th><th>Abre (becas)</th></tr>` +
              [...corridas.values()]
                .slice(0, 10)
                .map((es) => {
                  const base = es.find((e) => e.escenario === "base") || es[0];
                  const becas = es.find((e) => e.escenario === "becas");
                  const insc = `${num(base.probInscribe * 100, 0)} %${becas ? ` → ${num(becas.probInscribe * 100, 0)} %` : ""}`;
                  return `<tr><td>${esc(String(base.fecha).slice(0, 16).replace("T", " "))}</td><td>${base.nTitulados}</td><td>${num(base.probInteres * 100, 0)} %</td><td>${insc}</td><td>${base.minimo}</td><td>${pct(base)}</td><td>${pct(becas)}</td></tr>`;
                })
                .join("") +
              "</table></div>",
            nota: "Cada simulación guardada registra dos escenarios, el base y el que suma el aumento por becas, para poder compararlos; por eso aparecen juntos en una sola fila.",
            pie: `<a class="btn" href="/api/export/simulaciones.csv?datos=${ctx.fuente}&sep=${encodeURIComponent(ctx.sep)}">Descargar todas (CSV)</a>`,
            ancho: true,
            sinRelleno: true,
          })
        )
      : "";
  } catch {
    h.innerHTML = "";
  }
}

/** Recalcula sin guardar y recarga el historial (cuando cambia el origen de datos). */
export function resimular(ctx) {
  simular(ctx, false);
  historial(ctx);
}

export function iniciarSimulacion(ctx) {
  $("sim").onsubmit = (e) => {
    e.preventDefault();
    simular(ctx, true);
  };
  $("pi").addEventListener("input", () => (interesEditado = true));
}
