# Herramienta de recolección y análisis – Titulados y empleadores (ARCUSUR)

Aplicación web hecha con **Java 17 + Spring Boot 3**. El navegador usa HTML/JS simples (sin Node.js ni React) para que solo necesites Java y Maven.

## 1. Qué necesitas instalar
| Programa | Versión | Para qué | Verificar |
|---|---|---|---|
| **JDK** | 17 o superior (ej. Temurin 17/21) | Compilar y ejecutar | `java -version` |
| **Maven** | 3.9 o superior | Descargar dependencias y ejecutar | `mvn -version` |
| Navegador | Chrome, Edge o Firefox | Usar la app | – |
| Internet | Solo la primera vez | Maven descarga las librerías. El panel ya no necesita internet: sus gráficos son propios | – |

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
1. Entra al **Panel** y pulsa **Cargar datos de demostración** (150 titulados y 24 empleadores ficticios, con respuestas relacionadas entre sí; si lo pulsas de nuevo se reemplazan, no se duplican).
2. Recorre las pestañas: **Resumen** (hallazgos principales), **Titulados**, **Empleadores**, **Pruebas estadísticas** (uniformidad y relaciones entre variables con χ²), **Simulación** y **Datos** (muestra, limpieza y descargas). Cada gráfico trae su lectura en palabras. Si aún no hay respuestas reales, el panel abre la demostración solo.
3. Pulsa **Borrar datos de demostración**. Los datos ficticios **no deben usarse como datos de campo**.
4. Llena una encuesta real en la página principal y mira cómo aparece en el panel. Exporta con los enlaces de descarga (ver sección 4).

## 4. Qué hace el análisis
| Etapa | Qué hace la herramienta |
|---|---|
| Muestra | Tamaño de la muestra, margen de error referencial y empresas individualizadas (públicas y privadas) |
| Recolección | Formulario web con listas cerradas, rutas condicionales y validación en el servidor |
| Limpieza de datos | Unifica mayúsculas, tildes y espacios; agrupa «Otro: …»; convierte las opciones múltiples en columnas 0/1; reporta duplicados, incoherencias y atípicos (regla de Tukey) |
| Estadística univariada | Frecuencias absolutas y relativas, media, mediana, desviación, cuartiles y porcentajes por nivel en las escalas Likert |
| Uniformidad | Prueba χ² de bondad de ajuste en cada pregunta de opción única: FE = n/k, χ², valor crítico (α = 5 %) y conclusión «Uniformidad» o «No uniformidad». Cuenta todas las opciones de la pregunta, también las que nadie eligió |
| Estadística bivariada (independencia) | 5 cruces con χ², grados de libertad, p, V de Cramér, frecuencias esperadas y residuos; avisa si el χ² no es confiable (más del 20 % de celdas con esperada menor a 5) |
| Visualización | Barras, histograma, barras Likert apiladas, radar, mapa de calor y curvas de simulación; el panel se puede imprimir |
| Simulación | Monte Carlo: probabilidad de abrir un programa, escenario base vs. con becas |

### Descargas (panel o URL)
| Archivo | Contenido |
|---|---|
| `/api/export/titulados.csv`, `empleadores.csv` | Datos **limpios** para analizar |
| `/api/export/titulados_crudo.csv`, `empleadores_crudo.csv` | Copia fiel de la base de datos (trazabilidad) |
| `/api/export/uniformidad.csv` | Resultado de la prueba de uniformidad de cada pregunta, con las frecuencias observadas |
| `/api/export/diccionario.csv` | Qué significa cada variable y qué limpieza recibe |
| `/api/export/cruce/<id>.csv` | Matriz de un cruce: frecuencias, % por fila, esperados, residuos y χ² (`fin-nivel`, `area-sector`, `seg-area`, `int-sit`, `area-fin`) |

Todos aceptan `?datos=reales|demo|todos` (por defecto `reales`) y `?sep=,` (por defecto `;`, que es el que espera Excel en español). Para obtener los CSV con coma, agrega `?sep=,` a la URL de descarga. El CSV de titulados incluye correo y teléfono: no lo publiques ni lo compartas.

## 5. Estructura
```
pom.xml                         dependencias
src/main/java/arcusur/          Titulado, Empleador (entidades), repositorios
                                Api (rutas REST y simulación), Estadistica (limpieza, frecuencias, χ²), Exportacion (CSV),
                                Opciones (opciones de cada pregunta, tomadas de index.html)
src/main/resources/static/      index.html (encuestas), dashboard.html (panel), app.css y encuesta.css
src/main/resources/application.properties   configuración (puerto, base de datos)
```

## 6. Problemas comunes
- **`release version 17 not supported`**: tu JDK es anterior a 17. Instala JDK 17+ y revisa `JAVA_HOME`.
- **El puerto 8080 está ocupado**: cambia `server.port` en `application.properties`.
- **El CSV se abre en una sola columna en Excel**: el separador por defecto es `;` (Excel en español). Si tu Excel espera coma, agrega `?sep=,` a la URL de descarga.
- **`mvn` no se reconoce**: agrega Maven al `PATH` o usa IntelliJ.
- **Quiero empezar de cero**: detén la app y borra la carpeta `data/`.

## 7. Límites de esta versión
- No tiene login: el panel es público. Agrega Spring Security antes de publicarlo.
- La exportación es CSV (Excel lo abre); no genera .xlsx.
- Las preguntas de la encuesta se definen en `index.html`; si las modificas, ajusta también `Titulado.java`, `Empleador.java` y `Api.java`.
- Para PostgreSQL: añade la dependencia `org.postgresql:postgresql` y cambia las 3 líneas `spring.datasource.*` de `application.properties`.
- Escalas Likert: 4 niveles en titulados y 3 niveles más «No sabe» en empleadores.
- Si cambias las opciones de una pregunta en `index.html`, actualiza también `Opciones.java` (la prueba de uniformidad usa ese número de categorías).
- Con pocas respuestas el χ² casi nunca es confiable (el panel lo advierte). Reúne más respuestas o agrupa categorías antes de concluir.
- El margen de error del panel supone muestra aleatoria; si la muestra fue por conveniencia, es solo referencial.

## 8. Estructura de las encuestas
La encuesta de titulados tiene rutas condicionales (formación complementaria, interés en posgrado, situación laboral). Usa la tabla `titulado`. Si venías de una versión anterior, borra la carpeta `data/` para empezar con las tablas nuevas. Las escalas Likert de titulados son de 4 niveles (1 a 4). La encuesta de empleadores (tabla `empleador`, P1–P12 más 18 afirmaciones) usa 3 niveles (3 = totalmente de acuerdo, 2 = parcialmente, 1 = totalmente en desacuerdo) y 0 = «No sabe», que se excluye de las medias. Años de vida profesional reemplaza al año de egreso para las medidas de antigüedad.
