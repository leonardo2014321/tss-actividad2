// Importación de respuestas desde Excel: convierte las hojas exportadas por Microsoft Forms (titulados) y
// Google Forms (empleadores) en objetos listos para guardar con POST /api/importar/{titulados|empleadores}.
//
// Este archivo NO lee el .xlsx: recibe la hoja ya convertida en filas (arreglo de arreglos, la primera fila son los
// encabezados). La lectura del archivo la hace registros.js con la librería SheetJS (js/vendor/xlsx.full.min.js).
// Las opciones válidas se toman de js/encuesta/preguntas.js, la misma definición que usa el formulario: si se cambia
// una opción allí, la importación se ajusta sola.

import { PASOS, OPC, L3, L4 } from "../encuesta/preguntas.js";

// ---------------------------------------------------------------------------
// Utilidades de texto
// ---------------------------------------------------------------------------

/** Texto comparable: sin tildes, sin espacios dobles ni no separables, en minúsculas. */
const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** Igual que norm, pero sin los «:» o «.» finales (las opciones «OTRO RUBRO:» se comparan como «otro rubro»). */
const normOpcion = (s) => norm(s).replace(/[:.\s]+$/, "");

/** Respuestas que en realidad no responden nada («n/a», «.», «-», «ninguno»...). */
const BASURA = /^(\.+|-+|_+|\?+|n\/?a|na|no|ninguno|ninguna|nada|no tengo|no aplica|sin dato|prefiero no responder|0)$/;

/** Texto libre limpio: recorta, quita espacios raros y devuelve "" si no dice nada. */
function libre(v, max = 255) {
  if (v == null) return "";
  const t = String(v).replace(/ /g, " ").replace(/\s+/g, " ").trim();
  if (!t || BASURA.test(norm(t))) return "";
  return t.slice(0, max);
}

const esCorreo = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/** Primera letra en mayúscula. */
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Nombre legible de cada campo, para los mensajes de error. */
const NOMBRE = {
  email: "correo", edad: "edad", genero: "género", formacion: "formación complementaria", interes: "interés en posgrado",
  situacion: "situación laboral", redContactos: "red de contactos", aniosProfesionales: "años de vida profesional",
  aniosDesempleado: "años desempleado", opinionPosgrado: "opinión sobre el posgrado", satisfaccion: "satisfacción",
  concordancia: "concordancia", empresa: "empresa", tipo: "tipo de organización", tamano: "tamaño", rubro: "rubro",
  contrato: "contrató en los últimos 5 años", proyeccion: "posibilidad de contratar", nivelFormacion: "nivel de formación",
  medio: "medio de convocatoria", cargos: "cargos", areasEmergentes: "áreas emergentes", herramientas: "herramientas",
  competencias: "competencias",
};

// ---------------------------------------------------------------------------
// Opciones y conversiones de valores
// ---------------------------------------------------------------------------

/** Opciones que ofrece la encuesta para un campo (las propias de la pregunta o las generales). */
function opciones(k, campo) {
  for (const p of PASOS[k]) for (const c of p.c) if (c.n === campo) return c.o || OPC[campo] || [];
  return OPC[campo] || [];
}

/**
 * Convierte el texto del Excel en una de las opciones de la encuesta (ignora mayúsculas, tildes y espacios).
 * Si la opción pide especificar («OTRO RUBRO:», «Otros:»), se le agrega el texto de `especifica`.
 * Devuelve { valor, conocido }. Si no coincide con ninguna, conserva el texto original (conocido = false).
 */
function elegir(k, campo, bruto, especifica = "") {
  // Aquí no se usa libre(): «NO» y «0» son respuestas válidas en las preguntas de opción.
  const t = String(bruto ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return { valor: "", conocido: true };
  const n = normOpcion(t);
  const lista = opciones(k, campo);
  const opt = lista.find((o) => normOpcion(o) === n);
  if (opt) return { valor: opt.trim().endsWith(":") ? `${opt} ${libre(especifica) || "(sin especificar)"}` : opt, conocido: true };
  return { valor: t, conocido: false };
}

/** «23 - 26 años» -> «23 a 26» (la encuesta usa «a»). */
function edadDe(bruto) {
  const e = elegir("titulados", "edad", bruto);
  if (e.conocido) return e;
  const m = norm(bruto).match(/(\d+)\s*(?:-|a)\s*(\d+)/);
  const v = m ? `${m[1]} a ${m[2]}` : "";
  const o = OPC.edad.find((x) => x === v);
  return o ? { valor: o, conocido: true } : e;
}

/** Situación laboral: tolera errores de tipeo del Forms original («trabajando un una organización»). */
function situacionDe(bruto) {
  const n = norm(bruto);
  const o = OPC.situacion.find((x) => n.startsWith(norm(x).slice(0, 22)));
  return o ? { valor: o, conocido: true } : elegir("titulados", "situacion", bruto);
}

/** Texto de una escala Likert de 4 niveles -> 1 a 4 (null si no se reconoce). */
function likert4(v) {
  if (typeof v === "number" && v >= 1 && v <= 4) return v;
  const n = norm(v);
  if (/^[1-4]$/.test(n)) return +n;
  const i = L4.findIndex((x) => norm(x) === n);
  return i >= 0 ? i + 1 : null;
}

/** Afirmaciones de empleadores -> 3, 2, 1 o 0 = «No sabe» (null si no se reconoce). */
function likert3(v) {
  if (typeof v === "number" && v >= 0 && v <= 3) return v;
  const n = norm(v).replace("totalmente desacuerdo", "totalmente en desacuerdo");
  const x = L3.find(([t]) => norm(t) === n);
  return x ? x[1] : null;
}

/** Años a partir de texto libre: «2 años», «6 meses», «1,5», «ninguno». Devuelve null si no se entiende. */
function aniosDe(v) {
  if (typeof v === "number") return v;
  const t = norm(v).replace(",", ".");
  if (!t) return null;
  if (/^(ninguno|ninguna|nada|nunca)\b/.test(t) || /siempre estuve/.test(t)) return 0;
  const m = t.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const x = parseFloat(m[1]) / (/mes/.test(t) ? 12 : 1);
  return Math.round(x * 100) / 100;
}

/**
 * Elección múltiple a partir de una lista separada por «;» (Microsoft Forms). Cada elemento se compara con las opciones;
 * lo que no coincide va como «Otra: texto». `extra` es el texto de «Otra asignatura».
 */
function multiplePorSeparador(k, campo, bruto, extra = "") {
  const lista = opciones(k, campo);
  const sel = [];
  const otras = [];
  for (const p of String(bruto ?? "").split(";")) {
    const t = p.replace(/ /g, " ").replace(/\s+/g, " ").trim();
    if (!t) continue;
    const o = lista.find((x) => normOpcion(x) === normOpcion(t));
    if (o) {
      if (!sel.includes(o)) sel.push(o);
    } else if (libre(t)) otras.push(t);
  }
  const e = libre(extra);
  if (e) otras.push(e);
  return [...sel, ...otras.map((x) => `Otra: ${x}`)].join("|").slice(0, 1500);
}

/**
 * Elección múltiple a partir de una lista separada por comas (Google Forms). Las opciones largas contienen comas,
 * así que se busca cada opción dentro del texto completo y lo que sobra se guarda como «Otra: texto».
 */
function multiplePorContenido(k, campo, bruto) {
  let resto = norm(bruto);
  const sel = [];
  for (const o of opciones(k, campo)) {
    const n = norm(o);
    if (resto.includes(n)) {
      sel.push(o);
      resto = resto.replace(n, " ");
    }
  }
  const sobra = resto.replace(/[,;|]+/g, " ").replace(/\s+/g, " ").trim();
  if (sobra && !BASURA.test(sobra)) sel.push(`Otra: ${cap(sobra)}`);
  return sel.join("|").slice(0, 1500);
}

/** Fecha y hora de la hoja (número de serie de Excel, Date o texto) -> ISO 8601; "" si no se entiende. */
function fechaIso(v) {
  if (v == null || v === "") return "";
  let d;
  if (v instanceof Date) d = v;
  else if (typeof v === "number") {
    // Serie de Excel: días desde 1899-12-30. Se toma como hora local de quien exportó el archivo.
    const u = new Date(Math.round((v - 25569) * 86400) * 1000);
    d = new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(), u.getUTCHours(), u.getUTCMinutes(), u.getUTCSeconds());
  } else d = new Date(String(v));
  return isNaN(d) ? "" : d.toISOString();
}

// ---------------------------------------------------------------------------
// Reconocimiento de columnas por el texto del encabezado
// ---------------------------------------------------------------------------

/**
 * Busca, para cada campo, la columna cuyo encabezado coincide. Se ignoran las columnas «Puntos:» y «Comentarios:»
 * que agrega Microsoft Forms. defs: [campo, expresión, número de aparición (por defecto 1)].
 */
function columnas(cabeceras, defs, limpiar = (s) => s) {
  const h = cabeceras.map((c) => limpiar(norm(c)).replace(/^[¿.\s]+/, "")); // sin numeración, «¿» ni «.» iniciales
  const util = h.map((t) => !/^(puntos|comentarios):/.test(t));
  const ix = {};
  for (const [campo, re, vez = 1] of defs) {
    let visto = 0;
    for (let i = 0; i < h.length; i++) {
      if (util[i] && re.test(h[i]) && ++visto === vez) {
        ix[campo] = i;
        break;
      }
    }
  }
  return ix;
}

const DEF_T = [
  ["id", /^id$/], ["fin", /^hora de finalizacion$/],
  ["edad", /^edad que tiene/], ["genero", /^genero:/],
  ["formacion", /^posterior a sus estudios/], ["nivelPosgrado", /^cual es el programa de formacion complementaria/],
  ["dondeCurso", /^donde ha cursado/], ["financiamiento", /^cual fue la fuente de financiamiento/],
  ["nombrePrograma", /^indique el nombre del programa/], ["interes", /^estaria interesado/],
  ["area", /^en cual de las siguientes areas/], ["orgPosgrado", /^en caso de realizar un estudio/],
  ["opinionPosgrado", /^cual es su opinion personal respecto al posgrado/],
  ["aniosProfesionales", /^cuantos son los anos de vida profesional/], ["aniosDesempleado", /^de la cantidad de tiempo/],
  ["situacion", /^cual de las siguientes afirmaciones describe/], ["empresa", /^nombre de la empresa u organizacion/],
  ["rubro", /^cual es el rubro/], ["rubroOtro", /^otro rubro/], ["sector", /^el trabajo en el que se encuentra/],
  ["departamento", /^en que departamento/], ["areaOrg", /^cual es el area dentro/], ["areaOtra", /^otr@ area/],
  ["cargo", /^cual es el cargo/], ["cargoOtro", /^otr@ cargo/], ["pertinencia", /^\.?en su actual puesto/],
  ["antiguedad", /^que antiguedad/], ["medio", /^a traves de que medio obtuvo/], ["remuneracion", /^senale la remuneracion/],
  ["primerEmpleo", /^el trabajo que ejerce actualmente es su primer/], ["tiempoPrimerTrabajo", /^luego de titularse/],
  ["numEmpleos", /^desde que se titulo/], ["satisfaccion", /^\.?de manera global/],
  ["concordancia", /^\.?considera que existe concordancia/],
  ["utiles", /^que aspectos de la carrera les resultaron/], ["mejorar", /^que aspectos de la carrera considera/],
  ["ventaja", /^indique 5 asignaturas.*ventaja competitiva/], ["ventajaOtra", /^otra asignatura:\d*$/, 1],
  ["pocoUtiles", /^indique 5 asignaturas.*no le resultaron/], ["pocoOtra", /^otra asignatura:\d*$/, 2],
  ["redContactos", /^le interesaria formar parte/], ["email", /^email de contacto/],
  ["telefono", /^numero telefonico/], ["linkedin", /^link de linkedin/],
];

// En el Google Forms de empleadores los encabezados empiezan con «1)», «2)»...; se quita la numeración.
const sinNumero = (s) => s.replace(/^\d+\)\s*/, "");
const DEF_E = [
  ["fecha", /^marca temporal/], ["email", /^direccion de correo/], ["empresa", /^nombre de la empresa/],
  ["tipo", /^tipo de organizacion/], ["tamano", /^tamano de la organizacion/], ["rubro", /^indique el rubro/],
  ["contrato", /^la organizacion ha contratado/], ["proyeccion", /^considerando las necesidades/],
  ["nivelFormacion", /^que nivel de formacion/], ["medio", /^a traves de que medio convoca/],
  ["cargos", /^que tipo de cargos/], ["areasEmergentes", /^desde su experiencia en el sector/],
  ["herramientas", /^cuales son las nuevas herramientas/], ["competencias", /^desde su experiencia en el ambito/],
];
const AFIRMACIONES = [...Array.from({ length: 10 }, (_, i) => `fp${i + 1}`), ...Array.from({ length: 8 }, (_, i) => `vc${i + 1}`)];

// ---------------------------------------------------------------------------
// Titulados
// ---------------------------------------------------------------------------

/** Campos sin los cuales el servidor rechaza la respuesta. */
const OBLIGATORIOS_T = ["email", "edad", "genero", "formacion", "interes", "situacion", "redContactos", "aniosProfesionales", "aniosDesempleado", "opinionPosgrado", "satisfaccion", "concordancia"];
const OBLIGATORIOS_E = ["email", "empresa", "tipo", "tamano", "rubro", "contrato", "proyeccion", "nivelFormacion", "medio", "cargos", "areasEmergentes", "herramientas", "competencias", ...AFIRMACIONES];

function mapearTitulados(aoa) {
  const ix = columnas(aoa[0], DEF_T);
  const reconocidas = Object.keys(ix).length;
  const claves = ["edad", "genero", "formacion", "interes", "situacion", "aniosProfesionales", "satisfaccion"];
  const esTitulados = claves.filter((c) => ix[c] != null).length >= 5;
  const filas = [];
  const omitidas = [];
  const correos = new Map(); // correo -> fila de Excel que lo usó primero
  const g = (r, c) => (ix[c] == null ? null : r[ix[c]]);

  aoa.slice(1).forEach((r, j) => {
    const fila = j + 2; // número de fila en Excel (la 1 son los encabezados)
    if (!r || r.every((x) => x == null || String(x).trim() === "")) return;
    const avisos = [];
    const t = {};
    // Asigna un campo de opción única; si el texto no es una opción conocida lo conserva y avisa.
    const poner = (campo, e) => {
      if (e.valor) t[campo] = e.valor;
      if (!e.conocido) avisos.push(`${NOMBRE[campo] || campo}: valor no reconocido «${e.valor}»`);
    };
    const unica = (campo, especifica) => poner(campo, elegir("titulados", campo, g(r, campo), especifica));

    poner("edad", edadDe(g(r, "edad")));
    unica("genero");
    unica("formacion");
    unica("nivelPosgrado");
    unica("dondeCurso");
    unica("financiamiento");
    const prog = libre(g(r, "nombrePrograma"));
    if (prog) t.nombrePrograma = prog;
    unica("interes");
    unica("area");
    unica("orgPosgrado");
    poner("situacion", situacionDe(g(r, "situacion")));

    const emp = libre(g(r, "empresa"));
    if (emp) t.empresa = emp;
    // Rubro, área y cargo: si no eligieron una opción pero escribieron «Otro», se guarda como «OTRO RUBRO: texto».
    const otro = (campo, campoOtro, marca) => {
      const v = libre(g(r, campo));
      if (v) return poner(campo, elegir("titulados", campo, v));
      const x = libre(g(r, campoOtro));
      if (x) t[campo] = `${marca} ${x}`;
    };
    otro("rubro", "rubroOtro", "OTRO RUBRO:");
    unica("sector");
    unica("departamento");
    // Área dentro de la organización: Forms a veces la exporta como lista JSON ["Desarrollo","Computo"]; se toma la primera.
    let area = g(r, "areaOrg");
    if (typeof area === "string" && area.trim().startsWith("[")) {
      try {
        area = JSON.parse(area)[0];
      } catch {
        /* se deja el texto tal cual */
      }
    }
    if (libre(area)) poner("areaOrg", elegir("titulados", "areaOrg", area));
    else {
      const x = libre(g(r, "areaOtra"));
      if (x) t.areaOrg = `OTR@ AREA: ${x}`;
    }
    otro("cargo", "cargoOtro", "OTR@ CARGO:");
    unica("antiguedad");
    unica("medio");
    unica("remuneracion");
    unica("primerEmpleo");
    unica("tiempoPrimerTrabajo");
    unica("numEmpleos");

    for (const c of ["opinionPosgrado", "pertinencia", "satisfaccion", "concordancia"]) {
      const v = g(r, c);
      if (v == null || String(v).trim() === "") continue;
      const n = likert4(v);
      if (n == null) avisos.push(`${NOMBRE[c] || c}: valor no reconocido «${v}»`);
      else t[c] = n;
    }

    // Años: solo los de vida profesional son indispensables; si «desempleado» no se entiende se toma 0 y se avisa.
    const ap = aniosDe(g(r, "aniosProfesionales"));
    if (ap != null && ap >= 0 && ap <= 60) t.aniosProfesionales = ap;
    const ad = aniosDe(g(r, "aniosDesempleado"));
    if (ad != null && ad >= 0 && ad <= 60) t.aniosDesempleado = ad;
    else if (t.aniosProfesionales != null) {
      t.aniosDesempleado = 0;
      avisos.push(`años desempleado: no se entendió «${String(g(r, "aniosDesempleado") ?? "").trim() || "vacío"}», se registró 0`);
    }

    const mp = (campo, extra) => {
      const v = multiplePorSeparador("titulados", campo, g(r, campo), extra);
      if (v) t[campo] = v;
    };
    mp("utiles");
    mp("mejorar");
    mp("ventaja", g(r, "ventajaOtra"));
    mp("pocoUtiles", g(r, "pocoOtra"));
    unica("redContactos");

    // Contacto: el correo identifica la respuesta. Si no dejaron uno válido, se usa un identificador interno.
    const mail = libre(g(r, "email"), 255).toLowerCase();
    const idExcel = g(r, "id") ?? fila;
    const tel = libre(g(r, "telefono"));
    const li = libre(g(r, "linkedin"));
    if (tel) t.telefono = tel;
    if (li) t.linkedin = li;
    let usaInterno = false;
    if (esCorreo(mail)) t.email = mail;
    else {
      t.email = `titulado-${idExcel}@importado.arcusur.test`;
      usaInterno = true;
    }
    const fecha = fechaIso(g(r, "fin"));
    if (fecha) t.registrado = fecha;

    // Validaciones propias de la importación
    const faltan = OBLIGATORIOS_T.filter((c) => t[c] == null || t[c] === "");
    if (faltan.length) return omitidas.push({ fila, correo: t.email, motivo: "Falta: " + faltan.map((c) => NOMBRE[c] || c).join(", ") + "." });
    if (t.aniosDesempleado > t.aniosProfesionales)
      return omitidas.push({ fila, correo: t.email, motivo: "Los años desempleado superan los años de vida profesional." });
    if (correos.has(t.email))
      return omitidas.push({ fila, correo: t.email, motivo: `Correo repetido: ya lo usó la fila ${correos.get(t.email)} de este archivo.` });
    correos.set(t.email, fila);
    if (usaInterno) avisos.push("sin correo válido: se usó un identificador interno");
    filas.push({ fila, correo: t.email, avisos, datos: t });
  });
  return { tipo: "titulados", esTipo: esTitulados, reconocidas, filas, omitidas };
}

// ---------------------------------------------------------------------------
// Empleadores
// ---------------------------------------------------------------------------

function mapearEmpleadores(aoa) {
  const ix = columnas(aoa[0], DEF_E, sinNumero);
  // Las 18 afirmaciones son las columnas cuyo encabezado va entre corchetes, en el orden del formulario.
  const af = aoa[0].map((c, i) => [norm(c), i]).filter(([t]) => t.startsWith("[")).map(([, i]) => i);
  const claves = ["empresa", "tipo", "tamano", "proyeccion", "cargos"];
  const esEmpleadores = claves.filter((c) => ix[c] != null).length >= 4 && af.length === 18;
  const reconocidas = Object.keys(ix).length + af.length;
  const filas = [];
  const omitidas = [];
  const correos = new Map();
  const g = (r, c) => (ix[c] == null ? null : r[ix[c]]);

  aoa.slice(1).forEach((r, j) => {
    const fila = j + 2;
    if (!r || r.every((x) => x == null || String(x).trim() === "")) return;
    const avisos = [];
    const e = {};
    const poner = (campo, x) => {
      if (x.valor) e[campo] = x.valor;
      if (!x.conocido) avisos.push(`${NOMBRE[campo] || campo}: valor no reconocido «${x.valor}»`);
    };
    const emp = libre(g(r, "empresa"));
    if (emp) e.empresa = emp;
    for (const c of ["tipo", "tamano", "rubro", "contrato", "proyeccion", "nivelFormacion", "medio"]) poner(c, elegir("empleadores", c, g(r, c)));
    const cargos = multiplePorContenido("empleadores", "cargos", g(r, "cargos"));
    if (cargos) e.cargos = cargos;
    for (const c of ["areasEmergentes", "herramientas", "competencias"]) {
      const v = libre(g(r, c), 1500);
      if (v) e[c] = v;
    }
    AFIRMACIONES.forEach((c, i) => {
      const v = r[af[i]];
      if (v == null || String(v).trim() === "") return;
      const n = likert3(v);
      if (n == null) avisos.push(`afirmación ${c}: valor no reconocido «${v}»`);
      else e[c] = n;
    });

    const mail = libre(g(r, "email"), 255).toLowerCase();
    let usaInterno = false;
    if (esCorreo(mail)) e.email = mail;
    else {
      e.email = `empleador-${fila}@importado.arcusur.test`;
      usaInterno = true;
    }
    const fecha = fechaIso(g(r, "fecha"));
    if (fecha) e.registrado = fecha;

    const faltan = OBLIGATORIOS_E.filter((c) => e[c] == null || e[c] === "");
    if (faltan.length) return omitidas.push({ fila, correo: e.email, motivo: "Falta: " + faltan.map((c) => NOMBRE[c] || c).join(", ") + "." });
    if (correos.has(e.email))
      return omitidas.push({ fila, correo: e.email, motivo: `Correo repetido: ya lo usó la fila ${correos.get(e.email)} de este archivo.` });
    correos.set(e.email, fila);
    if (usaInterno) avisos.push("sin correo válido: se usó un identificador interno");
    filas.push({ fila, correo: e.email, avisos, datos: e });
  });
  return { tipo: "empleadores", esTipo: esEmpleadores, reconocidas, filas, omitidas };
}

// ---------------------------------------------------------------------------
// Punto de entrada
// ---------------------------------------------------------------------------

/**
 * Detecta si la hoja es de titulados o de empleadores y la convierte. Devuelve null si no se reconoce ninguna de las dos.
 * aoa: filas de la hoja; la primera contiene los encabezados.
 */
export function mapearArchivo(aoa) {
  if (!Array.isArray(aoa) || aoa.length < 2) return null;
  const t = mapearTitulados(aoa);
  if (t.esTipo) return t;
  const e = mapearEmpleadores(aoa);
  return e.esTipo ? e : null;
}
