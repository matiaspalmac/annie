import "dotenv/config";
import { db } from "./src/db.js";

const npcs = [
    { id: "Vanya", location: "Fishing area", gifts: ["Fish", "Fishing bait", "Coffee"] },
    { id: "Blanc", location: "Garden shop", gifts: ["Flowers", "Seeds", "Vegetables"] },
    { id: "Massimo", location: "Restaurant", gifts: ["Cooked dishes", "Ingredients", "Recipes"] },
    { id: "Naniwa", location: "Forest", gifts: ["Insects", "Butterflies", "Nature items"] },
    { id: "Bailey J", location: "Bird area", gifts: ["Bird feed", "Photography items", "Binoculars"] },
    { id: "Señora Joan", location: "Pet area", gifts: ["Pet food", "Cat toys", "Wool"] },
    { id: "Albert Jr", location: "Main plaza", gifts: ["Coffee beans", "Gemstones", "Rare items"] },
    { id: "Bill", location: "Fishing village", gifts: ["Fish", "Sea items", "Bait"] },
    { id: "Harvey", location: "Mining area", gifts: ["Iron Ore", "Silver Ore", "Gold Ore"] },
    { id: "Jake", location: "Farm area", gifts: ["Corn", "Ginseng", "Milk"] },
    { id: "Garrick", location: "Orchard", gifts: ["Tomato", "Grape", "Orange"] },
    { id: "Nellie", location: "Ranch", gifts: ["Eggs", "Wool", "Milk"] },
    { id: "Oscar", location: "Riverside", gifts: ["Carp", "Sardine", "Herring"] },
    { id: "George", location: "Beach", gifts: ["Sand", "Salt", "Driftwood"] },
    { id: "Clara", location: "Orchard", gifts: ["Apple", "Strawberry", "Grape"] },
    { id: "Calvin", location: "Workshop", gifts: ["Scrap Metal", "Sand", "Wool"] },
    { id: "Anatolo", location: "Forest", gifts: ["Ginseng", "Wild Herbs", "Milk"] }
];

async function run() {
    try {
        for (const npc of npcs) {
            const jsonStr = JSON.stringify({ Aman: npc.gifts });

            await db.execute({
                sql: `INSERT INTO habitantes (id, ubicacion, regalos_favoritos) 
              VALUES (?, ?, ?) 
              ON CONFLICT(id) DO UPDATE SET 
                ubicacion = excluded.ubicacion, 
                regalos_favoritos = excluded.regalos_favoritos`,
                args: [npc.id, npc.location, jsonStr]
            });
            console.log(`✅ Upserted: ${npc.id}`);
        }

        console.log("¡Todo listo!");
        process.exit(0);
    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
}

run();
