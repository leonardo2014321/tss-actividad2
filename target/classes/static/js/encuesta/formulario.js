// Lógica del formulario: dibuja cada paso, valida las respuestas y las envía a la API.
import { OPC, PASOS, NUM, L3, L4 } from "./preguntas.js";

// Variables: k = encuesta elegida, i = paso actual, D = respuestas acumuladas.
// vs() devuelve los pasos que corresponden según las respuestas (omite los condicionales que no aplican).
// val(n) lee el valor actual de un campo; vis(c) indica si una pregunta debe mostrarse.

const $ = (id) => document.getElementById(id),
  f = $("f"),
  err = (m) => {
    $("err").textContent = m;
  };
let k, i, D;
const vs = () => PASOS[k].filter((s) => !s.w || (D[s.w[0]] || "").startsWith(s.w[1]));
const val = (n) => {
    const e = f.elements[n];
    return e ? e.value : (D[n] ?? "");
  },
  vis = (c) => !c.w || val(c.w[0]).startsWith(c.w[1]);
// lg(): si alguna opción es larga, la lista se muestra en una sola columna para que todos los cuadros queden alineados.
const lg = (a) => (a.some((x) => x.length > 40) ? " long" : "");
// campo(c): genera el HTML de una pregunta según su tipo.
function campo(c) {
  const { n, l, t } = c,
    o = c.o || OPC[n];
  let h = `<fieldset id="fs-${n}"${c.max ? ` data-max="${c.max}"` : ""}><legend>${l}</legend>`;
  if (t == "n")
    h += `<input type="number" name="${n}" inputmode="decimal" min="0" max="60" step="any" placeholder="Ej. 3">`;
  else if (t == "t") h += `<input name="${n}" maxlength="500">`;
  else if (t == "e") h += `<input type="email" name="${n}" maxlength="120" placeholder="nombre@correo.com">`;
  else if (t == "p") h += `<input type="tel" name="${n}" maxlength="30" placeholder="7XXXXXXX">`;
  else if (t == "a") h += `<textarea name="${n}" rows="4" maxlength="1500"></textarea>`;
  else if (t == "l3")
    h += `<div class="opts c4">${L3.map(([x, v]) => `<label><input type="radio" name="${n}" value="${v}"><span>${x}</span></label>`).join("")}</div>`;
  else if (t == "m")
    h +=
      `<div class="opts${lg(o)}">${o.map((x) => `<label><input type="checkbox" name="${n}" value="${x}"><span>${x}</span></label>`).join("")}</div>` +
      (c.otra
        ? `<input name="${n}_otra" maxlength="120" placeholder="${typeof c.otra == "string" ? c.otra : "Otra asignatura (opcional)"}">`
        : "") +
      (c.max ? `<p class="cnt" id="cnt-${n}"></p>` : "");
  else if (t == "l4")
    h += `<div class="opts">${L4.map((x, j) => `<label><input type="radio" name="${n}" value="${j + 1}"><span>${x}</span></label>`).join("")}</div>`;
  else if (o.length > 6)
    h += `<select name="${n}"><option value="">Seleccione…</option>${o.map((x) => `<option>${x}</option>`).join("")}</select>`;
  else
    h += `<div class="opts${lg(o)}">${o.map((x) => `<label><input type="radio" name="${n}" value="${x}"><span>${x}</span></label>`).join("")}</div>`;
  if (o && o.some((x) => x.endsWith(":")))
    h += `<input id="ot-${n}" name="${n}_otro" maxlength="120" placeholder="Especifique" hidden>`;
  return h + "</fieldset>";
}
// leer(): guarda en D las respuestas del paso actual (y borra las de preguntas que quedaron ocultas).
function leer() {
  const fd = new FormData(f);
  vs()[i].c.forEach((c) => {
    if (!vis(c)) {
      ["", "_otro", "_otra"].forEach((s) => delete D[c.n + s]);
      return;
    }
    D[c.n] = c.t == "m" ? fd.getAll(c.n).join("|") : fd.get(c.n) || "";
    ["_otro", "_otra"].forEach((s) => {
      if (fd.has(c.n + s)) D[c.n + s] = fd.get(c.n + s);
    });
  });
}
// actualizar(): muestra u oculta preguntas condicionales, el campo "Especifique" y el contador de opciones.
function actualizar() {
  vs()[i].c.forEach((c) => {
    const fs = $("fs-" + c.n);
    fs.hidden = !vis(c);
    const ot = $("ot-" + c.n);
    if (ot) ot.hidden = !val(c.n).endsWith(":");
    if (c.max) {
      const cb = [...fs.querySelectorAll("input[type=checkbox]")],
        oa = f.elements[c.n + "_otra"],
        n = cb.filter((b) => b.checked).length + (oa && oa.value.trim() ? 1 : 0);
      cb.forEach((b) => (b.disabled = !b.checked && n >= c.max));
      $("cnt-" + c.n).textContent = `Seleccionadas: ${n} de ${c.max}`;
    }
  });
}
// mostrar(): dibuja el paso actual con su barra de progreso, descripción y botones Atrás/Siguiente.
function mostrar() {
  const p = vs(),
    st = p[i];
  $("paso").textContent = `Paso ${i + 1} de ${p.length} · ${st.t}`;
  $("bar").style.width = ((i + 1) / p.length) * 100 + "%";
  $("campos").innerHTML = (st.d ? `<p class="desc">${st.d}</p>` : "") + st.c.map(campo).join("");
  st.c.forEach((c) => {
    const e = f.elements[c.n],
      v = D[c.n];
    if (e && v != null) {
      if (c.t == "m") {
        const s = v.split("|");
        [...e].forEach((b) => (b.checked = s.includes(b.value)));
      } else e.value = v;
    }
    ["_otro", "_otra"].forEach((s) => {
      const x = f.elements[c.n + s];
      if (x && D[c.n + s]) x.value = D[c.n + s];
    });
  });
  actualizar();
  $("atras").textContent = i == 0 ? "Volver al inicio" : "Atrás";
  $("sig").textContent = i == p.length - 1 ? "Enviar respuesta" : "Siguiente";
  err("");
  window.scrollTo(0, 0);
}
// Cada cambio en el formulario vuelve a evaluar qué preguntas se muestran.
f.addEventListener("input", actualizar);
f.addEventListener("change", actualizar);
// Botón Atrás: en el primer paso vuelve al inicio; en los demás retrocede un paso.
$("atras").onclick = () => {
  if (i == 0) {
    inicio();
    return;
  }
  leer();
  i--;
  mostrar();
};
// inicio(): vuelve a la pantalla de elección de encuesta y limpia el #hash de la dirección.
function inicio() {
  f.hidden = true;
  $("revision").hidden = true;
  $("fin").hidden = true;
  $("inicio").hidden = false;
  history.replaceState(null, "", location.pathname);
  window.scrollTo(0, 0);
}
// Elegir una encuesta en la pantalla de inicio: reinicia las respuestas y muestra el primer paso.
document.querySelectorAll("[data-k]").forEach(
  (b) =>
    (b.onclick = () => {
      k = b.dataset.k;
      i = 0;
      D = {};
      $("inicio").hidden = true;
      f.hidden = false;
      mostrar();
    }),
);
// "Responder otra encuesta" (pantalla final) también vuelve al inicio.
$("otra").onclick = inicio;
// Si la dirección trae #titulados o #empleadores, abre esa encuesta directamente.
if (["titulados", "empleadores"].includes(location.hash.slice(1)))
  document.querySelector(`[data-k=${location.hash.slice(1)}]`).click();
// Botón Siguiente / Enviar: valida el paso; si es el último, arma el objeto y lo envía a la API.
f.onsubmit = async (e) => {
  e.preventDefault();
  leer();
  const st = vs()[i];
  // Validación del paso: toda pregunta visible es obligatoria (salvo las marcadas opt).
  for (const c of st.c) {
    if (!vis(c)) continue;
    const v = String(D[c.n] || "").trim();
    if (c.t == "m") {
      const n = (v ? v.split("|").length : 0) + ((D[c.n + "_otra"] || "").trim() ? 1 : 0);
      if (c.max ? n != c.max : n == 0)
        return err(
          c.max ? `Seleccione exactamente ${c.max} opciones: ${c.l}` : "Seleccione al menos una opción en: " + c.l,
        );
      continue;
    }
    if (!v) {
      if (c.opt) continue;
      return err("Falta responder: " + c.l);
    }
    if (!c.t && v.endsWith(":") && !(D[c.n + "_otro"] || "").trim()) return err("Especifique su respuesta en: " + c.l);
    if (c.t == "n" && (isNaN(+v) || +v < 0 || +v > 60)) return err("Ingrese un número entre 0 y 60");
    if (c.t == "e" && !/^\S+@\S+\.\S+$/.test(v)) return err("Ingrese un correo válido");
  }
  // Regla de coherencia: no se puede haber estado desempleado más años que los de vida profesional.
  if (+D.aniosDesempleado > +D.aniosProfesionales)
    return err("El tiempo desempleado no puede superar sus años de vida profesional.");
  // Si quedan pasos, avanza; si era el último, continúa con el envío.
  if (i < vs().length - 1) {
    i++;
    mostrar();
    return;
  }
  // Arma el objeto a enviar: solo preguntas visibles y respondidas; concatena el texto de "Otros"; convierte a número los campos de NUM.
  const d = {};
  vs().forEach((s) =>
    s.c.forEach((c) => {
      if (!vis(c)) return;
      let v = D[c.n];
      if (v == null || v === "") return;
      const o = (D[c.n + "_otro"] || "").trim(),
        a = (D[c.n + "_otra"] || "").trim();
      if (o && String(v).endsWith(":")) v += " " + o;
      if (a) v = (v ? v + "|" : "") + "Otra: " + a;
      d[c.n] = NUM.includes(c.n) ? +v : v;
    }),
  );
  revisar(d);
};

// ---------------------------------------------------------------------------
// Revisión y guardado
// ---------------------------------------------------------------------------
// enviado: respuesta lista para guardar, mientras la persona la revisa.
let enviado;
// nombreDe(d): nombre con el que queda identificada la respuesta (el servidor guarda el correo en minúsculas).
const nombreDe = (d) => {
  const mail = d.email.trim().toLowerCase();
  return k == "titulados" ? `Titulado · ${mail}` : `Empleador · ${d.empresa.trim()} · ${mail}`;
};
// fecha(iso): fecha y hora legibles a partir de la marca ISO 8601 que asigna el servidor.
const fecha = (iso) => {
  const t = new Date(String(iso).replace(/(\.\d{3})\d+/, "$1"));
  return isNaN(t) ? String(iso) : t.toLocaleString("es-BO", { dateStyle: "long", timeStyle: "short" });
};
// textoRespuesta(c, v): cómo se muestra una respuesta guardada (las escalas se guardan como número).
const textoRespuesta = (c, v) =>
  c.t == "l4" ? (L4[v - 1] ?? v) : c.t == "l3" ? (L3.find(([, x]) => x == v) || [v])[0] : c.t == "m" ? String(v).split("|").join(", ") : String(v);
// fila(dl, titulo, valor): agrega un par título/valor a una lista de definiciones (con textContent: nada se interpreta como HTML).
const fila = (dl, t, v) => {
  const dt = document.createElement("dt"),
    dd = document.createElement("dd");
  dt.textContent = t;
  dd.textContent = v;
  dl.append(dt, dd);
};
// revisar(d): en vez de enviar de inmediato, muestra con qué nombre se guardará y el resumen de lo respondido.
function revisar(d) {
  enviado = d;
  $("rev-nombre").textContent = nombreDe(d);
  $("rev-detalle").textContent =
    (k == "titulados" ? "Encuesta de titulados" : "Encuesta de empleadores") + " · el nombre se forma con su correo";
  const dl = $("rev-lista");
  dl.replaceChildren();
  vs().forEach((s) =>
    s.c.forEach((c) => {
      if (d[c.n] != null) fila(dl, c.l, textoRespuesta(c, d[c.n]));
    }),
  );
  $("rev-err").textContent = "";
  f.hidden = true;
  $("revision").hidden = false;
  window.scrollTo(0, 0);
}
// "Volver y corregir": regresa al último paso con todas las respuestas intactas.
$("rev-atras").onclick = () => {
  $("revision").hidden = true;
  f.hidden = false;
  mostrar();
};
// "Confirmar y guardar": envía a la API (POST /api/titulados o /api/empleadores) y muestra la ficha de lo guardado.
$("rev-ok").onclick = async () => {
  const b = $("rev-ok");
  b.disabled = true;
  $("rev-err").textContent = "";
  try {
    const r = await fetch("/api/" + k, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(enviado),
    });
    // 409 = ese correo ya respondió: el servidor envía el mensaje y se muestra tal cual.
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw r.status == 409 && j.message ? j.message : 0;
    }
    const g = await r.json();
    const ficha = $("fin-ficha");
    ficha.replaceChildren();
    fila(ficha, "Guardada como", nombreDe(g));
    fila(ficha, "Registro n.º", g.id);
    fila(ficha, "Correo", g.email);
    fila(ficha, "Fecha y hora", fecha(g.registrado));
    $("revision").hidden = true;
    $("fin").hidden = false;
    window.scrollTo(0, 0);
  } catch (x) {
    $("rev-err").textContent =
      typeof x == "string" ? x + " Pulse «Volver y corregir» para usar otro correo." : "No se pudo guardar. Revise su conexión e inténtelo de nuevo.";
  }
  b.disabled = false;
};
