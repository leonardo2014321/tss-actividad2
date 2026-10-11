# Herramienta de recolección y análisis – Titulados y empleadores (ARCUSUR)

Aplicación web hecha con **Java 17 + Spring Boot 3**. El navegador usa HTML/JS simples (sin Node.js ni React) para que solo necesites Java y Maven.

## 1. Qué necesitas instalar
| Programa | Versión | Para qué | Verificar |
|---|---|---|---|
| **JDK** | 17 o superior (ej. Temurin 17/21) | Compilar y ejecutar | `java -version` |
| **Maven** | 3.9 o superior | Descargar dependencias y ejecutar | `mvn -version` |
| Navegador | Chrome, Edge o Firefox | Usar la app | – |
| Internet | Solo la primera vez | Maven descarga las librerías; el panel carga Chart.js desde un CDN | – |

Opcional: IntelliJ IDEA o VS Code (con "Extension Pack for Java"). Si usas IntelliJ, abre la carpeta como proyecto Maven y ejecuta `ArcusurApp`.

No necesitas instalar base de datos: usa **H2**, que guarda los datos en la carpeta `data/`.

## 2. Cómo ejecutarlo
```
unzip arcusur-encuestas.zip
cd arcusur-encuestas
mvn spring-boot:run
```
Cuando veas `Started ArcusurApp`, abre:
- Encuestas: http://localhost:8080/
- Panel de análisis: http://localhost:8080/dashboard.html

Para detenerlo: `Ctrl + C`. Para generar un jar: `mvn clean package` y luego `java -jar target/arcusur-encuestas-1.0.jar`.

## 3. Cómo probarlo (2 minutos)
1. Entra al **Panel** y pulsa **Cargar datos de demostración** (60 titulados y 6 empleadores ficticios).
2. Revisa los gráficos, el mapa de calor con la prueba χ² y los escenarios de simulación.
3. Pulsa **Borrar datos de demostración**. Los datos ficticios **no deben usarse como datos de campo**.
4. Llena una encuesta real en la página principal y mira cómo aparece en el panel. Exporta con los botones CSV (abren en Excel).

## 4. Qué cubre cada historia de usuario
| Historia | Dónde |
|---|---|
| 1 Antigüedad y empleabilidad | Año de egreso numérico obligatorio, listas cerradas; media, mediana y desviación estándar, junior vs. consolidado (`/api/stats`) |
| 2 Formación continua y áreas | Frecuencias del área y nivel de posgrado (gráficos de barras) |
| 3 Financiamiento | Tabla de contingencia financiamiento × área con χ² (`Api.cruce`) |
| 4 Brechas de competencias | Escalas Likert 1–5; media y desviación; radar |
| 5 Reportes | Exportación CSV, panel con mapa de calor y radar |
| Escenarios | Simulación Monte Carlo (`/api/simulacion`): inscritos esperados y probabilidad de abrir un programa, base vs. con becas |

## 5. Estructura
```
pom.xml                         dependencias
src/main/java/arcusur/          Titulado, Empleador (entidades), repositorios, Api (REST, estadística, simulación)
src/main/resources/static/      index.html (encuestas), dashboard.html (panel), app.css
src/main/resources/application.properties   configuración (puerto, base de datos)
```

## 6. Problemas comunes
- **`release version 17 not supported`**: tu JDK es anterior a 17. Instala JDK 17+ y revisa `JAVA_HOME`.
- **El puerto 8080 está ocupado**: cambia `server.port` en `application.properties`.
- **Los gráficos no aparecen**: no hay internet para Chart.js. El resto del panel funciona.
- **`mvn` no se reconoce**: agrega Maven al `PATH` o usa IntelliJ.
- **Quiero empezar de cero**: detén la app y borra la carpeta `data/`.

## 7. Límites de esta versión
- No tiene login: el panel es público. Agrega Spring Security antes de publicarlo.
- La exportación es CSV (Excel lo abre); no genera .xlsx.
- Las encuestas incluyen un subconjunto de preguntas del anexo. Faltan, entre otras, el bloque de emprendimiento, las asignaturas de ventaja/poca utilidad y las preguntas de contacto. Agrégalas en `Titulado.java`, `index.html` y `Api.java`.
- Para PostgreSQL: añade la dependencia `org.postgresql:postgresql` y cambia las 3 líneas `spring.datasource.*` de `application.properties`.
- Escala Likert: usa 1 a 5 como pide la guía; el anexo usa escalas de 3-4 niveles. Confírmalo con tu docente.

## 8. Encuesta de titulados (versión completa del anexo)
La encuesta de titulados reproduce todas las preguntas del anexo, con rutas condicionales (formación complementaria, interés en posgrado, situación laboral). Usa la tabla `titulado`. Si venías de una versión anterior, borra la carpeta `data/` para empezar con las tablas nuevas. Las escalas Likert de titulados son de 4 niveles (1 a 4). La encuesta de empleadores (tabla `empleador`, P1–P12 más 18 afirmaciones) usa 3 niveles (3 = totalmente de acuerdo, 2 = parcialmente, 1 = totalmente en desacuerdo) y 0 = «No sabe», que se excluye de las medias. Años de vida profesional reemplaza al año de egreso para las medidas de antigüedad.
