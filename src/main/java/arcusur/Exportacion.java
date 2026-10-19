package arcusur;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Exportación de datos a CSV (se abre en Excel, R o Python).
 *
 *  - limpio()      : datos listos para analizar (categorías unificadas, opciones múltiples en columnas 0/1).
 *  - crudo()       : copia fiel de lo que guardó la base de datos, sin ninguna transformación.
 *  - diccionario() : qué significa cada variable y qué limpieza recibió.
 *  - cruce()       : matriz de un cruce con frecuencias, porcentajes, esperados, residuos y prueba χ².
 *
 * El separador por defecto es ";" porque Excel en español (Bolivia) lo espera así; con "," el archivo
 * se abre en pandas o R sin configurar nada.
 */
final class Exportacion {

  private Exportacion() {}

  static final String BOM = "\uFEFF"; // hace que Excel reconozca las tildes (UTF-8)

  // =====================================================================
  // FORMATO DE CELDAS
  // =====================================================================

  /** Texto entre comillas. Si empieza con = + - @ se antepone ' para que Excel no lo ejecute como fórmula. */
  static String texto(Object o) {
    String s = o == null ? "" : String.valueOf(o);
    if (!s.isEmpty() && "=+-@\t\r".indexOf(s.charAt(0)) >= 0) s = "'" + s;
    return "\"" + s.replace("\"", "\"\"") + "\"";
  }

  /** Número sin comillas. Con separador ";" usa coma decimal, como espera Excel en español. */
  static String numero(Object o, char sep) {
    if (o == null) return "";
    String s;
    if (o instanceof Double d) {
      s = d == Math.rint(d) && Math.abs(d) < 1e15
          ? String.valueOf(d.longValue())
          : new java.math.BigDecimal(String.valueOf(d)).toPlainString(); // sin notación científica
    } else {
      s = String.valueOf(o);
    }
    return sep == ';' ? s.replace('.', ',') : s;
  }

  private static String fila(char sep, List<String> celdas) {
    return String.join(String.valueOf(sep), celdas) + "\n";
  }

  private static List<Field> campos(Class<?> c) {
    return Arrays.stream(c.getDeclaredFields())
        .filter(f -> Modifier.isPublic(f.getModifiers()) && !Modifier.isStatic(f.getModifiers()))
        .filter(f -> !f.getName().equals("id") && !f.getName().equals("demo"))
        .collect(Collectors.toList());
  }

  static Object valor(Object o, Field f) {
    try {
      return f.get(o);
    } catch (IllegalAccessException e) {
      throw new IllegalStateException(e);
    }
  }

  static Object valor(Object o, String campo) {
    try {
      return o.getClass().getField(campo).get(o);
    } catch (ReflectiveOperationException e) {
      throw new IllegalStateException(e);
    }
  }

  static boolean esDemo(Object o) {
    return Boolean.TRUE.equals(valor(o, "demo"));
  }

  // =====================================================================
  // CSV CRUDO
  // =====================================================================

  /** Una columna por cada campo de la entidad, tal como está guardado. */
  static <T> String crudo(List<T> datos, Class<T> c, char sep) {
    List<Field> fs = campos(c);
    StringBuilder s = new StringBuilder(BOM);
    s.append(fila(sep, fs.stream().map(f -> texto(f.getName())).collect(Collectors.toList())));
    for (T o : datos) {
      s.append(fila(sep, fs.stream().map(f -> {
        Object v = valor(o, f);
        return v instanceof Number ? numero(v, sep) : texto(v);
      }).collect(Collectors.toList())));
    }
    return s.toString();
  }

  // =====================================================================
  // CSV LIMPIO
  // =====================================================================

  /**
   * Datos listos para analizar:
   *  - preguntas de opción única (cat): etiqueta unificada; si hubo "Otro: ...", el texto va en la columna campo__otro_texto;
   *  - preguntas de elección múltiple (multi): una columna 0/1 por cada opción y el texto de "Otra" en campo__otra_texto;
   *  - números y escalas Likert: sin cambios; texto libre: sin cambios.
   * Se agregan las columnas "n" (número de fila) y "origen" (real o demo).
   */
  static <T> String limpio(List<T> datos, Class<T> c, String[] cat, String[] multi, char sep) {
    Set<String> sCat = Set.of(cat), sMulti = Set.of(multi);
    List<Field> fs = campos(c);

    // Etiqueta unificada de cada categoría, calculada con todas las respuestas del campo.
    Map<String, Map<String, String>> canon = new HashMap<>();
    Map<String, Boolean> tieneOtro = new HashMap<>();
    for (String campo : cat) {
      List<String> et = new ArrayList<>();
      boolean otro = false;
      for (T o : datos) {
        String v = (String) valor(o, campo);
        if (v == null || v.isBlank()) continue;
        et.add(Estadistica.etiqueta(v));
        otro |= !Estadistica.textoOtro(v).isEmpty();
      }
      canon.put(campo, Estadistica.canon(et));
      tieneOtro.put(campo, otro);
    }

    // Opciones de cada pregunta múltiple (ordenadas alfabéticamente para que las columnas no cambien entre exportaciones).
    Map<String, List<String>> opciones = new HashMap<>();
    Map<String, Map<String, String>> canonM = new HashMap<>();
    Map<String, Boolean> tieneOtra = new HashMap<>();
    for (String campo : multi) {
      List<String> et = new ArrayList<>();
      boolean otra = false;
      for (T o : datos) {
        String v = (String) valor(o, campo);
        if (v == null || v.isBlank()) continue;
        Estadistica.partes(v).forEach(p -> et.add(Estadistica.etiquetaMulti(p)));
        otra |= !Estadistica.textoOtra(v).isEmpty();
      }
      Map<String, String> cm = Estadistica.canon(et);
      canonM.put(campo, cm);
      opciones.put(campo, cm.values().stream().filter(x -> !x.equals("Otra (especificada)")).sorted().collect(Collectors.toList()));
      tieneOtra.put(campo, otra);
    }

    // Encabezado.
    List<String> enc = new ArrayList<>(List.of(texto("n"), texto("origen")));
    for (Field f : fs) {
      String nom = f.getName();
      if (sMulti.contains(nom)) {
        opciones.get(nom).forEach(op -> enc.add(texto(nom + ": " + op)));
        if (canonM.get(nom).containsValue("Otra (especificada)")) enc.add(texto(nom + ": Otra (especificada)"));
        if (tieneOtra.get(nom)) enc.add(texto(nom + "__otra_texto"));
      } else {
        enc.add(texto(nom));
        if (sCat.contains(nom) && tieneOtro.get(nom)) enc.add(texto(nom + "__otro_texto"));
      }
    }
    StringBuilder s = new StringBuilder(BOM).append(fila(sep, enc));

    // Filas.
    int k = 0;
    for (T o : datos) {
      List<String> celdas = new ArrayList<>(List.of(String.valueOf(++k), texto(esDemo(o) ? "demo" : "real")));
      for (Field f : fs) {
        String nom = f.getName();
        Object v = valor(o, f);
        if (sMulti.contains(nom)) {
          String raw = (String) v;
          Set<String> marcadas = new HashSet<>();
          if (raw != null && !raw.isBlank()) {
            Estadistica.partes(raw).forEach(p -> marcadas.add(canonM.get(nom).get(Estadistica.clave(Estadistica.etiquetaMulti(p)))));
          }
          boolean respondio = raw != null && !raw.isBlank();
          for (String op : opciones.get(nom)) celdas.add(respondio ? (marcadas.contains(op) ? "1" : "0") : "");
          if (canonM.get(nom).containsValue("Otra (especificada)")) celdas.add(respondio ? (marcadas.contains("Otra (especificada)") ? "1" : "0") : "");
          if (tieneOtra.get(nom)) celdas.add(texto(Estadistica.textoOtra(raw)));
        } else if (sCat.contains(nom)) {
          String raw = (String) v;
          celdas.add(raw == null || raw.isBlank() ? "" : texto(canon.get(nom).get(Estadistica.clave(Estadistica.etiqueta(raw)))));
          if (tieneOtro.get(nom)) celdas.add(texto(Estadistica.textoOtro(raw)));
        } else if (v instanceof Number) {
          celdas.add(numero(v, sep));
        } else {
          celdas.add(v == null ? "" : texto(String.valueOf(v).trim()));
        }
      }
      s.append(fila(sep, celdas));
    }
    return s.toString();
  }

  // =====================================================================
  // DICCIONARIO DE DATOS
  // =====================================================================

  private static final String[][] DIC_T = {
    {"edad", "Categórica ordinal", "Rango de edad actual"},
    {"genero", "Categórica nominal", "Género"},
    {"formacion", "Categórica nominal", "¿Realizó o realiza formación complementaria después del pregrado?"},
    {"nivelPosgrado", "Categórica ordinal", "Mayor nivel de formación complementaria concluido o en curso"},
    {"dondeCurso", "Categórica nominal", "Dónde cursó el programa"},
    {"financiamiento", "Categórica nominal", "Fuente de financiamiento del programa cursado"},
    {"nombrePrograma", "Texto libre", "Nombre del programa cursado"},
    {"interes", "Categórica nominal", "¿Le interesa un posgrado en áreas de Ingeniería en Sistemas?"},
    {"area", "Categórica nominal", "Área de posgrado de interés"},
    {"orgPosgrado", "Categórica nominal", "Organización donde le gustaría estudiar el posgrado"},
    {"opinionPosgrado", "Likert 1-4", "Existen posgrados de la FCyT afines a Sistemas (1 = totalmente en desacuerdo, 4 = totalmente de acuerdo)"},
    {"aniosProfesionales", "Numérica continua", "Años de vida profesional (0 a 60)"},
    {"aniosDesempleado", "Numérica continua", "Años desempleado dentro de su vida profesional"},
    {"situacion", "Categórica nominal", "Situación laboral actual"},
    {"empresa", "Texto libre", "Organización donde trabaja"},
    {"rubro", "Categórica nominal", "Rubro de la organización"},
    {"sector", "Categórica nominal", "Sector (público o privado)"},
    {"departamento", "Categórica nominal", "Departamento de Bolivia donde trabaja"},
    {"areaOrg", "Categórica nominal", "Área dentro de la organización"},
    {"cargo", "Categórica nominal", "Cargo que desempeña"},
    {"pertinencia", "Likert 1-4", "Las labores del puesto son pertinentes a su formación (solo quienes trabajan)"},
    {"antiguedad", "Categórica ordinal", "Antigüedad en el trabajo actual"},
    {"medio", "Categórica nominal", "Medio por el que obtuvo el trabajo actual"},
    {"remuneracion", "Categórica ordinal", "Remuneración mensual promedio (Bs.)"},
    {"primerEmpleo", "Categórica nominal", "¿El trabajo actual es su primer empleo?"},
    {"tiempoPrimerTrabajo", "Categórica ordinal", "Tiempo en conseguir el primer trabajo tras titularse"},
    {"numEmpleos", "Categórica ordinal", "Cantidad de empleos desde que se tituló"},
    {"satisfaccion", "Likert 1-4", "Satisfacción global con la formación recibida"},
    {"concordancia", "Likert 1-4", "Concordancia entre la formación y los requerimientos laborales"},
    {"utiles", "Selección múltiple", "Aspectos de la Carrera de bastante utilidad"},
    {"mejorar", "Selección múltiple", "Aspectos de la Carrera que pueden mejorarse"},
    {"ventaja", "Selección múltiple", "5 asignaturas que dieron ventaja competitiva"},
    {"pocoUtiles", "Selección múltiple", "5 asignaturas de poca utilidad"},
    {"redContactos", "Categórica nominal", "¿Le interesa una red de contactos oficial de la Carrera?"},
    {"email", "Contacto (obligatorio)", "Correo electrónico que identifica la respuesta (único por encuesta). Dato personal: no publicar ni compartir"},
    {"registrado", "Marca de tiempo", "Fecha y hora en que el servidor guardó la respuesta (ISO 8601)"},
    {"telefono", "Contacto (opcional)", "Teléfono. Dato personal: no publicar ni compartir"},
    {"linkedin", "Contacto (opcional)", "Perfil de LinkedIn. Dato personal: no publicar ni compartir"}};

  private static final String[][] DIC_E = {
    {"email", "Contacto (obligatorio)", "Correo electrónico de contacto que identifica la respuesta (único por encuesta). Dato personal: no publicar ni compartir"},
    {"registrado", "Marca de tiempo", "Fecha y hora en que el servidor guardó la respuesta (ISO 8601)"},
    {"empresa", "Texto libre", "Nombre de la empresa o institución"},
    {"tipo", "Categórica nominal", "Tipo de organización (público o privado)"},
    {"tamano", "Categórica ordinal", "Tamaño de la organización"},
    {"rubro", "Categórica nominal", "Rubro o sector principal"},
    {"contrato", "Categórica nominal", "¿Contrató Ingenieros de Sistemas en los últimos 5 años?"},
    {"proyeccion", "Categórica nominal", "Posibilidad de incorporar Ingenieros de Sistemas en los próximos años"},
    {"nivelFormacion", "Categórica ordinal", "Nivel de formación que demanda para contratar"},
    {"medio", "Categórica nominal", "Medio de convocatoria de profesionales"},
    {"cargos", "Selección múltiple", "Tipos de cargos que ocupan los titulados"},
    {"areasEmergentes", "Texto libre", "Áreas o tendencias emergentes importantes para la formación (P10)"},
    {"herramientas", "Texto libre", "Herramientas tecnológicas que debería manejar el profesional (P11)"},
    {"competencias", "Texto libre", "Habilidades y competencias fundamentales (P12)"},
    {"fp1", "Likert 1-3 (0 = No sabe)", "La Carrera brinda confianza como formadora de profesionales"},
    {"fp2", "Likert 1-3 (0 = No sabe)", "El título es consistente con las competencias de los titulados"},
    {"fp3", "Likert 1-3 (0 = No sabe)", "Las autoridades consultan regularmente su opinión sobre el perfil"},
    {"fp4", "Likert 1-3 (0 = No sabe)", "Conoce el perfil profesional y las competencias de egreso"},
    {"fp5", "Likert 1-3 (0 = No sabe)", "El perfil declarado es coherente con el desempeño de los titulados"},
    {"fp6", "Likert 1-3 (0 = No sabe)", "La formación permite un desempeño destacado"},
    {"fp7", "Likert 1-3 (0 = No sabe)", "La Carrera incorpora la opinión del sector en la formación práctica"},
    {"fp8", "Likert 1-3 (0 = No sabe)", "Los titulados demuestran competencias laborales"},
    {"fp9", "Likert 1-3 (0 = No sabe)", "Los titulados demuestran valores y ética profesional"},
    {"fp10", "Likert 1-3 (0 = No sabe)", "Participó en procesos de retroalimentación sobre el desempeño"},
    {"vc1", "Likert 1-3 (0 = No sabe)", "La Carrera mantiene vínculos que generan oportunidades laborales"},
    {"vc2", "Likert 1-3 (0 = No sabe)", "Participó en actividades de vinculación con el entorno"},
    {"vc3", "Likert 1-3 (0 = No sabe)", "Participó en difusión de oportunidades laborales y pasantías"},
    {"vc4", "Likert 1-3 (0 = No sabe)", "Participó en vinculación entre empleadores, docentes y estudiantes"},
    {"vc5", "Likert 1-3 (0 = No sabe)", "Fue consultado sobre el desempeño de los titulados"},
    {"vc6", "Likert 1-3 (0 = No sabe)", "La Carrera consultó sobre la pertinencia de la formación"},
    {"vc7", "Likert 1-3 (0 = No sabe)", "Recurren a la UMSS para buscar talento"},
    {"vc8", "Likert 1-3 (0 = No sabe)", "Fue consultado en los procesos de autoevaluación"}};

  /** Limpieza que recibe cada tipo de variable (se escribe en la última columna del diccionario). */
  private static String tratamiento(String tipo) {
    if (tipo.startsWith("Categórica"))
      return "Se unifican mayúsculas, tildes y espacios; «Otro: …» pasa a «Otro (especificado)» y el texto va en <campo>__otro_texto";
    if (tipo.startsWith("Selección")) return "Una columna 0/1 por opción; el texto de «Otra» va en <campo>__otra_texto";
    if (tipo.startsWith("Likert 1-3")) return "Sin cambios. El valor 0 (No sabe) se excluye de medias y desviaciones";
    if (tipo.startsWith("Likert")) return "Sin cambios (entero de 1 a 4)";
    if (tipo.startsWith("Numérica")) return "Sin cambios; los valores atípicos se detectan con la regla de Tukey (se reportan, no se eliminan)";
    if (tipo.startsWith("Contacto")) return "Sin cambios; excluir al publicar resultados";
    return "Sin cambios (solo se recortan espacios)";
  }

  static String diccionario(char sep) {
    StringBuilder s = new StringBuilder(BOM);
    s.append(fila(sep, List.of(texto("tabla"), texto("variable"), texto("tipo"), texto("descripcion"), texto("tratamiento_en_la_limpieza"))));
    for (String[] d : DIC_T) s.append(fila(sep, List.of(texto("titulados"), texto(d[0]), texto(d[1]), texto(d[2]), texto(tratamiento(d[1])))));
    for (String[] d : DIC_E) s.append(fila(sep, List.of(texto("empleadores"), texto(d[0]), texto(d[1]), texto(d[2]), texto(tratamiento(d[1])))));
    return s.toString();
  }

  // =====================================================================
  // PRUEBAS DE UNIFORMIDAD
  // =====================================================================

  /** Descripción de una variable según el diccionario (si no está, devuelve el nombre del campo). */
  private static String descripcion(String[][] dic, String variable) {
    for (String[] d : dic) {
      if (d[0].equals(variable)) return d[2];
    }
    return variable;
  }

  /** Prueba de uniformidad (Chi-cuadrado, alfa = 5 %) de cada pregunta de opción única, con las frecuencias observadas. */
  static String uniformidad(Map<String, Estadistica.Dist> titulados, Map<String, Estadistica.Dist> empleadores, char sep) {
    StringBuilder s = new StringBuilder(BOM);
    s.append(fila(sep, Stream.of("tabla", "variable", "pregunta", "n", "categorias_k", "FE_n_sobre_k", "chi2", "gl",
        "chi2_critico_5pct", "p", "resultado", "prueba_confiable", "frecuencias_observadas").map(Exportacion::texto).collect(Collectors.toList())));
    filasUnif(s, sep, "titulados", DIC_T, titulados);
    filasUnif(s, sep, "empleadores", DIC_E, empleadores);
    return s.toString();
  }

  private static void filasUnif(StringBuilder s, char sep, String tabla, String[][] dic, Map<String, Estadistica.Dist> dists) {
    dists.forEach((campo, d) -> {
      Estadistica.Unif u = d.unif();
      if (u == null) return;
      s.append(fila(sep, List.of(texto(tabla), texto(campo), texto(descripcion(dic, campo)), numero(u.n(), sep), numero(u.k(), sep),
          numero(u.fe(), sep), numero(u.chi2(), sep), numero(u.gl(), sep), numero(u.critico(), sep), numero(u.p(), sep),
          texto(u.uniforme() ? "Uniformidad" : "No uniformidad"), texto(u.confiable() ? "Sí" : "No (FE < 5)"),
          texto(d.filas().stream().map(f -> f.opcion() + ": " + f.n()).collect(Collectors.joining(" | "))))));
    });
  }

  // =====================================================================
  // MATRIZ DE UN CRUCE
  // =====================================================================

  /** Exporta un cruce: frecuencias, porcentajes por fila, esperados, residuos y la prueba χ². */
  static String cruce(Estadistica.Cruce c, char sep) {
    StringBuilder s = new StringBuilder(BOM);
    s.append(fila(sep, List.of(texto("Cruce"), texto(c.titulo()))));
    s.append(fila(sep, List.of(texto("Respuestas válidas (n)"), numero(c.n(), sep))));
    s.append("\n");

    int nf = c.filas().size(), nc = c.columnas().size();
    long[] ft = new long[nf], ct = new long[nc];
    for (int i = 0; i < nf; i++) {
      for (int j = 0; j < nc; j++) {
        ft[i] += c.matriz()[i][j];
        ct[j] += c.matriz()[i][j];
      }
    }

    bloque(s, sep, "Frecuencias absolutas", c, (i, j) -> numero(c.matriz()[i][j], sep), i -> numero(ft[i], sep), j -> numero(ct[j], sep), numero(c.n(), sep));
    bloque(s, sep, "Porcentaje por fila (%)", c,
        (i, j) -> numero(ft[i] == 0 ? 0 : Estadistica.r1(c.matriz()[i][j] * 100.0 / ft[i]), sep),
        i -> numero(100, sep), j -> numero(c.n() == 0 ? 0 : Estadistica.r1(ct[j] * 100.0 / c.n()), sep), numero(100, sep));
    if (c.chi2() != null) {
      bloque(s, sep, "Frecuencias esperadas si fueran independientes", c, (i, j) -> numero(c.esperados()[i][j], sep), null, null, null);
      bloque(s, sep, "Residuos estandarizados ajustados (|z| > 1,96 se aparta del azar)", c, (i, j) -> numero(c.residuales()[i][j], sep), null, null, null);
      s.append(fila(sep, List.of(texto("Prueba"), texto("Chi-cuadrado de independencia"))));
      s.append(fila(sep, List.of(texto("chi2"), numero(c.chi2(), sep))));
      s.append(fila(sep, List.of(texto("gl"), numero(c.gl(), sep))));
      s.append(fila(sep, List.of(texto("p"), numero(c.p(), sep))));
      s.append(fila(sep, List.of(texto("V de Cramer"), numero(c.cramerV(), sep))));
      s.append(fila(sep, List.of(texto("Celdas con esperada < 5 (%)"), numero(c.pctEsperadosBajos(), sep))));
      s.append(fila(sep, List.of(texto("Prueba confiable"), texto(c.confiable() ? "Sí" : "No"))));
    }
    if (c.aviso() != null) s.append(fila(sep, List.of(texto("Aviso"), texto(c.aviso()))));
    return s.toString();
  }

  private static void bloque(StringBuilder s, char sep, String titulo, Estadistica.Cruce c,
      java.util.function.BiFunction<Integer, Integer, String> celda, java.util.function.Function<Integer, String> totF,
      java.util.function.Function<Integer, String> totC, String totalGeneral) {
    s.append(fila(sep, List.of(texto(titulo))));
    List<String> enc = new ArrayList<>();
    enc.add(texto(c.filaNombre() + " \\ " + c.colNombre()));
    c.columnas().forEach(x -> enc.add(texto(x)));
    if (totF != null) enc.add(texto("Total"));
    s.append(fila(sep, enc));
    for (int i = 0; i < c.filas().size(); i++) {
      List<String> f = new ArrayList<>();
      f.add(texto(c.filas().get(i)));
      for (int j = 0; j < c.columnas().size(); j++) f.add(celda.apply(i, j));
      if (totF != null) f.add(totF.apply(i));
      s.append(fila(sep, f));
    }
    if (totC != null) {
      List<String> f = new ArrayList<>();
      f.add(texto("Total"));
      for (int j = 0; j < c.columnas().size(); j++) f.add(totC.apply(j));
      f.add(totalGeneral);
      s.append(fila(sep, f));
    }
    s.append("\n");
  }
}
