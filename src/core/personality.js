const TRATOS = [
  "vecino", "vecina", "tesorito", "corazón",
  "jovencito", "jovencita", "vecinito", "vecinita",
  "iñorito", "iñora",
];

export function getTrato() {
  return TRATOS[Math.floor(Math.random() * TRATOS.length)];
}

export function getSaludoHora(hora) {
  if (hora >= 6 && hora < 12) return "Buenos dias";
  if (hora >= 12 && hora < 20) return "Buenas tardes";
  return "Buenas noches";
}

export function debeSugerir() {
  return Math.random() < 0.25;
}

const FRASES = {
  peces: [
    "Me encanta cuando el rio suena suavecito por la manana... si te acercas, puede que escuches un pececito saltando.",
    "Vanya me conto que los mejores pescadores saben esperar con paciencia y cafe calentito.",
    "Una vez intente pescar yo misma... termine con los pies mojados y sin nada, pero feliz.",
    "Dicen que el Mar de Cefiro guarda peces que brillan como estrellas cuando cae la tarde.",
    "Si vas a pescar, llevate algo abrigadito... el viento del lago puede ser traicionero.",
  ],
  insectos: [
    "Naniwa me enseñó que cada bichito tiene su momento perfecto para aparecer. Paciencia, corazón.",
    "Una vez vi un Morpho Azul volando cerca de mi oficinita... casi se me cae el tecito de la emocion.",
    "Los insectos del bosque son timidos, pero si te quedas quietito, se acercan solos.",
    "Ayer vi una mariposa gigante cerca del molino... estaba tan bonita que me quede mirandola un rato.",
    "Dicen que cuando llueve, los escarabajos raros salen a pasear. No te los pierdas.",
  ],
  aves: [
    "Bailey J me dijo que las aves mas raras solo se dejan ver cuando el cielo esta de buen humor.",
    "Si escuchas un canto bonito desde el bosque... quedate quietita y mira para arriba.",
    "Los flamencos del campo de flores son mi debilidad. Son tan elegantes, corazón.",
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
    "Blanc me enseñó que cada semilla necesita su tiempo y cariñito para crecer fuerte.",
    "Las flores toman mas tiempo, pero cuando florecen... ay, no hay nada mas lindo.",
    "Recuerda regar tus plantitas, tesoro. Un jardin sin agua es como una carta sin sello.",
    "Los cultivos de nivel alto necesitan paciencia, pero la cosecha vale la pena, creeme.",
    "Si plantas con arcoiris, dicen que los hibridos salen mas bonitos. Suerte del cielo.",
  ],
  recetas: [
    "Massimo me dejo probar su Tiramisu una vez... casi me desmayo de lo rico que estaba.",
    "Cocinar es como escribir una carta: hay que ponerle amor en cada paso.",
    "Si te sale una Comida Extraña, no te preocupes... a todos nos pasa la primera vez.",
    "Las recetas Legendarias son dificiles, pero imaginate servir un Set de Picnic a tus amigos.",
    "Mi sueño es aprender a cocinar la Pasta de Trufa. Algun dia, corazón.",
  ],
  logros: [
    "Cada logro del pueblito es una historia. No te apures, disfrutalos.",
    "Algunos logros ocultos se descubren sin querer... solo viviendo la vida del pueblo.",
    "Estoy tan orgullosa de cada vecinito que consigue un titulo nuevo.",
    "Los logros de pesca son los mas desafiantes, pero los pescadores del pueblo son valientes.",
    "Si necesitas consejos para un logro, no dudes en preguntarme. Reviso mi libretita.",
  ],
  recolectables: [
    "La Trufa Negra de la Isla del Bosque... es tan rara que casi da miedo encontrarla.",
    "Las ramitas no parecen mucho, pero con suficientes puedes construir cosas lindas.",
    "Bob siempre dice: La madera de calidad se encuentra en los arboles mas viejos.",
    "Si ves un Fragmento de Estrella Fugaz, recogelo rapido. Son magicos.",
    "Los hongos del pueblo son un tesoro escondido. Cada zona tiene su tipo especial.",
  ],
  habitantes: [
    "Cada habitante del pueblo tiene algo especial que ofrecer. Solo hay que visitarlos.",
    "Doris cambia lo que vende segun el clima... es toda una comerciante estelar.",
    "Bob es el abuelito que todo el mundo necesita. Hace los muebles mas lindos.",
    "Vanya sabe todo sobre peces. Si ella no sabe, nadie sabe.",
    "Massimo es serio cocinando, pero tiene un corazón enorme detras de ese delantal.",
  ],
  codigos: [
    "Los codigos son como cartitas sorpresa. Aprovechalos antes de que expiren.",
    "Siempre anoto los codigos nuevos en mi libretita para que nadie se los pierda.",
    "Un buen código puede darte Estrellas de Deseo, Oro y mas... no los dejes pasar.",
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

const SUGERENCIAS = {
  peces: [
    "Si te gusta pescar, mira las **recetas** que puedes cocinar con tus capturas. (`/recetas`)",
    "Revisa los **logros de pesca** para saber que desafios te esperan. (`/logros`)",
    "Los **recolectables** cerca de los rios tambien pueden ser utiles. Echales un vistazo. (`/recolectables`)",
  ],
  insectos: [
    "Los **logros de caza de insectos** tienen titulos bonitos. (`/logros`)",
    "Naniwa vende cosas utiles. Chequea **habitantes**. (`/habitantes`)",
    "Algunos insectos aparecen en los mismos lugares que las **aves**. Doble aventura. (`/aves`)",
  ],
  aves: [
    "Bailey J tiene recompensas por avistamiento. (`/habitantes Bailey J`)",
    "Los **logros de aves** incluyen titulos como Susurrador de Pajaros. (`/logros`)",
    "Muchas aves se encuentran en las mismas zonas que los **insectos**. Dos pajaros de un tiro. (`/insectos`)",
  ],
  animales: [
    "Algunos **cultivos** son comida favorita de estos animalitos. (`/cultivos`)",
    "Joan vende comida especial. (`/habitantes Senora Joan`)",
    "Mira los **logros** relacionados con animales para descubrir 'Vecino Animal'. (`/logros`)",
  ],
  cultivos: [
    "Con tus cosechas puedes preparar **recetas** increibles. (`/recetas`)",
    "Blanc tiene semillas especiales. (`/habitantes Blanc`)",
    "Los **logros de jardineria** te pueden dar titulos como 'Horticultor'. (`/logros`)",
  ],
  recetas: [
    "Necesitas ingredientes de **cultivos** y **recolectables**. (`/cultivos`, `/recolectables`)",
    "Massimo vende equipamiento de cocina. (`/habitantes Massimo`)",
    "Los **logros de cocina** incluyen desafios como 'Rapido e Impecable'. (`/logros`)",
  ],
  logros: [
    "Muchos logros estan ligados a peces, insectos y aves.",
    "Los logros ocultos se descubren explorando el pueblo.",
    "Si un logro parece dificil, puede que algun **habitante** te de pistas. (`/habitantes`)",
  ],
  recolectables: [
    "Muchos recolectables son ingredientes para **recetas**. (`/recetas`)",
    "Bob usa madera para muebles. (`/habitantes Bob`)",
    "Algunos animalitos comen recolectables. Mira la seccion de **animales**. (`/animales`)",
  ],
  habitantes: [
    "Cada NPC esta ligado a un hobby. Revisa la categoria que te interese.",
    "Algunos habitantes desbloquean **recetas** especiales. Prueba cocinar con ellos. (`/recetas`)",
    "Hay **logros** ocultos relacionados con interactuar con ciertos NPCs. (`/logros`)",
  ],
  codigos: [
    "Usa tus recompensas para comprar semillas o equipamiento.",
    "Las Estrellas de Deseo de los codigos te ayudan a acelerar muchas cosas del pueblo.",
  ],
};

export function getSugerencia(categoria) {
  const pool = SUGERENCIAS[categoria] || [];
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export const ACTIVIDADES = [
  "repartiendo cartas con amor",
  "buscando sellitos en la oficinita",
  "tomando tecito dulce",
  "persiguiendo mariposas suaves",
  "ordenando paquetitos con ternura",
  "mirando nubecitas con los vecinos",
  "comiendo una sopaipillita rica",
  "charlando con la vecinita de al lado",
  "regando sus plantitas con besitos",
  "tomando mote con huesillo fresco",
  "escuchando musiquita vieja",
  "contando estrellitas con ternura",
  "hablando con los patitos del lago",
  "planeando la proxima once",
];

export const RUTINAS = [
  { hora: 8,  mensaje: "*Annie abre la oficinita con cariño:* Buenos dias, pueblito lindo! Ya llego el pancito para compartir" },
  { hora: 13, mensaje: "*Hora de almuerzo:* Annie se va a comer algo rico, pero igual escucha sus cositas con amor" },
  { hora: 18, mensaje: "*La tarde se pone suave:* El pueblito esta mas tranquilo... Annie tambien se relaja con ustedes" },
  { hora: 20, mensaje: "*Annie mira las estrellitas:* Que cielo tan bonito hoy, vecinitos... lo estan viendo conmigo?" },
  { hora: 21, mensaje: "*Once dulce:* Alguien comparte un pedacito de empanadita conmigo, tesoritos?" },
  { hora: 22, mensaje: "*Annie bosteza suave:* Ya voy cerrando la oficinita, corazónes... a descansar juntitos!" },
  { hora: 23, mensaje: "*Annie se acurruca:* Buenas noches, mi pueblito lindo... suenen bonito y abriguense, ya?" },
];

export const FRASES_AMBIENT = [
  "Ay, vecin@ lindo/a! Que alegria verte por aqui hoy... como estas, corazón?",
  "No se te olvide regar tus plantitas, ya?",
  "Wena, mi alegria! Ese look te queda precioso hoy.",
  "Holi, holi, tesoro! Solo pasaba a decirte que eres lo mas lindo del pueblo.",
  "Amo mi trabajo... cada carta es como un abrazito que reparto por el pueblo.",
  "Que ganas de un completo con harta mayo y palta!",
  "Oye, vecin@ lindo/a... ya regaste tus flores?",
  "Que dia lindo pa sentarnos a charlar en la plaza!",
  "Si necesitas un consejo del corazón, aqui estoy yo, mi personita favorita.",
  "No se me duerman, ya? Que despues extrano sus mensajitos dulces.",
  "Ay, esta fresquito! Abrígate po, mi rayito de sol, no quiero que te resfries.",
  "Quien me regala un tecito rico pa seguir repartiendo cariñitos todo el dia?",
];

/* 
export const CLIMA_PUEBLO = {
  hoy: {
    tipo: "Nevada moderada ❄️",
    descripcion:
      "El pueblo está cubierto por un manto blanco. La nieve cae con intensidad moderada, creando un paisaje invernal perfecto. ¡Abrígate bien antes de salir a jugar en la nieve!",
    eventos: [
      { hora: 14, evento: "Nieve intensa 🌨️" },
      { hora: 20, evento: "Nevada persistente ❄️" },
    ],
    timeline: [
      { hora: 14, texto: "Nubes de nieve ☁️❄️" },
      { hora: 20, texto: "Nevada moderada 🌨️" },
      { hora: 2, texto: "Luna despejada 🌙" },
      { hora: 8, texto: "Mañana soleada ☀️" },
      { hora: 14, texto: "Sol de mediodía ☀️" },
    ],
  },
  próximos: [
    { dia: "Martes", clima: "Soleado y despejado ☀️" },
    { dia: "Miércoles", clima: "Soleado y despejado ☀️" },
    { dia: "Jueves", clima: "Soleado y despejado ☀️" },
    { dia: "Viernes", clima: "Lluvia ligera 🌧️" },
    { dia: "Sábado", clima: "Noche con nubes y luna 🌙☁️" },
    { dia: "Domingo", clima: "Soleado y despejado ☀️" },
    { dia: "Lunes", clima: "Lluvia ligera 🌧️" },
  ],
};
 */