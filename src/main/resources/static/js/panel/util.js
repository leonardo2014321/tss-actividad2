// Utilidades compartidas por todas las vistas del panel.

export const $ = (id) => document.getElementById(id);

/** Escapa texto antes de insertarlo en HTML (las respuestas las escribe el público). */
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Número con coma decimal. */
export const num = (x, d = 1) => String(+(+x).toFixed(d)).replace(".", ",");

/** Nombres cortos para opciones muy largas (el texto completo queda en el tooltip). */
const CORTO = [
  [/^actualmente me encuentro trabajando/i, "Trabaja en una organización"],
  [/^actualmente no trabajo/i, "No trabaja"],
  [/^actualmente dedico/i, "Emprendimiento propio (tiempo completo)"],
  [/^financiado con recursos propios/i, "Recursos propios"],
  [/^financiado parcialmente/i, "Beca parcial"],
  [/^total financiamiento/i, "Beca total"],
];
export const corto = (s) => {
  for (const [re, t] of CORTO) if (re.test(s)) return t;
  return s;
};

/** Filas de una distribución ordenadas de mayor a menor. */
export const orden = (d) => d.filas.slice().sort((a, b) => b.n - a.n);

export const pTxt = (p) => (p < 0.0001 ? "p < 0,0001" : "p = " + num(p, 4));

/**
 * Criterios de decisión del equipo. Se cambian aquí y todo el panel se ajusta
 * (tabla de decisiones, semáforos y requisitos de calidad).
 */
export const UMB = {
  mayoria: 50,
  concentracion: 70,
  acuerdoBajo: 60,
  acuerdoAlto: 80,
  demandaAlta: 60,
  empleabilidadMin: 70,
  primerTrabajoLento: 40,
  junior: 3,
  nMin: 30,
  margenMax: 10,
};

export const NOMBRE_FUENTE = {
  reales: "datos reales",
  demo: "datos de demostración",
  todos: "datos reales y de demostración",
};

/** Etiqueta de estado con punto de color: ok = favorable, at = atender, mal = crítico, in = referencia. */
export const estado = (nivel, texto) => `<span class="estado e-${nivel}"><i></i>${texto}</span>`;
