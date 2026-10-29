// Definición de las encuestas: opciones de respuesta y pasos con sus preguntas.
// Para agregar o cambiar una pregunta se edita solo este archivo; formulario.js la dibuja y valida.

// ============================================================
// 1. OPCIONES DE RESPUESTA
// ============================================================
// SI: opciones de las preguntas sí/no. L4: escala Likert de 4 niveles (se guarda como 1 a 4).
// DON: organizaciones educativas (se reutiliza en dos preguntas de titulados).
const SI = ["SI", "NO"],
  L4 = ["Totalmente en desacuerdo", "En desacuerdo", "De acuerdo", "Totalmente de Acuerdo"],
  DON = [
    "ESCUELA UNIVERSITARIA DE POSGRADO (EUPG)",
    "DIRECCIÓN DE POSGRADO FCyT",
    "IBNORCA",
    "UNIVERSIDADES INTERNACIONALES",
    "UNIVERSIDADES PÚBLICAS NACIONALES",
    "UNIVERSIDADES PRIVADAS NACIONALES",
    "OTRO",
  ];
// OPC: opciones de cada pregunta, indexadas por el nombre del campo (el mismo de las entidades Java).
const OPC = {
  edad: ["15 a 18", "19 a 22", "23 a 26", "27 a 30", "31 a 34", "35 años o más"],
  genero: ["Hombre", "Mujer"],
  formacion: SI,
  nivelPosgrado: ["DIPLOMADO", "ESPECIALIDAD", "MAESTRIA", "DOCTORADO", "POS DOCTORADO"],
  dondeCurso: DON,
  orgPosgrado: DON,
  financiamiento: [
    "FINANCIADO CON RECURSOS PROPIOS",
    "TOTAL FINANCIAMIENTO POR MEDIO DE UNA BECA",
    "FINANCIADO PARCIALMENTE POR MEDIO DE UNA BECA",
  ],
  interes: SI,
  area: ["IA", "Robótica", "Ingeniería de Software", "Base de Datos", "Redes de Datos y Seguridad"],
  situacion: [
    "Actualmente me encuentro trabajando en una organización",
    "Actualmente NO trabajo",
    "Actualmente dedico mi tiempo COMPLETO a un emprendimiento propio",
  ],
  rubro: [
    "Telecomunicaciones",
    "Educación",
    "Desarrollo de Software",
    "Redes de Computadoras",
    "Salud",
    "Banca",
    "OTRO RUBRO:",
  ],
  sector: ["PÚBLICO", "PRIVADO"],
  departamento: [
    "COCHABAMBA",
    "CHUQUISACA",
    "TARIJA",
    "LA PAZ",
    "ORURO",
    "POTOSI",
    "SANTA CRUZ",
    "BENI",
    "PANDO",
    "EXTRANJERO",
  ],
  areaOrg: ["Contabilidad", "Administración", "Cómputo", "Desarrollo", "R.R.H.H.", "OTR@ AREA:"],
  cargo: ["Ejecutivo", "Técnico", "Desarrollo", "Help Desk", "OTR@ CARGO:"],
  antiguedad: [
    "Menos de 1 año",
    "Entre 1 a 2 años",
    "Entre 2 a 5 años",
    "Entre 5 a 8 años",
    "Entre 8 a 11 años",
    "Entre 11 a 15 años",
    "Entre 15 a 20 años",
    "Entre 20 a 25 años",
    "Más de 25 años",
  ],
  medio: [
    "MEDIOS ESCRITOS O AUDIOVISUALES",
    "INTERNET Y REDES SOCIALES",
    "POSTULACIÓN COMPETITIVA (CONVOCATORIAS PÚBLICAS Y PRIVADAS)",
    "RECOMENDACIÓN DE TERCEROS",
    "OTROS",
  ],
  remuneracion: [
    "Menor a Bs. 2500",
    "Entre Bs. 2.500 - Bs. 3.500",
    "Entre Bs. 3.501 - Bs. 5.000",
    "Entre Bs. 5.001 - Bs. 7.000",
    "Entre Bs. 7.001 - Bs. 10.000",
    "Más de Bs. 10.000",
  ],
  primerEmpleo: SI,
  tiempoPrimerTrabajo: [
    "Ya trabajaba antes de titularse",
    "Menos de 1 mes",
    "Entre 1 - 4 meses",
    "Entre 4 - 8 meses",
    "Entre 8 - 12 meses",
    "Más de 12 meses",
  ],
  numEmpleos: ["1", "2", "3", "Más de 3"],
  utiles: [
    "La aplicación práctica de conceptos teóricos en proyectos reales.",
    "La oportunidad de realizar pasantías o prácticas profesionales.",
    "La distribución de los horarios de clases.",
    "El desarrollo de habilidades analíticas y de resolución de problemas.",
    "La colaboración de equipos multidisciplinarios para resolver problemas complejos.",
    "La enseñanza de herramientas y software específico de la industria.",
  ],
  mejorar: [
    "Mayor integración de la teoría con aplicaciones prácticas en el plan de estudios.",
    "Mayor relacionamiento del estudiante con las empresas por medio de práctica profesionales.",
    "La distribución de horarios de clases. (Horario para trabajadores, módulos virtuales, etc)",
    "Actualización constante del plan de estudios para atender tendencias actuales.",
    "Incremento de actividades extracurriculares (Investigación, servicio social, etc)",
    "Ofrecimiento de más opciones de especialización.",
  ],
  ventaja: [
    "Introducción",
    "Base de Datos",
    "Inteligencia Artificial",
    "Redes de Computadora",
    "Electivas",
    "T.I.S.",
    "Básicas (Física, Calculo, Algebras)",
    "Planificación de Proyectos y Gestión",
    "Tecnologia Redes Avanzadas",
  ],
  pocoUtiles: [
    "Básicas (Física, Calculo, Algebras)",
    "Aplic. Interactivas para Televisión Digital",
    "Telefonía IP",
    "Web Semánticas",
    "Graficación por Computadora",
    "Robótica",
    "Taller de Programación en Bajo Nivel",
    "Teoría de Autómatas y Leng. Formales",
    "Programación Funcional",
    "Teoría de Grafos",
    "Contabilidad Básica",
  ],
  redContactos: SI,
  tipo: ["Público", "Privado"],
  tamano: [
    "Grande (100 funcionarios o más)",
    "Mediana (entre 31 a 99 funcionarios)",
    "Pequeña (entre 11 a 30 funcionarios)",
    "Micro (hasta 10 funcionarios)",
  ],
  contrato: ["SI", "No"],
  proyeccion: [
    "Sí, existe una alta probabilidad de contratación",
    "Sí, dependiendo del crecimiento o nuevos proyectos de la organización",
    "No se tiene prevista la contratación actualmente",
    "No requiere profesionales del área de Sistemas",
  ],
  nivelFormacion: ["Licenciatura", "Diplomado", "Especialidad", "Maestría", "Doctorado", "Post- doctorado"],
};
// Encuesta de empleadores: opciones propias (los nombres de campo rubro y medio ya los usan los titulados)
const RUBE = [
    "Desarrollo de software",
    "Servicios de tecnologías de información (TI)",
    "Telecomunicaciones y redes",
    "Soporte técnico y mantenimiento de sistemas",
    "Consultoría en sistemas / transformación digital",
    "Banca y servicios financieros",
    "Instituciones públicas / gobierno",
    "Educación e investigación",
    "Industria y manufactura",
    "Comercio y comercio electrónico",
    "Salud",
    "Seguridad informática / ciberseguridad",
    "Análisis de datos / inteligencia de negocios",
    "Startups o emprendimientos tecnológicos",
    "Otros:",
  ],
  MEDE = [
    "Medios escritos y audiovisuales",
    "Internet y Redes sociales",
    "Postulación competitiva (convocatorias públicas y privadas)",
    "Oferta profesional personal",
    "Recomendación de terceros",
    "Otros:",
  ],
  CARE = [
    "De apoyo / asistencia tecnológica",
    "Técnico (desarrollo de software, administración de sistemas, redes, bases de datos, soporte TI)",
    "Analista (sistemas, datos, procesos o soluciones tecnológicas)",
    "Especialista (ciberseguridad, arquitectura de software, infraestructura tecnológica, entre otros)",
    "Supervisor / Coordinador de área tecnológica",
    "Jefatura o Gerencial (gestión de proyectos, dirección de TI, transformación digital)",
    "Consultor tecnológico",
  ];
// Escala de afirmaciones de empleadores: valor guardado = 3, 2, 1 y 0 (No sabe, se excluye de las medias)
const L3 = [
  ["Totalmente de acuerdo", 3],
  ["Parcialmente de acuerdo", 2],
  ["Totalmente en desacuerdo", 1],
  ["No sabe", 0],
];
// AF: nombres de las 18 afirmaciones de empleadores (fp1..fp10 y vc1..vc8).
const AF = [
  "fp1",
  "fp2",
  "fp3",
  "fp4",
  "fp5",
  "fp6",
  "fp7",
  "fp8",
  "fp9",
  "fp10",
  "vc1",
  "vc2",
  "vc3",
  "vc4",
  "vc5",
  "vc6",
  "vc7",
  "vc8",
];
// NUM: campos que deben enviarse como número y no como texto.
const NUM = [
  "aniosProfesionales",
  "aniosDesempleado",
  "opinionPosgrado",
  "pertinencia",
  "satisfaccion",
  "concordancia",
  ...AF,
];
// ============================================================
// 2. DEFINICIÓN DE LAS ENCUESTAS
// ============================================================
// F(nombre, enunciado, tipo, extras) crea una pregunta. Tipos:
//   0 (sin tipo)  opción única (botones, o lista desplegable si hay más de 6 opciones)
//   "t" texto corto   "a" texto largo   "n" número   "e" correo   "p" teléfono
//   "m" elección múltiple   "l4" Likert de 4 niveles   "l3" acuerdo de 3 niveles + No sabe
// Extras: w = [campo, valor] la muestra solo si ese campo empieza con ese valor (ruta condicional);
//         o = opciones propias; max = cantidad exacta a elegir; otra = campo de texto adicional; opt = opcional.
// W1, W2, WT: condiciones reutilizables (tiene formación, tiene interés, trabaja en una organización).
const F = (n, l, t, x = {}) => ({ n, l, t, ...x }),
  W1 = ["formacion", "SI"],
  W2 = ["interes", "SI"],
  WT = ["situacion", "Actualmente me encuentro"];
// PASOS: cada encuesta es una lista de pasos (pantallas); cada paso tiene título (t), descripción (d, opcional),
// condición (w, opcional) y sus preguntas (c).
// ---- Encuesta de TITULADOS ----
const PASOS = {
  titulados: [
    { t: "Datos generales", c: [F("edad", "Edad que tiene actualmente"), F("genero", "Género")] },
    // Paso con ruta condicional: las preguntas siguientes solo aparecen si respondió SI.
    {
      t: "Formación complementaria",
      c: [
        F(
          "formacion",
          "Posterior a sus estudios de pregrado en Ingeniería en Sistemas, ¿ha realizado o se encuentra realizando algún programa de formación complementaria? (posgrado, diplomado, doble titulación, especializaciones, etc.)",
        ),
        F(
          "nivelPosgrado",
          "¿Cuál es el programa de formación complementaria de mayor nivel que ha concluido o que se encuentra realizando?",
          0,
          { w: W1 },
        ),
        F("dondeCurso", "¿Dónde ha cursado el programa indicado?", 0, { w: W1 }),
        F("financiamiento", "¿Cuál fue la fuente de financiamiento para cursar el programa indicado?", 0, { w: W1 }),
        F("nombrePrograma", "Indique el nombre del programa", "t", { w: W1 }),
      ],
    },
    {
      t: "Interés en posgrado",
      c: [
        F(
          "interes",
          "¿Estaría interesado en realizar estudios en algún programa de posgrado dentro de las áreas de la Ingeniería en Sistemas?",
        ),
        F("area", "¿En cuál de las siguientes áreas le interesaría realizar el programa?", 0, { w: W2 }),
        F(
          "orgPosgrado",
          "En caso de realizar un estudio de posgrado, ¿en qué organización educativa optaría por realizar sus estudios?",
          0,
          { w: W2 },
        ),
        F(
          "opinionPosgrado",
          "¿Considera que existen programas de posgrado ofertados en la Dirección de Posgrado de la FCyT que son afines a las áreas de especialidad de un Ingeniero en Sistemas?",
          "l4",
        ),
      ],
    },
    {
      t: "Experiencia profesional",
      c: [
        F("aniosProfesionales", "¿Cuántos son los años de vida profesional que lleva hasta la fecha?", "n"),
        F("aniosDesempleado", "Del tiempo anterior, ¿cuántos años ha estado desempleado? (escriba 0 si ninguno)", "n"),
        F("situacion", "¿Cuál de las siguientes afirmaciones describe su situación laboral actual?"),
      ],
    },
    // Los pasos 5 y 6 solo se muestran si la persona trabaja en una organización (WT).
    {
      t: "Su organización",
      w: WT,
      c: [
        F("empresa", "Nombre de la empresa u organización donde trabaja actualmente", "t"),
        F("rubro", "¿Cuál es el rubro de la organización donde trabaja actualmente?"),
        F("sector", "El trabajo en el que se encuentra, ¿a qué sector corresponde?"),
        F("departamento", "¿En qué departamento de Bolivia trabaja?"),
        F("areaOrg", "¿Cuál es el área dentro de la organización donde desarrolla sus actividades profesionales?"),
      ],
    },
    {
      t: "Su puesto de trabajo",
      w: WT,
      c: [
        F("cargo", "¿Cuál es el cargo que desempeña en su actual trabajo?"),
        F(
          "pertinencia",
          "En su actual puesto de trabajo, las labores que desempeña son pertinentes a su formación como Ingeniero de Sistemas.",
          "l4",
        ),
        F("antiguedad", "¿Qué antigüedad tiene en su actual trabajo?"),
        F("medio", "¿A través de qué medio obtuvo el trabajo que actualmente desempeña?"),
        F("remuneracion", "Señale la remuneración promedio mensual que está percibiendo en su actual trabajo."),
        F("primerEmpleo", "¿El trabajo que ejerce actualmente es su primer empleo?"),
      ],
    },
    {
      t: "Trayectoria y satisfacción",
      c: [
        F(
          "tiempoPrimerTrabajo",
          "Luego de titularse, ¿cuánto tiempo se demoró en conseguir su primer trabajo relacionado con su formación como Ingeniero en Sistemas?",
        ),
        F(
          "numEmpleos",
          "Desde que se tituló, ¿en cuántos empleos se ha desempeñado? (incluyendo su actual empleo si corresponde)",
        ),
        F(
          "satisfaccion",
          "De manera global, ¿cuál es el grado de satisfacción que ha desarrollado con la formación profesional recibida en la Carrera de Ingeniería de Sistemas?",
          "l4",
        ),
        F(
          "concordancia",
          "¿Considera que existe concordancia entre la formación profesional recibida en la Carrera de Ingeniería de Sistemas y los requerimientos laborales?",
          "l4",
        ),
      ],
    },
    {
      t: "Aspectos de la Carrera",
      c: [
        F("utiles", "¿Qué aspectos de la Carrera le resultaron de bastante utilidad?", "m"),
        F("mejorar", "¿Qué aspectos de la Carrera considera que pueden mejorarse?", "m"),
      ],
    },
    {
      t: "Asignaturas",
      c: [
        F(
          "ventaja",
          "Indique 5 asignaturas cursadas en la Carrera que le brindaron una ventaja competitiva al momento de buscar trabajo o desenvolverse profesionalmente.",
          "m",
          { max: 5, otra: 1 },
        ),
        F(
          "pocoUtiles",
          "Indique 5 asignaturas cursadas en la Carrera que no le resultaron de mucha utilidad en su vida profesional.",
          "m",
          { max: 5, otra: 1 },
        ),
      ],
    },
    {
      t: "Red de contactos",
      c: [
        F(
          "redContactos",
          "¿Le interesaría formar parte de una red de contactos oficial de la Carrera de Ingeniería en Sistemas para compartir experiencias, proyectos y ofertas laborales?",
        ),
        F("email", "Email de contacto (identifica su respuesta: una por correo)", "e"),
        F("telefono", "Número telefónico de contacto (de preferencia con WhatsApp)", "p", { opt: 1 }),
        F("linkedin", "Link de LinkedIn", "t", { opt: 1 }),
      ],
    },
  ],
  // ---- Encuesta de EMPLEADORES ----
  empleadores: [
    {
      t: "Su organización",
      c: [
        F("empresa", "Nombre de la empresa o institución", "t"),
        F("tipo", "Tipo de organización"),
        F(
          "tamano",
          "Indique el tamaño de la organización en la que se desempeña laboralmente el profesional titulado de la Carrera de Ingeniería de Sistemas.",
        ),
        F(
          "rubro",
          "Indique el rubro o sector principal de la organización en la que se desempeña laboralmente el profesional titulado de la Carrera de Ingeniería de Sistemas.",
          0,
          { o: RUBE },
        ),
      ],
    },
    {
      t: "Empleabilidad",
      d: "Se busca conocer la demanda laboral, oportunidades de contratación y desempeño de los profesionales titulados de Ingeniería de Sistemas en las organizaciones, con el fin de evaluar la pertinencia de la formación profesional frente a las necesidades del entorno laboral.",
      c: [
        F("contrato", "¿La organización ha contratado Ingenieros de la carrera de Sistemas en los últimos 5 años?"),
        F(
          "proyeccion",
          "Considerando las necesidades actuales y proyectadas de la organización, ¿existe la posibilidad de incorporar Ingenieros de Sistemas en su equipo de trabajo durante los próximos años?",
        ),
        F(
          "nivelFormacion",
          "¿Qué nivel de formación académica o actualización profesional demanda su organización para contratar nuevos profesionales del área?",
        ),
        F("medio", "¿A través de qué medio convoca a profesionales en su organización (empresa o institución)?", 0, {
          o: MEDE,
        }),
        F(
          "cargos",
          "¿Qué tipo de cargos desempeñan los profesionales titulados de la Carrera de Ingeniería de Sistemas en su organización? (Puede seleccionar más de una opción)",
          "m",
          { o: CARE, otra: "Otros (especifique, opcional)" },
        ),
      ],
    },
    {
      t: "Contacto",
      d: "El correo identifica su respuesta: cada correo puede responder esta encuesta una sola vez.",
      c: [F("email", "Correo electrónico de contacto de la organización", "e")],
    },
    {
      t: "Tendencias y competencias",
      c: [
        F(
          "areasEmergentes",
          "Desde su experiencia en el sector laboral, ¿qué nuevas áreas de conocimiento, tecnologías o tendencias emergentes considera importantes para la formación del profesional de Ingeniería de Sistemas?",
          "a",
        ),
        F(
          "herramientas",
          "¿Cuáles son las nuevas herramientas tecnológicas (software, plataformas o entornos de desarrollo) que, a su criterio, debería conocer y manejar el profesional titulado de la Carrera de Ingeniería de Sistemas?",
          "a",
        ),
        F(
          "competencias",
          "Desde su experiencia en el ámbito laboral, ¿qué habilidades, competencias y destrezas considera fundamentales que debe desarrollar el profesional de Ingeniería de Sistemas para responder adecuadamente a las necesidades de la organización y del mercado laboral?",
          "a",
        ),
      ],
    },
    {
      t: "Formación y perfil profesional",
      d: "Se busca conocer la valoración de los empleadores sobre la formación, competencias y desempeño profesional de los titulados de Ingeniería de Sistemas, con el propósito de fortalecer la calidad académica y adecuar el perfil profesional a las necesidades del mercado laboral.",
      c: [
        F(
          "fp1",
          "La Carrera de Ingeniería de Sistemas de la Universidad Mayor de San Simón brinda confianza a nuestra organización como formadora de profesionales del área tecnológica.",
          "l3",
        ),
        F(
          "fp2",
          "Considero que el título profesional otorgado por la Carrera de Ingeniería de Sistemas es consistente con el nivel de formación y las competencias demostradas por sus titulados.",
          "l3",
        ),
        F(
          "fp3",
          "Las autoridades de la Carrera de Ingeniería de Sistemas consultan regularmente nuestra opinión como empleadores respecto al perfil profesional y las competencias requeridas en el ámbito laboral.",
          "l3",
        ),
        F(
          "fp4",
          "Conozco el perfil profesional y las competencias de egreso declaradas por la Carrera de Ingeniería de Sistemas.",
          "l3",
        ),
        F(
          "fp5",
          "El perfil profesional declarado por la Carrera de Ingeniería de Sistemas es coherente con el desempeño laboral demostrado por sus titulados.",
          "l3",
        ),
        F(
          "fp6",
          "La formación proporcionada por la Carrera de Ingeniería de Sistemas permite a sus titulados alcanzar un desempeño destacado tanto en el ámbito profesional como en su formación integral.",
          "l3",
        ),
        F(
          "fp7",
          "La Carrera de Ingeniería de Sistemas considera nuestra opinión como empleadores e incorpora las necesidades del sector laboral en la definición y mejora de actividades de formación práctica, pasantías y modalidades de titulación.",
          "l3",
        ),
        F(
          "fp8",
          "El desempeño profesional de los titulados de Ingeniería de Sistemas evidencia el desarrollo de competencias laborales como: comunicación efectiva, análisis y resolución de problemas, pensamiento crítico, aprendizaje continuo, trabajo en equipo, iniciativa personal y manejo adecuado de tecnologías de información.",
          "l3",
        ),
        F(
          "fp9",
          "Los profesionales titulados de Ingeniería de Sistemas demuestran valores y actitudes relacionados con la ética profesional, responsabilidad social, inclusión, diversidad, respeto a los derechos humanos y compromiso con el medio ambiente.",
          "l3",
        ),
        F(
          "fp10",
          "He participado en procesos de recopilación de información, evaluación o retroalimentación relacionados con el desempeño laboral de los titulados de la Carrera de Ingeniería de Sistemas.",
          "l3",
        ),
      ],
    },
    {
      t: "Relación de la Carrera con la organización",
      d: "Esta sección tiene como objetivo conocer la relación entre la Carrera de Ingeniería de Sistemas y las organizaciones del sector laboral, así como su participación en actividades de vinculación y retroalimentación.",
      c: [
        F(
          "vc1",
          "La Carrera de Ingeniería de Sistemas mantiene vínculos con organizaciones e instituciones que generan oportunidades laborales para sus titulados.",
          "l3",
        ),
        F(
          "vc2",
          "He participado en actividades de vinculación con el entorno laboral y tecnológico organizadas por la Carrera de Ingeniería de Sistemas o la Facultad de Ciencias y Tecnología.",
          "l3",
        ),
        F(
          "vc3",
          "He participado en actividades de difusión de oportunidades laborales, convocatorias, pasantías o prácticas profesionales organizadas por la Carrera de Ingeniería de Sistemas.",
          "l3",
        ),
        F(
          "vc4",
          "He participado en actividades de vinculación entre profesionales del sector tecnológico, empleadores, docentes y estudiantes de la Carrera de Ingeniería de Sistemas para el intercambio de conocimientos, experiencias y desarrollo de trabajos conjuntos.",
          "l3",
        ),
        F(
          "vc5",
          "Como empleador, he sido consultado sobre el desempeño profesional de los titulados de Ingeniería de Sistemas, con el propósito de retroalimentar el perfil profesional y el plan de estudios de la Carrera.",
          "l3",
        ),
        F(
          "vc6",
          "Como empleador, la Carrera de Ingeniería de Sistemas ha consultado nuestra opinión respecto a la pertinencia de la formación impartida y su correspondencia con las necesidades del sector tecnológico y laboral.",
          "l3",
        ),
        F(
          "vc7",
          "Cuando nuestra organización requiere profesionales del área de Sistemas, recurrimos a la Universidad Mayor de San Simón y a la Carrera de Ingeniería de Sistemas como fuente de búsqueda de talento profesional.",
          "l3",
        ),
        F(
          "vc8",
          "He sido consultado periódicamente por la Carrera de Ingeniería de Sistemas durante sus procesos de autoevaluación y mejora continua.",
          "l3",
        ),
      ],
    },
  ],
};

export { OPC, PASOS, NUM, L3, L4 };
