// Vistas del panel. Cada función recibe las estadísticas (s) y el contexto de datos (ctx = { fuente, sep }) y devuelve HTML.

import { esc, num, orden, pTxt, UMB, estado } from "./util.js";
import { TT, TE, ALCANCE, LT, FPL, VCL, PARES } from "./etiquetas.js";
import {
  bloque, indicadores, columnas, grupo, metaN, barras, histograma, likert, pares, heat, caja, ojiva, tablaFrec, tablaDesc, brecha,
  NIV4, COL4, CL4, NIV3, COL3, CL3,
} from "./graficos.js";
import { lecDist, lecArea, lecAnios, lecLikert, lecCruce, veredicto } from "./lecturas.js";
import { filasDecision, tablaDecisiones, prevE } from "./decisiones.js";

const consulta = (ctx) => `datos=${ctx.fuente}&sep=${encodeURIComponent(ctx.sep)}`;
const enlaceCsv = (ctx, ruta, archivo, texto) => `<a class="btn" href="/api/export/${ruta}?${consulta(ctx)}" download="${archivo}">${texto}</a>`;

/** Bloque de barras para una pregunta de opción única o múltiple. */
const dist = (d, titulos, k, { multiple = false, ancho = false, titulo } = {}) =>
  bloque({ titulo: titulo ?? titulos[k], meta: metaN(d, ALCANCE[k]), cuerpo: barras(d), nota: k === "area" ? lecArea(d) : lecDist(d, multiple), ancho });

/** Grupo plegable a partir de una lista de bloques. */
const seccion = (titulo, bloques, { abierto = false, antes = "" } = {}) => grupo(titulo, bloques.length, antes + columnas(...bloques), abierto);

const filtrar = (v) => v.filter(Boolean);

// ---------------------------------------------------------------------------
// Estado sin datos
// ---------------------------------------------------------------------------
export const sinDatos = (fuente) =>
  `<div class="estado-vacio"><b>Sin respuestas ${fuente === "reales" ? "reales " : ""}registradas</b>` +
  `<p>El panel se completa a medida que titulados y empleadores responden las encuestas.</p>` +
  `<div class="admin"><a class="btn btn-primario" href="index.html">Abrir las encuestas</a><button type="button" class="btn" data-accion="demo">Cargar datos de demostración</button></div></div>`;

// ---------------------------------------------------------------------------
// Resumen ejecutivo
// ---------------------------------------------------------------------------
export function vResumen(s) {
  const K = [];
  if (s.nTitulados) {
    K.push(
      { valor: s.nTitulados, etiqueta: "Titulados encuestados" },
      { valor: `${num(s.pctInteres * 100, 0)} %`, etiqueta: "Interesados en un posgrado" },
      { valor: `${num(s.likertT.satisfaccion.media, 1)} <small>/ 4</small>`, etiqueta: "Satisfacción con la formación" },
      { valor: num(s.anios.mediana), etiqueta: "Años de vida profesional", detalle: `Mediana · media ${num(s.anios.media)} ± ${num(s.anios.sd)}` }
    );
  }
  if (s.nEmpleadores) K.push({ valor: s.nEmpleadores, etiqueta: "Empleadores encuestados" }, { valor: `${num(prevE(s), 0)} %`, etiqueta: "Prevé contratar Ingenieros de Sistemas" });

  const decisiones = bloque({
    titulo: "Decisiones recomendadas",
    meta: `${s.nTitulados} titulados · ${s.nEmpleadores} empleadores`,
    cuerpo: tablaDecisiones(filasDecision(s)),
    ancho: true,
    sinRelleno: true,
  });
  return indicadores(K) + columnas(decisiones) + contraste(s);
}

/** Titulados frente a empleadores: porcentaje de acuerdo en afirmaciones equivalentes. */
function contraste(s) {
  if (!s.nTitulados || !s.nEmpleadores) return "";
  const p = PARES.filter(([, t, e]) => s.likertT[t] && s.likertE[e] && s.likertT[t].n > 0 && s.likertE[e].n > 0);
  if (p.length < PARES.length) return "";
  const A = p.map(([, t]) => s.likertT[t].acuerdo);
  const B = p.map(([, , e]) => s.likertE[e].acuerdo);
  const dif = p.map((_, i) => B[i] - A[i]);
  const k = dif.map(Math.abs).indexOf(Math.max(...dif.map(Math.abs)));
  const nota =
    Math.abs(dif[k]) < 10
      ? "Titulados y empleadores coinciden: las diferencias son menores de 10 puntos."
      : `Mayor distancia en «${esc(p[k][0])}»: ${dif[k] < 0 ? "los empleadores lo valoran menos que los titulados" : "los empleadores lo valoran más que los titulados"} (${num(Math.abs(dif[k]), 0)} puntos).`;
  return columnas(
    bloque({
      titulo: "Titulados frente a empleadores",
      meta: "Porcentaje de acuerdo",
      cuerpo: pares(p.map((r) => r[0]), A, B),
      nota: nota + " Las escalas difieren (4 y 3 niveles): la comparación es referencial.",
      ancho: true,
    })
  );
}

// ---------------------------------------------------------------------------
// Titulados
// ---------------------------------------------------------------------------
export function vTitulados(s) {
  const d = s.distT;
  const a = s.anios;
  const tot = s.junior + s.consolidado;
  const items = Object.keys(LT).map((k) => ({ label: LT[k], l: s.likertT[k] }));
  const D = (k, op) => dist(d[k], TT, k, op);

  const perfil = seccion(
    "Perfil profesional",
    [
      bloque({ titulo: "Años de vida profesional", meta: metaN(s.aniosHist), cuerpo: histograma(s.aniosHist), nota: lecAnios(a, s.junior, s.consolidado) }),
      D("edad"),
      D("genero"),
    ],
    {
      abierto: true,
      antes: indicadores([
        { valor: num(a.media), etiqueta: "Años de vida profesional (media)", detalle: `Desviación estándar ${num(a.sd)}` },
        { valor: num(a.mediana), etiqueta: "Mediana", detalle: `Mitad central: de ${num(a.q1)} a ${num(a.q3)}` },
        { valor: `${num((s.junior * 100) / tot, 0)} %`, etiqueta: `Junior (hasta ${UMB.junior} años)`, detalle: `${s.junior} junior · ${s.consolidado} consolidados` },
      ]),
    }
  );

  const descriptiva = seccion("Estadística descriptiva de los años de vida profesional", [
    bloque({ titulo: "Medidas descriptivas", meta: `n = ${a.n}`, cuerpo: tablaDesc(a), ancho: true, sinRelleno: true }),
    bloque({ titulo: "Diagrama de caja", meta: `n = ${a.n}`, cuerpo: caja(a) }),
    bloque({ titulo: "Ojiva", meta: metaN(s.aniosHist), cuerpo: ojiva(s) }),
    bloque({ titulo: "Tabla de frecuencias", meta: metaN(s.aniosHist), cuerpo: tablaFrec(s), nota: "fi = frecuencia absoluta · hi = relativa · Fi y Hi = acumuladas.", ancho: true, sinRelleno: true }),
  ]);

  const insercion = seccion("Inserción laboral", [
    D("situacion"), D("tiempoPrimerTrabajo"), D("sector"), D("rubro"), D("departamento"), D("remuneracion"),
  ]);

  const formacion = seccion("Formación continua", [D("area"), D("orgPosgrado"), D("nivelPosgrado"), D("financiamiento")], {
    antes: indicadores([{ valor: `${num(s.pctInteres * 100, 0)} %`, etiqueta: "Interesados en un posgrado", detalle: "En áreas de Ingeniería en Sistemas" }]),
  });

  const valoracion = seccion("Valoración de la formación", [
    bloque({ titulo: "Brechas de formación", meta: "Porcentaje de acuerdo (niveles 3 y 4 de 4)", cuerpo: brecha(items, UMB, estado), nota: `Brecha: menos de ${UMB.acuerdoBajo} %. Atender: entre ${UMB.acuerdoBajo} % y ${UMB.acuerdoAlto} %. Fortaleza: ${UMB.acuerdoAlto} % o más.`, ancho: true, sinRelleno: true }),
    bloque({ titulo: "Grado de acuerdo por afirmación", meta: "Escala de 1 a 4 · media ± desviación", cuerpo: likert(items, NIV4, COL4, CL4), nota: lecLikert(items, "de acuerdo o totalmente de acuerdo"), ancho: true }),
    D("utiles", { multiple: true }),
    D("mejorar", { multiple: true }),
    D("ventaja", { multiple: true }),
    D("pocoUtiles", { multiple: true }),
  ]);

  return perfil + descriptiva + insercion + formacion + valoracion;
}

// ---------------------------------------------------------------------------
// Empleadores
// ---------------------------------------------------------------------------
export function vEmpleadores(s) {
  const d = s.distE;
  const L = s.likertE;
  const P = Object.keys(FPL).map((k) => ({ label: FPL[k], l: L[k] }));
  const V = Object.keys(VCL).map((k) => ({ label: VCL[k], l: L[k] }));
  const noSabe = Object.values(L).reduce((a, l) => a + l.noSabe, 0);
  const total = Object.values(L).reduce((a, l) => a + l.n + l.noSabe, 0);
  const D = (k, op) => dist(d[k], TE, k, op);
  const meta = "Escala de 1 a 3 · «No sabe» excluido";

  const perfil = seccion("Perfil de las organizaciones", [D("tipo"), D("tamano"), D("rubro")], { abierto: true });
  const demanda = seccion("Demanda de profesionales", [D("proyeccion"), D("nivelFormacion"), D("medio"), D("contrato"), D("cargos", { multiple: true, ancho: true })], {
    antes: indicadores([{ valor: `${num(prevE(s), 0)} %`, etiqueta: "Prevé contratar Ingenieros de Sistemas", detalle: "Con alta probabilidad o según su crecimiento" }]),
  });
  const valoracion = seccion("Valoración de la Carrera", [
    bloque({ titulo: "Formación y perfil profesional", meta, cuerpo: likert(P, NIV3, COL3, CL3), nota: lecLikert(P, "de acuerdo total o parcial"), ancho: true }),
    bloque({ titulo: "Relación de la Carrera con la organización", meta, cuerpo: likert(V, NIV3, COL3, CL3), nota: lecLikert(V, "de acuerdo total o parcial"), ancho: true }),
  ]);
  const nota = `<p class="vacio">«No sabe»: ${noSabe} de ${total} respuestas (${total ? num((noSabe * 100) / total, 0) : 0} %). Las preguntas abiertas se revisan en el CSV limpio de empleadores.</p>`;
  return perfil + demanda + valoracion + nota;
}

// ---------------------------------------------------------------------------
// Análisis estadístico
// ---------------------------------------------------------------------------
function ejemploUniformidad(d, titulo) {
  const u = d.unif;
  const fo = d.filas.map((f) => f.n);
  const formula = fo.length <= 6 ? `[${fo.map((x) => `(${x} − ${num(u.fe, 2)})²`).join(" + ")}] / ${num(u.fe, 2)}` : "Σ (FO − FE)² / FE";
  const conclusion = u.chi2 < u.critico ? `${num(u.chi2, 2)} &lt; ${num(u.critico, 2)}: <b>uniformidad</b>` : `${num(u.chi2, 2)} ≥ ${num(u.critico, 2)}: <b>no uniformidad</b>`;
  return `Ejemplo con «${esc(titulo)}»: n = ${u.n}, k = ${u.k}, FE = ${u.n} / ${u.k} = ${num(u.fe, 2)}. χ² = ${formula} = <b>${num(u.chi2, 2)}</b>. Valor teórico (α = 0,05 y ${u.gl} gl) = <b>${num(u.critico, 2)}</b>. ${conclusion}.`;
}

export function vEstadistica(s, ctx) {
  const cruces = Object.values(s.cruces || {});

  // Uniformidad
  const filasU = (mapa, titulos, etiqueta) => {
    const f = Object.keys(titulos)
      .filter((k) => mapa && mapa[k] && mapa[k].unif)
      .map((k) => {
        const u = mapa[k].unif;
        return (
          `<tr><td>${esc(titulos[k])}</td><td>${u.n}</td><td>${u.k}</td>` +
          `<td class="${u.confiable ? "" : "bajo"}"${u.confiable ? "" : ' title="Con menos de 5 respuestas esperadas por categoría la prueba no es fiable"'}>${num(u.fe, 1)}${u.confiable ? "" : " *"}</td>` +
          `<td>${num(u.chi2, 2)}</td><td>${u.gl}</td><td>${num(u.critico, 2)}</td><td>${estado(u.uniforme ? "ok" : "in", u.uniforme ? "Uniformidad" : "No uniformidad")}</td></tr>`
        );
      });
    return f.length ? `<tr class="sep"><td colspan="8">${etiqueta}</td></tr>` + f.join("") : "";
  };
  const tablaU = filasU(s.distT, TT, "Titulados") + filasU(s.distE, TE, "Empleadores");
  const ejemplo = (() => {
    let alterno = "";
    for (const [m, t] of [[s.distT, TT], [s.distE, TE]])
      for (const k of Object.keys(t)) if (m && m[k] && m[k].unif) {
        if (m[k].unif.confiable) return ejemploUniformidad(m[k], t[k]);
        alterno = alterno || ejemploUniformidad(m[k], t[k]);
      }
    return alterno;
  })();
  const procedimiento =
    `<details class="supuestos"><summary>Procedimiento de cálculo</summary><div class="formulas" style="margin-top:10px">` +
    `<div><small>Estadístico</small>χ² = Σ (FOᵢ − FEᵢ)² / FEᵢ</div><div><small>Frecuencia esperada</small>FE = n / k</div><div><small>Grados de libertad</small>gl = k − 1</div></div>` +
    `<ul><li>Si χ² es menor que el valor teórico (α = 5 % y k − 1 gl) hay <b>uniformidad</b>; si no, <b>no uniformidad</b>.</li></ul></details>`;
  const uniformidad = tablaU
    ? bloque({
        titulo: "Uniformidad de las respuestas",
        meta: "χ² de bondad de ajuste · α = 5 %",
        cuerpo: `<div class="scroll"><table class="tabla"><tr><th>Pregunta</th><th>n</th><th>k</th><th>FE = n/k</th><th>χ²</th><th>gl</th><th>χ² crítico</th><th>Resultado</th></tr>${tablaU}</table></div>`,
        nota: `El asterisco indica FE &lt; 5: prueba poco fiable.${procedimiento}`,
        pie: enlaceCsv(ctx, "uniformidad.csv", "uniformidad.csv", "Exportar resultados (CSV)"),
        ancho: true,
        sinRelleno: true,
      })
    : bloque({ titulo: "Uniformidad de las respuestas", cuerpo: '<p class="vacio">Todavía no hay respuestas para calcular la uniformidad.</p>', ancho: true });

  // Independencia
  const resumen = cruces.length
    ? bloque({
        titulo: "Relaciones entre variables",
        meta: "χ² de independencia · α = 5 %",
        cuerpo:
          `<div class="scroll"><table class="tabla"><tr><th>Cruce</th><th>n</th><th>χ²</th><th>gl</th><th>p</th><th>V</th><th>Resultado</th></tr>` +
          cruces
            .map((c) => {
              const [nivel, texto] = veredicto(c);
              return `<tr><td>${esc(c.titulo)}</td><td>${c.n}</td><td>${c.chi2 != null ? num(c.chi2, 2) : "–"}</td><td>${c.gl ?? "–"}</td><td>${c.p != null ? num(c.p, 4) : "–"}</td><td>${c.cramerV != null ? num(c.cramerV, 2) : "–"}</td><td>${estado(nivel, texto)}</td></tr>`;
            })
            .join("") +
          "</table></div>",
        nota: "«No concluyente»: más del 20 % de las celdas tiene frecuencia esperada menor a 5.",
        ancho: true,
        sinRelleno: true,
      })
    : "";
  const detalle = cruces.map((c) => {
    const [nivel, texto] = veredicto(c);
    const est =
      c.chi2 != null
        ? `<div class="estad"><span>χ² = <b>${num(c.chi2, 2)}</b></span><span>gl = <b>${c.gl}</b></span><span><b>${pTxt(c.p)}</b></span><span>V de Cramér = <b>${num(c.cramerV, 2)}</b></span><span>Celdas con esperada &lt; 5: <b>${num(c.pctEsperadosBajos, 0)} %</b></span></div>`
        : "";
    const cautela = c.chi2 != null && !c.confiable ? `<p class="cautela"><b>Cautela.</b> ${esc(c.aviso)}</p>` : "";
    return bloque({
      titulo: esc(c.titulo),
      meta: `n = ${c.n} · ${estado(nivel, texto)}`,
      cuerpo: heat(c) + est + cautela,
      nota: c.chi2 != null ? lecCruce(c) : "",
      pie: enlaceCsv(ctx, `cruce/${esc(c.id)}.csv`, `cruce_${esc(c.id)}.csv`, "Exportar matriz (CSV)"),
      ancho: true,
    });
  });

  return columnas(uniformidad) + (cruces.length ? columnas(resumen) + columnas(...detalle) : "");
}

// ---------------------------------------------------------------------------
// Calidad de datos
// ---------------------------------------------------------------------------
export function vDatos(s, ctx) {
  const m = s.muestra;
  const q = s.calidad;

  const K = indicadores([
    { valor: s.nTitulados, etiqueta: "Titulados encuestados", detalle: s.nTitulados ? `Margen de error referencial ± ${num(m.margenTitulados)} puntos` : "" },
    { valor: s.nEmpleadores, etiqueta: "Empleadores encuestados", detalle: s.nEmpleadores ? `Margen de error referencial ± ${num(m.margenEmpleadores)} puntos` : "" },
    { valor: m.empresas, etiqueta: "Empresas individualizadas", detalle: `Públicas: ${m.empresasPublicas} · Privadas: ${m.empresasPrivadas}` },
    { valor: num(q.completitud, 1) + " %", etiqueta: "Datos completos", detalle: "Campos obligatorios con respuesta" },
  ]);

  const cumple = (ok) => estado(ok ? "ok" : "mal", ok ? "Cumple" : "No cumple");
  const val = [
    ["Respuestas duplicadas", q.duplicadosTitulados + q.duplicadosEmpleadores, "0", "Se repiten todas las respuestas de otra persona.", true],
    ["Campos obligatorios vacíos", q.camposObligatoriosVacios, "0", "Distinto de 0 indica datos cargados por otra vía.", true],
    ["Valores fuera de rango", q.fueraDeRango, "0", "Años fuera de 0 a 60 o escalas fuera de su rango.", true],
    ["Años negativos", q.aniosNegativos, "0", "Un tiempo no puede ser negativo.", true],
    ["Incoherencias (desempleo mayor que vida profesional)", q.incoherentes, "0", "Más años desempleado que años de ejercicio.", true],
    ["Valores atípicos en años de vida profesional", q.atipicos, "Informativo", "Regla de Tukey: se revisa que sea real y se reporta.", false],
    ["Variantes de escritura unificadas", q.categoriasUnificadas, "Informativo", "Mayúsculas, tildes y espacios agrupados en una categoría.", false],
    ["Respuestas «Otro» especificadas", q.otrasEspecificadas, "Informativo", "Texto libre agrupado como «Otro (…)».", false],
  ];
  const validacion = bloque({
    titulo: "Validación de los datos",
    cuerpo: `<div class="scroll"><table class="tabla texto"><tr><th>Verificación</th><th>Resultado</th><th>Esperado</th><th>Estado</th><th>Detalle</th></tr>${val
      .map((r) => `<tr><td>${r[0]}</td><td><b>${r[1]}</b></td><td>${r[2]}</td><td>${r[4] ? cumple(r[1] === 0) : estado("in", "Informativo")}</td><td>${r[3]}</td></tr>`)
      .join("")}</table></div>`,
    ancho: true,
    sinRelleno: true,
  });

  const esPub = (e) => /^p[uú]blic/i.test(e.tipo);
  const esPri = (e) => /^privad/i.test(e.tipo);
  const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, "es");
  const lista = (titulo, l) => (l.length ? `<h4>${titulo} (${l.length})</h4><ul>${l.map((e) => `<li title="${esc(e.nombre)}">${esc(e.nombre)}</li>`).join("")}</ul>` : "");
  const empresas = bloque({
    titulo: "Empresas individualizadas",
    meta: `${m.empresas} en total`,
    cuerpo: m.listaEmpresas.length
      ? `<div class="empresas">${lista("Públicas", m.listaEmpresas.filter(esPub).sort(porNombre))}${lista("Privadas", m.listaEmpresas.filter(esPri).sort(porNombre))}${lista("Sin clasificar", m.listaEmpresas.filter((e) => !esPub(e) && !esPri(e)).sort(porNombre))}</div>`
      : '<p class="vacio">Todavía no hay empresas registradas.</p>',
    ancho: true,
  });

  const archivos = [
    ["titulados.csv", "Titulados (limpio)"], ["empleadores.csv", "Empleadores (limpio)"], ["titulados_crudo.csv", "Titulados (crudo)"],
    ["empleadores_crudo.csv", "Empleadores (crudo)"], ["diccionario.csv", "Diccionario de datos"], ["uniformidad.csv", "Pruebas de uniformidad"], ["simulaciones.csv", "Simulaciones guardadas"],
  ];
  const exportacion = bloque({
    titulo: "Exportación",
    cuerpo: `<div class="descargas">${archivos.map(([f, t]) => enlaceCsv(ctx, f, f, t)).join("")}</div>`,
    nota: "Los archivos limpios están listos para analizar; los crudos conservan lo que respondió cada persona. El CSV de titulados incluye correo y teléfono: no se debe publicar ni compartir.",
    ancho: true,
  });

  const metodologia = bloque({
    titulo: "Metodología de cálculo",
    cuerpo:
      `<details class="supuestos"><summary>Fórmulas</summary><div class="formulas" style="margin-top:10px">` +
      `<div><small>Media</small>x̄ = Σxᵢ / n</div><div><small>Varianza muestral</small>s² = Σ(xᵢ − x̄)² / (n − 1)</div><div><small>Coeficiente de variación</small>CV = s / x̄ × 100</div>` +
      `<div><small>Cuartiles y percentiles</small>Interpolación lineal (método R-7)</div><div><small>Atípicos (Tukey)</small>Fuera de [Q1 − 1,5·RIC ; Q3 + 1,5·RIC]</div>` +
      `<div><small>Asimetría</small>Coeficiente de Fisher ajustado</div><div><small>χ² de independencia</small>Σ(O − E)² / E, gl = (f − 1)(c − 1); confiable si menos del 20 % de celdas tiene E &lt; 5</div>` +
      `<div><small>V de Cramér</small>√(χ² / (n · min(f − 1, c − 1)))</div></div>` +
      `</details>`,
    ancho: true,
  });

  const admin = bloque({
    titulo: "Datos de demostración",
    meta: "Ficticios · no usar como datos de campo",
    cuerpo: `<div class="admin"><p>Registros ficticios, identificados aparte de los datos de campo.</p><button type="button" class="btn" data-accion="demo">Cargar datos de demostración</button><button type="button" class="btn" data-accion="borrar">Borrar datos de demostración</button></div>`,
    ancho: true,
  });

  return K + columnas(validacion) + columnas(empresas, exportacion, metodologia, admin);
}
