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

## 2.1 Base de datos persistente
Las respuestas y las simulaciones se guardan en una base de datos que **sobrevive a los reinicios**:
| Opción | Cuándo usarla | Cómo |
|---|---|---|
| **H2 en archivo** (por defecto) | Uso local | No requiere nada: guarda en la carpeta `data/`. Si usas Docker, monta esa carpeta como volumen (`-v arcusur-data:/app/data`) |
| **PostgreSQL** | Servidor o nube (varias personas respondiendo a la vez) | Define `DB_URL=jdbc:postgresql://host:5432/arcusur`, `DB_USER` y `DB_PASSWORD` antes de ejecutar |
| **Docker Compose** | Todo en uno con PostgreSQL ya configurado | `docker compose up --build` (los datos quedan en el volumen `pgdata`; cambia `DB_PASSWORD` en un archivo `.env`) |

Las tablas se crean solas la primera vez y se actualizan sin borrar datos. Haz copias de seguridad de `data/` (H2) o de la base de PostgreSQL (`pg_dump`) antes de cambiar de versión.

## 3. Cómo probarlo (2 minutos)
1. Entra al **Panel** y pulsa **Cargar datos de demostración** (150 titulados y 24 empleadores ficticios, con respuestas relacionadas entre sí y un correo ficticio cada uno; si lo pulsas de nuevo se reemplazan, no se duplican). También deja guardada una simulación Monte Carlo calculada con esos datos.
2. Recorre las pestañas en este orden: **Resumen** (resultados clave y *decisiones sugeridas*), **Titulados** y **Empleadores** (detalle), **Pruebas estadísticas** (uniformidad y relaciones entre variables con χ²), **Simulación** y **Muestra y calidad** (requisitos, validación de datos, fórmulas y descargas). Cada gráfico trae su «Para qué sirve» y su lectura en palabras. Si aún no hay respuestas reales, el panel abre la demostración solo.
3. Pulsa **Borrar datos de demostración**: se borran los titulados, los empleadores **y las simulaciones** que salieron de ellos. Los datos ficticios **no deben usarse como datos de campo**.
4. Llena una encuesta real en la página principal (el correo es obligatorio y cada correo responde una sola vez por encuesta; si se repite, el formulario lo avisa) y mira cómo aparece en el panel. Exporta con los enlaces de descarga (ver sección 4).

## 4. Qué hace el análisis
| Etapa | Qué hace la herramienta |
|---|---|
| Muestra | Tamaño de la muestra, margen de error referencial y empresas individualizadas (públicas y privadas) |
| Recolección | Formulario web con listas cerradas, rutas condicionales y validación en el servidor |
| Limpieza de datos | Unifica mayúsculas, tildes y espacios; agrupa «Otro: …»; convierte las opciones múltiples en columnas 0/1; reporta duplicados, incoherencias y atípicos (regla de Tukey) |
| Estadística univariada | Frecuencias absolutas y relativas; en los años de vida profesional: n, media, mediana, moda, rango, varianza, desviación, coeficiente de variación, cuartiles, P90, asimetría y atípicos (Tukey); porcentajes por nivel y % de acuerdo en las escalas Likert |
| Uniformidad | Prueba χ² de bondad de ajuste en cada pregunta de opción única: FE = n/k, χ², valor crítico (α = 5 %) y conclusión «Uniformidad» o «No uniformidad». Cuenta todas las opciones de la pregunta, también las que nadie eligió |
| Estadística bivariada (independencia) | 5 cruces con χ², grados de libertad, p, V de Cramér, frecuencias esperadas y residuos; avisa si el χ² no es confiable (más del 20 % de celdas con esperada menor a 5) |
| Visualización | Barras, histograma, **diagrama de caja**, **ojiva** y tabla de frecuencias (con marca de clase y acumuladas), barras Likert apiladas, **radar** titulados vs. empleadores, mapa de calor y curvas de simulación. Se quitó el radar de una sola serie porque repetía las barras Likert. El panel se puede imprimir |
| Decisiones | Tabla «Decisiones sugeridas» en el Resumen: cada fila muestra evidencia, regla con umbral y acción (ver sección 4.1) |
| Calidad | Pestaña «Muestra y calidad»: requisitos de la guía (≥ 3 empresas, pública y privada), validación de datos (duplicados, vacíos, rangos, negativos, incoherencias, atípicos), fórmulas y su equivalente en Excel |
| Simulación | Monte Carlo: probabilidad de abrir un programa, escenario base vs. con becas. La probabilidad de interés se toma de las respuestas del origen de datos elegido (reales, demostración o ambos) y cada área de posgrado se simula con la participación que tuvo en esas respuestas. Cada corrida se guarda en la base con su origen de datos |

### 4.1 Reglas de decisión (umbrales)
Están en la constante `UMB` al inicio del script de `dashboard.html`; si el equipo los cambia, todo el panel se ajusta.
| Decisión | Regla | Fuente |
|---|---|---|
| Hay demanda de posgrado | ≥ 50 % de titulados interesados | criterio del equipo |
| Concentrar la oferta en dos áreas | las dos primeras suman > 70 % | guía, historia de usuario 2 |
| Dependencia de recursos propios | ≥ 50 % → becas y convenios con la banca | guía, historia de usuario 3 |
| Brecha de formación | < 60 % de acuerdo (atención 60–79 %, fortaleza ≥ 80 %) | criterio del equipo |
| Inserción laboral aceptable | ≥ 70 % trabaja o emprende | criterio del equipo |
| Primer empleo lento | ≥ 40 % tardó más de 4 meses | criterio del equipo |
| Demanda del mercado alta | ≥ 60 % de organizaciones prevé contratar | criterio del equipo |
| Resultados estables | ≥ 30 titulados y margen ≤ 10 puntos | criterio del equipo |
Con datos de demostración las decisiones no valen: son solo para probar el panel.

### Descargas (panel o URL)
| Archivo | Contenido |
|---|---|
| `/api/export/titulados.csv`, `empleadores.csv` | Datos **limpios** para analizar |
| `/api/export/titulados_crudo.csv`, `empleadores_crudo.csv` | Copia fiel de la base de datos (trazabilidad) |
| `/api/export/uniformidad.csv` | Resultado de la prueba de uniformidad de cada pregunta, con las frecuencias observadas |
| `/api/export/simulaciones.csv` | Corridas Monte Carlo guardadas: origen de datos, titulados usados, parámetros y resultados (también en `GET /api/simulaciones`) |
| `/api/export/diccionario.csv` | Qué significa cada variable y qué limpieza recibe |
| `/api/export/cruce/<id>.csv` | Matriz de un cruce: frecuencias, % por fila, esperados, residuos y χ² (`fin-nivel`, `area-sector`, `seg-area`, `int-sit`, `area-fin`) |

Todos aceptan `?datos=reales|demo|todos` (por defecto `reales`) y `?sep=,` (por defecto `;`, que es el que espera Excel en español). Para obtener los CSV con coma, agrega `?sep=,` a la URL de descarga. El CSV de titulados incluye correo y teléfono: no lo publiques ni lo compartas.

## 5. Estructura
```
pom.xml                         dependencias
docker-compose.yml              aplicación + PostgreSQL con volumen persistente
src/main/java/arcusur/          Titulado, Empleador, Simulacion (entidades), repositorios
                                Api (rutas REST y simulación), Estadistica (limpieza, frecuencias, χ²), Exportacion (CSV),
                                Opciones (opciones de cada pregunta, tomadas de index.html)
src/main/resources/static/      index.html (encuestas), dashboard.html (panel), app.css y encuesta.css
src/test/java/arcusur/          EstadisticaTest: 11 pruebas de validación de los cálculos (mvn test)
src/main/resources/application.properties   configuración (puerto, base de datos)
```

## 5.1 Pruebas de validación
`mvn test` ejecuta 11 pruebas JUnit sobre `Estadistica`. Los valores esperados NO salen del programa: se calcularon aparte con Python (numpy/scipy) y se pueden repetir en Excel o Google Sheets (PROMEDIO, MEDIANA, MODA, VAR.S, DESVEST.M, CUARTIL.INC, PERCENTIL.INC, COEF.ASIMETRIA). Cubren media, mediana, moda, rango, varianza, desviación, CV, cuartiles, P90, asimetría, atípicos, casos límite, χ² de uniformidad, χ² de independencia con p y V de Cramér, la advertencia de χ² no confiable y los Likert con «No sabe». Los cuartiles usan el método R-7 (el de Excel); otros programas usan otros métodos y pueden dar valores algo distintos.

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
- El correo identifica cada respuesta, pero no se verifica (no se envía un mensaje de confirmación): alguien podría escribir un correo ajeno.
- Una persona con un correo ya registrado no puede corregir su respuesta desde el formulario; hay que editarla en la base de datos.
- Escalas Likert: 4 niveles en titulados y 3 niveles más «No sabe» en empleadores (la guía sugiere 1 a 5; por eso titulados y empleadores se comparan como % de acuerdo y no como medias). Si el docente exige 5 niveles, hay que cambiar `index.html`, `Titulado.java` y las constantes `NIV4/COL4` del panel.
- Los años de vida profesional reemplazan al «año de egreso» de la guía; sirven para las mismas medidas (media, mediana, desviación) y para separar junior y consolidados.
- El formulario no incluye aún un texto de consentimiento informado: agréguelo en `index.html` antes de recoger datos reales.
- Si cambias las opciones de una pregunta en `index.html`, actualiza también `Opciones.java` (la prueba de uniformidad usa ese número de categorías).
- Con pocas respuestas el χ² casi nunca es confiable (el panel lo advierte). Reúne más respuestas o agrupa categorías antes de concluir.
- El margen de error del panel supone muestra aleatoria; si la muestra fue por conveniencia, es solo referencial.

## 8. Estructura de las encuestas
Cada respuesta lleva un **correo único** (`email`) y la hora de registro (`registrado`). En titulados el correo está en el último paso; en empleadores hay un paso «Contacto». La encuesta de titulados tiene rutas condicionales (formación complementaria, interés en posgrado, situación laboral). Usa la tabla `titulado`. Si venías de una versión anterior, borra la carpeta `data/` para empezar con las tablas nuevas. Las escalas Likert de titulados son de 4 niveles (1 a 4). La encuesta de empleadores (tabla `empleador`, P1–P12 más 18 afirmaciones) usa 3 niveles (3 = totalmente de acuerdo, 2 = parcialmente, 1 = totalmente en desacuerdo) y 0 = «No sabe», que se excluye de las medias. Años de vida profesional reemplaza al año de egreso para las medidas de antigüedad.
