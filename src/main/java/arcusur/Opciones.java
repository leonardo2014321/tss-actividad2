package arcusur;

import java.util.Map;

/**
 * Opciones de respuesta de cada pregunta cerrada, tal como las ofrece la encuesta (index.html).
 * Sirven para que las tablas incluyan también las opciones que nadie eligió y para contar el número real
 * de categorías en la prueba de uniformidad. Si cambias las opciones en index.html, actualiza este archivo.
 */
final class Opciones {

  private Opciones() {}

  /** Preguntas de la encuesta de titulados (campo -> opciones). */
  static final Map<String, String[]> TITULADOS = Map.ofEntries(
      Map.entry("edad", new String[] {"15 a 18", "19 a 22", "23 a 26", "27 a 30", "31 a 34", "35 años o más"}),
      Map.entry("genero", new String[] {"Hombre", "Mujer"}),
      Map.entry("formacion", new String[] {"SI", "NO"}),
      Map.entry("nivelPosgrado", new String[] {"DIPLOMADO", "ESPECIALIDAD", "MAESTRIA", "DOCTORADO", "POS DOCTORADO"}),
      Map.entry("dondeCurso", new String[] {"ESCUELA UNIVERSITARIA DE POSGRADO (EUPG)", "DIRECCIÓN DE POSGRADO FCyT", "IBNORCA", "UNIVERSIDADES INTERNACIONALES", "UNIVERSIDADES PÚBLICAS NACIONALES", "UNIVERSIDADES PRIVADAS NACIONALES", "OTRO"}),
      Map.entry("financiamiento", new String[] {"FINANCIADO CON RECURSOS PROPIOS", "TOTAL FINANCIAMIENTO POR MEDIO DE UNA BECA", "FINANCIADO PARCIALMENTE POR MEDIO DE UNA BECA"}),
      Map.entry("interes", new String[] {"SI", "NO"}),
      Map.entry("area", new String[] {"IA", "Robótica", "Ingeniería de Software", "Base de Datos", "Redes de Datos y Seguridad"}),
      Map.entry("orgPosgrado", new String[] {"ESCUELA UNIVERSITARIA DE POSGRADO (EUPG)", "DIRECCIÓN DE POSGRADO FCyT", "IBNORCA", "UNIVERSIDADES INTERNACIONALES", "UNIVERSIDADES PÚBLICAS NACIONALES", "UNIVERSIDADES PRIVADAS NACIONALES", "OTRO"}),
      Map.entry("situacion", new String[] {"Actualmente me encuentro trabajando en una organización", "Actualmente NO trabajo", "Actualmente dedico mi tiempo COMPLETO a un emprendimiento propio"}),
      Map.entry("rubro", new String[] {"Telecomunicaciones", "Educación", "Desarrollo de Software", "Redes de Computadoras", "Salud", "Banca", "OTRO RUBRO:"}),
      Map.entry("sector", new String[] {"PÚBLICO", "PRIVADO"}),
      Map.entry("departamento", new String[] {"COCHABAMBA", "CHUQUISACA", "TARIJA", "LA PAZ", "ORURO", "POTOSI", "SANTA CRUZ", "BENI", "PANDO", "EXTRANJERO"}),
      Map.entry("areaOrg", new String[] {"Contabilidad", "Administración", "Cómputo", "Desarrollo", "R.R.H.H.", "OTR@ AREA:"}),
      Map.entry("cargo", new String[] {"Ejecutivo", "Técnico", "Desarrollo", "Help Desk", "OTR@ CARGO:"}),
      Map.entry("antiguedad", new String[] {"Menos de 1 año", "Entre 1 a 2 años", "Entre 2 a 5 años", "Entre 5 a 8 años", "Entre 8 a 11 años", "Entre 11 a 15 años", "Entre 15 a 20 años", "Entre 20 a 25 años", "Más de 25 años"}),
      Map.entry("medio", new String[] {"MEDIOS ESCRITOS O AUDIOVISUALES", "INTERNET Y REDES SOCIALES", "POSTULACIÓN COMPETITIVA (CONVOCATORIAS PÚBLICAS Y PRIVADAS)", "RECOMENDACIÓN DE TERCEROS", "OTROS"}),
      Map.entry("remuneracion", new String[] {"Menor a Bs. 2500", "Entre Bs. 2.500 - Bs. 3.500", "Entre Bs. 3.501 - Bs. 5.000", "Entre Bs. 5.001 - Bs. 7.000", "Entre Bs. 7.001 - Bs. 10.000", "Más de Bs. 10.000"}),
      Map.entry("primerEmpleo", new String[] {"SI", "NO"}),
      Map.entry("tiempoPrimerTrabajo", new String[] {"Ya trabajaba antes de titularse", "Menos de 1 mes", "Entre 1 - 4 meses", "Entre 4 - 8 meses", "Entre 8 - 12 meses", "Más de 12 meses"}),
      Map.entry("numEmpleos", new String[] {"1", "2", "3", "Más de 3"}),
      Map.entry("redContactos", new String[] {"SI", "NO"}),
      Map.entry("utiles", new String[] {"La aplicación práctica de conceptos teóricos en proyectos reales.", "La oportunidad de realizar pasantías o prácticas profesionales.", "La distribución de los horarios de clases.", "El desarrollo de habilidades analíticas y de resolución de problemas.", "La colaboración de equipos multidisciplinarios para resolver problemas complejos.", "La enseñanza de herramientas y software específico de la industria."}),
      Map.entry("mejorar", new String[] {"Mayor integración de la teoría con aplicaciones prácticas en el plan de estudios.", "Mayor relacionamiento del estudiante con las empresas por medio de práctica profesionales.", "La distribución de horarios de clases. (Horario para trabajadores, módulos virtuales, etc)", "Actualización constante del plan de estudios para atender tendencias actuales.", "Incremento de actividades extracurriculares (Investigación, servicio social, etc)", "Ofrecimiento de más opciones de especialización."}),
      Map.entry("ventaja", new String[] {"Introducción", "Base de Datos", "Inteligencia Artificial", "Redes de Computadora", "Electivas", "T.I.S.", "Básicas (Física, Calculo, Algebras)", "Planificación de Proyectos y Gestión", "Tecnologia Redes Avanzadas"}),
      Map.entry("pocoUtiles", new String[] {"Básicas (Física, Calculo, Algebras)", "Aplic. Interactivas para Televisión Digital", "Telefonía IP", "Web Semánticas", "Graficación por Computadora", "Robótica", "Taller de Programación en Bajo Nivel", "Teoría de Autómatas y Leng. Formales", "Programación Funcional", "Teoría de Grafos", "Contabilidad Básica"}));

  /** Preguntas de la encuesta de empleadores (campo -> opciones). */
  static final Map<String, String[]> EMPLEADORES = Map.ofEntries(
      Map.entry("tipo", new String[] {"Público", "Privado"}),
      Map.entry("tamano", new String[] {"Grande (100 funcionarios o más)", "Mediana (entre 31 a 99 funcionarios)", "Pequeña (entre 11 a 30 funcionarios)", "Micro (hasta 10 funcionarios)"}),
      Map.entry("contrato", new String[] {"SI", "No"}),
      Map.entry("proyeccion", new String[] {"Sí, existe una alta probabilidad de contratación", "Sí, dependiendo del crecimiento o nuevos proyectos de la organización", "No se tiene prevista la contratación actualmente", "No requiere profesionales del área de Sistemas"}),
      Map.entry("nivelFormacion", new String[] {"Licenciatura", "Diplomado", "Especialidad", "Maestría", "Doctorado", "Post- doctorado"}),
      Map.entry("rubro", new String[] {"Desarrollo de software", "Servicios de tecnologías de información (TI)", "Telecomunicaciones y redes", "Soporte técnico y mantenimiento de sistemas", "Consultoría en sistemas / transformación digital", "Banca y servicios financieros", "Instituciones públicas / gobierno", "Educación e investigación", "Industria y manufactura", "Comercio y comercio electrónico", "Salud", "Seguridad informática / ciberseguridad", "Análisis de datos / inteligencia de negocios", "Startups o emprendimientos tecnológicos", "Otros:"}),
      Map.entry("medio", new String[] {"Medios escritos y audiovisuales", "Internet y Redes sociales", "Postulación competitiva (convocatorias públicas y privadas)", "Oferta profesional personal", "Recomendación de terceros", "Otros:"}),
      Map.entry("cargos", new String[] {"De apoyo / asistencia tecnológica", "Técnico (desarrollo de software, administración de sistemas, redes, bases de datos, soporte TI)", "Analista (sistemas, datos, procesos o soluciones tecnológicas)", "Especialista (ciberseguridad, arquitectura de software, infraestructura tecnológica, entre otros)", "Supervisor / Coordinador de área tecnológica", "Jefatura o Gerencial (gestión de proyectos, dirección de TI, transformación digital)", "Consultor tecnológico"}));
}
