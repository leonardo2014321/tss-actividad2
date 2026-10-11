package arcusur;

import jakarta.validation.Valid;
import java.lang.reflect.Field;
import java.util.*;
import java.util.function.Function;
import java.util.stream.*;
import org.apache.commons.math3.distribution.BinomialDistribution;
import org.apache.commons.math3.random.JDKRandomGenerator;
import org.apache.commons.math3.stat.descriptive.DescriptiveStatistics;
import org.apache.commons.math3.stat.inference.ChiSquareTest;
import org.springframework.web.bind.annotation.*;

/**
 * API REST de la aplicación. Todas las rutas empiezan con /api.
 *
 *  - POST /api/titulados y /api/empleadores : guardan una respuesta de encuesta.
 *  - GET  /api/stats                        : estadísticas para el panel de análisis.
 *  - POST /api/simulacion                   : simulación Monte Carlo de inscritos a un posgrado.
 *  - GET  /api/export/*.csv                 : exportación de datos (se abre en Excel).
 *  - POST /api/seed y DELETE /api/reset     : datos de demostración (ficticios).
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
  // 2. FUNCIONES AUXILIARES DE ESTADÍSTICA
  // =====================================================================

  /** Redondea a 2 decimales; un valor no numérico (NaN) se devuelve como 0. */
  static double r(double v) {
    return Double.isNaN(v) ? 0 : Math.round(v * 100) / 100.0;
  }

  /** Tabla de frecuencias de una pregunta de opción única: opción -> cantidad de respuestas. */
  static <T> Map<String, Long> freq(List<T> l, Function<T, String> f) {
    return l.stream().map(f)
        .filter(x -> x != null && !x.isBlank())
        .collect(Collectors.groupingBy(x -> x, TreeMap::new, Collectors.counting()));
  }

  /**
   * Tabla de frecuencias de una pregunta de elección múltiple.
   * Las opciones de una misma respuesta vienen unidas con "|", así que se separan y se cuentan una a una.
   * Los textos libres ("Otra: ...") se agrupan bajo la etiqueta "Otra".
   */
  static <T> Map<String, Long> fm(List<T> l, Function<T, String> f) {
    return l.stream().map(f).filter(Objects::nonNull)
        .flatMap(s -> Arrays.stream(s.split("\\|")))
        .map(String::trim)
        .filter(x -> !x.isEmpty())
        .map(x -> x.startsWith("Otra") ? "Otra" : x)
        .collect(Collectors.groupingBy(x -> x, TreeMap::new, Collectors.counting()));
  }

  /** Media y desviación estándar de una serie de valores Likert. */
  static Map<String, Double> lk(double[] v) {
    DescriptiveStatistics d = new DescriptiveStatistics(v);
    return Map.of("media", r(d.getMean()), "sd", r(d.getStandardDeviation()));
  }

  /** Extrae una columna numérica (Integer) de la lista de titulados, ignorando los valores vacíos. */
  static double[] arr(List<Titulado> l, Function<Titulado, Integer> f) {
    return l.stream().map(f).filter(Objects::nonNull).mapToDouble(Integer::doubleValue).toArray();
  }

  // ---- Afirmaciones de la encuesta de empleadores ----

  /** Nombres de los 18 campos de afirmaciones: fp1..fp10 (formación y perfil) y vc1..vc8 (vinculación). */
  static final String[] AFIRM = {
    "fp1", "fp2", "fp3", "fp4", "fp5", "fp6", "fp7", "fp8", "fp9", "fp10",
    "vc1", "vc2", "vc3", "vc4", "vc5", "vc6", "vc7", "vc8"
  };

  /** Lee por nombre un campo Integer de un empleador (por reflexión). Sirve para recorrer AFIRM en un bucle. */
  static Integer ig(Empleador e, String n) {
    try {
      return (Integer) Empleador.class.getField(n).get(e);
    } catch (Exception x) {
      throw new IllegalStateException(x);
    }
  }

  /**
   * Resumen de una afirmación de empleadores (escala 1 a 3).
   * El valor 0 significa "No sabe": se cuenta aparte y NO entra en la media ni en la desviación.
   * Devuelve: media, sd, n (respuestas válidas) y noSabe (cantidad de "No sabe").
   */
  static Map<String, Object> lkE(List<Empleador> es, String n) {
    List<Integer> vs = es.stream().map(e -> ig(e, n)).filter(Objects::nonNull).toList();
    double[] v = vs.stream().filter(x -> x > 0).mapToDouble(Integer::doubleValue).toArray();
    DescriptiveStatistics d = new DescriptiveStatistics(v);
    Map<String, Object> o = new LinkedHashMap<>();
    o.put("media", r(d.getMean()));
    o.put("sd", r(d.getStandardDeviation()));
    o.put("n", v.length);
    o.put("noSabe", vs.stream().filter(x -> x == 0).count());
    return o;
  }

  /**
   * Tabla de contingencia entre dos variables categóricas de titulados y prueba Chi-cuadrado de independencia.
   * Devuelve filas, columnas, matriz de conteos y, si la muestra alcanza, chi2, p y grados de libertad (gl).
   */
  static Map<String, Object> cruce(List<Titulado> ts, Function<Titulado, String> f, Function<Titulado, String> c) {
    List<String> fs = ts.stream().map(f).distinct().sorted().toList();
    List<String> cs = ts.stream().map(c).distinct().sorted().toList();

    // Se cuenta cuántos titulados caen en cada combinación fila x columna.
    long[][] mat = new long[fs.size()][cs.size()];
    for (Titulado t : ts) {
      mat[fs.indexOf(f.apply(t))][cs.indexOf(c.apply(t))]++;
    }

    Map<String, Object> o = new LinkedHashMap<>();
    o.put("filas", fs);
    o.put("columnas", cs);
    o.put("matriz", mat);

    // La prueba necesita al menos 2 categorías en cada variable.
    if (fs.size() > 1 && cs.size() > 1) {
      try {
        ChiSquareTest x = new ChiSquareTest();
        o.put("chi2", r(x.chiSquare(mat)));
        o.put("p", Math.round(x.chiSquareTest(mat) * 10000) / 10000.0);
        o.put("gl", (fs.size() - 1) * (cs.size() - 1));
      } catch (Exception e) {
        o.put("aviso", "Muestra insuficiente para calcular χ².");
      }
    } else {
      o.put("aviso", "Se necesitan al menos 2 categorías en cada variable.");
    }
    return o;
  }

  // =====================================================================
  // 3. ESTADÍSTICAS PARA EL PANEL
  // =====================================================================

  /** Calcula todas las estadísticas que muestra el panel de análisis (dashboard.html). */
  @GetMapping("/stats")
  public Map<String, Object> stats() {
    List<Titulado> ts = tr.findAll();
    List<Empleador> es = er.findAll();
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("nTitulados", ts.size());
    m.put("nEmpleadores", es.size());

    // ---- Titulados ----
    if (!ts.isEmpty()) {
      // Antigüedad profesional: media, mediana y desviación estándar.
      DescriptiveStatistics d = new DescriptiveStatistics(ts.stream().mapToDouble(t -> t.aniosProfesionales).toArray());
      m.put("anios", Map.of("media", r(d.getMean()), "mediana", r(d.getPercentile(50)), "sd", r(d.getStandardDeviation())));

      // Segmentación: junior (hasta 3 años) frente a consolidado (más de 3 años).
      m.put("junior", ts.stream().filter(t -> t.aniosProfesionales <= 3).count());
      m.put("consolidado", ts.stream().filter(t -> t.aniosProfesionales > 3).count());

      // Proporción de titulados interesados en un posgrado (0 a 1).
      m.put("pctInteres", r(ts.stream().filter(t -> "SI".equals(t.interes)).count() * 1.0 / ts.size()));

      // Distribuciones de frecuencia de preguntas de opción única.
      m.put("situacion", freq(ts, t -> t.situacion));
      m.put("area", freq(ts, t -> t.area));
      m.put("nivelPosgrado", freq(ts, t -> t.nivelPosgrado));
      m.put("financiamiento", freq(ts, t -> t.financiamiento));
      m.put("sector", freq(ts, t -> t.sector));
      m.put("departamento", freq(ts, t -> t.departamento));
      m.put("remuneracion", freq(ts, t -> t.remuneracion));
      m.put("tiempoPrimerTrabajo", freq(ts, t -> t.tiempoPrimerTrabajo));

      // Preguntas de elección múltiple.
      m.put("utiles", fm(ts, t -> t.utiles));
      m.put("mejorar", fm(ts, t -> t.mejorar));
      m.put("ventaja", fm(ts, t -> t.ventaja));
      m.put("pocoUtiles", fm(ts, t -> t.pocoUtiles));

      // Escalas Likert (1 a 4): media y desviación estándar.
      Map<String, Object> lt = new LinkedHashMap<>();
      lt.put("Posgrado FCyT afín", lk(arr(ts, t -> t.opinionPosgrado)));
      if (arr(ts, t -> t.pertinencia).length > 0) {
        lt.put("Trabajo pertinente", lk(arr(ts, t -> t.pertinencia)));
      }
      lt.put("Satisfacción", lk(arr(ts, t -> t.satisfaccion)));
      lt.put("Concordancia", lk(arr(ts, t -> t.concordancia)));
      m.put("likertT", lt);

      // Financiamiento x nivel de posgrado (mapa de calor + Chi-cuadrado).
      m.put("cruce", cruce(
          ts.stream().filter(t -> t.financiamiento != null && t.nivelPosgrado != null).toList(),
          t -> t.financiamiento,
          t -> t.nivelPosgrado));
    }

    // ---- Empleadores ----
    if (!es.isEmpty()) {
      m.put("tamanoE", freq(es, e -> e.tamano));
      m.put("rubroE", freq(es, e -> e.rubro));
      m.put("contratoE", freq(es, e -> e.contrato));
      m.put("proyeccionE", freq(es, e -> e.proyeccion));
      m.put("nivelFormacionE", freq(es, e -> e.nivelFormacion));
      m.put("medioE", fm(es, e -> e.medio));
      m.put("cargosE", fm(es, e -> e.cargos));

      // Resumen de cada una de las 18 afirmaciones (media sin contar "No sabe").
      Map<String, Object> le = new LinkedHashMap<>();
      for (String n : AFIRM) {
        le.put(n, lkE(es, n));
      }
      m.put("likertE", le);
    }
    return m;
  }

  // =====================================================================
  // 4. SIMULACIÓN MONTE CARLO
  // =====================================================================

  /**
   * Simula cuántos titulados se inscribirían a un programa de posgrado.
   * Cada titulado potencial se inscribe con probabilidad q = probInteres x probInscribe,
   * así que los inscritos siguen una distribución binomial. Se repite el experimento
   * "iteraciones" veces y se reporta la media, el rango del 90 % (p5 a p95) y la
   * probabilidad de alcanzar el mínimo de inscritos para abrir el programa.
   * La semilla fija (42) hace que el resultado sea reproducible.
   */
  @PostMapping("/simulacion")
  public Map<String, Object> sim(@RequestBody Map<String, Double> p) {
    int n = Math.max(1, p.getOrDefault("poblacion", 300.0).intValue());
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
    return Map.of(
        "media", r(d.getMean()),
        "p5", r(d.getPercentile(5)),
        "p95", r(d.getPercentile(95)),
        "probApertura", r(ok * 1.0 / it));
  }

  // =====================================================================
  // 5. EXPORTACIÓN CSV
  // =====================================================================

  /** Encierra un valor entre comillas y duplica las comillas internas (formato CSV). */
  static String q(Object o) {
    return "\"" + String.valueOf(o).replace("\"", "\"\"") + "\"";
  }

  /**
   * Convierte una lista de entidades a CSV con una columna por cada campo público (por reflexión).
   * El carácter ﻿ (BOM) al inicio hace que Excel reconozca las tildes.
   */
  static String csv(List<?> l, Class<?> c) {
    Field[] fs = c.getFields();
    StringBuilder s = new StringBuilder("﻿" + Arrays.stream(fs).map(Field::getName).collect(Collectors.joining(",")) + "\n");
    for (Object o : l) {
      s.append(Arrays.stream(fs).map(f -> {
        try {
          Object v = f.get(o);
          return q(v == null ? "" : v);
        } catch (Exception e) {
          return "\"\"";
        }
      }).collect(Collectors.joining(","))).append("\n");
    }
    return s.toString();
  }

  @GetMapping(value = "/export/titulados.csv", produces = "text/csv; charset=UTF-8")
  public String csvT() {
    return csv(tr.findAll(), Titulado.class);
  }

  @GetMapping(value = "/export/empleadores.csv", produces = "text/csv; charset=UTF-8")
  public String csvE() {
    return csv(er.findAll(), Empleador.class);
  }

  // =====================================================================
  // 6. DATOS DE DEMOSTRACIÓN (FICTICIOS)
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
