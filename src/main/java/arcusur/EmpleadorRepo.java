package arcusur;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Acceso a datos de la tabla {@code empleador}.
 * Spring genera la implementación: save, findAll, deleteAll, etc.
 */
public interface EmpleadorRepo extends JpaRepository<Empleador, Long> {

  /** Indica si ese correo ya respondió la encuesta (sin distinguir mayúsculas). */
  boolean existsByEmailIgnoreCase(String email);
}
