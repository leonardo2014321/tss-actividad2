// Lecturas en palabras: frases cortas generadas a partir de los números (se muestran como nota al pie de cada bloque).

import { esc, num, corto, orden, pTxt, UMB } from "./util.js";

export function lecDist(d, multiple = false) {
  if (!d || !d.total) return "";
  const [a, b0] = orden(d);
  const b = b0 && b0.n > 0 ? b0 : null;
  if (!multiple && b && a.n === b.n) return `Empate entre «${esc(corto(a.opcion))}» y «${esc(corto(b.opcion))}» (${num(a.pct)} % cada una).`;
  if (multiple) return `La más mencionada es «${esc(corto(a.opcion))}» (${num(a.pct)} %)` + (b ? `, después «${esc(corto(b.opcion))}» (${num(b.pct)} %).` : ".");
  return `Predomina «${esc(corto(a.opcion))}» (${num(a.pct)} %)` + (b ? `, seguida de «${esc(corto(b.opcion))}» (${num(b.pct)} %).` : ".");
}

/** Si dos áreas concentran más del umbral de las preferencias, conviene una oferta modular o híbrida. */
export function lecArea(d) {
  if (!d || !d.total) return "";
  const top = orden(d).slice(0, 2);
  const suma = top.reduce((x, f) => x + f.pct, 0);
  const nombres = top.map((f) => `«${esc(f.opcion)}»`).join(" y ");
  return `${nombres} concentran ${num(suma)} % de las preferencias` + (suma > UMB.concentracion ? ": concentración suficiente para una oferta modular o híbrida." : ": la demanda está repartida entre varias áreas.");
}

export function lecAnios(a, junior, consolidado) {
  const tot = junior + consolidado;
  let t = `Media de ${num(a.media)} años de vida profesional (mediana ${num(a.mediana)}, desviación ${num(a.sd)}). ${num((junior * 100) / tot, 0)} % son junior y ${num((consolidado * 100) / tot, 0)} % consolidados.`;
  if (a.media > a.mediana * 1.25 && a.sd > 0) t += " Unos pocos casos de mucha trayectoria elevan la media: la mediana describe mejor al titulado típico.";
  return t;
}

export function lecLikert(items, texto) {
  const v = items.filter((x) => x.l.n > 0).sort((a, b) => b.l.acuerdo - a.l.acuerdo);
  if (v.length < 2) return "";
  const a = v[0];
  const b = v[v.length - 1];
  if (a.l.acuerdo === b.l.acuerdo) return `Todas las afirmaciones tienen el mismo nivel de acuerdo (${num(a.l.acuerdo)} % ${texto}).`;
  return `Mayor acuerdo: «${esc(a.label)}» (${num(a.l.acuerdo)} %). Menor acuerdo: «${esc(b.label)}» (${num(b.l.acuerdo)} %).`;
}

const efecto = (v, k) => {
  const t = k <= 1 ? [0.1, 0.3, 0.5] : k === 2 ? [0.07, 0.21, 0.35] : [0.06, 0.17, 0.29];
  return v < t[0] ? "muy débil" : v < t[1] ? "débil" : v < t[2] ? "moderada" : "fuerte";
};

export function lecCruce(c) {
  if (c.chi2 == null) return esc(c.aviso || "");
  const k = Math.min(c.filas.length - 1, c.columnas.length - 1);
  const A = esc(c.filaNombre.toLowerCase());
  const B = esc(c.colNombre.toLowerCase());
  if (!c.confiable) return "Pocos casos por celda: la tabla describe pero no permite concluir si las variables están relacionadas.";
  if (c.p >= 0.05) return `Sin evidencia de relación entre ${A} y ${B} (${pTxt(c.p)}, α = 0,05).`;
  const celdas = [];
  c.filas.forEach((f, i) =>
    c.columnas.forEach((x, j) => {
      if (Math.abs(c.residuales[i][j]) > 1.96) celdas.push({ f, x, z: c.residuales[i][j], o: c.matriz[i][j], e: c.esperados[i][j] });
    })
  );
  celdas.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
  const destacadas = celdas.slice(0, 2).map((x) => `«${esc(corto(x.f))}» con «${esc(corto(x.x))}» (${x.o} casos; se esperaban ${num(x.e)})`).join("; ");
  return `Hay relación entre ${A} y ${B} (${pTxt(c.p)}, α = 0,05), de intensidad ${efecto(c.cramerV, k)} (V de Cramér = ${num(c.cramerV, 2)}).` + (destacadas ? ` Mayor desvío: ${destacadas}.` : "");
}

/** Resultado de un cruce para la tabla resumen: [clase de estado, texto]. */
export const veredicto = (c) => (c.chi2 == null ? ["in", "Sin datos"] : !c.confiable ? ["at", "No concluyente"] : c.p < 0.05 ? ["ok", "Hay relación"] : ["in", "Sin relación"]);
