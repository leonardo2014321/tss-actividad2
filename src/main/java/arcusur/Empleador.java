package arcusur;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;

/**
 * Respuesta de un empleador a la encuesta sobre los titulados de Ingeniería de Sistemas.
 * Cada objeto es una fila de la tabla {@code empleador}.
 */
@Entity
@Table(name = "empleador")
public class Empleador {

  /** Identificador autogenerado. */
  @Id @GeneratedValue public Long id;

  // ---- P1 a P8: datos de la organización y empleabilidad (listas cerradas) ----
  @NotBlank @Size(max = 255) public String empresa, tipo, tamano, rubro, contrato, proyeccion, nivelFormacion, medio;

  /** P9: cargos de los titulados (selección múltiple; las opciones van separadas por "|"). */
  @NotBlank @Size(max = 1500) @Column(length = 1500) public String cargos;

  /** P10 a P12: respuestas abiertas (áreas emergentes, herramientas y competencias). */
  @NotBlank @Size(max = 1500) @Column(length = 1500) public String areasEmergentes, herramientas, competencias;

  /**
   * Bloque "Formación y perfil profesional": 10 afirmaciones (fp1 a fp10).
   * Escala: 3 = Totalmente de acuerdo, 2 = Parcialmente de acuerdo,
   * 1 = Totalmente en desacuerdo, 0 = No sabe (se excluye de las medias).
   */
  @NotNull @Min(0) @Max(3) public Integer fp1, fp2, fp3, fp4, fp5, fp6, fp7, fp8, fp9, fp10;

  /** Bloque "Relación de la Carrera con la organización": 8 afirmaciones (vc1 a vc8). Misma escala. */
  @NotNull @Min(0) @Max(3) public Integer vc1, vc2, vc3, vc4, vc5, vc6, vc7, vc8;

  /** true si el registro es de demostración (ficticio); permite borrarlo sin tocar datos reales. */
  public boolean demo;
}
