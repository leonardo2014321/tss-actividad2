package arcusur;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Acceso a datos de la tabla {@code empleador}.
 * Spring genera la implementación: save, findAll, deleteAll, etc.
 */
public interface EmpleadorRepo extends JpaRepository<Empleador, Long> {

  /** Indica si ese correo ya respondió la encuesta (sin distinguir mayúsculas). */
  boolean existsByEmailIgnoreCase(String email);

  /** Igual que la anterior, pero ignorando un registro: sirve al editar para no chocar con el correo propio. */
  boolean existsByEmailIgnoreCaseAndIdNot(String email, Long id);
}
