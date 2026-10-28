// Títulos y etiquetas de cada pregunta, tal como se muestran en el panel.

export const TT = {
  edad: "Edad",
  genero: "Género",
  situacion: "Situación laboral actual",
  tiempoPrimerTrabajo: "Tiempo hasta el primer trabajo",
  numEmpleos: "Empleos desde la titulación",
  nivelPosgrado: "Mayor nivel de formación complementaria",
  financiamiento: "Fuente de financiamiento",
  area: "Área de posgrado de interés",
  orgPosgrado: "Organización donde estudiarían",
  rubro: "Rubro de la organización",
  sector: "Sector (público o privado)",
  departamento: "Departamento",
  remuneracion: "Remuneración mensual promedio",
  utiles: "Aspectos de la Carrera que resultaron útiles",
  mejorar: "Aspectos que pueden mejorarse",
  ventaja: "Asignaturas con ventaja competitiva",
  pocoUtiles: "Asignaturas de poca utilidad",
};

export const TE = {
  tipo: "Tipo de organización",
  tamano: "Tamaño de la organización",
  rubro: "Rubro o sector principal",
  contrato: "Contrataron Ingenieros de Sistemas en los últimos 5 años",
  proyeccion: "Posibilidad de incorporar Ingenieros de Sistemas",
  nivelFormacion: "Nivel de formación que demandan",
  medio: "Medio de convocatoria",
  cargos: "Cargos que ocupan los titulados",
};

/** Aclaración de a quién corresponde cada pregunta (solo si no la respondieron todos). */
export const ALCANCE = {
  nivelPosgrado: "Quienes cursaron formación complementaria",
  financiamiento: "Del programa que cursaron",
  area: "Quienes están interesados en un posgrado",
  orgPosgrado: "Quienes están interesados en un posgrado",
  sector: "Quienes trabajan en una organización",
  departamento: "Quienes trabajan en una organización",
  remuneracion: "Quienes trabajan en una organización",
  ventaja: "Cada persona eligió 5",
  pocoUtiles: "Cada persona eligió 5",
};

/** Afirmaciones tipo Likert de los titulados. */
export const LT = {
  opinionPosgrado: "Existen posgrados de la FCyT afines a Sistemas",
  pertinencia: "Mi trabajo es pertinente a mi formación",
  satisfaccion: "Satisfacción global con la formación recibida",
  concordancia: "La formación concuerda con lo que exige el trabajo",
};

/** Afirmaciones de empleadores: formación y perfil profesional. */
export const FPL = {
  fp1: "Confianza en la Carrera como formadora",
  fp2: "Título consistente con las competencias",
  fp3: "Las autoridades nos consultan sobre el perfil",
  fp4: "Conozco el perfil de egreso",
  fp5: "Perfil coherente con el desempeño",
  fp6: "La formación permite un desempeño destacado",
  fp7: "La Carrera incorpora nuestra opinión",
  fp8: "Competencias laborales demostradas",
  fp9: "Valores y ética demostrados",
  fp10: "Participé en recopilación de información",
};

/** Afirmaciones de empleadores: relación de la Carrera con la organización. */
export const VCL = {
  vc1: "Vínculos que generan oportunidades",
  vc2: "Participé en vinculación con el entorno",
  vc3: "Participé en difusión de oportunidades",
  vc4: "Participé en vinculación entre actores",
  vc5: "Me consultaron sobre el desempeño",
  vc6: "Me consultaron sobre la pertinencia",
  vc7: "Recurrimos a la UMSS para buscar talento",
  vc8: "Me consultaron en la autoevaluación",
};

/** Afirmaciones equivalentes entre titulados y empleadores: [aspecto, campo titulado, campo empleador]. */
export const PARES = [
  ["Formación coherente con el desempeño", "concordancia", "fp5"],
  ["Satisfacción y confianza en la Carrera", "satisfaccion", "fp1"],
  ["Competencias aplicadas en el trabajo", "pertinencia", "fp8"],
];
