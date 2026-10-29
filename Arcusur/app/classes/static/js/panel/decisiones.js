// Matriz de decisión: convierte los resultados en acciones. Cada fila indica la evidencia, el criterio aplicado y la acción sugerida.

import { esc, num, orden, UMB, estado } from "./util.js";
import { LT } from "./etiquetas.js";

/** Porcentaje de organizaciones que prevé contratar (respuestas que empiezan con «Sí,»). */
export const prevE = (s) => (s.distE ? s.distE.proyeccion.filas.filter((f) => /^s[ií],/i.test(f.opcion)).reduce((a, f) => a + f.pct, 0) : 0);

const sumaPct = (d, re) => (d && d.total ? d.filas.filter((f) => re.test(f.opcion)).reduce((x, f) => x + f.pct, 0) : null);

/** Devuelve las filas de decisión: { tema, evidencia, criterio, accion, nivel }. */
export function filasDecision(s) {
  const R = [];
  const d = s.distT;
  const e = s.distE;
  const add = (tema, evidencia, criterio, accion, nivel) => R.push({ tema, evidencia, criterio, accion, nivel });

  if (s.nTitulados) {
    const pi = s.pctInteres * 100;
    const tot = s.junior + s.consolidado;
    const pj = tot ? (s.junior * 100) / tot : 0;

    add(
      "Demanda de posgrado",
      `${num(pi, 0)} % de los titulados quiere un posgrado.`,
      `Mayoría desde ${UMB.mayoria} %`,
      pi >= UMB.mayoria ? "Hay demanda: estimar en «Oferta de posgrado» la probabilidad de abrir un programa." : "Demanda minoritaria: empezar con diplomados o módulos cortos antes de una maestría.",
      pi >= UMB.mayoria ? "ok" : "at"
    );

    if (d.area && d.area.total) {
      const top = orden(d.area).slice(0, 2);
      const suma = top.reduce((x, f) => x + f.pct, 0);
      const nombres = top.map((f) => `«${esc(f.opcion)}»`).join(" y ");
      add(
        "Áreas de posgrado a abrir",
        `${nombres} reúnen ${num(suma, 0)} % de las preferencias.`,
        `Concentración sobre ${UMB.concentracion} %`,
        suma > UMB.concentracion ? `Concentrar la oferta en ${nombres}, en formato modular o híbrido.` : "Demanda repartida: ofrecer módulos comunes y especializar según la matrícula.",
        suma > UMB.concentracion ? "ok" : "at"
      );
    }

    const propios = sumaPct(d.financiamiento, /recursos propios/i);
    if (propios != null)
      add(
        "Financiamiento",
        `${num(propios, 0)} % de quienes estudiaron un posgrado lo pagó con recursos propios.`,
        `Dependencia desde ${UMB.mayoria} %`,
        propios >= UMB.mayoria ? "Dependencia económica: gestionar becas institucionales y convenios con la banca." : "Predominan becas u otras fuentes: mantener los convenios vigentes.",
        propios >= UMB.mayoria ? "at" : "ok"
      );

    if (tot)
      add(
        "Madurez profesional",
        `${num(pj, 0)} % son junior (hasta ${UMB.junior} años).`,
        `Mayoría junior desde ${UMB.mayoria} %`,
        pj >= UMB.mayoria ? "Priorizar diplomados y especialidades de entrada." : "Predominan los consolidados: priorizar maestrías y programas de gestión.",
        "in"
      );

    const trabaja = sumaPct(d.situacion, /trabajando|emprendimiento/i);
    if (trabaja != null)
      add(
        "Inserción laboral",
        `${num(trabaja, 0)} % trabaja o emprende.`,
        `Aceptable desde ${UMB.empleabilidadMin} %`,
        trabaja >= UMB.empleabilidadMin ? "Inserción alta: usarla como evidencia de pertinencia." : "Inserción baja: reforzar la bolsa de trabajo y la vinculación con empresas.",
        trabaja >= UMB.empleabilidadMin ? "ok" : "mal"
      );

    const lento = sumaPct(d.tiempoPrimerTrabajo, /(4\s*[-–]\s*8|8\s*[-–]\s*12|m[aá]s de 12)/i);
    if (lento != null)
      add(
        "Rapidez del primer empleo",
        `${num(lento, 0)} % tardó más de 4 meses en conseguir su primer trabajo.`,
        `Lento desde ${UMB.primerTrabajoLento} %`,
        lento >= UMB.primerTrabajoLento ? "Ampliar prácticas profesionales y pasantías antes de la titulación." : "Transición rápida al empleo: mantener las prácticas actuales.",
        lento >= UMB.primerTrabajoLento ? "at" : "ok"
      );

    const brechas = Object.keys(LT).map((k) => ({ k, l: s.likertT[k] })).filter((x) => x.l && x.l.n > 0 && x.l.acuerdo < UMB.acuerdoBajo);
    add(
      "Brechas de formación",
      brechas.length ? `${brechas.length} afirmación(es) bajo ${UMB.acuerdoBajo} % de acuerdo: ${brechas.map((x) => `«${esc(LT[x.k])}» (${num(x.l.acuerdo, 0)} %)`).join("; ")}.` : `Ninguna afirmación baja de ${UMB.acuerdoBajo} % de acuerdo.`,
      `Brecha bajo ${UMB.acuerdoBajo} % de acuerdo`,
      brechas.length ? "Llevar estos puntos a la revisión de la malla curricular." : "Sin brechas fuertes: vigilar las afirmaciones en «Atender».",
      brechas.length ? "mal" : "ok"
    );

    if (d.pocoUtiles && d.pocoUtiles.total && d.mejorar && d.mejorar.total) {
      const a = orden(d.pocoUtiles).slice(0, 2).map((f) => `«${esc(f.opcion)}»`).join(" y ");
      const b = orden(d.mejorar)[0];
      add(
        "Revisión de la malla",
        `Más señaladas como poco útiles: ${a}. Mejora más pedida: «${esc(b.opcion)}».`,
        "Opciones más mencionadas",
        "Evaluar actualizar, fusionar o volver electivas esas asignaturas, y priorizar la mejora más pedida.",
        "at"
      );
    }
  }

  if (s.nEmpleadores) {
    const pr = prevE(s);
    const superior = sumaPct(e.nivelFormacion, /^(?!licenciatura)/i);
    add(
      "Demanda del mercado",
      `${num(pr, 0)} % de las organizaciones prevé contratar Ingenieros de Sistemas.`,
      `Demanda alta desde ${UMB.demandaAlta} %`,
      pr >= UMB.demandaAlta ? "El sector respalda la pertinencia de la Carrera: incluirlo en el informe de acreditación." : "Demanda moderada: buscar convenios con las organizaciones que sí contratan.",
      pr >= UMB.demandaAlta ? "ok" : "at"
    );
    if (superior != null)
      add(
        "Nivel de formación que piden",
        `${num(superior, 0)} % de las organizaciones demanda un nivel superior a la licenciatura.`,
        `Respaldo desde ${UMB.mayoria} %`,
        superior >= UMB.mayoria ? "El mercado pide posgrado: respalda abrir diplomados y especialidades." : "El mercado acepta la licenciatura: ofrecer posgrado como diferenciador, no como requisito.",
        superior >= UMB.mayoria ? "ok" : "at"
      );
  }

  const margen = s.muestra.margenTitulados;
  const suficiente = s.nTitulados >= UMB.nMin && margen <= UMB.margenMax;
  add(
    "Confiabilidad de los datos",
    `${s.nTitulados} titulados y ${s.nEmpleadores} empleadores; margen de error referencial de ± ${num(margen)} puntos en titulados.`,
    `Mínimo ${UMB.nMin} titulados y margen de ${UMB.margenMax} puntos o menos`,
    suficiente ? "Resultados estables para sustentar decisiones." : "Tratar las conclusiones como preliminares y reunir más respuestas antes de decidir.",
    suficiente ? "ok" : "at"
  );
  return R;
}

const ETIQUETA = { ok: "Favorable", at: "Atender", mal: "Crítico", in: "Referencia" };

/** Tabla HTML de la matriz de decisión. */
export function tablaDecisiones(filas) {
  const cuerpo = filas
    .map((r) => `<tr><td>${r.tema}</td><td>${r.evidencia}</td><td>${r.criterio}</td><td>${estado(r.nivel, ETIQUETA[r.nivel])}</td><td>${r.accion}</td></tr>`)
    .join("");
  return `<div class="scroll"><table class="tabla texto decisiones"><tr><th>Asunto</th><th>Evidencia</th><th>Criterio</th><th>Estado</th><th>Acción recomendada</th></tr>${cuerpo}</table></div>`;
}
