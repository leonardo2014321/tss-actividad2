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

  /** Cruces que calcula el panel. El primero es el que pide la historia de usuario 3 (financiamiento × posgrado). */
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

    // ---- Muestra: tamaño, margen de error y respaldo de campo (empresas) ----
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
    mu.put("cumpleEmpresas", empresas.size() >= 3 && pub >= 1 && pri >= 1);
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
      d.put("edad", Estadistica.dist(ts, t -> t.edad, false, "edad"));
      d.put("genero", Estadistica.dist(ts, t -> t.genero, false, "genero"));
      d.put("situacion", Estadistica.dist(ts, t -> t.situacion, false, "situacion"));
      d.put("tiempoPrimerTrabajo", Estadistica.dist(ts, t -> t.tiempoPrimerTrabajo, false, "tiempoPrimerTrabajo"));
      d.put("numEmpleos", Estadistica.dist(ts, t -> t.numEmpleos, false, "numEmpleos"));
      d.put("nivelPosgrado", Estadistica.dist(ts, t -> t.nivelPosgrado, false, "nivelPosgrado"));
      d.put("financiamiento", Estadistica.dist(ts, t -> t.financiamiento, false, "financiamiento"));
      d.put("area", Estadistica.dist(ts, t -> t.area, false, "area"));
      d.put("orgPosgrado", Estadistica.dist(ts, t -> t.orgPosgrado, false, "orgPosgrado"));
      d.put("rubro", Estadistica.dist(ts, t -> t.rubro, false, "rubro"));
      d.put("sector", Estadistica.dist(ts, t -> t.sector, false, "sector"));
      d.put("departamento", Estadistica.dist(ts, t -> t.departamento, false, "departamento"));
      d.put("remuneracion", Estadistica.dist(ts, t -> t.remuneracion, false, "remuneracion"));
      d.put("utiles", Estadistica.dist(ts, t -> t.utiles, true, "utiles"));
      d.put("mejorar", Estadistica.dist(ts, t -> t.mejorar, true, "mejorar"));
      d.put("ventaja", Estadistica.dist(ts, t -> t.ventaja, true, "ventaja"));
      d.put("pocoUtiles", Estadistica.dist(ts, t -> t.pocoUtiles, true, "pocoUtiles"));
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
      d.put("tipo", Estadistica.dist(es, e -> e.tipo, false, "tipo"));
      d.put("tamano", Estadistica.dist(es, e -> e.tamano, false, "tamano"));
      d.put("rubro", Estadistica.dist(es, e -> e.rubro, false, "rubro"));
      d.put("contrato", Estadistica.dist(es, e -> e.contrato, false, "contrato"));
      d.put("proyeccion", Estadistica.dist(es, e -> e.proyeccion, false, "proyeccion"));
      d.put("nivelFormacion", Estadistica.dist(es, e -> e.nivelFormacion, false, "nivelFormacion"));
      d.put("medio", Estadistica.dist(es, e -> e.medio, false, "medio"));
      d.put("cargos", Estadistica.dist(es, e -> e.cargos, true, "cargos"));
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

  /**
   * Crea 60 titulados y 6 empleadores ficticios (marcados con demo = true)
   * para probar el panel. NO deben usarse como datos de campo.
   */
  @PostMapping("/seed")
  public String seed() {
    Random r = new Random(7); // semilla fija: siempre genera los mismos datos
    String[] U = {
      "La aplicación práctica de conceptos teóricos en proyectos reales.",
      "El desarrollo de habilidades analíticas y de resolución de problemas.",
      "La enseñanza de herramientas y software específico de la industria."};
    String[] M = {
      "Actualización constante del plan de estudios para atender tendencias actuales.",
      "Mayor relacionamiento del estudiante con las empresas por medio de práctica profesionales.",
      "Ofrecimiento de más opciones de especialización."};

    // ---- 60 titulados ficticios ----
    for (int i = 0; i < 60; i++) {
      Titulado t = new Titulado();
      t.demo = true;
      t.edad = pk(r, "19 a 22", "23 a 26", "27 a 30", "31 a 34", "35 años o más");
      t.genero = pk(r, "Hombre", "Hombre", "Mujer");
      t.aniosProfesionales = (double) r.nextInt(15);
      t.aniosDesempleado = Math.min(t.aniosProfesionales, (double) r.nextInt(2));

      // Ruta: formación complementaria.
      t.formacion = pk(r, "SI", "NO");
      if (t.formacion.equals("SI")) {
        t.nivelPosgrado = pk(r, "DIPLOMADO", "DIPLOMADO", "MAESTRIA", "ESPECIALIDAD");
        t.financiamiento = pk(r, "FINANCIADO CON RECURSOS PROPIOS", "FINANCIADO CON RECURSOS PROPIOS",
            "FINANCIADO PARCIALMENTE POR MEDIO DE UNA BECA", "TOTAL FINANCIAMIENTO POR MEDIO DE UNA BECA");
        t.dondeCurso = "UNIVERSIDADES PRIVADAS NACIONALES";
        t.nombrePrograma = "Programa demo";
      }

      // Ruta: interés en posgrado.
      t.interes = pk(r, "SI", "SI", "NO");
      if (t.interes.equals("SI")) {
        t.area = pk(r, "IA", "Robótica", "Ingeniería de Software", "Base de Datos", "Redes de Datos y Seguridad");
        t.orgPosgrado = pk(r, "ESCUELA UNIVERSITARIA DE POSGRADO (EUPG)", "DIRECCIÓN DE POSGRADO FCyT", "UNIVERSIDADES INTERNACIONALES");
      }
      t.opinionPosgrado = lv(r, 3, 4);

      // Ruta: situación laboral.
      t.situacion = pk(r, TRAB, TRAB, "Actualmente NO trabajo", "Actualmente dedico mi tiempo COMPLETO a un emprendimiento propio");
      if (t.situacion.equals(TRAB)) {
        t.empresa = "Empresa demo";
        t.rubro = pk(r, "Desarrollo de Software", "Banca", "Educación", "Telecomunicaciones");
        t.sector = pk(r, "PÚBLICO", "PRIVADO");
        t.departamento = "COCHABAMBA";
        t.areaOrg = pk(r, "Desarrollo", "Cómputo");
        t.cargo = pk(r, "Técnico", "Desarrollo", "Help Desk");
        t.pertinencia = lv(r, 3, 4);
        t.antiguedad = pk(r, "Menos de 1 año", "Entre 1 a 2 años", "Entre 2 a 5 años");
        t.medio = "INTERNET Y REDES SOCIALES";
        t.remuneracion = pk(r, "Entre Bs. 2.500 - Bs. 3.500", "Entre Bs. 3.501 - Bs. 5.000", "Entre Bs. 5.001 - Bs. 7.000");
        t.primerEmpleo = pk(r, "SI", "NO");
      }

      // Trayectoria, satisfacción y preguntas de elección múltiple.
      t.tiempoPrimerTrabajo = pk(r, "Menos de 1 mes", "Entre 1 - 4 meses", "Entre 4 - 8 meses");
      t.numEmpleos = pk(r, "1", "2", "3");
      t.satisfaccion = lv(r, 3, 4);
      t.concordancia = lv(r, 3, 4);
      t.utiles = U[0] + "|" + U[1 + r.nextInt(2)];
      t.mejorar = M[0] + "|" + M[1 + r.nextInt(2)];
      t.ventaja = "Base de Datos|Inteligencia Artificial|Redes de Computadora|Planificación de Proyectos y Gestión|Introducción";
      t.pocoUtiles = "Telefonía IP|Web Semánticas|Teoría de Grafos|Contabilidad Básica|Robótica";
      t.redContactos = pk(r, "SI", "NO");
      tr.save(t);
    }

    // ---- 6 empleadores ficticios ----
    // Valores posibles de las afirmaciones: 3 y 2 son más frecuentes; 0 = "No sabe".
    int[] esc = {3, 3, 3, 2, 2, 1, 0};
    for (int i = 1; i <= 6; i++) {
      Empleador e = new Empleador();
      e.demo = true;
      e.empresa = "Empresa demo " + i;
      e.tipo = pk(r, "Público", "Privado");
      e.tamano = pk(r, "Grande (100 funcionarios o más)", "Mediana (entre 31 a 99 funcionarios)", "Pequeña (entre 11 a 30 funcionarios)");
      e.rubro = pk(r, "Desarrollo de software", "Servicios de tecnologías de información (TI)",
          "Banca y servicios financieros", "Instituciones públicas / gobierno");
      e.contrato = pk(r, "SI", "SI", "No");
      e.proyeccion = pk(r, "Sí, existe una alta probabilidad de contratación",
          "Sí, dependiendo del crecimiento o nuevos proyectos de la organización",
          "No se tiene prevista la contratación actualmente");
      e.nivelFormacion = pk(r, "Licenciatura", "Diplomado", "Maestría");
      e.medio = pk(r, "Internet y Redes sociales", "Postulación competitiva (convocatorias públicas y privadas)", "Recomendación de terceros");
      e.cargos = pk(r, "Analista (sistemas, datos, procesos o soluciones tecnológicas)",
          "Técnico (desarrollo de software, administración de sistemas, redes, bases de datos, soporte TI)")
          + "|Supervisor / Coordinador de área tecnológica";
      e.areasEmergentes = "Nube, IA, DevOps";
      e.herramientas = "Git, Docker, plataformas cloud";
      e.competencias = "Comunicación, trabajo en equipo, aprendizaje continuo";

      // Asigna un valor aleatorio a cada una de las 18 afirmaciones (por reflexión).
      for (String n : AFIRM) {
        try {
          Empleador.class.getField(n).set(e, esc[r.nextInt(esc.length)]);
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
