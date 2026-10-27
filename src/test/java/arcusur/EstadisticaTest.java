package arcusur;

import static org.junit.jupiter.api.Assertions.*;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Pruebas de validación de los cálculos estadísticos de la herramienta.
 *
 * Los valores esperados NO salen del propio programa: se calcularon aparte con Python (numpy/scipy) y se pueden
 * reproducir en Excel o Google Sheets (PROMEDIO, MEDIANA, MODA, VAR.S, DESVEST.M, CUARTIL.INC, PERCENTIL.INC, COEF.ASIMETRIA,
 * PRUEBA.CHICUAD). Cada prueba indica la fórmula de contraste.
 */
class EstadisticaTest {

  /** Muestra pequeña de 15 datos (tiempos), fácil de repetir a mano en una hoja de cálculo. */
  static final double[] DATOS = {4, 5, 5, 7, 8, 10, 12, 12, 15, 18, 20, 22, 5, 10, 8};

  @Test
  @DisplayName("Tendencia central: media, mediana y moda")
  void tendenciaCentral() {
    Estadistica.Desc d = Estadistica.desc(DATOS);
    assertEquals(15, d.n());
    assertEquals(10.73, d.media(), 0.005); // =PROMEDIO(A1:A15) = 161 / 15
    assertEquals(10.0, d.mediana(), 1e-9); // =MEDIANA(A1:A15)
    assertEquals(5.0, d.moda(), 1e-9); // =MODA(A1:A15): el 5 aparece 3 veces
  }

  @Test
  @DisplayName("Dispersión: rango, varianza muestral, desviación y coeficiente de variación")
  void dispersion() {
    Estadistica.Desc d = Estadistica.desc(DATOS);
    assertEquals(18.0, d.rango(), 1e-9); // 22 − 4
    assertEquals(32.92, d.varianza(), 0.005); // =VAR.S(A1:A15), divide entre n − 1
    assertEquals(5.74, d.sd(), 0.005); // =DESVEST.M(A1:A15)
    assertEquals(53.46, d.cv(), 0.005); // desviación / media × 100
  }

  @Test
  @DisplayName("Posición: cuartiles y percentil 90 con el método de Excel (INC)")
  void posicion() {
    Estadistica.Desc d = Estadistica.desc(DATOS);
    assertEquals(6.0, d.q1(), 1e-9); // =CUARTIL.INC(A1:A15;1)
    assertEquals(13.5, d.q3(), 1e-9); // =CUARTIL.INC(A1:A15;3)
    assertEquals(19.2, d.p90(), 1e-9); // =PERCENTIL.INC(A1:A15;0,9)
  }

  @Test
  @DisplayName("Forma: asimetría positiva (cola a la derecha) igual a SKEW de Excel")
  void asimetria() {
    Estadistica.Desc d = Estadistica.desc(DATOS);
    assertEquals(0.75, d.asimetria(), 0.005); // =COEF.ASIMETRIA(A1:A15)
    assertTrue(d.media() > d.mediana(), "media > mediana en una distribución con cola a la derecha");
  }

  @Test
  @DisplayName("Atípicos con la regla de Tukey: el 22 NO es atípico en esta muestra")
  void atipicos() {
    // Límite superior = Q3 + 1,5·RIC = 13,5 + 1,5·7,5 = 24,75: ningún dato lo supera.
    assertEquals(0, Estadistica.atipicos(DATOS));
    assertEquals(0, Estadistica.desc(DATOS).atipicos().length);
    double[] conAtipico = {4, 5, 5, 7, 8, 10, 12, 12, 15, 18, 20, 22, 5, 10, 8, 60};
    Estadistica.Desc d = Estadistica.desc(conAtipico);
    assertEquals(1, Estadistica.atipicos(conAtipico));
    assertArrayEquals(new double[] {60}, d.atipicos(), 1e-9);
    assertEquals(22, d.bigoteSup(), 1e-9, "el bigote llega al mayor dato que no es atípico");
  }

  @Test
  @DisplayName("Casos límite: sin datos, un dato y todos distintos")
  void casosLimite() {
    Estadistica.Desc vacio = Estadistica.desc(new double[0]);
    assertEquals(0, vacio.n());
    assertNull(vacio.moda());
    Estadistica.Desc uno = Estadistica.desc(new double[] {7});
    assertEquals(7, uno.media(), 1e-9);
    assertEquals(0, uno.sd(), 1e-9);
    assertEquals(0, uno.asimetria(), 1e-9);
    assertNull(Estadistica.desc(new double[] {1, 2, 3}).moda(), "si ningún valor se repite no hay moda");
  }

  @Test
  @DisplayName("Uniformidad: χ² de bondad de ajuste con FE = n/k")
  void uniformidad() {
    // 30, 20, 10 y 40 respuestas en 4 opciones: n = 100, FE = 25, χ² = (25 + 25 + 225 + 225) / 25 = 20, gl = 3.
    List<String> datos = new ArrayList<>();
    for (int i = 0; i < 30; i++) datos.add("A");
    for (int i = 0; i < 20; i++) datos.add("B");
    for (int i = 0; i < 10; i++) datos.add("C");
    for (int i = 0; i < 40; i++) datos.add("D");
    Estadistica.Dist dist = Estadistica.dist(datos, x -> x, false, "x", new String[] {"A", "B", "C", "D"});
    Estadistica.Unif u = dist.unif();
    assertEquals(25.0, u.fe(), 1e-9);
    assertEquals(20.0, u.chi2(), 1e-9); // scipy.stats.chisquare([30,20,10,40]) = 20
    assertEquals(3, u.gl());
    assertEquals(7.81, u.critico(), 0.005); // tabla χ², α = 0,05 y 3 gl
    assertFalse(u.uniforme(), "20 > 7,81: se rechaza la uniformidad");
    assertTrue(u.confiable(), "FE = 25 ≥ 5");
  }

  @Test
  @DisplayName("Uniformidad: cuenta también las opciones que nadie eligió")
  void uniformidadConOpcionesVacias() {
    List<String> datos = List.of("A", "A", "A", "A", "B", "B", "B", "B");
    Estadistica.Unif u = Estadistica.dist(datos, x -> x, false, "x", new String[] {"A", "B", "C", "D"}).unif();
    assertEquals(4, u.k());
    assertEquals(2.0, u.fe(), 1e-9);
    assertEquals(8.0, u.chi2(), 1e-9); // (2² + 2² + 2² + 2²) / 2 = 16 / 2
  }

  @Test
  @DisplayName("Independencia: χ² sobre una tabla 2×3, p y V de Cramér")
  void independencia() {
    // Tabla [[20,10,5],[10,15,20]]; scipy.stats.chi2_contingency(correction=False): χ² = 12,2751, gl = 2, p = 0,00216.
    int[][] t = {{20, 10, 5}, {10, 15, 20}};
    List<String[]> datos = new ArrayList<>();
    for (int i = 0; i < 2; i++) for (int j = 0; j < 3; j++) for (int k = 0; k < t[i][j]; k++) datos.add(new String[] {"F" + i, "C" + j});
    Estadistica.Cruce c = Estadistica.cruce("t", "Prueba", "fila", "col", datos, x -> x[0], x -> x[1], null, null);
    assertEquals(80, c.n());
    assertEquals(12.28, c.chi2(), 0.005);
    assertEquals(2, c.gl());
    assertEquals(0.00216, c.p(), 0.00001);
    assertEquals(0.39, c.cramerV(), 0.005); // √(χ² / (n · min(f − 1, c − 1)))
    assertTrue(c.confiable(), "todas las frecuencias esperadas son ≥ 5");
  }

  @Test
  @DisplayName("Independencia: avisa que el χ² no es confiable con pocos casos")
  void independenciaPocosCasos() {
    List<String[]> datos = List.of(new String[] {"F0", "C0"}, new String[] {"F0", "C1"}, new String[] {"F1", "C0"}, new String[] {"F1", "C1"},
        new String[] {"F0", "C0"}, new String[] {"F1", "C1"});
    Estadistica.Cruce c = Estadistica.cruce("t", "Prueba", "fila", "col", datos, x -> x[0], x -> x[1], null, null);
    assertFalse(c.confiable());
    assertNotNull(c.aviso());
  }

  @Test
  @DisplayName("Likert: media, porcentaje de acuerdo y exclusión de «No sabe»")
  void likert() {
    // Escala de 3 niveles con 0 = «No sabe»: los ceros no entran en ningún cálculo.
    List<Integer> v = java.util.Arrays.asList(3, 3, 2, 1, 0, 0, null);
    Estadistica.Lik l = Estadistica.lik(v, 3);
    assertEquals(4, l.n());
    assertEquals(2, l.noSabe());
    assertEquals(2.25, l.media(), 1e-9); // (3 + 3 + 2 + 1) / 4
    assertEquals(75.0, l.acuerdo(), 1e-9); // niveles 2 y 3: 3 de 4
  }
}
