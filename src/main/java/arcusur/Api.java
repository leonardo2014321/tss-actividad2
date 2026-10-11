package arcusur;

import arcusur.Estadistica.Cruce;
import arcusur.Estadistica.Dist;
import jakarta.validation.Valid;
import java.util.*;
import java.util.function.Function;
import java.util.stream.*;
import org.apache.commons.math3.distribution.BinomialDistribution;
import org.apache.commons.math3.random.JDKRandomGenerator;
import org.apache.commons.math3.stat.descriptive.DescriptiveStatistics;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * API REST de la aplicación. Todas las rutas empiezan con /api.
 *
 *  - POST /api/titulados y /api/empleadores : guardan una respuesta de encuesta.
 *  - GET  /api/stats?datos=reales|demo|todos : estadísticas para el panel de análisis.
 *  - POST /api/simulacion                    : simulación Monte Carlo de inscritos a un posgrado.
 *  - GET  /api/export/...                    : CSV limpio, crudo, diccionario y matrices de cruce.
 *  - POST /api/seed y DELETE /api/reset      : datos de demostración (ficticios).
 *
 * Los cálculos están en {@link Estadistica} y los archivos CSV en {@link Exportacion}.
 */
@RestController
@RequestMapping("/api")
public class Api {

  private final TituladoRepo tr;
  private final EmpleadorRepo er;

  /** Spring inyecta los repositorios automáticamente. */
  public Api(TituladoRepo tr, EmpleadorRepo er) {
    this.tr = tr;
    this.er = er;
  }

  // =====================================================================
  // 1. GUARDADO DE ENCUESTAS
  // =====================================================================

  /** Guarda la respuesta de un titulado. @Valid aplica las reglas de la entidad (obligatorios, rangos). */
  @PostMapping("/titulados")
  public Titulado guardarT(@Valid @RequestBody Titulado t) {
    t.id = null;      // evita que el cliente sobrescriba un registro existente
    t.demo = false;   // una respuesta enviada por formulario nunca es de demostración
    return tr.save(t);
  }

  /** Guarda la respuesta de un empleador. Mismas reglas que en titulados. */
  @PostMapping("/empleadores")
  public Empleador guardarE(@Valid @RequestBody Empleador e) {
    e.id = null;
    e.demo = false;
    return er.save(e);
  }

  // =====================================================================
  // 2. DEFINICIONES COMUNES
  // =====================================================================

  /** Preguntas de opción única (listas cerradas): se les unifica el formato al limpiar y exportar. */
  static final String[] CAT_T = {"edad", "genero", "formacion", "interes", "situacion", "tiempoPrimerTrabajo", "numEmpleos",
    "redContactos", "nivelPosgrado", "dondeCurso", "financiamiento", "area", "orgPosgrado", "rubro", "sector", "departamento",
    "areaOrg", "cargo", "antiguedad", "medio", "remuneracion", "primerEmpleo"};
  /** Preguntas de elección múltiple de titulados (opciones unidas con "|"). */
  static final String[] MULTI_T = {"utiles", "mejorar", "ventaja", "pocoUtiles"};
  static final String[] CAT_E = {"tipo", "tamano", "rubro", "contrato", "proyeccion", "nivelFormacion", "medio"};
  static final String[] MULTI_E = {"cargos"};

  /** Nombres de los 18 campos de afirmaciones de empleadores: fp1..fp10 (formación y perfil) y vc1..vc8 (vinculación). */
  static final String[] AFIRM = {
    "fp1", "fp2", "fp3", "fp4", "fp5", "fp6", "fp7", "fp8", "fp9", "fp10",
    "vc1", "vc2", "vc3", "vc4", "vc5", "vc6", "vc7", "vc8"
  };

  /** Lee por nombre un campo Integer de un empleador (por reflexión). Sirve para recorrer AFIRM en un bucle. */
  static Integer ig(Empleador e, String n) {
    return (Integer) Exportacion.valor(e, n);
  }

  /** Segmento de madurez profesional: junior (hasta 3 años) o consolidado (más de 3 años). */
  static String segmento(Titulado t) {
    return t.aniosProfesionales <= 3 ? "Junior (hasta 3 años)" : "Consolidado (más de 3 años)";
  }

  /** Definición de un cruce de variables del panel. */
  record Def(String id, String titulo, String filas, String cols,
      Function<Titulado, String> f, Function<Titulado, String> c, String ordF, String ordC) {}

  /** Cruces que calcula el panel. El primero relaciona la fuente de financiamiento con el nivel de posgrado. */
  static final List<Def> CRUCES = List.of(
      new Def("fin-nivel", "Fuente de financiamiento × nivel de formación complementaria", "Financiamiento", "Nivel de formación",
          t -> t.financiamiento, t -> t.nivelPosgrado, null, "nivelPosgrado"),
      new Def("area-sector", "Área de posgrado de interés × sector donde trabaja", "Área de interés", "Sector",
          t -> t.area, t -> t.sector, null, null),
      new Def("seg-area", "Madurez profesional × área de posgrado de interés", "Segmento", "Área de interés",
          Api::segmento, t -> t.area, null, null),
      new Def("int-sit", "Interés en un posgrado × situación laboral", "Interés en posgrado", "Situación laboral",
          t -> t.interes, t -> t.situacion, null, null),
      new Def("area-fin", "Área de posgrado de interés × fuente de financiamiento", "Área de interés", "Financiamiento",
          t -> t.area, t -> t.financiamiento, null, null));

  /** Indica si un registro entra según el filtro: reales (por defecto), demo o todos. */
  static boolean acepta(String datos, boolean demo) {
    return "todos".equals(datos) || ("demo".equals(datos) ? demo : !demo);
  }

  private List<Titulado> titulados(String datos) {
    return tr.findAll().stream().filter(t -> acepta(datos, t.demo)).collect(Collectors.toList());
  }

  private List<Empleador> empleadores(String datos) {
    return er.findAll().stream().filter(e -> acepta(datos, e.demo)).collect(Collectors.toList());
  }

  private static char separador(String sep) {
    return ",".equals(sep) ? ',' : ';';
  }

  // =====================================================================
  // 3. CALIDAD DE LOS DATOS Y MUESTRA
  // =====================================================================

  /** Registros que coinciden en todas las respuestas (posibles envíos repetidos). */
  private static long duplicados(List<?> l) {
    Set<String> vistos = new HashSet<>();
    long dup = 0;
    for (Object o : l) {
      StringBuilder firma = new StringBuilder();
      for (java.lang.reflect.Field f : o.getClass().getFields()) {
        if (f.getName().equals("id") || f.getName().equals("demo")) continue;
        Object v = Exportacion.valor(o, f);
        firma.append(v instanceof String str ? Estadistica.clave(str) : v).append('¦'); // ignora mayúsculas y tildes
      }
      if (!vistos.add(firma.toString())) dup++;
    }
    return dup;
  }

  /** Variantes de escritura (mayúsculas, tildes, espacios) que la limpieza unifica en las preguntas cerradas. */
  private static long unificadas(List<?> l, String[] campos) {
    long n = 0;
    for (String c : campos) {
      Set<String> exactos = new HashSet<>(), claves = new HashSet<>();
      for (Object o : l) {
        String v = (String) Exportacion.valor(o, c);
        if (v == null || v.isBlank() || Estadistica.etiqueta(v).startsWith("Otro (")) continue;
        exactos.add(v.trim());
        claves.add(Estadistica.clave(v));
      }
      n += exactos.size() - claves.size();
    }
    return n;
  }

  /** Margen de error de una proporción (95 %, p = 0,5) en puntos porcentuales. Es referencial: supone muestra aleatoria. */
  private static double margen(long n) {
    return n == 0 ? 0 : Estadistica.r1(1.96 * Math.sqrt(0.25 / n) * 100);
  }

  // =====================================================================
  // 4. ESTADÍSTICAS PARA EL PANEL
  // =====================================================================

  /** Calcula todas las estadísticas del panel (dashboard.html). datos: reales (defecto), demo o todos. */
  @GetMapping("/stats")
  public Map<String, Object> stats(@RequestParam(defaultValue = "reales") String datos) {
    List<Titulado> todosT = tr.findAll();
    List<Empleador> todosE = er.findAll();
    List<Titulado> ts = todosT.stream().filter(t -> acepta(datos, t.demo)).collect(Collectors.toList());
    List<Empleador> es = todosE.stream().filter(e -> acepta(datos, e.demo)).collect(Collectors.toList());

    Map<String, Object> m = new LinkedHashMap<>();
    m.put("datos", datos);
    m.put("nTitulados", ts.size());
    m.put("nEmpleadores", es.size());
    m.put("disponibles", Map.of(
        "reales", todosT.stream().filter(t -> !t.demo).count() + todosE.stream().filter(e -> !e.demo).count(),
        "demo", todosT.stream().filter(t -> t.demo).count() + todosE.stream().filter(e -> e.demo).count()));

    // ---- Muestra: tamaño, margen de error y cobertura de empresas ----
    Map<String, String> empresas = new TreeMap<>(); // clave de la empresa -> "Público" / "Privado" / "Sin dato"
    Map<String, String> nombres = new HashMap<>();
    for (Empleador e : es) {
      String k = Estadistica.clave(e.empresa);
      nombres.putIfAbsent(k, e.empresa.trim());
      empresas.merge(k, Estadistica.etiqueta(e.tipo), (a, b) -> a);
    }
    for (Titulado t : ts) {
      if (t.empresa == null || t.empresa.isBlank()) continue;
      String k = Estadistica.clave(t.empresa);
      nombres.putIfAbsent(k, t.empresa.trim());
      empresas.merge(k, t.sector == null ? "Sin dato" : Estadistica.etiqueta(t.sector), (a, b) -> a.equals("Sin dato") ? b : a);
    }
    long pub = empresas.values().stream().filter(v -> Estadistica.clave(v).equals("publico")).count();
    long pri = empresas.values().stream().filter(v -> Estadistica.clave(v).equals("privado")).count();
    Map<String, Object> mu = new LinkedHashMap<>();
    mu.put("margenTitulados", margen(ts.size()));
    mu.put("margenEmpleadores", margen(es.size()));
    mu.put("empresas", empresas.size());
    mu.put("empresasPublicas", pub);
    mu.put("empresasPrivadas", pri);
    mu.put("listaEmpresas", empresas.entrySet().stream()
        .map(e -> Map.of("nombre", nombres.get(e.getKey()), "tipo", e.getValue())).collect(Collectors.toList()));
    m.put("muestra", mu);

    // ---- Calidad de los datos (resultado de la etapa de limpieza) ----
    double[] anios = ts.stream().mapToDouble(t -> t.aniosProfesionales).toArray();
    Map<String, Object> q = new LinkedHashMap<>();
    q.put("duplicadosTitulados", duplicados(ts));
    q.put("duplicadosEmpleadores", duplicados(es));
    q.put("incoherentes", ts.stream().filter(t -> t.aniosDesempleado > t.aniosProfesionales).count());
    q.put("atipicos", Estadistica.atipicos(anios));
    q.put("categoriasUnificadas", unificadas(ts, CAT_T) + unificadas(es, CAT_E));
    q.put("otrasEspecificadas", ts.stream().flatMap(t -> Arrays.stream(CAT_T).map(c -> (String) Exportacion.valor(t, c)))
        .filter(v -> v != null && !Estadistica.textoOtro(v).isEmpty()).count()
        + es.stream().flatMap(e -> Arrays.stream(CAT_E).map(c -> (String) Exportacion.valor(e, c)))
        .filter(v -> v != null && !Estadistica.textoOtro(v).isEmpty()).count());
    m.put("calidad", q);

    // ---- Titulados ----
    if (!ts.isEmpty()) {
      m.put("anios", Estadistica.desc(anios));
      m.put("aniosHist", Estadistica.histAnios(anios));
      m.put("junior", ts.stream().filter(t -> t.aniosProfesionales <= 3).count());
      m.put("consolidado", ts.stream().filter(t -> t.aniosProfesionales > 3).count());
      m.put("pctInteres", Estadistica.r(ts.stream().filter(t -> "SI".equalsIgnoreCase(t.interes)).count() * 1.0 / ts.size()));

      Map<String, Dist> d = new LinkedHashMap<>();
      d.put("edad", Estadistica.dist(ts, t -> t.edad, false, "edad", Opciones.TITULADOS.get("edad")));
      d.put("genero", Estadistica.dist(ts, t -> t.genero, false, "genero", Opciones.TITULADOS.get("genero")));
      d.put("situacion", Estadistica.dist(ts, t -> t.situacion, false, "situacion", Opciones.TITULADOS.get("situacion")));
      d.put("tiempoPrimerTrabajo", Estadistica.dist(ts, t -> t.tiempoPrimerTrabajo, false, "tiempoPrimerTrabajo", Opciones.TITULADOS.get("tiempoPrimerTrabajo")));
      d.put("numEmpleos", Estadistica.dist(ts, t -> t.numEmpleos, false, "numEmpleos", Opciones.TITULADOS.get("numEmpleos")));
      d.put("nivelPosgrado", Estadistica.dist(ts, t -> t.nivelPosgrado, false, "nivelPosgrado", Opciones.TITULADOS.get("nivelPosgrado")));
      d.put("financiamiento", Estadistica.dist(ts, t -> t.financiamiento, false, "financiamiento", Opciones.TITULADOS.get("financiamiento")));
      d.put("area", Estadistica.dist(ts, t -> t.area, false, "area", Opciones.TITULADOS.get("area")));
      d.put("orgPosgrado", Estadistica.dist(ts, t -> t.orgPosgrado, false, "orgPosgrado", Opciones.TITULADOS.get("orgPosgrado")));
      d.put("rubro", Estadistica.dist(ts, t -> t.rubro, false, "rubro", Opciones.TITULADOS.get("rubro")));
      d.put("sector", Estadistica.dist(ts, t -> t.sector, false, "sector", Opciones.TITULADOS.get("sector")));
      d.put("departamento", Estadistica.dist(ts, t -> t.departamento, false, "departamento", Opciones.TITULADOS.get("departamento")));
      d.put("remuneracion", Estadistica.dist(ts, t -> t.remuneracion, false, "remuneracion", Opciones.TITULADOS.get("remuneracion")));
      d.put("utiles", Estadistica.dist(ts, t -> t.utiles, true, "utiles", Opciones.TITULADOS.get("utiles")));
      d.put("mejorar", Estadistica.dist(ts, t -> t.mejorar, true, "mejorar", Opciones.TITULADOS.get("mejorar")));
      d.put("ventaja", Estadistica.dist(ts, t -> t.ventaja, true, "ventaja", Opciones.TITULADOS.get("ventaja")));
      d.put("pocoUtiles", Estadistica.dist(ts, t -> t.pocoUtiles, true, "pocoUtiles", Opciones.TITULADOS.get("pocoUtiles")));
      m.put("distT", d);

      // Escalas Likert de 4 niveles (1 = totalmente en desacuerdo ... 4 = totalmente de acuerdo).
      Map<String, Object> lt = new LinkedHashMap<>();
      lt.put("opinionPosgrado", Estadistica.lik(ts.stream().map(t -> t.opinionPosgrado).collect(Collectors.toList()), 4));
      lt.put("pertinencia", Estadistica.lik(ts.stream().map(t -> t.pertinencia).collect(Collectors.toList()), 4));
      lt.put("satisfaccion", Estadistica.lik(ts.stream().map(t -> t.satisfaccion).collect(Collectors.toList()), 4));
      lt.put("concordancia", Estadistica.lik(ts.stream().map(t -> t.concordancia).collect(Collectors.toList()), 4));
      m.put("likertT", lt);

      // Cruces de variables con Chi-cuadrado.
      Map<String, Cruce> cr = new LinkedHashMap<>();
      for (Def c : CRUCES) {
        cr.put(c.id(), Estadistica.cruce(c.id(), c.titulo(), c.filas(), c.cols(), ts, c.f(), c.c(), c.ordF(), c.ordC()));
      }
      m.put("cruces", cr);
    }

    // ---- Empleadores ----
    if (!es.isEmpty()) {
      Map<String, Dist> d = new LinkedHashMap<>();
      d.put("tipo", Estadistica.dist(es, e -> e.tipo, false, "tipo", Opciones.EMPLEADORES.get("tipo")));
      d.put("tamano", Estadistica.dist(es, e -> e.tamano, false, "tamano", Opciones.EMPLEADORES.get("tamano")));
      d.put("rubro", Estadistica.dist(es, e -> e.rubro, false, "rubro", Opciones.EMPLEADORES.get("rubro")));
      d.put("contrato", Estadistica.dist(es, e -> e.contrato, false, "contrato", Opciones.EMPLEADORES.get("contrato")));
      d.put("proyeccion", Estadistica.dist(es, e -> e.proyeccion, false, "proyeccion", Opciones.EMPLEADORES.get("proyeccion")));
      d.put("nivelFormacion", Estadistica.dist(es, e -> e.nivelFormacion, false, "nivelFormacion", Opciones.EMPLEADORES.get("nivelFormacion")));
      d.put("medio", Estadistica.dist(es, e -> e.medio, false, "medio", Opciones.EMPLEADORES.get("medio")));
      d.put("cargos", Estadistica.dist(es, e -> e.cargos, true, "cargos", Opciones.EMPLEADORES.get("cargos")));
      m.put("distE", d);

      // Las 18 afirmaciones (escala 1 a 3). El valor 0 = "No sabe" se cuenta aparte.
      Map<String, Object> le = new LinkedHashMap<>();
      for (String n : AFIRM) {
        le.put(n, Estadistica.lik(es.stream().map(e -> ig(e, n)).collect(Collectors.toList()), 3));
      }
      m.put("likertE", le);
    }
    return m;
  }

  // =====================================================================
  // 5. SIMULACIÓN MONTE CARLO
  // =====================================================================

  /**
   * Simula cuántos titulados se inscribirían a un programa de posgrado.
   * Cada titulado potencial se inscribe con probabilidad q = probInteres x probInscribe,
   * así que los inscritos siguen una distribución binomial. Se repite el experimento
   * "iteraciones" veces y se reporta la media, el rango del 90 % (p5 a p95), la probabilidad
   * de alcanzar el mínimo de inscritos para abrir el programa y la distribución completa
   * (para dibujarla). La semilla fija (42) hace que el resultado sea reproducible.
   */
  @PostMapping("/simulacion")
  public Map<String, Object> sim(@RequestBody Map<String, Double> p) {
    int n = Math.min(1_000_000, Math.max(1, p.getOrDefault("poblacion", 300.0).intValue()));
    int it = Math.min(50000, Math.max(100, p.getOrDefault("iteraciones", 5000.0).intValue()));
    int min = p.getOrDefault("minimo", 20.0).intValue();
    double q = Math.min(1, Math.max(0, p.getOrDefault("probInteres", 0.6) * p.getOrDefault("probInscribe", 0.3)));

    BinomialDistribution b = new BinomialDistribution(new JDKRandomGenerator(42), n, q);
    double[] x = new double[it];
    int ok = 0; // iteraciones en las que se alcanzó el mínimo
    for (int i = 0; i < it; i++) {
      x[i] = b.sample();
      if (x[i] >= min) ok++;
    }

    DescriptiveStatistics d = new DescriptiveStatistics(x);

    // Distribución de los inscritos entre el percentil 0,5 y el 99,5 (porcentaje de iteraciones por valor).
    int lo = (int) Math.floor(d.getPercentile(0.5)), hi = (int) Math.ceil(d.getPercentile(99.5));
    int[] cuenta = new int[hi - lo + 1];
    for (double v : x) {
      int k = (int) v;
      if (k >= lo && k <= hi) cuenta[k - lo]++;
    }
    List<double[]> dist = new ArrayList<>();
    for (int i = 0; i < cuenta.length; i++) {
      dist.add(new double[] {lo + i, Estadistica.r(cuenta[i] * 100.0 / it)});
    }

    Map<String, Object> o = new LinkedHashMap<>();
    o.put("media", Estadistica.r(d.getMean()));
    o.put("p5", Estadistica.r(d.getPercentile(5)));
    o.put("p95", Estadistica.r(d.getPercentile(95)));
    o.put("probApertura", Estadistica.r(ok * 1.0 / it));
    o.put("probConjunta", Estadistica.r(q));
    o.put("minimo", min);
    o.put("dist", dist);
    return o;
  }

  // =====================================================================
  // 6. EXPORTACIÓN CSV
  // =====================================================================

  /** Titulados listos para analizar (categorías unificadas, opciones múltiples en columnas 0/1). */
  @GetMapping(value = "/export/titulados.csv", produces = "text/csv; charset=UTF-8")
  public String csvT(@RequestParam(defaultValue = "reales") String datos, @RequestParam(defaultValue = ";") String sep) {
    return Exportacion.limpio(titulados(datos), Titulado.class, CAT_T, MULTI_T, separador(sep));
  }

  @GetMapping(value = "/export/empleadores.csv", produces = "text/csv; charset=UTF-8")
  public String csvE(@RequestParam(defaultValue = "reales") String datos, @RequestParam(defaultValue = ";") String sep) {
    return Exportacion.limpio(empleadores(datos), Empleador.class, CAT_E, MULTI_E, separador(sep));
  }

  /** Copia fiel de lo guardado en la base de datos (trazabilidad). */
  @GetMapping(value = "/export/titulados_crudo.csv", produces = "text/csv; charset=UTF-8")
  public String csvTCrudo(@RequestParam(defaultValue = "reales") String datos, @RequestParam(defaultValue = ";") String sep) {
    return Exportacion.crudo(titulados(datos), Titulado.class, separador(sep));
  }

  @GetMapping(value = "/export/empleadores_crudo.csv", produces = "text/csv; charset=UTF-8")
  public String csvECrudo(@RequestParam(defaultValue = "reales") String datos, @RequestParam(defaultValue = ";") String sep) {
    return Exportacion.crudo(empleadores(datos), Empleador.class, separador(sep));
  }

  /** Prueba de uniformidad (Chi-cuadrado) de cada pregunta de opción única. */
  @GetMapping(value = "/export/uniformidad.csv", produces = "text/csv; charset=UTF-8")
  public String csvUniformidad(@RequestParam(defaultValue = "reales") String datos, @RequestParam(defaultValue = ";") String sep) {
    List<Titulado> ts = titulados(datos);
    List<Empleador> es = empleadores(datos);
    Map<String, Dist> dt = new LinkedHashMap<>(), de = new LinkedHashMap<>();
    for (String c : CAT_T) {
      if (Opciones.TITULADOS.containsKey(c)) dt.put(c, Estadistica.dist(ts, t -> (String) Exportacion.valor(t, c), false, c, Opciones.TITULADOS.get(c)));
    }
    for (String c : CAT_E) {
      if (Opciones.EMPLEADORES.containsKey(c)) de.put(c, Estadistica.dist(es, e -> (String) Exportacion.valor(e, c), false, c, Opciones.EMPLEADORES.get(c)));
    }
    return Exportacion.uniformidad(dt, de, separador(sep));
  }

  /** Significado de cada variable y limpieza que recibe. */
  @GetMapping(value = "/export/diccionario.csv", produces = "text/csv; charset=UTF-8")
  public String csvDiccionario(@RequestParam(defaultValue = ";") String sep) {
    return Exportacion.diccionario(separador(sep));
  }

  /** Matriz de frecuencia cruzada con porcentajes, esperados, residuos y prueba χ². id: ver CRUCES. */
  @GetMapping(value = "/export/cruce/{id}.csv", produces = "text/csv; charset=UTF-8")
  public String csvCruce(@PathVariable String id, @RequestParam(defaultValue = "reales") String datos,
      @RequestParam(defaultValue = ";") String sep) {
    Def c = CRUCES.stream().filter(x -> x.id().equals(id)).findFirst()
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cruce desconocido: " + id));
    return Exportacion.cruce(
        Estadistica.cruce(c.id(), c.titulo(), c.filas(), c.cols(), titulados(datos), c.f(), c.c(), c.ordF(), c.ordC()),
        separador(sep));
  }

  // =====================================================================
  // 7. DATOS DE DEMOSTRACIÓN (FICTICIOS)
  // =====================================================================

  /** Elige al azar una de las opciones indicadas. */
  static String pk(Random r, String... o) {
    return o[r.nextInt(o.length)];
  }

  /** Valor Likert aleatorio cercano a "b": b-1, b o b+1, limitado al rango 1..mx. */
  static int lv(Random r, int b, int mx) {
    return Math.max(1, Math.min(mx, b + r.nextInt(3) - 1));
  }

  static final String TRAB = "Actualmente me encuentro trabajando en una organización";

  /** Cantidad de registros ficticios que genera la demostración. */
  static final int DEMO_TITULADOS = 150;

  /**
   * Organización ficticia de la demostración: nombre, si es pública, rubro (posición en la lista de titulados y en la
   * de empleadores), tamaño (0 grande ... 3 micro), departamento y peso con que los titulados la eligen como lugar
   * de trabajo (peso 0 = solo aparece como empleador). Todos los nombres son inventados.
   */
  private record Org(String nombre, boolean publica, int rubroT, int rubroE, int tamano, String depto, int peso) {}

  private static final List<Org> ORGS = List.of(
      new Org("Andes Telecom S.A.", false, 0, 2, 0, "COCHABAMBA", 8),
      new Org("Cooperativa Telefónica del Valle", false, 0, 2, 1, "COCHABAMBA", 5),
      new Org("Universidad Pública Demo", true, 1, 7, 0, "COCHABAMBA", 8),
      new Org("Instituto Técnico Cochabamba Demo", false, 1, 7, 2, "COCHABAMBA", 4),
      new Org("Soluciones Andinas S.R.L.", false, 2, 0, 2, "COCHABAMBA", 10),
      new Org("Cóndor Software", false, 2, 0, 1, "LA PAZ", 6),
      new Org("Tarija Digital", false, 2, 13, 3, "TARIJA", 3),
      new Org("Valle Sistemas Ltda.", false, 2, 1, 1, "COCHABAMBA", 7),
      new Org("Redes del Sur Ltda.", false, 3, 2, 1, "COCHABAMBA", 5),
      new Org("Hospital Regional Demo", true, 4, 10, 0, "COCHABAMBA", 4),
      new Org("Clínica Santa Cruz Demo", false, 4, 10, 1, "SANTA CRUZ", 3),
      new Org("Banco Andino Demo", false, 5, 5, 0, "LA PAZ", 7),
      new Org("Banco del Estado Demo", true, 5, 5, 0, "COCHABAMBA", 6),
      new Org("Cooperativa Financiera Demo", false, 5, 5, 1, "COCHABAMBA", 4),
      new Org("Consultora Altiplano", false, 2, 4, 3, "LA PAZ", 3),
      new Org("Gobernación Demo", true, -1, 6, 0, "COCHABAMBA", 0),
      new Org("Alcaldía Demo", true, -1, 6, 0, "COCHABAMBA", 0),
      new Org("Servicio de Impuestos Demo", true, -1, 6, 0, "LA PAZ", 0),
      new Org("Industrias del Valle Demo", false, -1, 8, 0, "COCHABAMBA", 0),
      new Org("Comercial Digital Demo", false, -1, 9, 1, "SANTA CRUZ", 0),
      new Org("Seguridad Informática Demo", false, -1, 11, 2, "COCHABAMBA", 0),
      new Org("Analítica Andina Demo", false, -1, 12, 2, "COCHABAMBA", 0),
      new Org("Soporte Total Demo", false, -1, 3, 2, "COCHABAMBA", 0),
      new Org("Startup Wayra Demo", false, -1, 13, 3, "COCHABAMBA", 0));

  /** Índice elegido al azar según pesos relativos (un peso 0 nunca sale). */
  private static int pesos(Random r, double... w) {
    double total = 0;
    for (double x : w) total += x;
    double u = r.nextDouble() * total;
    for (int i = 0; i < w.length; i++) {
      u -= w[i];
      if (u < 0) return i;
    }
    int ultimo = w.length - 1; // solo por redondeo: el último con peso mayor que 0
    while (ultimo > 0 && w[ultimo] <= 0) ultimo--;
    return ultimo;
  }

  /** Valor de una escala Likert (1 a mx) a partir de un número continuo. */
  private static int escala(double x, int mx) {
    return (int) Math.max(1, Math.min(mx, Math.round(x)));
  }

  /** Elige n opciones distintas, con más probabilidad las de mayor peso; las devuelve unidas por "|". */
  private static String elige(Random r, String[] op, int n, double... w) {
    List<Integer> libres = new ArrayList<>();
    for (int i = 0; i < op.length; i++) libres.add(i);
    List<String> sel = new ArrayList<>();
    for (int k = 0; k < n && !libres.isEmpty(); k++) {
      double total = 0;
      for (int i : libres) total += w[i];
      double u = r.nextDouble() * total;
      int pick = libres.get(libres.size() - 1);
      for (int i : libres) {
        u -= w[i];
        if (u < 0) { pick = i; break; }
      }
      libres.remove(Integer.valueOf(pick));
      sel.add(op[pick]);
    }
    return String.join("|", sel);
  }

  /**
   * Crea {@value #DEMO_TITULADOS} titulados y un empleador por cada organización ficticia (marcados con demo = true)
   * para probar el panel. NO deben usarse como datos de campo.
   *
   * Las respuestas no son independientes entre sí, para que los gráficos y las pruebas tengan sentido: la edad crece con
   * los años de vida profesional, quien trabaja tiene empresa, rubro, sector y departamento coherentes entre sí, el cargo y
   * el sueldo suben con la experiencia, quien estudió una maestría suele tener más becas, y las valoraciones (Likert) de cada
   * persona parten de una opinión propia. Se vuelve a generar siempre igual (semilla fija) y reemplaza la demostración anterior.
   */
  @PostMapping("/seed")
  public String seed() {
    reset(); // evita duplicar la demostración si se pulsa dos veces
    Random r = new Random(7);
    Map<String, String[]> T = Opciones.TITULADOS, E = Opciones.EMPLEADORES;
    double[] pesoOrg = ORGS.stream().mapToDouble(Org::peso).toArray();

    // ---- Titulados ficticios ----
    for (int i = 0; i < DEMO_TITULADOS; i++) {
      Titulado t = new Titulado();
      t.demo = true;

      // Perfil: años de vida profesional (la mayoría son juniors) y edad coherente con ellos.
      int a = (int) Math.min(22, Math.round(-Math.log(1 - r.nextDouble()) * 5.5));
      t.aniosProfesionales = (double) a;
      int edad = 23 + a + r.nextInt(4);
      t.edad = T.get("edad")[edad <= 26 ? 2 : edad <= 30 ? 3 : edad <= 34 ? 4 : 5];
      t.genero = r.nextDouble() < 0.7 ? "Hombre" : "Mujer";
      double animo = 3.0 + 0.6 * r.nextGaussian(); // opinión general de esta persona sobre la Carrera

      // Situación laboral: con más años es más probable que trabaje en una organización.
      boolean trabaja = r.nextDouble() < Math.min(0.92, 0.55 + 0.03 * a);
      boolean emprende = !trabaja && r.nextDouble() < 0.35;
      t.situacion = trabaja ? TRAB : T.get("situacion")[emprende ? 2 : 1];
      int desempleo = trabaja ? pesos(r, 70, 20, 10) : 1 + pesos(r, 50, 30, 20);
      t.aniosDesempleado = (double) Math.min(a, desempleo);

      // Ruta: formación complementaria. Con más años es más probable; la maestría se beca más que el diplomado.
      boolean formacion = r.nextDouble() < Math.min(0.75, 0.15 + 0.04 * a);
      t.formacion = formacion ? "SI" : "NO";
      if (formacion) {
        int nivel = pesos(r, 55, 15, 27, 3);
        t.nivelPosgrado = T.get("nivelPosgrado")[nivel];
        t.financiamiento = T.get("financiamiento")[nivel >= 2 ? pesos(r, 35, 40, 25) : pesos(r, 70, 10, 20)];
        t.dondeCurso = T.get("dondeCurso")[pesos(r, 30, 20, 5, 8, 12, 25, 0)];
        t.nombrePrograma = "Programa de posgrado (demo)";
      }

      // Ruta: trabajo actual (la organización define rubro, sector y departamento).
      Org org = null;
      if (trabaja) {
        org = ORGS.get(pesos(r, pesoOrg));
        t.empresa = org.nombre();
        t.rubro = T.get("rubro")[org.rubroT()];
        t.sector = org.publica() ? "PÚBLICO" : "PRIVADO";
        t.departamento = org.depto();
        t.areaOrg = T.get("areaOrg")[org.rubroT() == 2 ? pesos(r, 0, 0, 30, 70) : pesos(r, 0, 20, 60, 20)];
        double[] wc = a <= 3 ? new double[] {0, 35, 30, 35} : a <= 8 ? new double[] {15, 35, 40, 10} : new double[] {45, 25, 25, 5};
        if (t.areaOrg.equals("Desarrollo")) wc[2] *= 1.8;
        int cargo = pesos(r, wc);
        t.cargo = T.get("cargo")[cargo];
        int tope = a < 1 ? 0 : a < 2 ? 1 : a < 5 ? 2 : a < 8 ? 3 : a < 11 ? 4 : a < 15 ? 5 : a < 20 ? 6 : 7;
        t.antiguedad = T.get("antiguedad")[Math.max(0, tope - (int) (-Math.log(1 - r.nextDouble()) * 1.2))];
        t.medio = T.get("medio")[org.publica() ? pesos(r, 5, 15, 65, 15, 0) : pesos(r, 5, 40, 20, 35, 0)];
        double puntos = 0.8 + 0.3 * a + (cargo == 0 ? 1.8 : 0) + (org.rubroT() == 5 && !org.publica() ? 0.6 : 0) + 0.7 * r.nextGaussian();
        t.remuneracion = T.get("remuneracion")[(int) Math.max(0, Math.min(5, Math.round(puntos)))];
        t.primerEmpleo = r.nextDouble() < (a <= 3 ? 0.7 : 0.12) ? "SI" : "NO";
        t.pertinencia = escala(animo - 0.1 + 0.5 * r.nextGaussian(), 4);
      }

      // Ruta: interés en posgrado. Quien no trabaja se interesa más; cada área depende de la experiencia y del sector.
      double pInteres = (trabaja ? 0.65 : emprende ? 0.45 : 0.85) - (formacion ? 0.1 : 0);
      boolean interes = r.nextDouble() < pInteres;
      t.interes = interes ? "SI" : "NO";
      if (interes) {
        double[] wa = {28, 8, 30, 18, 16}; // IA, Robótica, Ing. de Software, Base de Datos, Redes y Seguridad
        if (a > 3) { wa[0] *= 0.7; wa[1] *= 0.5; wa[3] *= 1.3; wa[4] *= 1.2; }
        if (org != null && org.publica()) { wa[0] *= 0.6; wa[3] *= 1.4; wa[4] *= 1.5; }
        t.area = T.get("area")[pesos(r, wa)];
        t.orgPosgrado = T.get("orgPosgrado")[pesos(r, 35, 25, 5, 15, 12, 8, 0)];
      }

      // Trayectoria y valoración de la formación.
      int empleos = escala(1 + a / 5.0 + 0.7 * r.nextGaussian(), 4);
      if ("SI".equals(t.primerEmpleo)) empleos = 1;
      t.numEmpleos = T.get("numEmpleos")[empleos - 1];
      t.tiempoPrimerTrabajo = T.get("tiempoPrimerTrabajo")[pesos(r, 25, 15, 25, 15, 10, 10)];
      t.opinionPosgrado = escala(3.0 + 0.7 * r.nextGaussian(), 4);
      t.satisfaccion = escala(animo + 0.4 * r.nextGaussian(), 4);
      t.concordancia = escala(animo - 0.2 + 0.5 * r.nextGaussian(), 4);
      t.redContactos = r.nextDouble() < 0.65 ? "SI" : "NO";

      // Preguntas de elección múltiple, con opciones más y menos populares.
      t.utiles = elige(r, T.get("utiles"), 2 + r.nextInt(2), 30, 10, 5, 30, 12, 13);
      t.mejorar = elige(r, T.get("mejorar"), 2 + r.nextInt(2), 22, 28, 8, 22, 8, 12);
      t.ventaja = elige(r, T.get("ventaja"), 5, 4, 22, 14, 14, 6, 12, 6, 16, 6);
      t.pocoUtiles = elige(r, T.get("pocoUtiles"), 5, 10, 18, 14, 16, 8, 8, 6, 8, 8, 6, 12);
      tr.save(t);
    }

    // ---- Empleadores ficticios: uno por organización ----
    // Cada empleador tiene una opinión propia; las afirmaciones de participación y consulta reciben menos acuerdo.
    double[] ajuste = {0.2, 0.2, -0.5, -0.3, 0, 0.1, -0.5, 0.3, 0.4, -0.5, 0.1, -0.4, -0.5, -0.4, -0.4, -0.4, 0, -0.6};
    String[] emergentes = {"Nube, IA, DevOps", "Ciberseguridad, datos", "Automatización, IoT", "Analítica de datos, IA", "Desarrollo móvil, nube"};
    String[] herramientas = {"Git, Docker, plataformas cloud", "SQL, Power BI, Python", "Java, Spring, PostgreSQL", "Redes, Linux, virtualización"};
    String[] competencias = {"Comunicación, trabajo en equipo, aprendizaje continuo", "Resolución de problemas, ética, responsabilidad", "Liderazgo, adaptación al cambio, inglés técnico"};
    for (Org org : ORGS) {
      Empleador e = new Empleador();
      e.demo = true;
      e.empresa = org.nombre();
      e.tipo = E.get("tipo")[org.publica() ? 0 : 1];
      e.tamano = E.get("tamano")[org.tamano()];
      e.rubro = E.get("rubro")[org.rubroE()];
      double pContrato = switch (org.tamano()) { case 0 -> 0.9; case 1 -> 0.7; case 2 -> 0.5; default -> 0.3; };
      boolean contrata = r.nextDouble() < pContrato;
      e.contrato = contrata ? "SI" : "No";
      e.proyeccion = E.get("proyeccion")[contrata ? pesos(r, 40, 45, 15, 0) : pesos(r, 0, 25, 55, 20)];
      e.nivelFormacion = E.get("nivelFormacion")[pesos(r, 60, 15, 5, 18, 2, 0)];
      e.medio = E.get("medio")[org.publica() ? pesos(r, 5, 10, 65, 5, 15, 0) : pesos(r, 10, 40, 10, 10, 30, 0)];
      e.cargos = elige(r, E.get("cargos"), 1 + r.nextInt(3), 15, 30, 28, 10, 10, 5, 2);
      e.areasEmergentes = emergentes[r.nextInt(emergentes.length)];
      e.herramientas = herramientas[r.nextInt(herramientas.length)];
      e.competencias = competencias[r.nextInt(competencias.length)];

      double opinion = 2.35 + 0.35 * r.nextGaussian() - (org.publica() ? 0.1 : 0);
      for (int k = 0; k < AFIRM.length; k++) {
        int valor = escala(opinion + ajuste[k] + 0.45 * r.nextGaussian(), 3);
        if (r.nextDouble() < (ajuste[k] < -0.3 ? 0.08 : 0.03)) valor = 0; // «No sabe»
        try {
          Empleador.class.getField(AFIRM[k]).set(e, valor);
        } catch (Exception x) {
          throw new IllegalStateException(x);
        }
      }
      er.save(e);
    }
    return "OK";
  }

  /** Borra solo los registros de demostración; las respuestas reales no se tocan. */
  @DeleteMapping("/reset")
  public String reset() {
    tr.deleteAll(tr.findAll().stream().filter(t -> t.demo).toList());
    er.deleteAll(er.findAll().stream().filter(e -> e.demo).toList());
    return "OK";
  }
}
