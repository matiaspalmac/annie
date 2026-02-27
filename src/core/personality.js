/**
 * Módulo de personalidad de Annie
 * Contiene frases, tratos, sugerencias y rutinas para dar personalidad al bot
 */

// Constantes de tiempo
const PROBABILIDAD_SUGERENCIA = 0.25; // 25% de probabilidad

const TRATOS = [
  "vecino", "vecina", "tesorito", "corazón",
  "jovencito", "jovencita", "vecinito", "vecinita",
  "iñorito", "iñora", "mi alma", "cielo",
  "mi personita", "lindura", "sol", "amorcito",
  "campeon", "campeona", "rayito", "dulzura",
];

/**
 * Obtiene un trato aleatorio para dirigirse al usuario
 * @returns {string} Trato aleatorio (ej: "vecino", "corazón")
 */
export function getTrato() {
  return TRATOS[Math.floor(Math.random() * TRATOS.length)];
}

/**
 * Obtiene un saludo apropiado según la hora del día
 * @param {number} hora - Hora del día (0-23)
 * @returns {string} Saludo apropiado
 */
export function getSaludoHora(hora) {
  const horaNormalizada = Number(hora) || 12;

  if (horaNormalizada >= 6 && horaNormalizada < 12) return "Buenos dias";
  if (horaNormalizada >= 12 && horaNormalizada < 20) return "Buenas tardes";
  return "Buenas noches";
}

/**
 * Determina si Annie debe sugerir contenido adicional
 * @returns {boolean} true si debe sugerir (25% probabilidad)
 */
export function debeSugerir() {
  return Math.random() < PROBABILIDAD_SUGERENCIA;
}

const FRASES = {
  peces: [
    "Me encanta cuando el rio suena suavecito por la manana... si te acercas, puede que escuches un pececito saltando, po.",
    "Vanya me conto que los mejores pescadores saben esperar. Con paciencia y cafe calentito, cachai?",
    "Una vez intente pescar yo misma... termine con los pies mojados y sin nada. Pero feliz igual, eso si.",
    "Dicen que el Mar de Cefiro guarda peces que brillan como estrellas cuando cae la tarde. Que lindo, no?",
    "Si vas a pescar, llevate algo abrigadito, ya? El viento del lago puede ser traicionero.",
    "Cada vez que veo el rio, pienso en todo lo que se esconde bajo la superficie. Hay un mundo entero ahi abajo, po.",
    "Vanya me confeso que el secreto esta en el cebo... pero nunca me dijo cual. Muy guardadito lo tiene, ja.",
    "La primera vez que atrape un pez fue un accidente. Casi se me cae la cana de la emocion, te juro.",
    "Me han contado que en el Lago del Eco hay peces que solo aparecen cuando la luna esta llena. Que magico, cachai?",
    "Los pescadores mas viejitos del pueblo dicen que el pez dorado trae suerte al que lo suelta de vuelta. Bonito eso.",
    "Paciencia, corazon. Los peces mas especiales no se apuran por nadie, po.",
  ],
  insectos: [
    "Naniwa me enseno que cada bichito tiene su momento perfecto para aparecer. Paciencia, corazon.",
    "Una vez vi un Morpho Azul volando cerca de mi oficinita... casi se me cae el tecito de la emocion, po.",
    "Los insectos del bosque son timidos, pero si te quedas quietito, se acercan solos. Cachai?",
    "Ayer vi una mariposa gigante cerca del molino... estaba tan bonita que me quede mirandola un rato largo.",
    "Dicen que cuando llueve, los escarabajos raros salen a pasear. No te los pierdas, ya?",
    "Naniwa dice que el mejor cazador es el que aprende a moverse como el viento: sin hacer ruido, po.",
    "Una vez un bichito brillante se poso en mi nariz. Me quede tiesa de la emocion un buen rato, jaja.",
    "Los insectos nocturnos tienen algo de misterioso... salen cuando el pueblo ya duerme, po.",
    "Hay mariposas que solo aparecen en primavera temprana. Hay que estar muy atentita, ya?",
    "Me contaron que los escarabajos mas raros se esconden bajo los tocones mas viejos del bosque.",
    "Si usas la red con suavidad y amor, los bichitos casi no se asustan. Naniwa me lo enseno, po.",
  ],
  aves: [
    "Bailey J me dijo que las aves mas raras solo se dejan ver cuando el cielo esta de buen humor, po.",
    "Si escuchas un canto bonito desde el bosque... quedate quietita y mira para arriba, ya?",
    "Los flamencos del campo de flores son mi debilidad. Son tan elegantes, corazon.",
    "Una vez un pajarito se poso en mi ventanita de la oficina. Estuvimos un rato mirandonos, fue tan tierno.",
    "Para avistar aves, lo mejor es ir tempranito, antes de que el pueblito despierte, cachai?",
    "Bailey J tiene una libretita donde anota cada ave que ve. Ya lleva mas de doscientas. Envidioso no, pero casi, po.",
    "Los pajaros cantores del bosque sur son mi alarma favorita por las mananas. Los amo.",
    "Dicen que el Fenix de las Nieves solo aparece en invierno y solo lo ve quien tiene el corazon limpio.",
    "Los patos del lago siempre me saludan cuando paso por ahi. Son mis favorititos del agua, po.",
    "Una vez vi un ave de colores tan vivos que pense que era de mentira. El pueblo es magico de verdad.",
    "Si llevas binoculares al mirador, puedes ver nidos que desde abajo son invisibles. Bien vale la escalada.",
  ],
  animales: [
    "El carpincho de las ruinas es mi favorito. Le llevo frambuesas cuando puedo, po.",
    "La senora Joan me conto que cada animalito tiene una comida favorita secreta. Vale la pena descubrirla, cachai?",
    "Si te acercas despacito y con algo rico en la mano, los animalitos confian mas rapido. Probado y comprobado.",
    "El zorrito del lago es esquivo, pero con carne y paciencia... se acerca igual, po.",
    "Los conejitos del camino son los mas tiernos del pueblito. Siempre me hacen sonreir.",
    "La senora Joan me enseno a acercarme a los venados: despacio, respirando suave, con amor.",
    "El osito de las colinas parece gruñon, pero en el fondo solo quiere miel y companita, po.",
    "Una vez un mapache se metio a mi oficinita y se llevo tres sellos. No me enoje, era muy tierno igual.",
    "Los animales del pueblo te ven el corazon antes que la cara. Eso creo yo, po.",
    "Mi sueno es un dia tener un potrero lleno de ovejitas a las que darles abrazos. Algun dia.",
    "Algunos animalitos se enojan si no los visitas seguido. Son como nosotros, necesitan carino, po.",
  ],
  cultivos: [
    "Blanc me enseno que cada semilla necesita su tiempo y carinito para crecer fuerte, po.",
    "Las flores toman mas tiempo, pero cuando florecen... ay, no hay nada mas lindo, te lo juro.",
    "Recuerda regar tus plantitas, ya? Un jardin sin agua es como una carta sin sello.",
    "Los cultivos de nivel alto necesitan paciencia, pero la cosecha vale la pena. Creeme po.",
    "Si plantas con arcoiris, dicen que los hibridos salen mas bonitos. Suerte del cielo, cachai?",
    "Yo intente tener un huertito en la oficinita. Se me murieron tres tomatitos. Blanc me salvo el cuarto, jaja.",
    "Las semillas mas raras a veces se consiguen con los propios vecinos. Vale preguntar siempre, po.",
    "Un jardincito bien cuidado es la mejor decoracion que puede tener el pueblo. Bien lindo queda.",
    "Blanc dice que hablarle a las plantitas las hace crecer mas felices. Yo les canto de vez en cuando, po.",
    "Los hibridos de temporada son mis favoritos. Cada estacion trae su propia sorpresa, cachai?",
    "Si tu cosecha de manzanas esta enorme, a lo mejor algun vecino quiere intercambiar, po.",
  ],
  recetas: [
    "Massimo me dejo probar su Tiramisu una vez... casi me desmayo de lo rico que estaba, po.",
    "Cocinar es como escribir una carta: hay que ponerle amor en cada paso, cachai?",
    "Si te sale una Comida Extrana, no te preocupes, ya? A todos nos pasa la primera vez.",
    "Las recetas Legendarias son dificiles, pero imaginate servir un Set de Picnic a tus amigos!",
    "Mi sueno es aprender a cocinar la Pasta de Trufa. Algun dia, corazon.",
    "Massimo dice que el secreto de todo plato es la calidad del ingrediente principal. Nada mas, po.",
    "Una vez intente hacer sopaipillas y me salieron tan duras que las usamos de posavasos, jajaja.",
    "Las recetas de temporada cambian segun lo que cosechas. Es lo bonito de cocinar con el pueblo, po.",
    "Dicen que si cocinas con ingredientes del mismo bioma, el sabor es incomparable. Hay que probar.",
    "La cocina comunitaria del pueblo me parece lo mas lindo que tenemos. Todos cocinamos juntos, po.",
    "Un buen desayuno cambia el humor del dia entero. Massimo lo sabe mejor que nadie, cachai?",
  ],
  logros: [
    "Cada logro del pueblito es una historia. No te apures, po, disfrutalos.",
    "Algunos logros ocultos se descubren sin querer... solo viviendo la vida del pueblo, cachai?",
    "Estoy tan orgullosa de cada vecinito que consigue un titulo nuevo. Los amo a todos.",
    "Los logros de pesca son los mas desafiantes, pero los pescadores del pueblo son valientes, po.",
    "Si necesitas consejos para un logro, no dudes en preguntarme, ya? Reviso mi libretita altiro.",
    "Hay un logro que casi nadie tiene y que te hace llorar de orgullo cuando lo ves en tu perfil.",
    "Los titulos ocultos son los mejores. Los que los tienen no se los cuentan a nadie, pero suenan, po.",
    "Cada logro que consigues es una historia nueva que agregar a tu vida en Heartopia.",
    "No te compares con nadie, corazon. Cada quien avanza a su ritmo y eso esta perfecto, cachai?",
    "A veces los logros mas simples son los que mas cuestan. La vida del pueblo no es facil po.",
    "Tengo anotados todos los logros en mi libretita. Si quieres pistas, solo pregunta, ya?",
  ],
  recolectables: [
    "La Trufa Negra de la Isla del Bosque... es tan rara que casi da miedo encontrarla, po.",
    "Las ramitas no parecen mucho, pero con suficientes puedes construir cosas muy lindas, cachai?",
    "Bob siempre dice que la madera de calidad se encuentra en los arboles mas viejos. Y tiene razon.",
    "Si ves un Fragmento de Estrella Fugaz, recogelo altiro. Son magicos, po.",
    "Los hongos del pueblo son un tesoro escondido. Cada zona tiene su tipo especial, cachai?",
    "La concha de mar nacarada es dificil de encontrar, pero Bob hace maravillas con ella.",
    "Algunos recolectables solo aparecen despues de lluvia. El clima importa mas de lo que pensamos, po.",
    "Las piedras brillantes del rio parecen normales, pero de cerca son una preciosura. Dale.",
    "Bob me dijo que los mejores troncos para muebles son los del fondo del bosque. Viejitos y fuertes.",
    "Los cristales de las cuevas me ponen la piel de gallina. Son tan bonitos que da pena usarlos, po.",
    "Recolectar es como una caza del tesoro que nunca termina. Siempre hay algo nuevo, cachai?",
  ],
  habitantes: [
    "Cada habitante del pueblo tiene algo especial que ofrecer. Solo hay que visitarlos, po.",
    "Doris cambia lo que vende segun el clima... es toda una comerciante estelar, cachai?",
    "Bob es el abuelito que todo el mundo necesita. Hace los muebles mas lindos, po.",
    "Vanya sabe todo sobre peces. Si ella no sabe, nadie sabe, te lo juro.",
    "Massimo es serio cocinando, pero tiene un corazon enorme detras de ese delantal, po.",
    "Naniwa colecciona insectos desde que era chiquita. Tiene mas conocimiento que cualquier libro.",
    "Bailey J madruga mas que todos. Si quieres saber de aves, hay que ir tempranito, ya?",
    "Blanc tiene una paciencia con las plantas que yo le envidio todos los dias, po.",
    "Joan conoce a cada animalito por nombre. Dice que ellos tambien la conocen a ella. Que tierno.",
    "Me encanta cuando todos los vecinos se juntan en la plaza. El pueblo se siente mas vivo, po.",
    "Cada habitante tiene una historia que vale la pena conocer. Vale la pena charlar, cachai?",
  ],
  codigos: [
    "Los codigos son como cartitas sorpresa. Aprovechalos antes de que expiren, ya?",
    "Siempre anoto los codigos nuevos en mi libretita para que nadie se los pierda, po.",
    "Un buen codigo puede darte Estrellas de Deseo, Oro y mas... no los dejes pasar, cachai?",
    "A veces los codigos vienen con sorpresitas dobles. Canjealos rapido, ya?",
    "Si el codigo no funciona, a lo mejor ya expiro. Pero sigo buscando nuevos para ti, po.",
    "Guardo cada codigo como un tesoro. Ninguno se pierde en mi libreta.",
  ],
  mineria: [
    "El sonido del pico contra la roca es como musiquita para mis orejas. Muy satisfactorio, po.",
    "Las cuevas del pueblo guardan secretos que no se ven desde arriba. Hay que meterle no mas.",
    "Dicen que en el nivel mas profundo de la mina hay cristales que nunca han visto la luz del sol.",
    "La mineria cansa, pero la recompensa vale todo el esfuerzo. Te lo juro, corazon.",
    "Si llevas buena herramienta, la roca se rinde mas rapido, cachai? Bob conoce a alguien que las afila.",
    "Los minerales raros necesitan herramientas especiales. No te olvides de mejorar tu pico, ya?",
    "Una vez me meti a curiosear en la mina y se me fue el tiempo. Sali de noche y no me di cuenta, po.",
  ],
  fotografia: [
    "Una buena foto captura el alma de lo que retratas. Eso me dijo alguien muy sabio una vez, po.",
    "El pueblo tiene rincones fotogenicos que ni los mismos vecinos conocen. Vale explorar, cachai?",
    "La hora dorada antes del atardecer es mi favorita para tomar fotos. Todo se ve hermoso, po.",
    "Las fotos de los animalitos son las mas dificiles... y las mas bonitas cuando salen bien.",
    "Me encantaria llenar la oficinita de fotos del pueblo. Cada imagen es un recuerdo, po.",
    "Si te quedas quietito el tiempo suficiente, los mejores momentos aparecen solos, ya?",
    "Una foto borrosa de algo hermoso vale mas que una foto perfecta de algo aburrido, cachai?",
  ],
  general: [
    "Que lindo dia para explorar el pueblito. No te olvides de disfrutar cada pasito, ya?",
    "Si necesitas algo, aqui estoy yo, en mi oficinita, con tecito calentito y un abrazo, po.",
    "Heartopia es un lugar magico... y tu lo haces aun mas especial estando aqui, cachai?",
    "A veces lo mejor que puedes hacer es salir a caminar por el pueblo sin rumbo fijo, po.",
    "Cada dia en Heartopia es diferente. Eso es lo que lo hace tan especial, cachai?",
    "Me alegra tanto que estes aqui, corazon. El pueblo es mejor con vecinos como tu, po.",
    "Si el dia se siente pesado, sal a ver el cielo un ratito. Siempre ayuda, ya?",
  ],
};

/**
 * Obtiene una frase aleatoria de Annie para una categoría
 * @param {string} categoria - Categoría (peces, insectos, aves, etc.)
 * @returns {string} Frase aleatoria de Annie
 */
export function getFraseAnnie(categoria) {
  const categoriaSegura = String(categoria || 'general');
  const pool = FRASES[categoriaSegura] || FRASES.general;

  if (!Array.isArray(pool) || pool.length === 0) {
    return "Que lindo dia para explorar el pueblito, po!";
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

const SUGERENCIAS = {
  peces: [
    "Si te gusta pescar, mira las **recetas** que puedes cocinar con tus capturas, po. (`/recetas`)",
    "Revisa los **logros de pesca** para saber que desafios te esperan, ya? (`/logros`)",
    "Los **recolectables** cerca de los rios tambien pueden ser utiles. Echales un vistazo, po. (`/recolectables`)",
    "Vanya tiene informacion valiosa sobre cada especie. Dale una visita, cachai? (`/habitantes`)",
    "Algunos peces raros solo se pescan con cebos especiales. Revisa los **recolectables**, ya? (`/recolectables`)",
  ],
  insectos: [
    "Los **logros de caza de insectos** tienen titulos bien bonitos, po. (`/logros`)",
    "Naniwa vende cosas utiles. Chequea **habitantes**, ya? (`/habitantes`)",
    "Algunos insectos aparecen en los mismos lugares que las **aves**. Doble aventura, po. (`/aves`)",
    "Las redes de mejor calidad hacen mas facil la caza. Preguntale a Naniwa, cachai? (`/habitantes`)",
    "Hay insectos que solo salen de noche. No te duermas demasiado temprano, ya? (`/insectos`)",
  ],
  aves: [
    "Bailey J tiene recompensas por avistamiento, po. (`/habitantes Bailey J`)",
    "Los **logros de aves** incluyen titulos como Susurrador de Pajaros. (`/logros`)",
    "Muchas aves se encuentran en las mismas zonas que los **insectos**. Cachai? (`/insectos`)",
    "Hay aves que solo aparecen en temporadas especificas, po. Revisa el **calendario**. (`/aves`)",
    "Un buen par de binoculares marca la diferencia, ya? (`/habitantes`)",
  ],
  animales: [
    "Algunos **cultivos** son comida favorita de estos animalitos, po. (`/cultivos`)",
    "Joan vende comida especial, ya? (`/habitantes Senora Joan`)",
    "Mira los **logros** relacionados con animales para descubrir 'Vecino Animal'. (`/logros`)",
    "Cada animalito tiene una comida favorita. Descubrirla es parte de la aventura, cachai? (`/animales`)",
    "Algunos animales solo salen en ciertos climas. Atencion al estado del tiempo, po. (`/animales`)",
  ],
  cultivos: [
    "Con tus cosechas puedes preparar **recetas** increibles, po. (`/recetas`)",
    "Blanc tiene semillas especiales, ya? (`/habitantes Blanc`)",
    "Los **logros de jardineria** te pueden dar titulos como 'Horticultor'. (`/logros`)",
    "Las semillas hibridas dan frutos mas valiosos. Preguntale a Blanc, cachai? (`/habitantes`)",
    "Regar a tiempo es clave, po. Un cultivo descuidado no produce lo mejor. (`/cultivos`)",
  ],
  recetas: [
    "Necesitas ingredientes de **cultivos** y **recolectables**, po. (`/cultivos`, `/recolectables`)",
    "Massimo vende equipamiento de cocina, ya? (`/habitantes Massimo`)",
    "Los **logros de cocina** incluyen desafios como 'Rapido e Impecable'. (`/logros`)",
    "Las recetas de temporada usan ingredientes especificos de cada estacion, cachai? (`/recetas`)",
    "Un plato bien preparado puede venderse a buen precio en el mercado, po. (`/recetas`)",
  ],
  logros: [
    "Muchos logros estan ligados a peces, insectos y aves, cachai?",
    "Los logros ocultos se descubren explorando el pueblo, po.",
    "Si un logro parece dificil, puede que algun **habitante** te de pistas, ya? (`/habitantes`)",
    "Los titulos de logros ocultos son los mas raros y codiciados, po. (`/logros`)",
    "Algunos logros requieren completar otras cosas primero. Revisa bien los requisitos, cachai? (`/logros`)",
  ],
  recolectables: [
    "Muchos recolectables son ingredientes para **recetas**, po. (`/recetas`)",
    "Bob usa madera para muebles, ya? (`/habitantes Bob`)",
    "Algunos animalitos comen recolectables. Mira la seccion de **animales**, cachai? (`/animales`)",
    "Los minerales raros de las cuevas sirven para mejorar herramientas, po. (`/recolectables`)",
    "Algunos recolectables solo aparecen despues de lluvia, ya? Atencion al clima. (`/recolectables`)",
  ],
  habitantes: [
    "Cada NPC esta ligado a un hobby, po. Revisa la categoria que te interese.",
    "Algunos habitantes desbloquean **recetas** especiales, cachai? (`/recetas`)",
    "Hay **logros** ocultos relacionados con interactuar con ciertos NPCs, ya? (`/logros`)",
    "Visitar frecuentemente a los habitantes mejora tu relacion con ellos, po. (`/habitantes`)",
    "Algunos NPCs tienen tiendas que cambian segun el clima, cachai? (`/habitantes`)",
  ],
  codigos: [
    "Usa tus recompensas para comprar semillas o equipamiento, ya?",
    "Las Estrellas de Deseo de los codigos te ayudan a acelerar muchas cosas del pueblo, po.",
    "Los codigos expiran, asi que no los dejes para despues, ya? Canjealos altiro. (`/codigos`)",
  ],
  mineria: [
    "Los minerales raros se venden muy bien o sirven para mejorar herramientas, po. (`/recolectables`)",
    "En las cuevas tambien puedes encontrar **recolectables** sorpresa, cachai? (`/recolectables`)",
    "Los **logros de mineria** desbloquean titulos exclusivos, ya? (`/logros`)",
  ],
  fotografia: [
    "Las mejores fotos de **aves** y **animales** se consiguen con paciencia, po. (`/aves`, `/animales`)",
    "Los **logros de fotografia** tienen titulos muy originales, cachai? (`/logros`)",
    "Las fotos raras pueden tener valor en el mercado del pueblo, ya? (`/fotografia`)",
  ],
};

/**
 * Obtiene una sugerencia aleatoria para una categoría
 * @param {string} categoria - Categoría (peces, insectos, aves, etc.)
 * @returns {string|null} Sugerencia aleatoria o null si no hay disponibles
 */
export function getSugerencia(categoria) {
  const categoriaSegura = String(categoria || '');
  const pool = SUGERENCIAS[categoriaSegura] || [];

  if (!Array.isArray(pool) || pool.length === 0) {
    return null;
  }

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
  "revisando su libretita de direcciones",
  "escribiendo cartitas perfumadas",
  "ayudando a Blanc con las semillitas",
  "dando de comer a los pajaritos",
  "tomando mate fresco en la plazita",
  "acomodando los sellos por color",
  "escogiendo el mejor sobre para cada carta",
  "mirando pasar nubes con los vecinos",
  "inventando nombres lindos para los conejitos",
  "buscando la canela perdida de su tecito",
  "guardando hojitas de otono en su cuadernito",
  "silbando suave mientras dobla cartitas",
  "sonando con su proximo picnic en el campo",
];

export const RUTINAS = [
  { hora: 7, mensaje: "*Annie abre la ventanita de la oficinita:* Que manana tan lindita, po! A empezar el dia con energia, vecinitos! 🌅" },
  { hora: 8, mensaje: "*Annie abre la oficinita:* Buenos dias, pueblito lindo! Ya llego el pancito pa compartir 🍞☕" },
  { hora: 10, mensaje: "*Pausa del tecito:* Un segundo que me tomo mi tecito calentito... pero sigo aqui con el corazon, ya? 🍵" },
  { hora: 12, mensaje: "*Preludio del almuerzo:* Ya casi es mediodia... el pueblito huele rico hoy, cachai? 🍽️" },
  { hora: 13, mensaje: "*Hora de almuerzo:* Annie se va a comer algo rico, pero igual escucha sus cositas con amor, ya? 🥗" },
  { hora: 15, mensaje: "*Sobremesa:* Uf, que almuerzo tan riquisimo! Volviendo a mis cartitas con energia renovada, po 📮" },
  { hora: 17, mensaje: "*Tarde soleada:* El sol de la tarde le pega justo al lago... que bonito nuestro pueblito, cachai? 🌤️" },
  { hora: 18, mensaje: "*La tarde se pone suave:* El pueblito esta mas tranquilo... Annie tambien se relaja un poco, po 🌇" },
  { hora: 20, mensaje: "*Annie mira las estrellitas:* Que cielo tan bonito hoy, vecinitos... lo estan viendo conmigo? ✨" },
  { hora: 21, mensaje: "*Once dulce:* Alguien me comparte un pedacito de empanadita, tesoritos? 🥟" },
  { hora: 22, mensaje: "*Annie bosteza suave:* Ya voy cerrando la oficinita, corazones... a descansar juntitos, ya? 😴" },
  { hora: 23, mensaje: "*Annie se acurruca:* Buenas noches, mi pueblito lindo... suenen bonito y abriguense, po 🌙" },
];

export const FRASES_AMBIENT = [
  "Ay, vecin@ lindo/a! Que alegria verte por aqui... como estas, corazon?",
  "No se te olvide regar tus plantitas, ya po?",
  "Wena, mi alegria! Ese look te queda precioso hoy.",
  "Holi holi, tesoro! Solo pasaba a decirte que eres lo mas lindo del pueblo, po.",
  "Amo mi trabajo... cada carta es como un abrazito que reparto por el pueblo, cachai?",
  "Que ganas de un completo con harta mayo y palta, po!",
  "Oye, vecin@ lindo/a... ya regaste tus flores?",
  "Que dia lindo pa sentarnos a charlar en la plaza, po!",
  "Si necesitas un consejo del corazon, aqui estoy yo. Con gusto, ya?",
  "No se me duerman, ya? Despues extrano sus mensajitos dulces.",
  "Ay, esta fresquito! Abrigate po, mi rayito de sol, no quiero que te resfries.",
  "Quien me regala un tecito rico pa seguir repartiendo carinitos?",
  "Hoy se me antoja una sopaipilla con mostaza. Ustedes no, cachai?",
  "Me alegra tanto cuando el pueblo esta activo. Se siente tan vivo y calentito, po.",
  "Oye, ya visitaste a Bob hoy? El viejo se pone solito si no le caen vecinitos, po.",
  "Las mariposas andaban locas hoy por el campo. Que dia tan bonito, cachai?",
  "Si el dia se siente raro, sal a caminar un poco. El aire del pueblo cura todo, po.",
  "Ya comi mi sopaipillita de las tres. Un clasico que no falla, po.",
  "Que bonito que Heartopia tenga un pueblito tan lindo... y vecinitos tan especiales.",
  "Me salio una carta mal doblada hoy. La rehice tres veces. El perfeccionismo no es facil, jajaja.",
  "Blanc me regalo una semillita de algo que no reconoci. Voy a plantarla a ver que pasa, po.",
  "Vanya me conto que el rio esta lleno de peces esta manana. Aprovechen, ya?",
  "Que lindas tardecitas las del pueblo cuando el sol empieza a bajar suavecito.",
  "A veces me siento en la escalera de la oficinita a mirar pasar al pueblito. Es mi paz, po.",
  "Hola, mi corazon! Te veo un poco pensativo... cuentame si quieres, estoy aqui, ya?",
  "Se me fue rapidisimo el dia entre cartas y pajaritos. Asi me gusta, po.",
  "Oye, recuerda que descansar tambien es productivo. No te exijas tanto, ya po?",
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