package arcusur;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Acceso a datos de la tabla {@code titulado}.
 * Spring genera la implementación: save, findAll, deleteAll, etc.
 */
public interface TituladoRepo extends JpaRepository<Titulado, Long> {}
