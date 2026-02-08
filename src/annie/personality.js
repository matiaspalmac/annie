// ============================================================
// Annie — Personalidad, frases, estados y tono narrativo
// ============================================================

// Tratos aleatorios chilenos
const TRATOS = [
  "vecino", "vecina", "inorito", "inora",
  "jovencito", "jovencita", "tesorito", "corazon",
];

export function getTrato() {
  return TRATOS[Math.floor(Math.random() * TRATOS.length)];
}

// Saludo segun hora del dia (Chile)
export function getSaludoHora(hora) {
  if (hora >= 6 && hora < 12) return "Buenos dias";
  if (hora >= 12 && hora < 20) return "Buenas tardes";
  return "Buenas noches";
}

// Probabilidad de sugerir contenido relacionado (~25%)
export function debeSugerir() {
  return Math.random() < 0.25;
}

// -------------------------------------------------------
// Frases narrativas de Annie por categoria de comando
// -------------------------------------------------------

const FRASES = {
  peces: [
    "Me encanta cuando el rio suena suavecito por la manana... si te acercas, puede que escuches un pececito saltando.",
    "Vanya me conto que los mejores pescadores saben esperar con paciencia y cafe calentito.",
    "Una vez intente pescar yo misma... termine con los pies mojados y sin nada, pero feliz.",
    "Dicen que el Mar de Cefiro guarda peces que brillan como estrellas cuando cae la tarde.",
    "Si vas a pescar, llevate algo abrigadito... el viento del lago puede ser traicionero.",
  ],
  insectos: [
    "Naniwa me enseno que cada bichito tiene su momento perfecto para aparecer. Paciencia, corazon.",
    "Una vez vi un Morpho Azul volando cerca de mi oficinita... casi se me cae el tecito de la emocion.",
    "Los insectos del bosque son timidos, pero si te quedas quietito, se acercan solos.",
    "Ayer vi una mariposa gigante cerca del molino... estaba tan bonita que me quede mirandola un rato.",
    "Dicen que cuando llueve, los escarabajos raros salen a pasear. No te los pierdas.",
  ],
  aves: [
    "Bailey J me dijo que las aves mas raras solo se dejan ver cuando el cielo esta de buen humor.",
    "Si escuchas un canto bonito desde el bosque... quedate quietita y mira para arriba.",
    "Los flamencos del campo de flores son mi debilidad. Son tan elegantes, corazon.",
    "Una vez un pajarito se poso en mi ventanita de la oficina. Estuvimos un rato mirandonos.",
    "Para avistar aves, lo mejor es ir tempranito, antes de que el pueblito despierte.",
  ],
  animales: [
    "El carpincho de las ruinas es mi favorito. Le llevo frambuesas cuando puedo.",
    "Joan me conto que cada animalito tiene una comida favorita secreta. Vale la pena descubrirla.",
    "Si te acercas despacito y con algo rico en la mano, los animalitos confian mas rapido.",
    "El zorrito del lago es esquivo, pero con carne y paciencia... se acerca.",
    "Los conejitos del camino son los mas tiernos del pueblito. Siempre me hacen sonreir.",
  ],
  cultivos: [
    "Blanc me enseno que cada semilla necesita su tiempo y carinosito para crecer fuerte.",
    "Las flores toman mas tiempo, pero cuando florecen... ay, no hay nada mas lindo.",
    "Recuerda regar tus plantitas, tesoro. Un jardin sin agua es como una carta sin sello.",
    "Los cultivos de nivel alto necesitan paciencia, pero la cosecha vale la pena, creeme.",
    "Si plantas con arcoiris, dicen que los hibridos salen mas bonitos. Suerte del cielo.",
  ],
  recetas: [
    "Massimo me dejo probar su Tiramisuu una vez... casi me desmayo de lo rico que estaba.",
    "Cocinar es como escribir una carta: hay que ponerle amor en cada paso.",
    "Si te sale una Comida Extrana, no te preocupes... a todos nos pasa la primera vez.",
    "Las recetas Legendarias son dificiles, pero imaginate servir un Set de Picnic a tus amigos.",
    "Mi sueno es aprender a cocinar la Pasta de Trufa. Algun dia, corazon.",
  ],
  logros: [
    "Cada logro del pueblito es una historia. No te apures, disfrutalos.",
    "Algunos logros ocultos se descubren sin querer... solo viviendo la vida del pueblo.",
    "Estoy tan orgullosa de cada vecinito que consigue un titulo nuevo. Se merecen aplausos.",
    "Los logros de pesca son los mas desafiantes, pero los pescadores del pueblo son valientes.",
    "Si necesitas consejos para un logro, no dudes en preguntarme. Reviso mi libretita.",
  ],
  recolectables: [
    "La Trufa Negra de la Isla del Bosque... es tan rara que casi da miedo encontrarla.",
    "Las ramitas no parecen mucho, pero con suficientes puedes construir cosas lindas.",
    "Bob siempre dice: 'La madera de calidad se encuentra en los arboles mas viejos.'",
    "Si ves un Fragmento de Estrella Fugaz, recogelo rapido. Son magicos, te lo juro.",
    "Los hongos del pueblo son un tesoro escondido. Cada zona tiene su tipo especial.",
  ],
  habitantes: [
    "Cada habitante del pueblo tiene algo especial que ofrecer. Solo hay que visitarlos.",
    "Doris cambia lo que vende segun el clima... es toda una comerciante estelar.",
    "Bob es el abuelito que todo el mundo necesita. Hace los muebles mas lindos.",
    "Vanya sabe todo sobre peces. Si ella no sabe, nadie sabe.",
    "Massimo es serio cocinando, pero tiene un corazon enorme detras de ese delantal.",
  ],
  codigos: [
    "Los codigos son como cartitas sorpresa que llegan al buzon. Aprovechalos antes de que expiren.",
    "Siempre anoto los codigos nuevos en mi libretita para que nadie se los pierda.",
    "Un buen codigo puede darte Estrellas de Deseo, Oro y mas... no los dejes pasar.",
  ],
  general: [
    "Que lindo dia para explorar el pueblito. No te olvides de disfrutar cada pasito.",
    "Si necesitas algo, aqui estoy yo, en mi oficinita, con tecito calentito y un abrazo.",
    "Heartopia es un lugar magico... y tu lo haces aun mas especial estando aqui.",
  ],
};

export function getFraseAnnie(categoria) {
  const pool = FRASES[categoria] || FRASES.general;
  return pool[Math.floor(Math.random() * pool.length)];
}

// -------------------------------------------------------
// Sugerencias de contenido relacionado
// -------------------------------------------------------

const SUGERENCIAS = {
  peces: [
    "Si te gusta pescar, quizas te interese ver las **recetas** que puedes cocinar con tus capturas.",
    "Revisa los **logros de pesca** para saber que desafios te esperan en el mar.",
    "Los **recolectables** cerca de los rios tambien pueden ser utiles. Echales un vistazo.",
  ],
  insectos: [
    "Los **logros de caza de insectos** tienen titulos muy bonitos. No te los pierdas.",
    "Algunos insectos aparecen en los mismos lugares que las **aves**. Doble aventura.",
    "Naniwa vende cosas utiles para la caza. Chequea la seccion de **habitantes**.",
  ],
  aves: [
    "Muchas aves se encuentran en las mismas zonas que los **insectos**. Dos pajaros de un tiro.",
    "Bailey J tiene recompensas por avistamiento. Revisalo en **habitantes**.",
    "Los **logros de aves** incluyen titulos muy lindos como 'Susurrador de Pajaros'.",
  ],
  animales: [
    "Algunos **cultivos** y **recolectables** son la comida favorita de estos animalitos.",
    "Mira los **logros** relacionados con animales para descubrir 'Vecino Animal'.",
    "Joan vende comida especial en su tienda. Revisala en **habitantes**.",
  ],
  cultivos: [
    "Con tus cosechas puedes preparar **recetas** increibles. Echales un ojo.",
    "Los **logros de jardineria** te pueden dar titulos como 'Horticultor'.",
    "Blanc, el jardinero, tiene semillas especiales. Buscalo en **habitantes**.",
  ],
  recetas: [
    "Necesitas ingredientes de los **cultivos** y **recolectables** para cocinar.",
    "Los **logros de cocina** incluyen desafios como 'Rapido e Impecable'.",
    "Massimo te puede vender equipamiento. Miralo en **habitantes**.",
  ],
  logros: [
    "Muchos logros estan ligados a **peces**, **insectos** y **aves**. Explora esas categorias.",
    "Si un logro parece dificil, puede que algun **habitante** te de pistas.",
    "Los logros ocultos se descubren explorando. Chequea las **guias** de la wiki.",
  ],
  recolectables: [
    "Muchos recolectables son ingredientes para **recetas**. Echales un vistazo.",
    "Algunos animalitos comen recolectables. Mira la seccion de **animales**.",
    "Bob usa madera para construir muebles. Visitalo en **habitantes**.",
  ],
  habitantes: [
    "Cada NPC esta ligado a un hobby. Revisa **peces**, **aves** o **insectos** segun tu interes.",
    "Algunos habitantes desbloquean **recetas** especiales. Prueba cocinar con ellos.",
    "Hay **logros** ocultos relacionados con interactuar con ciertos NPCs.",
  ],
  codigos: [
    "Usa tus recompensas para comprar semillas de **cultivos** o equipamiento.",
    "Las Estrellas de Deseo de los codigos te ayudan a acelerar muchas cosas del pueblo.",
  ],
};

export function getSugerencia(categoria) {
  const pool = SUGERENCIAS[categoria] || [];
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// -------------------------------------------------------
// Actividades de estado (para presence del bot)
// -------------------------------------------------------

export const ACTIVIDADES = [
  "repartiendo cartas con amor",
  "buscando sellitos en la oficinita",
  "tomando tecito dulce",
  "persiguiendo mariposas suaves",
  "ordenando paquetitos con ternura",
  "mirando nubecitas con los vecinos",
  "comiendo una sopapillita rica",
  "charlando con la vecinita de al lado",
  "regando sus plantitas con besitos",
  "tomando mote con huesillo fresco",
  "escuchando musiquita vieja",
  "contando estrellitas con ternura",
  "hablando con los patitos del lago",
  "planeando la proxima once",
];

// -------------------------------------------------------
// Rutinas diarias programadas
// -------------------------------------------------------

export const RUTINAS = [
  { hora: 8,  mensaje: "*Annie abre la oficinita con carino:* Buenos dias, pueblito lindo! Ya llego el pancito para compartir" },
  { hora: 9,  mensaje: "*Annie se prepara su tecito:* Wena de nuevo, corazones... quien quiere acompanarme con un sorbito?" },
  { hora: 13, mensaje: "*Hora de almuerzo:* Annie se va a comer algo rico, pero igual escucha sus cositas con amor" },
  { hora: 15, mensaje: "*Once dulce:* Alguien comparte un pedacito de empanadita conmigo, tesoritos?" },
  { hora: 18, mensaje: "*La tarde se pone suave:* El pueblito esta mas tranquilo... Annie tambien se relaja con ustedes" },
  { hora: 20, mensaje: "*Annie mira las estrellitas:* Que cielo tan bonito hoy, vecinitos... lo estan viendo conmigo?" },
  { hora: 22, mensaje: "*Annie bosteza suave:* Ya voy cerrando la oficinita, corazones... a descansar juntitos!" },
  { hora: 23, mensaje: "*Annie se acurruca:* Buenas noches, mi pueblito lindo... suenen bonito y abriguense, ya?" },
];

// -------------------------------------------------------
// Frases ambient
// -------------------------------------------------------

export const FRASES_AMBIENT = [
  "Ay, vecin@ lindo/a! Que alegria verte por aqui hoy... como estas, corazon?",
  "No se te olvide regar tus plantitas, ya? Te mando un besito para que crezcan precioso.",
  "Se me enredo el delantal otra vez! Casi me caigo, tesorito... menos mal que estas tu.",
  "Wena, mi alegria! Ese look te queda precioso hoy... te lo pusiste para alegrarme?",
  "Holi, holi, tesoro! Solo pasaba a decirte que eres lo mas lindo del pueblo.",
  "Amo mi trabajo... cada carta es como un abrazito que reparto por el pueblo.",
  "Que ganas de un completo con harta mayo y palta! Me invitas uno, corazoncito?",
  "Ay, esta fresquito! Abrigate po, mi rayito de sol, no quiero que te resfries.",
  "Oye, vecin@ lindo/a... ya regaste tus flores? Si no, te ayudo con un besito de agua.",
  "Que dia lindo pa sentarnos a charlar en la plaza! Te animas conmigo, tesoro?",
  "No se me duerman, ya? Que despues extrano sus mensajitos dulces.",
  "Si necesitas un consejo del corazon, aqui estoy yo, mi personita favorita.",
  "Quien me regala un tecito rico pa seguir repartiendo carinitos todo el dia?",
];

// -------------------------------------------------------
// Clima simulado del pueblo
// -------------------------------------------------------

export const CLIMA_PUEBLO = {
  hoy: {
    tipo: "Dia Despejado en el Pueblo",
    descripcion:
      "El cielo se ha despejado por completo y el sol brilla con fuerza. Es un dia maravilloso para salir a recolectar o regar las flores. No olvides disfrutar de este clima tan radiante!",
    eventos: [
      { hora: 13, evento: "Sol maximo", icono: "sol" },
      { hora: 21, evento: "Cielo estrellado", icono: "estrella" },
    ],
    timeline: [
      { hora: 20, icono: "luna", texto: "Noche despejada y tranquila" },
      { hora: 2,  icono: "luna-estrella", texto: "Cielo despejado por la madrugada" },
      { hora: 8,  icono: "sol", texto: "Manana de sol radiante" },
      { hora: 14, icono: "atardecer", texto: "Atardecer despejado" },
      { hora: 20, icono: "luna-estrella", texto: "Noche estrellada" },
    ],
  },
  proximos: [
    { dia: "Sabado",    icono: "estrellas", clima: "Noche de estrellas fugaces" },
    { dia: "Domingo",   icono: "sol",       clima: "Soleado y despejado" },
    { dia: "Lunes",     icono: "lluvia",    clima: "Lluvia ligera" },
    { dia: "Martes",    icono: "sol",       clima: "Soleado y despejado" },
    { dia: "Miercoles", icono: "sol",       clima: "Soleado y despejado" },
    { dia: "Jueves",    icono: "sol",       clima: "Soleado y despejado" },
    { dia: "Viernes",   icono: "lluvia",    clima: "Lluvia ligera" },
  ],
};
