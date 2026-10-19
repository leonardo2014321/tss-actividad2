package arcusur;

import org.springframework.data.jpa.repository.JpaRepository;

/** Acceso a datos de la tabla {@code simulacion}. */
public interface SimulacionRepo extends JpaRepository<Simulacion, Long> {}
