package arcusur;

import jakarta.persistence.*;

/**
 * Una corrida de la simulación Monte Carlo, guardada en la base de datos.
 *
 * Cada corrida queda asociada al conjunto de datos que la originó ({@code datos}: reales, demo o todos) y
 * a la cantidad de titulados cuyas respuestas dieron la probabilidad de interés ({@code nTitulados}).
 * Las dos corridas de una comparación (escenario base y con becas) comparten el mismo {@code corrida}.
 * Cuando {@code area} está vacía la fila es el programa en general; si no, es el programa de esa área.
 * Las corridas calculadas con datos de demostración tienen {@code demo = true} y se borran junto con ellos.
 */
@Entity
@Table(name = "simulacion")
public class Simulacion {

  @Id @GeneratedValue public Long id;

  /** Fecha y hora (ISO 8601) en que se calculó. */
  public String fecha;

  /** Identificador común de las corridas que se compararon juntas. */
  public String corrida;

  /** «base» o «becas» (u otro nombre de escenario). */
  public String escenario;

  /** Origen de las respuestas: reales, demo o todos. */
  public String datos;

  /** Área de posgrado simulada; vacía si es el programa en general. */
  public String area;

  /** Parámetros del modelo. */
  public int poblacion, minimo, iteraciones;
  public double probInteres, probInscribe, probConjunta;

  /** Titulados cuyas respuestas se usaron y de dónde salió la probabilidad de interés («datos» o «manual»). */
  public int nTitulados;
  public String origenInteres;

  /** Resultados: inscritos promedio, percentiles 5 y 95, y probabilidad de alcanzar el mínimo. */
  public double media, p5, p95, probApertura;

  /** true si se calculó con datos que incluyen la demostración (ficticios). */
  public boolean demo;
}
