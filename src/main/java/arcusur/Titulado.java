package arcusur;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;

/**
 * Respuesta de un titulado de Ingeniería de Sistemas a la encuesta.
 * Cada objeto es una fila de la tabla {@code titulado}.
 *
 * Los campos opcionales dependen de las rutas condicionales del formulario:
 * por ejemplo, "nivelPosgrado" solo se llena si "formacion" es SI.
 */
@Entity
@Table(name = "titulado", uniqueConstraints = @UniqueConstraint(name = "uk_titulado_email", columnNames = "email"))
public class Titulado {

  /** Identificador autogenerado. */
  @Id @GeneratedValue public Long id;

  /** Correo que identifica la respuesta: obligatorio y único (cada persona responde una sola vez). Se guarda en minúsculas. */
  @NotBlank @Email @Size(max = 255) public String email;

  /** Fecha y hora de registro (ISO 8601). La asigna el servidor al guardar. */
  @Size(max = 40) public String registrado;

  // ---- Campos obligatorios en todas las rutas ----
  @NotBlank @Size(max = 255) public String edad, genero, formacion, interes, situacion, tiempoPrimerTrabajo, numEmpleos, redContactos;

  /** Años de vida profesional y años desempleado (0 a 60). Base de media, mediana y desviación estándar. */
  @NotNull @DecimalMin("0") @DecimalMax("60") public Double aniosProfesionales, aniosDesempleado;

  /** Escalas Likert de 4 niveles: 1 = Totalmente en desacuerdo ... 4 = Totalmente de acuerdo. */
  @NotNull @Min(1) @Max(4) public Integer opinionPosgrado, satisfaccion, concordancia;

  /** Pertinencia del puesto (Likert 1 a 4). Solo la responde quien trabaja en una organización. */
  @Min(1) @Max(4) public Integer pertinencia;

  // ---- Campos condicionales (rutas del formulario) ----
  /** Formación complementaria (solo si formacion = SI). */
  @Size(max = 255) public String nivelPosgrado, dondeCurso, financiamiento, nombrePrograma;
  /** Interés en posgrado (solo si interes = SI). */
  @Size(max = 255) public String area, orgPosgrado;
  /** Datos del trabajo actual (solo si trabaja en una organización). */
  @Size(max = 255) public String empresa, rubro, sector, departamento, areaOrg, cargo, antiguedad, medio, remuneracion, primerEmpleo;
  /** Datos de contacto opcionales (el correo es obligatorio y está arriba). */
  @Size(max = 255) public String telefono, linkedin;

  /** Preguntas de elección múltiple: las opciones elegidas van separadas por "|". */
  @Size(max = 1500) @Column(length = 1500) public String utiles, mejorar, ventaja, pocoUtiles;

  /** true si el registro es de demostración (ficticio); permite borrarlo sin tocar datos reales. */
  public boolean demo;

  /** Marca la hora de registro en el servidor, sin importar lo que envíe el cliente. */
  @PrePersist
  void alGuardar() {
    registrado = java.time.OffsetDateTime.now().toString();
  }
}
