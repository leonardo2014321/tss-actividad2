// Componentes de presentación: bloques, indicadores, barras, histogramas, escalas Likert, mapas de calor y gráficos SVG.
// Todo es HTML/SVG propio: el panel funciona sin conexión a internet.

import { esc, num, corto } from "./util.js";

// ---------- Estructura ----------

/** Bloque con título, dato de contexto (n), contenido y una nota opcional al pie. */
export const bloque = ({ titulo, meta = "", cuerpo, nota = "", ancho = false, pie = "", sinRelleno = false }) =>
  `<section class="bloque${ancho ? " ancho" : ""}"><header><h3>${titulo}</h3>${meta ? `<span class="meta">${meta}</span>` : ""}</header>` +
  `<div class="cuerpo${sinRelleno ? " sin-relleno" : ""}">${cuerpo}</div>` +
  `${nota ? `<p class="nota">${nota}</p>` : ""}${pie ? `<div class="pie">${pie}</div>` : ""}</section>`;

/** Franja de indicadores: [{valor, etiqueta, detalle}]. */
export const indicadores = (lista) =>
  `<div class="indicadores">${lista
    .map((i) => `<div class="ind"><b>${i.valor}</b><span>${i.etiqueta}</span>${i.detalle ? `<em>${i.detalle}</em>` : ""}</div>`)
    .join("")}</div>`;

export const columnas = (...bloques) => `<div class="cols">${bloques.join("")}</div>`;

/** Grupo plegable dentro de una vista. */
export const grupo = (titulo, cantidad, html, abierto = false) =>
  `<details class="grupo"${abierto ? " open" : ""}><summary>${titulo}<small>${cantidad} ${cantidad === 1 ? "bloque" : "bloques"}</small></summary>${html}</details>`;

/** Dato de contexto de una distribución: cuántas respuestas tiene. */
export const metaN = (d, alcance = "") => {
  if (!d || !d.total) return "Sin respuestas";
  const partes = [`n = ${d.total}`];
  if (d.multiple) partes.push("varias opciones por persona");
  if (alcance) partes.push(alcance.toLowerCase());
  return partes.join(" · ");
};

// ---------- Distribuciones ----------

/** Barras horizontales ordenadas; la más alta se resalta. Escala de 0 al máximo redondeado a la decena. */
export function barras(d) {
  if (!d || !d.total) return '<p class="vacio">Sin respuestas.</p>';
  const max = Math.max(...d.filas.map((f) => f.pct));
  const escala = Math.min(100, Math.ceil(max / 10) * 10) || 10;
  return (
    '<div class="bars">' +
    d.filas
      .map(
        (f) =>
          `<div class="bar${f.pct === max ? " top" : ""}" title="${esc(f.opcion)}: ${f.n} de ${d.total}">` +
          `<span class="l">${esc(corto(f.opcion))}</span><span class="t"><i style="width:${(f.pct / escala) * 100}%"></i></span>` +
          `<span class="v"><b>${num(f.pct)} %</b><small>${f.n}</small></span></div>`
      )
      .join("") +
    "</div>"
  );
}

/** Histograma de columnas. Las dos primeras clases son los titulados junior (hasta 3 años). */
export function histograma(d) {
  const max = Math.max(1, ...d.filas.map((f) => f.pct));
  return (
    `<div class="leyenda"><span><i style="background:var(--acento-3)"></i>Junior (hasta 3 años)</span>` +
    `<span><i style="background:var(--acento)"></i>Consolidado (más de 3 años)</span></div><div class="hist">` +
    d.filas
      .map(
        (f, i) =>
          `<div class="col" title="${esc(f.opcion)}: ${f.n} personas"><div class="bw"><span class="hv">${num(f.pct)} %</span>` +
          `<i class="${i < 2 ? "jr" : ""}" style="height:${(f.pct / max) * 82}%"></i></div><span class="hl">${esc(f.opcion)}</span></div>`
      )
      .join("") +
    "</div>"
  );
}

// ---------- Escalas Likert ----------

export const NIV4 = ["Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de acuerdo"];
export const COL4 = ["#9a5b00", "#e0bf8a", "#8fb0d0", "#1f4d7a"];
export const CL4 = [0, 1, 1, 0]; // niveles con color claro: el texto va oscuro
export const NIV3 = ["Totalmente en desacuerdo", "Parcialmente de acuerdo", "Totalmente de acuerdo"];
export const COL3 = ["#9a5b00", "#8fb0d0", "#1f4d7a"];
export const CL3 = [0, 1, 0];

/** Una barra apilada al 100 % por afirmación, con media ± desviación estándar. */
export function likert(items, niveles, colores, claros) {
  const v = items.filter((x) => x.l.n > 0);
  if (!v.length) return '<p class="vacio">Sin respuestas.</p>';
  const leyenda = niveles.map((n, i) => `<span><i style="background:${colores[i]}"></i>${n}</span>`).join("");
  const filas = v
    .map(({ label, l }) => {
      const ns = l.noSabe ? ` <span class="ns">· «No sabe»: ${l.noSabe}</span>` : "";
      const segs = l.pct
        .map((p, i) =>
          p > 0
            ? `<span class="${claros[i] ? "cl" : ""}" style="width:${p}%;background:${colores[i]}" title="${niveles[i]}: ${num(p)} %">${p >= 8 ? num(p, 0) + " %" : ""}</span>`
            : ""
        )
        .join("");
      return (
        `<div class="lk"><div class="lkt"><span>${esc(label)}${ns}</span>` +
        `<b title="media ± desviación estándar (n = ${l.n})">${num(l.media, 2)} <small>± ${num(l.sd, 2)}</small></b></div>` +
        `<div class="seg" role="img" aria-label="${esc(label)}: ${num(l.acuerdo)} % de acuerdo">${segs}</div></div>`
      );
    })
    .join("");
  return `<div class="leyenda">${leyenda}</div>${filas}`;
}

/** Comparación de dos grupos sobre los mismos aspectos: porcentaje de acuerdo de titulados y de empleadores. */
export function pares(ejes, A, B) {
  const fila = (nombre, v, color) =>
    `<div class="fila"><span>${nombre}</span><span class="t"><i style="width:${v}%;background:${color}"></i></span><b>${num(v, 0)} %</b></div>`;
  return (
    ejes.map((e, i) => `<div class="par"><span>${esc(e)}</span>${fila("Titulados", A[i], "var(--acento)")}${fila("Empleadores", B[i], "#c98a1b")}</div>`).join("")
  );
}

// ---------- Cruces de variables ----------

/** Tabla de contingencia como mapa de calor. Azul = más casos de los esperados, ámbar = menos. Borde = |z| > 1,96. */
export function heat(c) {
  if (!c.n) return `<p class="vacio">${esc(c.aviso || "Sin datos.")}</p>`;
  const F = c.filas;
  const C = c.columnas;
  const ft = F.map((_, i) => c.matriz[i].reduce((a, b) => a + b, 0));
  const ct = C.map((_, j) => F.reduce((a, _x, i) => a + c.matriz[i][j], 0));
  const conPrueba = c.chi2 != null;
  const celda = (i, j) => {
    const o = c.matriz[i][j];
    const z = conPrueba ? c.residuales[i][j] : 0;
    const a = Math.min(0.78, (Math.abs(z) / 3) * 0.78);
    const bg = z >= 0 ? `rgba(31,77,122,${a})` : `rgba(154,91,0,${a})`;
    const detalle = conPrueba ? ` (esperados: ${num(c.esperados[i][j])}; z = ${num(z, 2)})` : "";
    return (
      `<td class="${Math.abs(z) > 1.96 ? "sig" : ""}" style="background:${conPrueba ? bg : "#edf0f4"};${a > 0.5 ? "color:#fff" : ""}" ` +
      `title="${esc(F[i])} · ${esc(C[j])}: ${o} casos${detalle}"><b>${o}</b><small>${ft[i] ? num((o * 100) / ft[i], 0) : 0} %</small></td>`
    );
  };
  const cabecera = `<tr><th class="f">${esc(c.filaNombre)} ↓ · ${esc(c.colNombre)} →</th>${C.map((x) => `<th>${esc(corto(x))}</th>`).join("")}<th class="tot">Total</th></tr>`;
  const cuerpo = F.map(
    (f, i) =>
      `<tr><th class="f" title="${esc(f)}">${esc(corto(f))}</th>${C.map((_, j) => celda(i, j)).join("")}<td class="tot"><b>${ft[i]}</b><small>100 %</small></td></tr>`
  ).join("");
  const totales = `<tr><th class="f tot">Total</th>${ct.map((x) => `<td class="tot"><b>${x}</b><small>${num((x * 100) / c.n, 0)} %</small></td>`).join("")}<td class="tot"><b>${c.n}</b></td></tr>`;
  const leyenda = conPrueba
    ? `<div class="leyenda-heat"><span><i style="background:rgba(31,77,122,.6)"></i>Más casos de los esperados</span>` +
      `<span><i style="background:rgba(154,91,0,.6)"></i>Menos de los esperados</span>` +
      `<span><i style="box-shadow:inset 0 0 0 2px var(--tinta)"></i>Diferencia que el azar no explica (|z| &gt; 1,96)</span></div>`
    : "";
  return `<div class="scroll"><table class="heat">${cabecera}${cuerpo}${totales}</table></div>${leyenda}`;
}

// ---------- Estadística descriptiva ----------

const nice = (v) => (v <= 10 ? Math.ceil(v) : v <= 30 ? Math.ceil(v / 5) * 5 : Math.ceil(v / 10) * 10);

/** Diagrama de caja: caja = Q1 a Q3, raya = mediana, rombo = media, bigotes = vallas de Tukey, círculos = atípicos. */
export function caja(a) {
  if (!a || a.n < 4) return '<p class="vacio">Se necesitan al menos 4 respuestas para dibujar el diagrama de caja.</p>';
  const W = 640, H = 118, ml = 18, mr = 18, y = 44, h = 34;
  const top = nice(Math.max(a.max, 5));
  const X = (v) => ml + (v / top) * (W - ml - mr);
  const paso = top <= 10 ? 1 : top <= 30 ? 5 : 10;
  const eje = y + h / 2 + 26;
  let s = `<svg class="caja" viewBox="0 0 ${W} ${H}" role="img" aria-label="Diagrama de caja de los años de vida profesional">`;
  for (let v = 0; v <= top; v += paso) s += `<line x1="${X(v)}" x2="${X(v)}" y1="${eje}" y2="${eje + 5}" stroke="#9aa6b5"/><text x="${X(v)}" y="${H - 3}" text-anchor="middle">${v}</text>`;
  s +=
    `<line x1="${X(0)}" x2="${X(top)}" y1="${eje}" y2="${eje}" stroke="#9aa6b5"/>` +
    `<line x1="${X(a.bigoteInf)}" x2="${X(a.q1)}" y1="${y + h / 2}" y2="${y + h / 2}" stroke="#1c2733" stroke-width="2"/>` +
    `<line x1="${X(a.q3)}" x2="${X(a.bigoteSup)}" y1="${y + h / 2}" y2="${y + h / 2}" stroke="#1c2733" stroke-width="2"/>` +
    `<line x1="${X(a.bigoteInf)}" x2="${X(a.bigoteInf)}" y1="${y + 8}" y2="${y + h - 8}" stroke="#1c2733" stroke-width="2"/>` +
    `<line x1="${X(a.bigoteSup)}" x2="${X(a.bigoteSup)}" y1="${y + 8}" y2="${y + h - 8}" stroke="#1c2733" stroke-width="2"/>` +
    `<rect x="${X(a.q1)}" y="${y}" width="${Math.max(2, X(a.q3) - X(a.q1))}" height="${h}" fill="#a9c2dc" fill-opacity=".6" stroke="#1f4d7a" stroke-width="2"/>` +
    `<line x1="${X(a.mediana)}" x2="${X(a.mediana)}" y1="${y}" y2="${y + h}" stroke="#1c2733" stroke-width="3"/>` +
    `<text x="${X(a.mediana)}" y="${y - 8}" text-anchor="middle" style="font-weight:700">Mediana ${num(a.mediana)}</text>` +
    `<polygon points="${X(a.media)},${y + h / 2 - 7} ${X(a.media) + 7},${y + h / 2} ${X(a.media)},${y + h / 2 + 7} ${X(a.media) - 7},${y + h / 2}" fill="#9a5b00" stroke="#fff"><title>Media: ${num(a.media)}</title></polygon>` +
    a.atipicos.map((v) => `<circle cx="${X(v)}" cy="${y + h / 2}" r="5" fill="none" stroke="#9a5b00" stroke-width="2"><title>Valor atípico: ${num(v)}</title></circle>`).join("") +
    "</svg>";
  return (
    s +
    `<div class="leyenda"><span><i style="background:#a9c2dc"></i>Caja: Q1 = ${num(a.q1)} a Q3 = ${num(a.q3)}</span>` +
    `<span><i style="background:#9a5b00"></i>Media = ${num(a.media)}</span><span>Bigotes: ${num(a.bigoteInf)} a ${num(a.bigoteSup)}</span>` +
    `<span>${a.atipicos.length ? `Atípicos (○): ${a.atipicos.map((v) => num(v)).join(", ")}` : "Sin valores atípicos"}</span></div>`
  );
}

/** Límites superiores de las clases de años de vida profesional (la última llega al máximo observado). */
const COTAS = [1, 3, 5, 10];

/** Ojiva: porcentaje acumulado de titulados con «x años o menos». La línea punteada marca el corte junior (3 años). */
export function ojiva(s) {
  const h = s.aniosHist;
  const a = s.anios;
  if (!h || !h.total) return '<p class="vacio">Sin respuestas.</p>';
  const xm = Math.max(Math.ceil(a.max), 12);
  const xs = [0, ...COTAS, xm];
  const ys = [0, ...h.filas.map((f) => f.acum)];
  ys[ys.length - 1] = 100;
  const W = 640, H = 250, ml = 46, mr = 18, mt = 16, mb = 40;
  const X = (v) => ml + (v / xm) * (W - ml - mr);
  const Y = (v) => H - mb - (v / 100) * (H - mt - mb);
  let g = `<svg class="ojiva" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ojiva: porcentaje acumulado de titulados según años de vida profesional">`;
  [0, 25, 50, 75, 100].forEach((v) => (g += `<line x1="${ml}" x2="${W - mr}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e3e8ee"/><text x="${ml - 6}" y="${Y(v) + 4}" text-anchor="end">${v} %</text>`));
  xs.forEach((v) => (g += `<text x="${X(v)}" y="${H - mb + 16}" text-anchor="middle">${v === xm && xm > 10 ? "máx." : v}</text>`));
  g +=
    `<line x1="${X(3)}" x2="${X(3)}" y1="${mt}" y2="${Y(0)}" stroke="#1c2733" stroke-dasharray="5 4" stroke-width="1.5"/>` +
    `<text x="${X(3) + 6}" y="${Y(10)}" style="font-weight:600;fill:#1c2733">Corte junior: 3 años (${num(ys[2], 0)} % o menos)</text>` +
    `<polyline fill="none" stroke="#1f4d7a" stroke-width="2.5" points="${xs.map((v, i) => `${X(v).toFixed(1)},${Y(ys[i]).toFixed(1)}`).join(" ")}"/>` +
    xs.map((v, i) => `<circle cx="${X(v).toFixed(1)}" cy="${Y(ys[i]).toFixed(1)}" r="4" fill="#1f4d7a"><title>${num(ys[i], 0)} % lleva ${v === xm && xm > 10 ? "hasta el máximo" : v + " años o menos"}</title></circle>`).join("") +
    `<text x="${W / 2}" y="${H - 2}" text-anchor="middle">Años de vida profesional</text></svg>`;
  return g;
}

/** Tabla de frecuencias por clases: clase, marca de clase, fi, hi, Fi, Hi. */
export function tablaFrec(s) {
  const h = s.aniosHist;
  const a = s.anios;
  if (!h || !h.total) return "";
  const mx = Math.max(a.max, 10);
  const clases = ["[0 – 1]", "(1 – 3]", "(3 – 5]", "(5 – 10]", `(10 – ${num(mx)}]`];
  const marcas = [0.5, 2, 4, 7.5, (10 + mx) / 2];
  let F = 0;
  const filas = h.filas
    .map((f, i) => {
      F += f.n;
      return `<tr><td>${clases[i]} <small>${esc(f.opcion)}</small></td><td>${f.n ? num(marcas[i], 2) : "–"}</td><td>${f.n}</td><td>${num(f.pct)} %</td><td>${F}</td><td>${num(i === 4 ? 100 : f.acum)} %</td></tr>`;
    })
    .join("");
  return (
    `<div class="scroll"><table class="tabla"><tr><th>Clase (años)</th><th>Marca de clase</th><th>fi</th><th>hi</th><th>Fi</th><th>Hi</th></tr>${filas}` +
    `<tr class="total"><td>Total</td><td></td><td>${h.total}</td><td>100 %</td><td></td><td></td></tr></table></div>`
  );
}

/** Medidas descriptivas; la nota solo aparece cuando la medida pide una advertencia. */
export function tablaDesc(a) {
  if (!a || !a.n) return "";
  const ric = a.q3 - a.q1;
  const lo = a.q1 - 1.5 * ric;
  const hi = a.q3 + 1.5 * ric;
  const g = a.asimetria;
  const cv = a.cv < 15 ? "Variabilidad baja" : a.cv < 30 ? "Variabilidad moderada" : "Variabilidad alta: conviene segmentar y usar la mediana";
  const as =
    Math.abs(g) < 0.5
      ? "Aproximadamente simétrica"
      : g > 0
        ? `Asimétrica a la derecha (${Math.abs(g) < 1 ? "moderada" : "fuerte"})`
        : `Asimétrica a la izquierda (${Math.abs(g) < 1 ? "moderada" : "fuerte"})`;
  const R = [
    ["Tamaño de la muestra (n)", a.n, ""],
    ["Media (x̄)", num(a.media) + " años", ""],
    ["Mediana", num(a.mediana) + " años", ""],
    ["Moda", a.moda == null ? "Sin moda" : num(a.moda) + " años", ""],
    ["Rango", num(a.rango) + " años", `De ${num(a.min)} a ${num(a.max)}`],
    ["Varianza (s²)", num(a.varianza, 2), ""],
    ["Desviación estándar (s)", num(a.sd) + " años", ""],
    ["Coeficiente de variación", num(a.cv) + " %", cv],
    ["Cuartiles Q1 y Q3", `${num(a.q1)} y ${num(a.q3)} años`, ""],
    ["Percentil 90", num(a.p90) + " años", ""],
    ["Asimetría", num(g, 2), as],
    ["Valores atípicos", a.atipicos.length ? a.atipicos.map((v) => num(v)).join(", ") + " años" : "Ninguno", `Fuera de [${num(lo)} ; ${num(hi)}] (regla de Tukey)`],
  ];
  return `<div class="scroll"><table class="tabla texto"><tr><th>Medida</th><th>Valor</th><th>Observación</th></tr>${R.map((r) => `<tr><td>${r[0]}</td><td><b>${r[1]}</b></td><td>${r[2]}</td></tr>`).join("")}</table></div>`;
}

// ---------- Brechas de formación ----------

/** Semáforo por afirmación según el porcentaje de acuerdo. */
export function brecha(items, UMB, estado) {
  const v = items.filter((x) => x.l.n > 0).sort((a, b) => a.l.acuerdo - b.l.acuerdo);
  if (!v.length) return "";
  const est = (p) => (p < UMB.acuerdoBajo ? estado("mal", "Brecha") : p < UMB.acuerdoAlto ? estado("at", "Atender") : estado("ok", "Fortaleza"));
  return (
    `<div class="scroll"><table class="tabla"><tr><th>Afirmación</th><th>n</th><th>Media ± s</th><th>De acuerdo</th><th>Estado</th></tr>` +
    v.map(({ label, l }) => `<tr><td>${esc(label)}</td><td>${l.n}</td><td>${num(l.media, 2)} ± ${num(l.sd, 2)}</td><td><b>${num(l.acuerdo, 0)} %</b></td><td>${est(l.acuerdo)}</td></tr>`).join("") +
    "</table></div>"
  );
}

// ---------- Simulación ----------

/** Superpone las distribuciones de inscritos de los dos escenarios y marca el mínimo para abrir. */
export function distSvg(a, c, min) {
  const W = 640, H = 230, ml = 44, mr = 14, mt = 14, mb = 34;
  const pts = a.dist.concat(c.dist);
  const x0 = Math.min(...pts.map((p) => p[0]), min);
  const x1 = Math.max(...pts.map((p) => p[0]), min);
  const y1 = Math.max(...pts.map((p) => p[1]), 1) * 1.1;
  const X = (v) => ml + ((v - x0) / Math.max(1, x1 - x0)) * (W - ml - mr);
  const Y = (v) => H - mb - (v / y1) * (H - mt - mb);
  const area = (d, col) =>
    `<polygon points="${X(d[0][0])},${Y(0)} ${d.map((p) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" ")} ${X(d[d.length - 1][0])},${Y(0)}" fill="${col}" fill-opacity=".25" stroke="${col}" stroke-width="2"/>`;
  let s = `<svg class="dist" viewBox="0 0 ${W} ${H}" role="img" aria-label="Distribución de inscritos en cada escenario">`;
  const paso = Math.max(1, Math.round((x1 - x0) / 6 / 5) * 5);
  for (let v = Math.ceil(x0 / paso) * paso; v <= x1; v += paso) s += `<line x1="${X(v)}" x2="${X(v)}" y1="${Y(0)}" y2="${Y(0) + 4}" stroke="#9aa6b5"/><text x="${X(v)}" y="${H - 16}" text-anchor="middle">${v}</text>`;
  s +=
    `<line x1="${ml}" x2="${W - mr}" y1="${Y(0)}" y2="${Y(0)}" stroke="#9aa6b5"/>` +
    area(a.dist, "#c98a1b") +
    area(c.dist, "#1f4d7a") +
    `<line x1="${X(min)}" x2="${X(min)}" y1="${mt}" y2="${Y(0)}" stroke="#1c2733" stroke-dasharray="5 4" stroke-width="2"/>` +
    `<text class="rotulo" x="${X(min) + 6}" y="${mt + 10}" style="font-weight:600">Mínimo para abrir: ${min}</text>` +
    `<text x="${W / 2}" y="${H - 1}" text-anchor="middle">Inscritos en el programa</text>` +
    `<text transform="translate(12 ${H / 2}) rotate(-90)" text-anchor="middle">% de simulaciones</text></svg>`;
  return s + `<div class="leyenda"><span><i style="background:#c98a1b"></i>Escenario base</span><span><i style="background:#1f4d7a"></i>Con becas</span></div>`;
}
