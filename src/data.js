// ============================================================
// Annie Bot v2 — Capa de datos (importada de la wiki)
// Fuente unica de verdad: lib/data.ts del proyecto wiki
// ============================================================

// Peces
export const PECES = {
  "Coregono": { ubicacion: "Mar de Cefiro", nivel: 1, tipo: "Lago", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Barbo Comun": { ubicacion: "Rio Poco Profundo", nivel: 1, tipo: "Rio", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Alburno": { ubicacion: "Lago", nivel: 1, tipo: "Lago", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Perca Europea": { ubicacion: "Rio", nivel: 1, tipo: "Rio", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Cacho": { ubicacion: "Lago", nivel: 1, tipo: "Lago", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Locha de Espina": { ubicacion: "Rio del Bosque Gigante", nivel: 1, tipo: "Rio", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Pequeno Pez de Rio": { ubicacion: "Rio Tranquilo", nivel: 1, tipo: "Rio", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Tenca": { ubicacion: "Lago del Bosque", nivel: 1, tipo: "Lago", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Carpa Gibelio": { ubicacion: "Lago", nivel: 1, tipo: "Lago", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Pez Schneider": { ubicacion: "Lago Suburbano", nivel: 1, tipo: "Lago", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Sardina": { ubicacion: "Oceano", nivel: 1, tipo: "Mar", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Lubina": { ubicacion: "Oceano", nivel: 1, tipo: "Mar", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Camaron Oriental": { ubicacion: "Rio", nivel: 1, tipo: "Rio", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Listado": { ubicacion: "Oceano", nivel: 1, tipo: "Mar", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Pez Sable": { ubicacion: "Mar de Cefiro", nivel: 1, tipo: "Mar", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Camaron Comun": { ubicacion: "Mar del Este", nivel: 1, tipo: "Mar", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Jurel": { ubicacion: "Mar de la Ballena", nivel: 1, tipo: "Mar", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Espinoso Marino": { ubicacion: "Mar Viejo", nivel: 1, tipo: "Mar", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Salmonete de Roca": { ubicacion: "Pesca Marina", nivel: 1, tipo: "Mar", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Eperlan Europeo": { ubicacion: "Lago de la Pradera", nivel: 1, tipo: "Lago", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Caballito de Mar": { ubicacion: "Mar de la Ballena", nivel: 1, tipo: "Mar", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia"] },
  "Pulpo Comun": { ubicacion: "Pesca Marina", nivel: 2, tipo: "Mar", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Locha de Piedra": { ubicacion: "Lago Suburbano", nivel: 2, tipo: "Lago", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Jurel Falso": { ubicacion: "Mar de Cefiro", nivel: 2, tipo: "Mar", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Pez Abisal": { ubicacion: "Pesca Marina", nivel: 2, tipo: "Mar", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Pulpo Pigmeo del Atlantico": { ubicacion: "Mar de la Ballena", nivel: 2, tipo: "Mar", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Rodaballo": { ubicacion: "Pesca Marina", nivel: 2, tipo: "Mar", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Lubina Negra": { ubicacion: "Lago del Bosque", nivel: 2, tipo: "Lago", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Salmon del Atlantico": { ubicacion: "Mar de la Ballena", nivel: 3, tipo: "Mar", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Dia", "Atardecer", "Noche"] },
  "Pez Payaso": { ubicacion: "Mar Viejo", nivel: 3, tipo: "Mar", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Lucioperca": { ubicacion: "Rio del Bosque Gigante", nivel: 3, tipo: "Rio", clima: ["Soleado", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Acerina": { ubicacion: "Lago de la Montana Onsen", nivel: 3, tipo: "Lago", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Dia", "Atardecer", "Noche"] },
  "Rana Comestible": { ubicacion: "Lagos", nivel: 3, tipo: "Lago", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Cangrejo Ermitano": { ubicacion: "Mar del Este", nivel: 3, tipo: "Mar", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Pez Sol del Fango": { ubicacion: "Lago del Bosque", nivel: 3, tipo: "Lago", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Amanecer", "Dia", "Atardecer"] },
  "Tilapia": { ubicacion: "Rios", nivel: 3, tipo: "Rio", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Streber": { ubicacion: "Rio Rosado", nivel: 3, tipo: "Rio", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Cangrejo de Rio Europeo": { ubicacion: "Lago del Bosque", nivel: 3, tipo: "Lago", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Atardecer", "Noche", "Amanecer"] },
  "Carpa Comun": { ubicacion: "Rio Rosado", nivel: 4, tipo: "Rio", clima: ["Soleado", "Arcoiris"], horario: ["Dia", "Atardecer"] },
  "Lota": { ubicacion: "Rio Tranquilo", nivel: 4, tipo: "Rio", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Dia"] },
  "Solla": { ubicacion: "Mar Viejo", nivel: 4, tipo: "Mar", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Atardecer", "Noche", "Amanecer"] },
  "Gobio": { ubicacion: "Mar del Este", nivel: 4, tipo: "Mar", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Dia", "Atardecer", "Amanecer"] },
  "Mejillon": { ubicacion: "Lago Suburbano", nivel: 4, tipo: "Lago", clima: ["Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Pez Conejo": { ubicacion: "Oceano", nivel: 4, tipo: "Mar", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Cangrejo de Rio": { ubicacion: "Lago Suburbano", nivel: 4, tipo: "Lago", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Renacuajo": { ubicacion: "Lago de la Montana Onsen", nivel: 4, tipo: "Lago", clima: ["Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Trucha": { ubicacion: "Lago de la Pradera", nivel: 5, tipo: "Lago", clima: ["Soleado", "Arcoiris"], horario: ["Atardecer", "Noche", "Amanecer"] },
  "Koi Mariposa": { ubicacion: "Lago de la Pradera", nivel: 5, tipo: "Lago", clima: ["Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Caballa del Atlantico": { ubicacion: "Mar de la Ballena", nivel: 5, tipo: "Mar", clima: ["Soleado", "Arcoiris"], horario: ["Dia", "Atardecer"] },
  "Rutilo": { ubicacion: "Lago Suburbano", nivel: 5, tipo: "Lago", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Calamar Volador Europeo": { ubicacion: "Pesca Marina", nivel: 5, tipo: "Mar", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Langosta Europea": { ubicacion: "Mar de Cefiro", nivel: 5, tipo: "Mar", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Atardecer", "Noche"] },
  "Blenio de Agua Dulce": { ubicacion: "Rio Rosado", nivel: 5, tipo: "Rio", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Pirana de Vientre Rojo": { ubicacion: "Rio del Bosque Gigante", nivel: 5, tipo: "Rio", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Salmon Keta": { ubicacion: "Rio Tranquilo", nivel: 6, tipo: "Rio", clima: ["Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Timalo": { ubicacion: "Lago Suburbano", nivel: 6, tipo: "Lago", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Mejillon de Perla Grande": { ubicacion: "Lago del Bosque", nivel: 6, tipo: "Lago", clima: ["Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Lija": { ubicacion: "Pesca Marina", nivel: 6, tipo: "Mar", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Pez Globo": { ubicacion: "Mar Viejo", nivel: 6, tipo: "Mar", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Rubio": { ubicacion: "Mar del Este", nivel: 6, tipo: "Mar", clima: ["Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Besugo": { ubicacion: "Mar de Cefiro", nivel: 7, tipo: "Mar", clima: ["Lluvioso", "Arcoiris"], horario: ["Atardecer"] },
  "Anguila Europea": { ubicacion: "Mar Viejo", nivel: 7, tipo: "Mar", clima: ["Arcoiris"], horario: ["Amanecer", "Dia", "Atardecer"] },
  "Fartet del Mediterraneo": { ubicacion: "Lago Suburbano", nivel: 7, tipo: "Lago", clima: ["Soleado", "Arcoiris"], horario: ["Dia", "Atardecer", "Noche"] },
  "Pez Remo Gigante": { ubicacion: "Pesca Marina", nivel: 7, tipo: "Mar", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Amanecer", "Dia"] },
  "Esculpin Moteado": { ubicacion: "Lago de la Montana Onsen", nivel: 7, tipo: "Lago", clima: ["Lluvioso", "Arcoiris"], horario: ["Amanecer", "Dia", "Atardecer"] },
  "Espinoso": { ubicacion: "Rio Poco Profundo", nivel: 7, tipo: "Rio", clima: ["Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Cangrejo de Rio Azul": { ubicacion: "Lago del Bosque", nivel: 8, tipo: "Lago", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Atardecer", "Noche"] },
  "Umbra Europea": { ubicacion: "Lago Suburbano", nivel: 8, tipo: "Lago", clima: ["Soleado", "Arcoiris"], horario: ["Noche", "Amanecer"] },
  "Cangrejo Real Dorado": { ubicacion: "Pesca Marina", nivel: 8, tipo: "Mar", clima: ["Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Pez Dorado": { ubicacion: "Lago de la Pradera", nivel: 8, tipo: "Lago", clima: ["Lluvioso", "Arcoiris"], horario: ["Amanecer", "Dia", "Atardecer"] },
  "Atun de Aleta Azul": { ubicacion: "Pesca Marina", nivel: 9, tipo: "Mar", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Huchon": { ubicacion: "Rio del Bosque Gigante", nivel: 9, tipo: "Rio", clima: ["Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Pez Luna": { ubicacion: "Pesca Marina", nivel: 9, tipo: "Mar", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Atardecer"] },
  "Lucio del Norte": { ubicacion: "Lago Suburbano", nivel: 9, tipo: "Lago", clima: ["Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Pez Luna Gigante": { ubicacion: "Mar del Este", nivel: 9, tipo: "Mar", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Pez Sol": { ubicacion: "Lago de la Montana Onsen", nivel: 9, tipo: "Lago", clima: ["Soleado", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Trucha Artica": { ubicacion: "Lago del Bosque", nivel: 10, tipo: "Lago", clima: ["Lluvioso", "Arcoiris"], horario: ["Dia", "Atardecer"] },
  "Agalla Azul": { ubicacion: "Lago de la Montana Onsen", nivel: 10, tipo: "Lago", clima: ["Soleado", "Arcoiris"], horario: ["Atardecer", "Noche"] },
  "Tiburon Mako": { ubicacion: "Pesca Marina", nivel: 10, tipo: "Mar", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Pez Espada": { ubicacion: "Pesca Marina", nivel: 10, tipo: "Mar", clima: ["Soleado", "Lluvioso", "Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
  "Siluro": { ubicacion: "Lago de la Pradera", nivel: 10, tipo: "Lago", clima: ["Soleado", "Arcoiris"], horario: ["Atardecer", "Noche"] },
  "Pargo": { ubicacion: "Mar de Cefiro", nivel: 10, tipo: "Mar", clima: ["Lluvioso", "Arcoiris"], horario: ["Atardecer", "Noche"] },
  "Cangrejo Real": { ubicacion: "Mar de la Ballena", nivel: 10, tipo: "Mar", clima: ["Arcoiris"], horario: ["Noche", "Amanecer", "Dia", "Atardecer"] },
};

// Animales (simplificado, los datos completos estan en la wiki)
export { ANIMALES } from "./data-animales.js";
export { INSECTOS } from "./data-insectos.js";
export { AVES } from "./data-aves.js";
export { CULTIVOS, RECOLECTABLES } from "./data-cultivos.js";
export { HABITANTES, RECETAS } from "./data-npcs.js";
export { LOGROS } from "./data-logros.js";
export { CODIGOS } from "./data-codigos.js";
export { PRECIOS } from "./data-precios.js";

// Utilidad para normalizar nombres (busqueda fuzzy)
export function normalize(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Buscar un item en un diccionario con normalizacion
export function buscarItem(diccionario, input) {
  // Intento directo
  if (diccionario[input]) return { nombre: input, data: diccionario[input] };

  // Intento normalizado
  const normalizado = normalize(input);
  const match = Object.keys(diccionario).find(k => normalize(k) === normalizado);
  if (match) return { nombre: match, data: diccionario[match] };

  // Intento parcial (solo si hay 1 resultado)
  const parciales = Object.keys(diccionario).filter(k => normalize(k).includes(normalizado));
  if (parciales.length === 1) return { nombre: parciales[0], data: diccionario[parciales[0]] };

  return null;
}

// Verificar si es "todos"
export function esTodos(input) {
  return ["*", "todos", "todo", "all"].includes((input || "").toLowerCase().trim());
}
