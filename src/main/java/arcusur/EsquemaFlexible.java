package arcusur;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Quita la restricción NOT NULL de las columnas de respuestas en una base que ya existía.
 *
 * Por qué hace falta: con {@code ddl-auto=update} Hibernate agrega columnas nuevas pero NO cambia las que ya existen.
 * Si una versión anterior creó una columna como NOT NULL (por ejemplo, tiempo hasta el primer trabajo), esa columna sigue
 * exigiendo un valor aunque el código actual ya la trate como opcional. Entonces las respuestas que no la contestaron
 * (como las que se registraron antes de que existiera esa pregunta) no se podían guardar.
 *
 * Se ejecuta una sola vez al arrancar y es inofensivo: si no hay nada que aflojar, no hace nada.
 * Se dejan intactas las columnas que sí deben tener valor: id, email y demo.
 */
@Component
public class EsquemaFlexible implements ApplicationRunner {

  private static final Logger LOG = LoggerFactory.getLogger(EsquemaFlexible.class);
  private static final List<String> TABLAS = List.of("titulado", "empleador");
  private static final List<String> SIEMPRE_CON_VALOR = List.of("id", "email", "demo");

  private final DataSource origen;

  public EsquemaFlexible(DataSource origen) {
    this.origen = origen;
  }

  @Override
  public void run(ApplicationArguments args) {
    for (String tabla : TABLAS) aflojar(tabla);
  }

  private void aflojar(String tabla) {
    try (Connection c = origen.getConnection()) {
      DatabaseMetaData md = c.getMetaData();
      List<String[]> pendientes = new ArrayList<>(); // {nombre real de la tabla, columna}
      try (ResultSet rs = md.getColumns(null, c.getSchema(), "%", "%")) {
        while (rs.next()) {
          if (!tabla.equalsIgnoreCase(rs.getString("TABLE_NAME"))) continue;
          String columna = rs.getString("COLUMN_NAME");
          if ("NO".equalsIgnoreCase(rs.getString("IS_NULLABLE")) && !SIEMPRE_CON_VALOR.contains(columna.toLowerCase()))
            pendientes.add(new String[] {rs.getString("TABLE_NAME"), columna});
        }
      }
      for (String[] p : pendientes) {
        String base = "ALTER TABLE \"" + p[0] + "\" ALTER COLUMN \"" + p[1] + "\" ";
        try (Statement st = c.createStatement()) {
          try {
            st.execute(base + "DROP NOT NULL"); // H2 2.x y PostgreSQL
          } catch (SQLException x) {
            st.execute(base + "SET NULL"); // sintaxis alternativa de H2
          }
          LOG.info("Columna {}.{}: ahora acepta respuestas vacías.", p[0], p[1]);
        } catch (SQLException x) {
          LOG.warn("No se pudo aflojar {}.{}: {}", p[0], p[1], x.getMessage());
        }
      }
    } catch (SQLException x) {
      LOG.warn("No se pudo revisar la tabla {}: {}", tabla, x.getMessage());
    }
  }
}
