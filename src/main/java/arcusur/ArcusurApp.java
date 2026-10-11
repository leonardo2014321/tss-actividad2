package arcusur;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Punto de entrada de la aplicación.
 *
 * {@code @SpringBootApplication} activa la configuración automática de Spring Boot
 * y busca los componentes (Api, repositorios, entidades) dentro de este paquete.
 * Por eso todas las clases del proyecto deben estar en el paquete {@code arcusur}.
 */
@SpringBootApplication
public class ArcusurApp {

  /** Arranca el servidor web embebido (puerto definido en application.properties). */
  public static void main(String[] args) {
    SpringApplication.run(ArcusurApp.class, args);
  }
}
