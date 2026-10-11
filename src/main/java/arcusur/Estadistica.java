package arcusur;

import java.text.Normalizer;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.apache.commons.math3.distribution.ChiSquaredDistribution;
import org.apache.commons.math3.stat.descriptive.DescriptiveStatistics;

/**
 * Limpieza de datos (data wrangling) y estadística de la aplicación.
 * No depende de Spring: recibe listas y funciones, y devuelve resultados listos para convertir a JSON.
 *
 * Etapas del pipeline que implementa esta clase:
 *   1. LIMPIEZA     : unifica mayúsculas, tildes y espacios; agrupa las respuestas "Otro: ...".
 *   2. UNIVARIADA   : frecuencias absolutas y relativas, media, mediana, desviación, cuartiles, Likert.
 *   3. BIVARIADA    : tabla de contingencia, Chi-cuadrado, V de Cramér, frecuencias esperadas y residuos.
 */
public final class Estadistica {

  private Estadistica() {}

  // =====================================================================
  // 1. LIMPIEZA DE CATEGORÍAS
  // =====================================================================

  /** Siglas que deben quedar en mayúsculas al pasar un texto de TODO MAYÚSCULAS a minúsculas. */
  static final Map<String, String> SIGLAS = Map.of(
      "EUPG", "EUPG", "IBNORCA", "IBNORCA", "FCYT", "FCyT", "UMSS", "UMSS", "IA", "IA");

  /** Correcciones puntuales de ortografía o nombres propios (clave normalizada -> texto correcto). */
  static final Map<String, String> CORRECCIONES = Map.of(
      "la paz", "La Paz", "santa cruz", "Santa Cruz", "potosi", "Potosí",
      "maestria", "Maestría", "pos doctorado", "Posdoctorado",
      "post- doctorado", "Posdoctorado", "post doctorado", "Posdoctorado");

  /**
   * Orden natural de las variables ordinales (de menor a mayor). Las demás variables
   * se ordenan por frecuencia, de la más a la menos elegida.
   */
  static final Map<String, String[]> ORD = Map.of(
      "edad", new String[] {"15 a 18", "19 a 22", "23 a 26", "27 a 30", "31 a 34", "35 años o más"},
      "nivelPosgrado", new String[] {"Diplomado", "Especialidad", "Maestría", "Doctorado", "Posdoctorado"},
      "nivelFormacion", new String[] {"Licenciatura", "Diplomado", "Especialidad", "Maestría", "Doctorado", "Posdoctorado"},
      "antiguedad", new String[] {"Menos de 1 año", "Entre 1 a 2 años", "Entre 2 a 5 años", "Entre 5 a 8 años",
          "Entre 8 a 11 años", "Entre 11 a 15 años", "Entre 15 a 20 años", "Entre 20 a 25 años", "Más de 25 años"},
      "remuneracion", new String[] {"Menor a Bs. 2500", "Entre Bs. 2.500 - Bs. 3.500", "Entre Bs. 3.501 - Bs. 5.000",
          "Entre Bs. 5.001 - Bs. 7.000", "Entre Bs. 7.001 - Bs. 10.000", "Más de Bs. 10.000"},
      "tiempoPrimerTrabajo", new String[] {"Ya trabajaba antes de titularse", "Menos de 1 mes", "Entre 1 - 4 meses",
          "Entre 4 - 8 meses", "Entre 8 - 12 meses", "Más de 12 meses"},
      "numEmpleos", new String[] {"1", "2", "3", "Más de 3"},
      "tamano", new String[] {"Micro (hasta 10 funcionarios)", "Pequeña (entre 11 a 30 funcionarios)",
          "Mediana (entre 31 a 99 funcionarios)", "Grande (100 funcionarios o más)"});

  /** Redondea a 2 decimales; un valor no numérico (NaN o infinito) se devuelve como 0. */
  static double r(double v) {
    return Double.isNaN(v) || Double.isInfinite(v) ? 0 : Math.round(v * 100) / 100.0;
  }

  /** Redondea a 1 decimal (porcentajes). */
  static double r1(double v) {
    return Double.isNaN(v) || Double.isInfinite(v) ? 0 : Math.round(v * 10) / 10.0;
  }

  /** Clave de comparación: sin tildes, en minúsculas, espacios simples y sin puntuación final. */
  static String clave(String s) {
    String t = Normalizer.normalize(s.trim(), Normalizer.Form.NFD)
        .replaceAll("\\p{M}", "")
        .toLowerCase(Locale.ROOT)
        .replaceAll("\\s+", " ");
    return t.replaceAll("[\\s.:;,]+$", "");
  }

  private static String cap(String p) {
    return p.isEmpty() ? p : Character.toUpperCase(p.charAt(0)) + p.substring(1);
  }

  /**
   * Pasa un texto escrito TODO EN MAYÚSCULAS a formato de oración (los textos mixtos no se tocan),
   * conservando siglas y abreviaturas. También unifica SI/NO como "Sí"/"No".
   */
  static String bonito(String s) {
    String t = s.trim().replaceAll("\\s+", " ");
    if (t.equalsIgnoreCase("si")) return "Sí";
    if (t.equalsIgnoreCase("no")) return "No";
    boolean soloMayusculas = t.equals(t.toUpperCase(Locale.ROOT)) && !t.equals(t.toLowerCase(Locale.ROOT));
    if (!soloMayusculas) return cap(t); // inicial en mayúscula: "privado" y "Privado" quedan iguales
    String[] pal = t.split(" ");
    StringBuilder b = new StringBuilder();
    for (int i = 0; i < pal.length; i++) {
      String p = pal[i];
      String letras = p.replaceAll("[^\\p{L}]", "");
      String sigla = SIGLAS.get(letras);
      if (i > 0) b.append(' ');
      if (sigla != null) b.append(p.replace(letras, sigla));
      else if (p.contains(".")) b.append(p); // T.I.S., R.R.H.H.
      else b.append(i == 0 ? cap(p.toLowerCase(Locale.ROOT)) : p.toLowerCase(Locale.ROOT));
    }
    return b.toString();
  }

  /** Etiqueta limpia de una respuesta de opción única. "OTRO RUBRO: Agroindustria" -> "Otro (especificado)". */
  static String etiqueta(String raw) {
    String t = raw.trim().replaceAll("\\s+", " ");
    if (t.matches("(?is)^otr[oa@s]?[^:]{0,25}:.+")) return "Otro (especificado)";
    String corregido = CORRECCIONES.get(clave(t));
    return corregido != null ? corregido : bonito(t);
  }

  /** Etiqueta limpia de una opción tal como la ofrece la encuesta ("OTRO RUBRO:" sin texto -> "Otro (especificado)"). */
  static String etiquetaOpcion(String raw) {
    String t = raw.trim().replaceAll("\\s+", " ");
    if (t.matches("(?is)^otr[oa@s]?[^:]{0,25}:\\s*$")) return "Otro (especificado)";
    return etiqueta(t);
  }

  /** Separa una respuesta de elección múltiple ("a|b|Otra: texto") en sus opciones. El texto de "Otra" va al final. */
  static List<String> partes(String s) {
    String base = s, otra = null;
    int j = s.indexOf("|Otra:");
    if (s.startsWith("Otra:")) {
      base = "";
      otra = s;
    } else if (j >= 0) {
      base = s.substring(0, j);
      otra = s.substring(j + 1);
    }
    List<String> l = new ArrayList<>();
    for (String p : base.split("\\|")) {
      if (!p.isBlank()) l.add(p.trim());
    }
    if (otra != null) l.add(otra.trim());
    return l;
  }

  /** Etiqueta limpia de una opción de elección múltiple. */
  static String etiquetaMulti(String p) {
    if (p.matches("(?is)^otra:.*")) return "Otra (especificada)";
    return etiqueta(p);
  }

  /** Texto escrito en "Otra: ..." (cadena vacía si no hay). */
  static String textoOtra(String s) {
    if (s == null) return "";
    for (String p : partes(s)) {
      if (p.matches("(?is)^otra:.*")) return p.substring(p.indexOf(':') + 1).trim();
    }
    return "";
  }

  /** Texto escrito junto a una opción "Otro: ..." de opción única (cadena vacía si no hay). */
  static String textoOtro(String s) {
    if (s == null || !s.trim().matches("(?is)^otr[oa@s]?[^:]{0,25}:.+")) return "";
    return s.substring(s.indexOf(':') + 1).trim();
  }

  /**
   * Para un conjunto de etiquetas de la misma pregunta, devuelve clave -> etiqueta a mostrar.
   * Si una misma respuesta llegó escrita de varias formas, se elige la más frecuente.
   */
  static Map<String, String> canon(Collection<String> etiquetas) {
    Map<String, Map<String, Long>> variantes = new LinkedHashMap<>();
    for (String e : etiquetas) {
      variantes.computeIfAbsent(clave(e), k -> new TreeMap<>()).merge(e, 1L, Long::sum);
    }
    Map<String, String> m = new LinkedHashMap<>();
    variantes.forEach((k, v) -> m.put(k, v.entrySet().stream()
        .max(Map.Entry.<String, Long>comparingByValue().thenComparing(Map.Entry.comparingByKey()))
        .get().getKey()));
    return m;
  }

  // =====================================================================
  // 2. UNIVARIADA: FRECUENCIAS, DESCRIPTIVOS Y LIKERT
  // =====================================================================

  /** Una opción con su frecuencia absoluta (n), relativa (pct) y acumulada (acum), en %. */
  public record Fila(String opcion, long n, double pct, double acum) {}

  /**
   * Prueba de uniformidad (Chi-cuadrado de bondad de ajuste): ¿las respuestas se reparten por igual entre las categorías?
   * H0: todas las categorías son igualmente probables. fe = n / k es la frecuencia esperada de cada una.
   * chi2 = suma de (FO - FE)² / FE, con gl = k - 1. Si chi2 < critico (alfa = 5 %), hay uniformidad.
   * confiable = false cuando fe < 5 (con tan pocas respuestas por categoría la prueba no es fiable).
   */
  public record Unif(int k, long n, double fe, double chi2, int gl, double critico, double p, boolean uniforme, boolean confiable) {}

  /**
   * Distribución de una pregunta. total = personas que la respondieron; multiple = admite varias opciones;
   * unif = prueba de uniformidad (solo en preguntas de opción única; null en las demás).
   */
  public record Dist(long total, boolean multiple, List<Fila> filas, Unif unif) {}

  /** Prueba de uniformidad sobre las frecuencias observadas (alfa = 5 %). Devuelve null si no se puede calcular. */
  static Unif uniformidad(List<Fila> filas, long total) {
    int k = filas.size();
    if (k < 2 || total == 0) return null;
    double fe = total / (double) k, chi2 = 0;
    for (Fila f : filas) chi2 += Math.pow(f.n() - fe, 2) / fe;
    int gl = k - 1;
    ChiSquaredDistribution d = new ChiSquaredDistribution(gl);
    return new Unif(k, total, r(fe), r(chi2), gl, r(d.inverseCumulativeProbability(0.95)),
        Math.round((1 - d.cumulativeProbability(chi2)) * 1e6) / 1e6, chi2 < d.inverseCumulativeProbability(0.95), fe >= 5);
  }

  private static int pos(String[] orden, String etiqueta) {
    String k = clave(etiqueta);
    for (int i = 0; i < orden.length; i++) {
      if (clave(orden[i]).equals(k)) return i;
    }
    return 1000;
  }

  /**
   * Tabla de frecuencias de una pregunta. En las de elección múltiple el porcentaje se calcula sobre las
   * personas que respondieron (por eso la suma puede superar 100 %).
   * Las variables ordinales conservan su orden natural; las demás se ordenan de mayor a menor frecuencia.
   */
  public static <T> Dist dist(List<T> datos, Function<T, String> f, boolean multiple, String campo) {
    return dist(datos, f, multiple, campo, null);
  }

  /**
   * Igual que la anterior, pero con las opciones que ofrece la encuesta: las que nadie eligió aparecen con 0 respuestas
   * y la prueba de uniformidad cuenta todas las categorías disponibles.
   */
  public static <T> Dist dist(List<T> datos, Function<T, String> f, boolean multiple, String campo, String[] opciones) {
    List<List<String>> resp = new ArrayList<>();
    for (T x : datos) {
      String s = f.apply(x);
      if (s == null || s.isBlank()) continue;
      List<String> e = multiple
          ? partes(s).stream().map(Estadistica::etiquetaMulti).collect(Collectors.toList())
          : List.of(etiqueta(s));
      if (!e.isEmpty()) resp.add(e);
    }
    Map<String, String> canon = canon(resp.stream().flatMap(List::stream).collect(Collectors.toList()));
    Map<String, Long> cuenta = new LinkedHashMap<>();
    Map<String, String> deOpcion = new HashMap<>(); // clave -> etiqueta de la opción ofrecida
    if (opciones != null) {
      for (String o : opciones) {
        String l = etiquetaOpcion(o);
        deOpcion.put(clave(l), l);
        cuenta.put(l, 0L);
      }
    }
    for (List<String> e : resp) {
      for (String l : new LinkedHashSet<>(e.stream().map(v -> deOpcion.getOrDefault(clave(v), canon.get(clave(v)))).collect(Collectors.toList()))) {
        cuenta.merge(l, 1L, Long::sum);
      }
    }
    List<Map.Entry<String, Long>> es = new ArrayList<>(cuenta.entrySet());
    String[] orden = ORD.get(campo);
    es.sort((a, b) -> {
      if (orden != null) {
        int c = Integer.compare(pos(orden, a.getKey()), pos(orden, b.getKey()));
        if (c != 0) return c;
      }
      int c = Long.compare(b.getValue(), a.getValue());
      return c != 0 ? c : a.getKey().compareTo(b.getKey());
    });
    long total = resp.size();
    List<Fila> filas = new ArrayList<>();
    double acum = 0;
    for (Map.Entry<String, Long> e : es) {
      double pct = total == 0 ? 0 : e.getValue() * 100.0 / total;
      acum += pct;
      filas.add(new Fila(e.getKey(), e.getValue(), r1(pct), r1(Math.min(acum, multiple ? acum : 100))));
    }
    return new Dist(total, multiple, filas, multiple ? null : uniformidad(filas, total));
  }

  /** Descriptivos de una variable numérica. */
  public record Desc(long n, double media, double mediana, double sd, double min, double q1, double q3, double max) {}

  public static Desc desc(double[] v) {
    if (v.length == 0) return new Desc(0, 0, 0, 0, 0, 0, 0, 0);
    DescriptiveStatistics d = new DescriptiveStatistics(v);
    return new Desc(v.length, r(d.getMean()), r(d.getPercentile(50)), r(d.getStandardDeviation()),
        r(d.getMin()), r(d.getPercentile(25)), r(d.getPercentile(75)), r(d.getMax()));
  }

  /** Cantidad de valores fuera de [Q1 - 1,5·RIC ; Q3 + 1,5·RIC] (regla de Tukey). Con menos de 4 datos devuelve 0. */
  public static long atipicos(double[] v) {
    if (v.length < 4) return 0;
    DescriptiveStatistics d = new DescriptiveStatistics(v);
    double q1 = d.getPercentile(25), q3 = d.getPercentile(75), ric = q3 - q1;
    return Arrays.stream(v).filter(x -> x < q1 - 1.5 * ric || x > q3 + 1.5 * ric).count();
  }

  /** Histograma de los años de vida profesional con cortes alineados a la segmentación junior (hasta 3 años). */
  public static Dist histAnios(double[] v) {
    String[] nom = {"Hasta 1 año", "Más de 1 a 3", "Más de 3 a 5", "Más de 5 a 10", "Más de 10"};
    long[] c = new long[5];
    for (double x : v) {
      c[x <= 1 ? 0 : x <= 3 ? 1 : x <= 5 ? 2 : x <= 10 ? 3 : 4]++;
    }
    List<Fila> filas = new ArrayList<>();
    double acum = 0;
    for (int i = 0; i < 5; i++) {
      double pct = v.length == 0 ? 0 : c[i] * 100.0 / v.length;
      acum += pct;
      filas.add(new Fila(nom[i], c[i], r1(pct), r1(Math.min(acum, 100))));
    }
    return new Dist(v.length, false, filas, null);
  }

  /**
   * Resumen de una pregunta tipo Likert. pct[i] = % de respuestas en el nivel i+1 (sin contar "No sabe"),
   * acuerdo = % en la mitad superior de la escala. El valor 0 significa "No sabe" y no entra en ningún cálculo.
   */
  public record Lik(long n, double media, double mediana, double sd, double[] pct, double acuerdo, long noSabe) {}

  public static Lik lik(List<Integer> vs, int niveles) {
    long noSabe = vs.stream().filter(x -> x != null && x == 0).count();
    double[] v = vs.stream().filter(x -> x != null && x >= 1 && x <= niveles).mapToDouble(Integer::doubleValue).toArray();
    double[] pct = new double[niveles];
    if (v.length == 0) return new Lik(0, 0, 0, 0, pct, 0, noSabe);
    DescriptiveStatistics d = new DescriptiveStatistics(v);
    for (double x : v) pct[(int) x - 1]++;
    for (int i = 0; i < niveles; i++) pct[i] = r1(pct[i] * 100 / v.length);
    int umbral = niveles / 2 + 1; // 4 niveles: 3 y 4; 3 niveles: 2 y 3
    double ac = Arrays.stream(v).filter(x -> x >= umbral).count() * 100.0 / v.length;
    return new Lik(v.length, r(d.getMean()), r(d.getPercentile(50)), r(d.getStandardDeviation()), pct, r1(ac), noSabe);
  }

  // =====================================================================
  // 3. BIVARIADA: TABLA DE CONTINGENCIA Y CHI-CUADRADO
  // =====================================================================

  /**
   * Resultado de un cruce de dos variables categóricas.
   * matriz = frecuencias observadas; esperados = frecuencias esperadas si fueran independientes;
   * residuales = residuos estandarizados ajustados (|z| > 1,96 indica una celda que se aparta del azar).
   * chi2, gl, p y cramerV son null si la prueba no se pudo calcular.
   * confiable = false cuando más del 20 % de las celdas tiene frecuencia esperada menor a 5 (criterio de Cochran).
   */
  public record Cruce(String id, String titulo, String filaNombre, String colNombre, long n,
      List<String> filas, List<String> columnas, long[][] matriz, double[][] esperados, double[][] residuales,
      Double chi2, Integer gl, Double p, Double cramerV, Double pctEsperadosBajos, boolean confiable, String aviso) {}

  public static <T> Cruce cruce(String id, String titulo, String filaNombre, String colNombre, List<T> datos,
      Function<T, String> f, Function<T, String> c, String ordF, String ordC) {
    List<String[]> pares = new ArrayList<>();
    for (T x : datos) {
      String a = f.apply(x), b = c.apply(x);
      if (a == null || a.isBlank() || b == null || b.isBlank()) continue;
      pares.add(new String[] {etiqueta(a), etiqueta(b)});
    }
    Map<String, String> cf = canon(pares.stream().map(p -> p[0]).collect(Collectors.toList()));
    Map<String, String> cc = canon(pares.stream().map(p -> p[1]).collect(Collectors.toList()));
    List<String> fs = ordenar(pares.stream().map(p -> cf.get(clave(p[0]))).collect(Collectors.toList()), ordF);
    List<String> cs = ordenar(pares.stream().map(p -> cc.get(clave(p[1]))).collect(Collectors.toList()), ordC);
    int nf = fs.size(), nc = cs.size();
    long[][] mat = new long[nf][nc];
    for (String[] p : pares) {
      mat[fs.indexOf(cf.get(clave(p[0])))][cs.indexOf(cc.get(clave(p[1])))]++;
    }
    long n = pares.size();
    double[][] esp = new double[nf][nc], res = new double[nf][nc];
    String aviso = null;
    Double chi2 = null, p = null, v = null, bajos = null;
    Integer gl = null;
    boolean confiable = false;
    if (n == 0) {
      aviso = "Todavía no hay respuestas suficientes para este cruce.";
    } else if (nf < 2 || nc < 2) {
      aviso = "Se necesitan al menos 2 categorías en cada variable para calcular χ².";
    } else {
      long[] ft = new long[nf], ct = new long[nc];
      for (int i = 0; i < nf; i++) {
        for (int j = 0; j < nc; j++) {
          ft[i] += mat[i][j];
          ct[j] += mat[i][j];
        }
      }
      double x2 = 0, minEsp = Double.MAX_VALUE;
      int bajas = 0;
      for (int i = 0; i < nf; i++) {
        for (int j = 0; j < nc; j++) {
          double e = ft[i] * (double) ct[j] / n;
          esp[i][j] = r(e);
          x2 += Math.pow(mat[i][j] - e, 2) / e;
          double den = Math.sqrt(e * (1 - (double) ft[i] / n) * (1 - (double) ct[j] / n));
          res[i][j] = den == 0 ? 0 : r((mat[i][j] - e) / den);
          if (e < 5) bajas++;
          minEsp = Math.min(minEsp, e);
        }
      }
      gl = (nf - 1) * (nc - 1);
      chi2 = r(x2);
      p = Math.round((1 - new ChiSquaredDistribution(gl).cumulativeProbability(x2)) * 1e6) / 1e6;
      v = r(Math.sqrt(x2 / (n * Math.min(nf - 1, nc - 1))));
      bajos = r1(bajas * 100.0 / (nf * nc));
      confiable = bajos <= 20 && minEsp >= 1;
      if (!confiable) {
        aviso = "El " + String.valueOf(bajos).replace('.', ',') + " % de las celdas tiene una frecuencia esperada menor a 5: el valor de p no es "
            + "confiable. Agrupe categorías o reúna más respuestas antes de concluir.";
      }
    }
    return new Cruce(id, titulo, filaNombre, colNombre, n, fs, cs, mat, esp, res, chi2, gl, p, v, bajos, confiable, aviso);
  }

  /** Ordena categorías por el orden natural de la variable (si lo tiene) o de la más a la menos frecuente. */
  private static List<String> ordenar(List<String> valores, String campo) {
    Map<String, Long> cuenta = valores.stream().collect(Collectors.groupingBy(x -> x, Collectors.counting()));
    String[] orden = campo == null ? null : ORD.get(campo);
    List<String> l = new ArrayList<>(cuenta.keySet());
    l.sort((a, b) -> {
      if (orden != null) {
        int c = Integer.compare(pos(orden, a), pos(orden, b));
        if (c != 0) return c;
      }
      int c = Long.compare(cuenta.get(b), cuenta.get(a));
      return c != 0 ? c : a.compareTo(b);
    });
    return l;
  }
}
