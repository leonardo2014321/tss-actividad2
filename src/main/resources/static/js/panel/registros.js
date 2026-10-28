// Administración de las respuestas guardadas en la base de datos: consultar, editar y eliminar (CRUD).
// Crear una respuesta nueva se hace desde la encuesta pública (index.html); aquí se abre con «Nueva respuesta».
//
// Las preguntas, opciones y escalas se leen de js/encuesta/preguntas.js, la misma definición que usa el formulario:
// si se cambia una pregunta allí, esta pantalla se ajusta sola.

import { $, esc, num, corto, estado } from "./util.js";
import { TT, TE, LT, FPL, VCL } from "./etiquetas.js";
import { PASOS, OPC, NUM, L3, L4 } from "../encuesta/preguntas.js";

// ---------------------------------------------------------------------------
// Definición de los campos (a partir de las preguntas de la encuesta)
// ---------------------------------------------------------------------------

/** Nombre corto de cada campo, para tablas y fichas. Si falta, se usa el comienzo de la pregunta. */
const CORTO = {
  titulados: {
    ...TT,
    ...LT,
    formacion: "Formación complementaria",
    nombrePrograma: "Nombre del programa",
    dondeCurso: "Dónde cursó el programa",
    interes: "Interés en un posgrado",
    aniosProfesionales: "Años de vida profesional",
    aniosDesempleado: "Años desempleado",
    empresa: "Empresa u organización",
    areaOrg: "Área dentro de la organización",
    cargo: "Cargo",
    antiguedad: "Antigüedad en el trabajo",
    primerEmpleo: "Es su primer empleo",
    redContactos: "Interés en la red de contactos",
    email: "Correo",
    telefono: "Teléfono",
    linkedin: "LinkedIn",
  },
  empleadores: {
    ...TE,
    ...FPL,
    ...VCL,
    empresa: "Empresa o institución",
    areasEmergentes: "Áreas emergentes",
    herramientas: "Herramientas",
    competencias: "Competencias",
    email: "Correo de contacto",
  },
};

/** Campos obligatorios en el servidor (los mismos que valida la entidad Java). */
const OBLIGATORIOS = {
  titulados: new Set([
    "email", "edad", "genero", "formacion", "interes", "situacion", "tiempoPrimerTrabajo", "numEmpleos", "redContactos",
    "aniosProfesionales", "aniosDesempleado", "opinionPosgrado", "satisfaccion", "concordancia",
  ]),
  empleadores: new Set([
    "email", "empresa", "tipo", "tamano", "rubro", "contrato", "proyeccion", "nivelFormacion", "medio", "cargos",
    "areasEmergentes", "herramientas", "competencias",
    ...Array.from({ length: 10 }, (_, i) => "fp" + (i + 1)),
    ...Array.from({ length: 8 }, (_, i) => "vc" + (i + 1)),
  ]),
};

/** Lista plana de preguntas de cada encuesta, con el paso al que pertenecen y sus opciones. */
const CAMPOS = {};
for (const k of ["titulados", "empleadores"]) {
  CAMPOS[k] = PASOS[k].flatMap((s) => s.c.map((c) => ({ ...c, paso: s.t, o: c.o || OPC[c.n] || [] })));
}

const corta = (t, n = 64) => (t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t);
const etiqueta = (k, c) => CORTO[k][c.n] || corta(c.l);
const esObligatorio = (k, c) => OBLIGATORIOS[k].has(c.n);

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const TABS = [
  ["titulados", "Titulados"],
  ["empleadores", "Empleadores"],
  ["simulaciones", "Simulaciones"],
];
const TAM = 15; // filas por página

const norm = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Fecha y hora legibles a partir de la marca ISO 8601 que asigna el servidor. */
const fechaHora = (iso) => {
  if (!iso) return "—";
  const t = new Date(String(iso).replace(/(\.\d{3})\d+/, "$1"));
  return isNaN(t) ? String(iso) : t.toLocaleString("es-BO", { dateStyle: "medium", timeStyle: "short" });
};

/** Nombre con el que queda identificado cada registro (el mismo que muestra la encuesta al guardar). */
function nombre(k, r) {
  if (k === "titulados") return `Titulado · ${r.email}`;
  if (k === "empleadores") return `Empleador · ${r.empresa} · ${r.email}`;
  return `Simulación del ${fechaHora(r.fecha)}`;
}

const origen = (r) => (r.demo ? estado("in", "Demostración") : estado("ok", "Real"));

/** Cómo se muestra una respuesta guardada (las escalas se guardan como número). */
const textoRespuesta = (c, v) =>
  c.t === "l4" ? (L4[v - 1] ?? v) : c.t === "l3" ? (L3.find(([, x]) => x == v) || [v])[0] : c.t === "m" ? String(v).split("|").join(" · ") : String(v);

// ---------------------------------------------------------------------------
// Comunicación con la API
// ---------------------------------------------------------------------------

class ErrorApi extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.codigo = codigo;
  }
}

const clave = {
  leer() {
    try {
      return sessionStorage.getItem("arcusur.clave") || "";
    } catch {
      return "";
    }
  },
  guardar(v) {
    try {
      if (v) sessionStorage.setItem("arcusur.clave", v);
      else sessionStorage.removeItem("arcusur.clave");
    } catch {
      /* sin almacenamiento: se vuelve a pedir en cada operación */
    }
  },
};

const MSG_VALIDACION = {
  NotBlank: "es obligatorio",
  NotNull: "es obligatorio",
  Email: "no es un correo válido",
  Size: "supera el largo permitido",
  Min: "está fuera del rango permitido",
  Max: "está fuera del rango permitido",
  DecimalMin: "está fuera del rango permitido",
  DecimalMax: "está fuera del rango permitido",
};

/** Convierte la respuesta de error del servidor en un texto claro (con el nombre de cada campo inválido). */
function mensaje(j, k) {
  if (Array.isArray(j.errors) && j.errors.length) {
    const lineas = j.errors.map((e) => {
      const c = (CAMPOS[k] || []).find((x) => x.n === e.field);
      return `• ${c ? etiqueta(k, c) : e.field}: ${MSG_VALIDACION[e.code] || "no es válido"}`;
    });
    return "Revise estos campos:\n" + lineas.join("\n");
  }
  if (j.message && !/^(Validation failed|JSON parse error)/i.test(j.message)) return j.message;
  return "Los datos enviados no son válidos.";
}

/** Llama a /api/... con la clave de administración (si la instalación la exige, la pide una vez por sesión). */
async function api(ruta, opciones = {}, k = E.k) {
  const h = {};
  if (opciones.body) h["Content-Type"] = "application/json";
  const guardada = clave.leer();
  if (guardada) h["X-Admin-Clave"] = guardada;
  let r;
  try {
    r = await fetch("/api" + ruta, { ...opciones, headers: h });
  } catch {
    throw new ErrorApi(0, "No se pudo conectar con el servidor. Revise que esté activo.");
  }
  if (r.status === 401) {
    clave.guardar("");
    const nueva = await pedirClave(
      guardada
        ? "La clave no es correcta. Inténtelo de nuevo."
        : "Esta instalación está protegida. Escriba la clave de administración para ver y modificar las respuestas."
    );
    if (!nueva) throw new ErrorApi(401, "Se necesita la clave de administración.");
    clave.guardar(nueva);
    return api(ruta, opciones, k);
  }
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new ErrorApi(r.status, mensaje(j, k));
  }
  return r.json();
}

/** Diálogo para escribir la clave de administración. Devuelve el texto o null si se cancela. */
function pedirClave(motivo) {
  return new Promise((resolve) => {
    const d = $("dlg-clave");
    d.innerHTML =
      `<form class="dlg-form"><header class="dlg-cab"><div><h2 id="dlg-clave-titulo">Clave de administración</h2></div></header>` +
      `<div class="dlg-cuerpo"><p>${esc(motivo)}</p><div class="cmp"><label for="clave-in"><span class="cmp-t">Clave</span></label>` +
      `<input id="clave-in" type="password" name="clave" autocomplete="current-password" required></div></div>` +
      `<footer class="dlg-pie"><button type="button" class="btn" data-x>Cancelar</button><button class="btn btn-primario">Continuar</button></footer></form>`;
    const form = d.querySelector("form");
    let respuesta = null;
    form.onsubmit = (e) => {
      e.preventDefault();
      respuesta = form.elements.clave.value;
      d.close();
    };
    d.querySelector("[data-x]").onclick = () => d.close();
    d.addEventListener("close", () => resolve(respuesta), { once: true });
    d.showModal();
    form.elements.clave.focus();
  });
}

// ---------------------------------------------------------------------------
// Estado de la pantalla
// ---------------------------------------------------------------------------

const E = {
  k: "titulados", // pestaña activa
  datos: { titulados: [], empleadores: [], simulaciones: [] },
  q: "", // texto de búsqueda
  pag: 1,
  cargado: false,
  error: "",
  msg: null, // { texto, tipo: "ok" | "mal" }
};
let raiz, dlg, ctx, alCambiar, temporizador;

const buscar = (id, k = E.k) => E.datos[k].find((r) => String(r.id) === String(id));

function filtrados() {
  const q = norm(E.q.trim());
  const l = E.datos[E.k];
  return q ? l.filter((r) => norm(Object.values(r).join(" ")).includes(q)) : l;
}

/** Muestra un aviso arriba de la tabla (se oculta solo a los 7 segundos). */
function avisar(texto, tipo = "ok") {
  E.msg = { texto, tipo };
  clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    E.msg = null;
    pintarMensaje();
  }, 7000);
  pintarMensaje();
}

function pintarMensaje() {
  const p = $("reg-msg");
  if (!p) return;
  p.hidden = !E.msg;
  if (E.msg) {
    p.textContent = E.msg.texto;
    p.className = "reg-msg " + E.msg.tipo;
  }
}

// ---------------------------------------------------------------------------
// Pantalla principal: pestañas, búsqueda y tabla
// ---------------------------------------------------------------------------

const COLUMNAS = {
  titulados: [
    ["Registro", (r) => `<b>${esc(r.email)}</b><small>Titulado · n.º ${r.id}</small>`],
    ["Situación laboral", (r) => esc(corto(r.situacion || "—"))],
    ["Años de vida prof.", (r) => (r.aniosProfesionales == null ? "—" : num(r.aniosProfesionales))],
    ["Registrado", (r) => esc(fechaHora(r.registrado))],
    ["Origen", origen],
  ],
  empleadores: [
    ["Registro", (r) => `<b>${esc(r.empresa)}</b><small>${esc(r.email)} · n.º ${r.id}</small>`],
    ["Tipo", (r) => esc(r.tipo || "—")],
    ["Tamaño", (r) => esc((r.tamano || "—").replace(/\s*\(.*\)/, ""))],
    ["Registrado", (r) => esc(fechaHora(r.registrado))],
    ["Origen", origen],
  ],
  simulaciones: [
    ["Simulación", (r) => `<b>${esc(fechaHora(r.fecha))}</b><small>${r.filas} filas: base y becas, programa en general y por área</small>`],
    ["Datos usados", (r) => `${esc(r.datos)}<small>${r.nTitulados} titulados · interés ${num(r.probInteres * 100, 0)} %</small>`],
    ["Mínimo para abrir", (r) => String(r.minimo)],
    ["Inscritos (media)", (r) => r.escenarios.map((e) => `<span class="lin"><em>${esc(e.escenario)}</em>${num(e.media, 0)}</span>`).join("")],
    ["Probabilidad de abrir", (r) => r.escenarios.map((e) => `<span class="lin"><em>${esc(e.escenario)}</em>${num(e.probApertura * 100, 0)} %</span>`).join("")],
    ["Origen", origen],
  ],
};

/**
 * Cada guardado de la simulación deja varias filas en la base de datos con la misma «corrida»: el escenario base y el de
 * becas, y para cada uno el programa en general más una fila por área. Aquí se juntan en un solo registro.
 */
function agruparSimulaciones(filas) {
  const m = new Map();
  for (const f of filas) {
    if (!m.has(f.corrida)) m.set(f.corrida, { id: f.corrida, corrida: f.corrida, fecha: f.fecha, datos: f.datos, demo: f.demo, nTitulados: f.nTitulados, probInteres: f.probInteres, minimo: f.minimo, filas: 0, escenarios: [], todas: [] });
    const g = m.get(f.corrida);
    g.filas++;
    g.todas.push(f); // todas las filas (general y por área), para la ficha «Ver»
    if (!f.area) g.escenarios.push(f);
  }
  const orden = (e) => (e.escenario === "base" ? 0 : e.escenario === "becas" ? 1 : 2);
  const l = [...m.values()];
  l.forEach((g) => g.escenarios.sort((a, b) => orden(a) - orden(b)));
  return l.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
}

const TITULO = { titulados: "Respuestas de titulados", empleadores: "Respuestas de empleadores", simulaciones: "Simulaciones guardadas (cada una compara base y becas)" };

function pintarCascaron() {
  if (!raiz) return;
  if (!E.cargado) {
    raiz.innerHTML = E.error
      ? `<div class="estado-vacio"><b>No se pudieron cargar las respuestas</b><p>${esc(E.error)}</p><button type="button" class="btn btn-primario" data-reg="reintentar">Reintentar</button></div>`
      : '<p class="vacio">Cargando respuestas…</p>';
    return;
  }
  const k = E.k;
  const csv = k === "simulaciones" ? "simulaciones.csv" : `${k}_crudo.csv`;
  const herramientas =
    (k === "simulaciones" ? "" : `<a class="btn btn-primario" href="index.html#${k}">Nueva respuesta</a>`) +
    `<a class="btn" href="/api/export/${csv}?datos=${ctx.fuente}&sep=%3B" download="${csv}">Descargar CSV</a>`;
  raiz.innerHTML =
    `<div class="reg-barra"><div class="tabs" role="tablist" aria-label="Tipo de registro">` +
    TABS.map(
      ([id, t]) => `<button type="button" role="tab" aria-selected="${id === k}" data-tab="${id}">${t}<span>${E.datos[id].length}</span></button>`
    ).join("") +
    `</div><div class="reg-herr"><input type="search" id="reg-q" placeholder="Buscar por correo, empresa, texto…" value="${esc(E.q)}" aria-label="Buscar en los registros">${herramientas}</div></div>` +
    `<p class="reg-msg" id="reg-msg" role="status" hidden></p>` +
    `<section class="bloque"><header><h3>${TITULO[k]}</h3><span class="meta" id="reg-meta"></span></header>` +
    `<div class="cuerpo sin-relleno" id="reg-tabla"></div><div class="pie pag" id="reg-pie"></div></section>` +
    `<p class="reg-nota">Eliminar o editar una respuesta actualiza al instante todas las estadísticas del panel. ` +
    `Las respuestas de demostración se pueden borrar todas juntas desde «Calidad de datos».</p>`;
  pintarTabla();
  pintarMensaje();
}

function pintarTabla() {
  const k = E.k;
  const lista = filtrados();
  const total = E.datos[k].length;
  const paginas = Math.max(1, Math.ceil(lista.length / TAM));
  E.pag = Math.min(Math.max(1, E.pag), paginas);
  const desde = (E.pag - 1) * TAM;
  const fila = lista.slice(desde, desde + TAM);

  $("reg-meta").textContent = E.q.trim() ? `${lista.length} de ${total}` : `${total} ${total === 1 ? "registro" : "registros"}`;

  if (!fila.length) {
    $("reg-tabla").innerHTML = total
      ? '<p class="vacio reg-vacio">Ningún registro coincide con la búsqueda.</p>'
      : `<p class="vacio reg-vacio">Todavía no hay ${k === "simulaciones" ? "simulaciones guardadas" : "respuestas"} en este origen de datos.</p>`;
  } else {
    const cols = COLUMNAS[k];
    $("reg-tabla").innerHTML =
      `<div class="scroll"><table class="tabla texto reg"><thead><tr>${cols.map(([t]) => `<th>${t}</th>`).join("")}<th class="acc">Acciones</th></tr></thead><tbody>` +
      fila
        .map((r) => {
          const acc =
            `<button type="button" class="btn btn-sm" data-acc="ver" data-id="${esc(r.id)}">Ver</button>` +
            (k === "simulaciones" ? "" : `<button type="button" class="btn btn-sm" data-acc="editar" data-id="${esc(r.id)}">Editar</button>`) +
            `<button type="button" class="btn btn-sm btn-peligro" data-acc="borrar" data-id="${esc(r.id)}">Eliminar</button>`;
          return `<tr>${cols.map(([, f]) => `<td>${f(r)}</td>`).join("")}<td class="acc"><div>${acc}</div></td></tr>`;
        })
        .join("") +
      "</tbody></table></div>";
  }

  $("reg-pie").hidden = lista.length <= TAM;
  $("reg-pie").innerHTML =
    `<span>Mostrando ${desde + 1}–${desde + fila.length} de ${lista.length}</span><span class="sp"></span>` +
    `<button type="button" class="btn btn-sm" data-pag="-1"${E.pag <= 1 ? " disabled" : ""}>Anterior</button>` +
    `<span>Página ${E.pag} de ${paginas}</span>` +
    `<button type="button" class="btn btn-sm" data-pag="1"${E.pag >= paginas ? " disabled" : ""}>Siguiente</button>`;
}

/** Trae de la base de datos las tres listas del origen de datos elegido. Se llama cada vez que se abre la pantalla. */
export async function cargarRegistros(contexto) {
  ctx = contexto || ctx;
  if (!E.cargado) {
    E.error = "";
    pintarCascaron();
  }
  try {
    const f = encodeURIComponent(ctx.fuente);
    E.datos.titulados = await api(`/titulados?datos=${f}`, {}, "titulados");
    E.datos.empleadores = await api(`/empleadores?datos=${f}`, {}, "empleadores");
    E.datos.simulaciones = agruparSimulaciones(await api(`/simulaciones?datos=${f}`, {}, "simulaciones"));
    E.cargado = true;
    E.error = "";
  } catch (x) {
    if (E.cargado) avisar(x.message, "mal");
    else E.error = x.message;
  }
  pintarCascaron();
}

// ---------------------------------------------------------------------------
// Diálogos: ver, editar y eliminar
// ---------------------------------------------------------------------------

function abrir(html, { cierraConFondo = true } = {}) {
  dlg.innerHTML = html;
  dlg.dataset.fondo = cierraConFondo ? "1" : "";
  if (!dlg.open) dlg.showModal();
}
const cerrar = () => {
  if (dlg.open) dlg.close();
};

const cabecera = (titulo, sub) =>
  `<header class="dlg-cab"><div><h2 id="dlg-titulo">${esc(titulo)}</h2>${sub ? `<p>${sub}</p>` : ""}</div>` +
  `<button type="button" class="dlg-x" data-cerrar aria-label="Cerrar">×</button></header>`;

/** Ficha de solo lectura de una simulación guardada: parámetros y resultados de cada escenario y de cada área. */
function verSimulacion(r) {
  const t = r.todas[0] || {};
  const parametros = [
    ["Datos usados", `${r.datos} (${r.nTitulados} titulados)`],
    ["Origen de la probabilidad de interés", t.origenInteres === "manual" ? "Manual" : "Calculada con las respuestas"],
    ["Población de titulados", t.poblacion],
    ["Mínimo de inscritos para abrir", r.minimo],
    ["Repeticiones por escenario", t.iteraciones],
  ]
    .map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b ?? "—")}</dd>`)
    .join("");
  // Una fila por escenario y por área: primero el programa en general, luego las áreas en orden alfabético
  const orden = (e) => (e.escenario === "base" ? 0 : e.escenario === "becas" ? 1 : 2);
  const filas = [...r.todas]
    .sort((a, b) => (a.area || "").localeCompare(b.area || "") || orden(a) - orden(b))
    .map(
      (f) =>
        `<tr><td>${esc(f.area || "Programa en general")}</td><td>${esc(f.escenario)}</td>` +
        `<td>${num(f.probInteres * 100, 0)} %</td><td>${num(f.probInscribe * 100, 0)} %</td>` +
        `<td>${num(f.media, 0)}</td><td>${num(f.p5, 0)} – ${num(f.p95, 0)}</td><td>${num(f.probApertura * 100, 0)} %</td></tr>`
    )
    .join("");
  dlg.dataset.id = r.id;
  abrir(
    `<div class="dlg-form">${cabecera(nombre("simulaciones", r), `${r.filas} filas · ${r.demo ? "calculada con datos de demostración" : "calculada con datos reales"}`)}` +
      `<div class="dlg-cuerpo"><section class="det-grupo"><h4>Parámetros</h4><dl class="det">${parametros}</dl></section>` +
      `<section class="det-grupo"><h4>Resultados</h4><div class="scroll"><table class="tabla texto reg"><thead><tr>` +
      `<th>Programa</th><th>Escenario</th><th>Interés</th><th>Se inscribe</th><th>Inscritos (media)</th><th>Rango 5–95 %</th><th>Prob. de abrir</th>` +
      `</tr></thead><tbody>${filas}</tbody></table></div></section></div>` +
      `<footer class="dlg-pie"><button type="button" class="btn btn-peligro" data-ir="borrar">Eliminar</button><span class="sp"></span>` +
      `<button type="button" class="btn btn-primario" data-cerrar>Cerrar</button></footer></div>`
  );
}

/** Ficha de solo lectura con todas las respuestas, agrupadas por paso de la encuesta. */
function ver(id) {
  const k = E.k;
  const r = buscar(id);
  if (!r) return;
  if (k === "simulaciones") return verSimulacion(r);
  const grupos = PASOS[k]
    .map((s) => {
      const filas = s.c
        .filter((c) => r[c.n] != null && r[c.n] !== "")
        .map((c) => `<dt title="${esc(c.l)}">${esc(etiqueta(k, c))}</dt><dd>${esc(textoRespuesta(c, r[c.n]))}</dd>`)
        .join("");
      return filas ? `<section class="det-grupo"><h4>${esc(s.t)}</h4><dl class="det">${filas}</dl></section>` : "";
    })
    .join("");
  dlg.dataset.id = id;
  abrir(
    `<div class="dlg-form">${cabecera(nombre(k, r), `Registro n.º ${r.id} · guardado el ${esc(fechaHora(r.registrado))} · ${r.demo ? "respuesta de demostración" : "respuesta real"}`)}` +
      `<div class="dlg-cuerpo">${grupos}</div>` +
      `<footer class="dlg-pie"><button type="button" class="btn btn-peligro" data-ir="borrar">Eliminar</button><span class="sp"></span>` +
      `<button type="button" class="btn" data-cerrar>Cerrar</button><button type="button" class="btn btn-primario" data-ir="editar">Editar</button></footer></div>`
  );
}

// ---- Formulario de edición ----

/** Lista de selección. Si el valor guardado no está entre las opciones (por ejemplo «Otro: …»), se conserva como opción. */
function seleccion(c, lista, actual, requerido) {
  const cur = actual == null ? "" : String(actual);
  const esta = cur === "" || lista.some(([v]) => String(v) === cur);
  const ops = [["", "Sin respuesta"], ...lista, ...(esta ? [] : [[cur, `${cur} (valor registrado)`]])];
  return (
    `<select name="${c.n}" id="e-${c.n}"${requerido ? " required" : ""}>` +
    ops.map(([v, t]) => `<option value="${esc(v)}"${String(v) === cur ? " selected" : ""}>${esc(t)}</option>`).join("") +
    "</select>"
  );
}

function control(k, c, v) {
  const rq = esObligatorio(k, c);
  const base = `name="${c.n}" id="e-${c.n}"${rq ? " required" : ""}`;
  switch (c.t) {
    case "n":
      return `<input type="number" ${base} min="0" max="60" step="any" value="${esc(v)}">`;
    case "t":
      return `<input type="text" ${base} maxlength="255" value="${esc(v)}">`;
    case "e":
      return `<input type="email" ${base} maxlength="255" value="${esc(v)}">`;
    case "p":
      return `<input type="tel" ${base} maxlength="30" value="${esc(v)}">`;
    case "a":
      return `<textarea ${base} rows="3" maxlength="1500">${esc(v)}</textarea>`;
    case "l4":
      return seleccion(c, L4.map((x, j) => [j + 1, `${j + 1} · ${x}`]), v, rq);
    case "l3":
      return seleccion(c, L3.map(([x, val]) => [val, x]), v, rq);
    case "m": {
      const elegidas = v ? String(v).split("|") : [];
      const extra = elegidas.filter((x) => !c.o.includes(x)); // respuestas escritas a mano («Otra: …»)
      const items = [...c.o.map((x) => [x, elegidas.includes(x)]), ...extra.map((x) => [x, true])];
      return `<div class="chk">${items.map(([x, on]) => `<label><input type="checkbox" name="${c.n}" value="${esc(x)}"${on ? " checked" : ""}><span>${esc(x)}</span></label>`).join("")}</div>`;
    }
    default:
      return seleccion(c, c.o.map((x) => [x, x]), v, rq);
  }
}

function campoEdicion(k, c, r) {
  const corta = etiqueta(k, c);
  const cab =
    `<span class="cmp-t">${esc(corta)}${esObligatorio(k, c) ? ' <i title="Obligatorio">*</i>' : ""}</span>` +
    (c.l !== corta ? `<span class="cmp-q">${esc(c.l)}</span>` : "");
  return c.t === "m"
    ? `<fieldset class="cmp"><legend>${cab}</legend>${control(k, c, r[c.n])}</fieldset>`
    : `<div class="cmp"><label for="e-${c.n}">${cab}</label>${control(k, c, r[c.n])}</div>`;
}

/** Lee el formulario de edición y arma el objeto que espera la API (vacío = sin respuesta). */
function leerFormulario(k, form) {
  const fd = new FormData(form);
  const o = {};
  for (const c of CAMPOS[k]) {
    if (c.t === "m") {
      const l = fd.getAll(c.n);
      if (l.length) o[c.n] = l.join("|");
      continue;
    }
    const v = String(fd.get(c.n) ?? "").trim();
    if (v === "") continue;
    o[c.n] = NUM.includes(c.n) ? Number(v) : v;
  }
  return o;
}

function editar(id) {
  const k = E.k;
  const r = buscar(id);
  if (!r) return;
  dlg.dataset.id = id;
  const grupos = PASOS[k]
    .map((s) => `<section class="det-grupo"><h4>${esc(s.t)}</h4>${s.c.map((c) => campoEdicion(k, { ...c, o: c.o || OPC[c.n] || [] }, r)).join("")}</section>`)
    .join("");
  abrir(
    `<form class="dlg-form" id="ed-form">${cabecera("Editar respuesta", esc(nombre(k, r)))}` +
      `<div class="dlg-cuerpo">${grupos}</div><p class="dlg-err" role="alert" hidden></p>` +
      `<footer class="dlg-pie"><span class="dlg-nota">* Obligatorio</span><span class="sp"></span>` +
      `<button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn btn-primario" data-guardar>Guardar cambios</button></footer></form>`,
    { cierraConFondo: false } // un clic fuera no debe descartar lo escrito
  );
  const form = $("ed-form");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const err = form.querySelector(".dlg-err");
    const btn = form.querySelector("[data-guardar]");
    err.hidden = true;
    btn.disabled = true;
    btn.textContent = "Guardando…";
    try {
      const g = await api(`/${k}/${id}`, { method: "PUT", body: JSON.stringify(leerFormulario(k, form)) }, k);
      const i = E.datos[k].findIndex((x) => String(x.id) === String(id));
      if (i >= 0) E.datos[k][i] = g;
      cerrar();
      pintarCascaron();
      avisar(`Cambios guardados en «${nombre(k, g)}».`, "ok");
      alCambiar();
    } catch (x) {
      err.textContent = x.message;
      err.hidden = false;
      btn.disabled = false;
      btn.textContent = "Guardar cambios";
    }
  };
}

// ---- Eliminación ----

function confirmarBorrado(id) {
  const k = E.k;
  const r = buscar(id);
  if (!r) return;
  dlg.dataset.id = id;
  const que = { titulados: "esta respuesta de titulado", empleadores: "esta respuesta de empleador", simulaciones: "esta simulación guardada" }[k];
  const efecto =
    k === "simulaciones"
      ? `Se borran las ${r.filas} filas de esa comparación (escenario base y con becas, programa en general y por área) y deja de aparecer en el historial.`
      : r.demo
        ? "Es una respuesta de demostración. Se borra de la base de datos y de las estadísticas."
        : "Es una respuesta real: se borra de la base de datos y desaparece de todas las estadísticas.";
  abrir(
    `<form class="dlg-form" id="del-form">${cabecera(`¿Eliminar ${que}?`, "")}` +
      `<div class="dlg-cuerpo"><p class="del-nombre">${esc(nombre(k, r))}</p><p>${efecto} <b>Esta acción no se puede deshacer.</b></p></div>` +
      `<p class="dlg-err" role="alert" hidden></p>` +
      `<footer class="dlg-pie"><span class="sp"></span><button type="button" class="btn" data-cerrar autofocus>Cancelar</button>` +
      `<button class="btn btn-peligro solido" data-borrar>Eliminar definitivamente</button></footer></form>`
  );
  $("del-form").onsubmit = async (e) => {
    e.preventDefault();
    const err = dlg.querySelector(".dlg-err");
    const btn = dlg.querySelector("[data-borrar]");
    err.hidden = true;
    btn.disabled = true;
    btn.textContent = "Eliminando…";
    const quitar = () => {
      E.datos[k] = E.datos[k].filter((x) => String(x.id) !== String(id));
      cerrar();
      pintarCascaron();
    };
    try {
      const ruta = k === "simulaciones" ? `/simulaciones?corrida=${encodeURIComponent(id)}` : `/${k}/${id}`;
      await api(ruta, { method: "DELETE" }, k);
      quitar();
      avisar(`Se eliminó «${nombre(k, r)}».`, "ok");
      alCambiar();
    } catch (x) {
      if (x.codigo === 404) {
        // Otra persona ya la había eliminado: la lista se pone al día.
        quitar();
        avisar(x.message, "mal");
        alCambiar();
        return;
      }
      err.textContent = x.message;
      err.hidden = false;
      btn.disabled = false;
      btn.textContent = "Eliminar definitivamente";
    }
  };
}

// ---------------------------------------------------------------------------
// Arranque y eventos
// ---------------------------------------------------------------------------

/** Conecta la pantalla. `cuandoCambia` se llama tras editar o eliminar para que el resto del panel recalcule. */
export function iniciarRegistros(contexto, cuandoCambia) {
  ctx = contexto;
  alCambiar = cuandoCambia;
  raiz = $("registros");
  dlg = $("dlg");

  raiz.addEventListener("click", (e) => {
    const t = e.target.closest("[data-tab], [data-acc], [data-pag], [data-reg]");
    if (!t) return;
    if (t.dataset.tab) {
      E.k = t.dataset.tab;
      E.q = "";
      E.pag = 1;
      pintarCascaron();
    } else if (t.dataset.acc) {
      ({ ver, editar, borrar: confirmarBorrado })[t.dataset.acc](t.dataset.id);
    } else if (t.dataset.pag) {
      E.pag += Number(t.dataset.pag);
      pintarTabla();
    } else if (t.dataset.reg === "reintentar") {
      cargarRegistros(ctx);
    }
  });

  raiz.addEventListener("input", (e) => {
    if (e.target.id !== "reg-q") return;
    E.q = e.target.value;
    E.pag = 1;
    pintarTabla();
  });

  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) {
      if (dlg.dataset.fondo === "1") cerrar();
      return;
    }
    if (e.target.closest("[data-cerrar]")) cerrar();
    const ir = e.target.closest("[data-ir]");
    if (ir) ({ editar, borrar: confirmarBorrado })[ir.dataset.ir](dlg.dataset.id);
  });
}
