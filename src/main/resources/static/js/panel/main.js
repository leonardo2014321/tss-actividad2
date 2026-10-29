// Punto de entrada del panel: carga las estadísticas, arma el menú y muestra la vista elegida.

import { $ } from "./util.js";
import { vResumen, vTitulados, vEmpleadores, vEstadistica, vDatos, sinDatos } from "./vistas.js";
import { iniciarSimulacion, ajustarInteres, resimular } from "./simulacion.js";
import { iniciarRegistros, cargarRegistros } from "./registros.js";

/** Origen de datos elegido y separador de CSV (se comparten con las vistas y la simulación). */
const ctx = { fuente: "reales", sep: ";" };

const ALIAS = { pruebas: "estadistica" };
let vistaActual = ALIAS[location.hash.slice(1)] || location.hash.slice(1);

/**
 * Vistas del panel. `visible(s)` decide si hay datos para mostrarla; la simulación es estática (vive en el HTML)
 * para conservar los parámetros escritos al cambiar de vista.
 */
const VISTAS = [
  { id: "resumen", etiqueta: "Resumen", titulo: "Resumen ejecutivo", detalle: "Estado de la evidencia y decisiones recomendadas para el plan estratégico.", render: (s) => vResumen(s), visible: () => true, sinDatos: true },
  { id: "titulados", etiqueta: "Titulados", titulo: "Titulados", detalle: "Perfil, inserción laboral, formación continua y valoración de la formación recibida.", render: (s) => vTitulados(s), visible: (s) => s.nTitulados > 0 },
  { id: "empleadores", etiqueta: "Empleadores", titulo: "Empleadores", detalle: "Perfil de las organizaciones, demanda de profesionales y valoración de la Carrera.", render: (s) => vEmpleadores(s), visible: (s) => s.nEmpleadores > 0 },
  { id: "simulacion", etiqueta: "Oferta de posgrado", titulo: "Oferta de posgrado", detalle: "Probabilidad de que un programa alcance el mínimo de inscritos, con y sin becas.", visible: () => true, estatica: true },
  { id: "estadistica", etiqueta: "Análisis estadístico", titulo: "Análisis estadístico", detalle: "Uniformidad de las respuestas y relaciones entre variables.", render: (s) => vEstadistica(s, ctx), visible: (s) => s.nTitulados > 0 || s.nEmpleadores > 0 },
  { id: "datos", etiqueta: "Calidad de datos", titulo: "Calidad de datos", detalle: "Muestra, validación, exportación y administración de los datos.", render: (s) => vDatos(s, ctx), visible: () => true },
  { id: "registros", etiqueta: "Respuestas", titulo: "Administración de respuestas", detalle: "Consulte, edite y elimine las respuestas guardadas en la base de datos.", visible: () => true, estatica: true },
];

let visibles = [];

function mostrar(id) {
  if (!visibles.some((v) => v.id === id)) id = visibles.length ? visibles[0].id : "";
  document.querySelectorAll(".vista").forEach((p) => (p.hidden = p.id !== "v-" + id));
  document.querySelectorAll("#menu button").forEach((b) => (b.dataset.t === id ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")));
  const v = visibles.find((x) => x.id === id);
  if (v) {
    $("titulo").textContent = v.titulo;
    $("detalle").textContent = v.detalle;
    document.title = `${v.titulo} · ARCUSUR`;
  }
  vistaActual = id;
  if (id === "registros") cargarRegistros(ctx); // siempre muestra lo que hay en la base de datos en este momento
  try {
    history.replaceState(null, "", "#" + id);
  } catch {
    /* sin historial disponible */
  }
}

function pintar(s) {
  const hay = s.nTitulados || s.nEmpleadores;
  visibles = VISTAS.filter((v) => v.visible(s));
  const secciones = visibles
    .filter((v) => !v.estatica)
    .map((v) => `<section class="vista" id="v-${v.id}" hidden>${!hay && v.sinDatos ? sinDatos(ctx.fuente) : v.render(s)}</section>`)
    .join("");
  $("app").innerHTML = secciones;
  $("menu").innerHTML = visibles.map((v) => `<button type="button" data-t="${v.id}">${v.etiqueta}</button>`).join("");
  mostrar(vistaActual);
}

function actualizarControles(s) {
  $("origen").value = ctx.fuente;
  const aviso = $("aviso");
  aviso.hidden = ctx.fuente === "reales";
  aviso.textContent =
    ctx.fuente === "demo"
      ? "Está viendo datos de demostración (ficticios). No los use como datos de campo."
      : ctx.fuente === "todos"
        ? "Está viendo datos reales mezclados con datos de demostración (ficticios). Para el análisis final use «Datos reales»."
        : "";
  ajustarInteres(s);
}

/** Pide las estadísticas a /api/stats. Si no hay datos reales pero sí de demostración, abre la demostración. */
async function cargar(inicial = false) {
  let s;
  try {
    const r = await fetch("/api/stats?datos=" + ctx.fuente);
    if (!r.ok) throw new Error("stats");
    s = await r.json();
  } catch {
    $("app").innerHTML = '<div class="estado-vacio"><b>No se pudieron cargar los datos</b><p>Revise que el servidor esté activo y recargue la página.</p></div>';
    return;
  }
  if (inicial && ctx.fuente === "reales" && !s.nTitulados && !s.nEmpleadores && s.disponibles.demo > 0) {
    ctx.fuente = "demo";
    return cargar(false);
  }
  pintar(s);
  actualizarControles(s);
}

const recargar = () => cargar(false).then(() => resimular(ctx));

// ---------- Eventos ----------
$("menu").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-t]");
  if (b) mostrar(b.dataset.t);
});
$("origen").addEventListener("change", (e) => {
  ctx.fuente = e.target.value;
  recargar();
});
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-accion]");
  if (!b) return;
  if (b.dataset.accion === "demo") {
    await fetch("/api/seed", { method: "POST" });
    ctx.fuente = "demo";
  } else if (b.dataset.accion === "borrar") {
    await fetch("/api/reset", { method: "DELETE" });
    ctx.fuente = "reales";
  }
  recargar();
});

iniciarSimulacion(ctx);
iniciarRegistros(ctx, recargar); // tras editar o eliminar una respuesta, el panel recalcula sus estadísticas
cargar(true).then(() => resimular(ctx));
