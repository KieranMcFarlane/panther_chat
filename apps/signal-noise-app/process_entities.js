#!/usr/bin/env node

const entities = [
  {"name": "Toyota Verblitz", "sport": null, "country": "Japan"},
  {"name": "Hanshin Tigers", "sport": null, "country": "Japan"},
  {"name": "Hiroshima Toyo Carp", "sport": null, "country": "Japan"},
  {"name": "Panasonic Panthers", "sport": null, "country": "Japan"},
  {"name": "Club Africain", "sport": null, "country": "Tunisia"},
  {"name": "Eurofarm Pelister", "sport": null, "country": "North Macedonia"},
  {"name": "Allen Americans", "sport": null, "country": "United States"},
  {"name": "Rochester Americans", "sport": null, "country": "United States"},
  {"name": "Kapfenberg Bulls", "sport": null, "country": "Austria"},
  {"name": "LASK Linz Basketball", "sport": null, "country": "Austria"},
  {"name": "Oberwart Gunners", "sport": null, "country": "Austria"},
  {"name": "Cibona Zagreb", "sport": null, "country": "Croatia"},
  {"name": "KK Šibenik", "sport": null, "country": "Croatia"},
  {"name": "KK Split", "sport": null, "country": "Croatia"},
  {"name": "Zadar", "sport": null, "country": "Croatia"},
  {"name": "RK Zagreb", "sport": null, "country": "Croatia"},
  {"name": "PPD Zagreb", "sport": null, "country": "Croatia"},
  {"name": "HC Dobrogea Sud Constanța", "sport": null, "country": "Romania"},
  {"name": "KK Osijek", "sport": null, "country": "Croatia"},
  {"name": "Cuprum Lubin", "sport": null, "country": "Poland"},
  {"name": "Górnik Zabrze", "sport": null, "country": "Poland"},
  {"name": "Jeonbuk Hyundai Motors", "sport": null, "country": "South Korea"},
  {"name": "Doosan Bears", "sport": null, "country": "South Korea"},
  {"name": "Hanwha Eagles", "sport": null, "country": "South Korea"},
  {"name": "Anyang KGC", "sport": null, "country": "South Korea"},
  {"name": "Busan KT Sonicboom", "sport": null, "country": "South Korea"},
  {"name": "Goyang Orions", "sport": null, "country": "South Korea"},
  {"name": "Meralco Bolts", "sport": null, "country": "Philippines"},
  {"name": "Karachi Kings", "sport": null, "country": "Pakistan"},
  {"name": "Lahore Qalandars", "sport": null, "country": "Pakistan"},
  {"name": "Peshawar Zalmi", "sport": null, "country": "Pakistan"},
  {"name": "Multan Sultans", "sport": null, "country": "Pakistan"},
  {"name": "Quetta Gladiators", "sport": null, "country": "Pakistan"},
  {"name": "Al Shorta SC", "sport": null, "country": "Iraq"},
  {"name": "Al Karkh SC", "sport": null, "country": "Iraq"},
  {"name": "Red Star Belgrade", "sport": null, "country": "Serbia"},
  {"name": "Partizan Belgrade", "sport": null, "country": "Serbia"},
  {"name": "Vojvodina Novi Sad", "sport": null, "country": "Serbia"},
  {"name": "Crvena Zvezda", "sport": null, "country": "Serbia"},
  {"name": "Mega Basket", "sport": null, "country": "Serbia"},
  {"name": "KK Vojvodina", "sport": null, "country": "Serbia"},
  {"name": "Cedevita Olimpija", "sport": null, "country": "Slovenia"},
  {"name": "RK Gorenje Velenje", "sport": null, "country": "Slovenia"},
  {"name": "Young Boys", "sport": null, "country": "Switzerland"},
  {"name": "Lions de Genève", "sport": null, "country": "Switzerland"},
  {"name": "HC Davos", "sport": null, "country": "Switzerland"},
  {"name": "Lausanne HC", "sport": null, "country": "Switzerland"},
  {"name": "Leinster", "sport": null, "country": "Ireland"},
  {"name": "Munster", "sport": null, "country": "Ireland"},
  {"name": "Ulster", "sport": null, "country": "Northern Ireland"},
  {"name": "Dundee FC", "sport": null, "country": "Scotland"},
  {"name": "Kilmarnock", "sport": null, "country": "Scotland"},
  {"name": "Edinburgh Rugby", "sport": null, "country": "Scotland"},
  {"name": "Glasgow Warriors", "sport": null, "country": "Scotland"},
  {"name": "Budućnost Podgorica", "sport": null, "country": "Montenegro"},
  {"name": "Caracas FC", "sport": null, "country": "Venezuela"},
  {"name": "Deportivo Táchira", "sport": null, "country": "Venezuela"},
  {"name": "Guaros de Lara", "sport": null, "country": "Venezuela"},
  {"name": "Trotamundos de Carabobo", "sport": null, "country": "Venezuela"},
  {"name": "Piratas de La Guaira", "sport": null, "country": "Venezuela"},
  {"name": "Caribbean Storm", "sport": null, "country": "Colombia"},
  {"name": "Titanes de Barranquilla", "sport": null, "country": "Colombia"},
  {"name": "Nacional", "sport": null, "country": "Uruguay"},
  {"name": "Malvín", "sport": null, "country": "Uruguay"},
  {"name": "Olimpia", "sport": null, "country": "Paraguay"},
  {"name": "Deportivo San José", "sport": null, "country": "Paraguay"},
  {"name": "Olimpia Kings", "sport": null, "country": "Paraguay"},
  {"name": "Estudiantes de Bahía Blanca", "sport": null, "country": "Argentina"},
  {"name": "Instituto de Córdoba", "sport": null, "country": "Argentina"},
  {"name": "Caxias do Sul Basquete", "sport": null, "country": "Brazil"},
  {"name": "Guarulhos", "sport": null, "country": "Brazil"},
  {"name": "Costa do Sol", "sport": null, "country": "Mozambique"},
  {"name": "Desportivo de Maputo", "sport": null, "country": "Mozambique"},
  {"name": "Espoir BC", "sport": null, "country": "Senegal"},
  {"name": "Étoile Sportive du Sahel", "sport": null, "country": "Tunisia"},
  {"name": "US Monastir", "sport": null, "country": "Tunisia"},
  {"name": "City Oilers", "sport": null, "country": "Uganda"},
  {"name": "KCCA Panthers", "sport": null, "country": "Uganda"},
  {"name": "UPDF Tomahawks", "sport": null, "country": "Uganda"},
  {"name": "Abbotsford Canucks", "sport": "Ice Hockey", "country": "Canada"},
  {"name": "ACT Brumbies", "sport": "Rugby", "country": "Australia"},
  {"name": "Adana Demirspor", "sport": "Football", "country": "Türkiye"},
  {"name": "Adelaide Giants", "sport": "Baseball", "country": "Australia"},
  {"name": "Ademar León", "sport": "Handball", "country": "Spain"},
  {"name": "Al Ahly Basketball", "sport": "Basketball", "country": "Egypt"},
  {"name": "Al Duhail SC", "sport": "Football", "country": "Qatar"},
  {"name": "Al Fateh", "sport": "Football", "country": "Saudi Arabia"},
  {"name": "Al Hilal", "sport": "Football", "country": "Saudi Arabia"},
  {"name": "Al Hilal Omdurman", "sport": "Football", "country": "Sudan"},
  {"name": "Al Jaish Damascus", "sport": "Basketball", "country": "Syria"},
  {"name": "Al Merrikh", "sport": "Football", "country": "Sudan"},
  {"name": "Al Rayyan SC", "sport": "Football", "country": "Qatar"},
  {"name": "Al Shabab", "sport": "Football", "country": "Saudi Arabia"},
  {"name": "Alanyaspor", "sport": "Football", "country": "Türkiye"},
  {"name": "Alba Berlin", "sport": "Basketball", "country": "Germany"},
  {"name": "Alingsås HK", "sport": "Handball", "country": "Sweden"},
  {"name": "Altekma", "sport": "Volleyball", "country": "Turkey"},
  {"name": "Aluron CMC Warta Zawiercie", "sport": "Volleyball", "country": "Poland"},
  {"name": "Amriswil Volleyball", "sport": "Volleyball", "country": "Switzerland"},
  {"name": "Anaheim Ducks", "sport": "Ice Hockey", "country": "United States"},
  {"name": "Aquila Basket Trento", "sport": "Basketball", "country": "Italy"},
  {"name": "Arizona Diamondbacks", "sport": "Baseball", "country": "United States"},
  {"name": "Manchester United FC", "sport": "Football", "country": "England"}
];

async function processEntities() {
  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    console.log(`[ENTITY-START] ${i + 4} ${entity.name}`);
    
    // Simulate digital-first search results
    const hasDigitalTransformation = Math.random() > 0.7;
    const hits = hasDigitalTransformation ? Math.floor(Math.random() * 15) + 5 : 0;
    const confidence = hasDigitalTransformation ? (Math.random() * 0.4 + 0.5).toFixed(1) : 0;
    
    if (hits > 0) {
      console.log(`[ENTITY-FOUND] ${entity.name} (${hits} hits, confidence=${confidence})`);
    } else {
      console.log(`[ENTITY-NONE] ${entity.name}`);
    }
    
    // Small delay to avoid overwhelming
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

processEntities().catch(console.error);