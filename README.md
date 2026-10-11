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
1. Entra al **Panel** y pulsa **Cargar datos de demostración** (60 titulados y 6 empleadores ficticios).
2. Revisa los gráficos (cada uno trae su lectura en palabras), los cruces con la prueba χ² y los escenarios de simulación. Si aún no hay respuestas reales, el panel abre la demostración solo.
3. Pulsa **Borrar datos de demostración**. Los datos ficticios **no deben usarse como datos de campo**.
4. Llena una encuesta real en la página principal y mira cómo aparece en el panel. Exporta con los enlaces de descarga (ver sección 4).

## 4. Marco metodológico: qué hace la herramienta
| Requisito de la guía | Qué hace la herramienta | Qué debes redactar tú en el informe |
|---|---|---|
| Diseño cuantitativo y exploratorio | Preguntas cerradas, escalas Likert y campos numéricos; el panel explora distribuciones y cruces | Justificar el diseño y declarar que las preguntas abiertas de empleadores se revisan aparte |
| Población objetivo | Muestra el tamaño de la muestra, un margen de error referencial y las empresas individualizadas (≥ 3, una pública y una privada) | Definir la población (titulados de Ingeniería de Sistemas de la UMSS y empleadores), el tipo de muestreo y sus límites |
| Técnicas de recolección | Formulario web con listas cerradas, rutas condicionales y validación en el servidor | Describir el instrumento y cómo se distribuyó |
| **Data wrangling** | Unifica mayúsculas, tildes y espacios; agrupa «Otro: …»; convierte las opciones múltiples en columnas 0/1; reporta duplicados, incoherencias y atípicos (regla de Tukey) | Describir esos pasos (están en «Limpieza de datos» del panel y en el diccionario) |
| Estadística univariada | Frecuencias absolutas y relativas, media, mediana, desviación, cuartiles, Likert (porcentajes por nivel) | Interpretar los resultados |
| Bivariada con χ² | 5 cruces con χ², gl, p, V de Cramér, frecuencias esperadas y residuos; avisa si el χ² no es confiable (más del 20 % de celdas con esperada menor a 5) | Interpretar y declarar las limitaciones |
| Visualización | Barras, histograma, barras Likert apiladas, radar, mapa de calor y curvas de simulación | Insertar las figuras (el panel se puede imprimir) |

### Descargas (panel o URL)
| Archivo | Contenido |
|---|---|
| `/api/export/titulados.csv`, `empleadores.csv` | Datos **limpios** para analizar |
| `/api/export/titulados_crudo.csv`, `empleadores_crudo.csv` | Copia fiel de la base de datos (trazabilidad) |
| `/api/export/diccionario.csv` | Qué significa cada variable y qué limpieza recibe |
| `/api/export/cruce/<id>.csv` | Matriz de un cruce: frecuencias, % por fila, esperados, residuos y χ² (`fin-nivel`, `area-sector`, `seg-area`, `int-sit`, `area-fin`) |

Todos aceptan `?datos=reales|demo|todos` (por defecto `reales`) y `?sep=,` (por defecto `;`, que es el que espera Excel en español). El CSV de titulados incluye correo y teléfono: no lo publiques ni lo compartas.

### Historias de usuario
| Historia | Dónde |
|---|---|
| 1 Antigüedad y empleabilidad | Años de vida profesional: media, mediana, desviación, histograma y segmentación junior/consolidado |
| 2 Formación continua y áreas | Frecuencias y % del área y del nivel; regla del 70 % de concentración en las dos áreas principales |
| 3 Financiamiento | Cruce financiamiento × nivel de formación con χ² |
| 4 Brechas de competencias | Escalas Likert (barras apiladas y radar con media y desviación) |
| 5 Reportes | Descargas CSV y panel con mapa de calor y radar |
| Escenarios | Simulación Monte Carlo: probabilidad de abrir un programa, base vs. con becas, con la curva de inscritos |

## 5. Estructura
```
pom.xml                         dependencias
src/main/java/arcusur/          Titulado, Empleador (entidades), repositorios
                                Api (rutas REST y simulación), Estadistica (limpieza, frecuencias, χ²), Exportacion (CSV)
src/main/resources/static/      index.html (encuestas), dashboard.html (panel), app.css y encuesta.css
src/main/resources/application.properties   configuración (puerto, base de datos)
```

## 6. Problemas comunes
- **`release version 17 not supported`**: tu JDK es anterior a 17. Instala JDK 17+ y revisa `JAVA_HOME`.
- **El puerto 8080 está ocupado**: cambia `server.port` en `application.properties`.
- **El CSV se abre en una sola columna en Excel**: descárgalo con el separador que corresponde a tu Excel (selector sobre las descargas).
- **`mvn` no se reconoce**: agrega Maven al `PATH` o usa IntelliJ.
- **Quiero empezar de cero**: detén la app y borra la carpeta `data/`.

## 7. Límites de esta versión
- No tiene login: el panel es público. Agrega Spring Security antes de publicarlo.
- La exportación es CSV (Excel lo abre); no genera .xlsx.
- La encuesta no se modificó respecto al anexo recibido. Cualquier cambio de preguntas debe avisarse antes al docente.
- Para PostgreSQL: añade la dependencia `org.postgresql:postgresql` y cambia las 3 líneas `spring.datasource.*` de `application.properties`.
- Escala Likert: la guía menciona 1 a 5; el anexo usa 3 y 4 niveles y la encuesta se mantiene como el anexo. Confírmalo con tu docente.
- Con pocas respuestas el χ² casi nunca es confiable (el panel lo advierte). Reúne más respuestas o agrupa categorías antes de concluir.
- El margen de error del panel supone muestra aleatoria; si la muestra fue por conveniencia, es solo referencial.

## 8. Encuesta de titulados (versión completa del anexo)
La encuesta de titulados reproduce todas las preguntas del anexo, con rutas condicionales (formación complementaria, interés en posgrado, situación laboral). Usa la tabla `titulado`. Si venías de una versión anterior, borra la carpeta `data/` para empezar con las tablas nuevas. Las escalas Likert de titulados son de 4 niveles (1 a 4). La encuesta de empleadores (tabla `empleador`, P1–P12 más 18 afirmaciones) usa 3 niveles (3 = totalmente de acuerdo, 2 = parcialmente, 1 = totalmente en desacuerdo) y 0 = «No sabe», que se excluye de las medias. Años de vida profesional reemplaza al año de egreso para las medidas de antigüedad.
