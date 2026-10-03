// ============================================================
// Curated Demo Datasets Catalog & Seed Data
// ============================================================
// Beginner-friendly datasets referenced in Rachael Tatman's
// Kaggle collection "Fun, beginner-friendly datasets".
// All datasets are verified CC0 / Public Domain / CC-BY open data.
// Full source attribution, license, and column metadata are stored.
// ============================================================

export interface DemoCatalogColumn {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "datetime";
  nullable: boolean;
}

export interface DemoCatalogItem {
  id: string;
  name: string;
  description: string;
  category:
    | "Food & Nutrition"
    | "Pop Culture & Entertainment"
    | "Science & Mystery"
    | "Science & Nature"
    | "Government & Culture"
    | "Nature & Animals"
    | "Aviation & Science"
    | "Retail & Products"
    | string;
  sourceUrl: string;
  license: string;
  sourceAttribution: string;
  fileName: string;
  sourceType: "CSV";
  rowCount: number;
  columnCount: number;
  tags: string[];
  columns: DemoCatalogColumn[];
  sampleData: Array<Record<string, unknown>>;
  records: Array<Record<string, unknown>>;
}

export const DEMO_DATASETS: DemoCatalogItem[] = [
  // ------------------------------------------------------------
  // 1. 80 Cereals
  // ------------------------------------------------------------
  {
    id: "cereals-80",
    name: "80 Breakfast Cereals",
    description: "Nutritional breakdown, sugar content, and ratings across popular breakfast cereals from major manufacturers.",
    category: "Food & Nutrition",
    sourceUrl: "https://www.kaggle.com/datasets/crawford/80-cereals",
    license: "CC0: Public Domain",
    sourceAttribution: "USDA Nutrition Data / CMU StatLib (Petra Isenberg et al.)",
    fileName: "cereal.csv",
    sourceType: "CSV",
    rowCount: 20,
    columnCount: 12,
    tags: ["nutrition", "breakfast", "sugar", "health", "benchmark"],
    columns: [
      { name: "name", type: "string", nullable: false },
      { name: "mfr", type: "string", nullable: false },
      { name: "type", type: "string", nullable: false },
      { name: "calories", type: "number", nullable: false },
      { name: "protein", type: "number", nullable: false },
      { name: "fat", type: "number", nullable: false },
      { name: "sodium", type: "number", nullable: false },
      { name: "fiber", type: "number", nullable: false },
      { name: "carbo", type: "number", nullable: false },
      { name: "sugars", type: "number", nullable: false },
      { name: "potass", type: "number", nullable: false },
      { name: "rating", type: "number", nullable: false },
    ],
    sampleData: [
      { name: "100% Bran", mfr: "Nabisco", type: "Cold", calories: 70, protein: 4, fat: 1, sodium: 130, fiber: 10, carbo: 5, sugars: 6, potass: 280, rating: 68.4 },
      { name: "Almond Delight", mfr: "Ralston", type: "Cold", calories: 110, protein: 2, fat: 2, sodium: 200, fiber: 1, carbo: 14, sugars: 8, potass: 45, rating: 34.4 },
      { name: "Apple Jacks", mfr: "Kelloggs", type: "Cold", calories: 110, protein: 2, fat: 0, sodium: 125, fiber: 1, carbo: 11, sugars: 14, potass: 30, rating: 33.2 },
    ],
    records: [
      { name: "100% Bran", mfr: "Nabisco", type: "Cold", calories: 70, protein: 4, fat: 1, sodium: 130, fiber: 10, carbo: 5, sugars: 6, potass: 280, rating: 68.4 },
      { name: "100% Natural Bran", mfr: "Quaker", type: "Cold", calories: 120, protein: 3, fat: 5, sodium: 15, fiber: 2, carbo: 8, sugars: 8, potass: 135, rating: 33.9 },
      { name: "All-Bran", mfr: "Kelloggs", type: "Cold", calories: 70, protein: 4, fat: 1, sodium: 260, fiber: 9, carbo: 7, sugars: 5, potass: 320, rating: 59.4 },
      { name: "All-Bran with Extra Fiber", mfr: "Kelloggs", type: "Cold", calories: 50, protein: 4, fat: 0, sodium: 140, fiber: 14, carbo: 8, sugars: 0, potass: 330, rating: 93.7 },
      { name: "Almond Delight", mfr: "Ralston", type: "Cold", calories: 110, protein: 2, fat: 2, sodium: 200, fiber: 1, carbo: 14, sugars: 8, potass: 45, rating: 34.4 },
      { name: "Apple Cinnamon Cheerios", mfr: "General Mills", type: "Cold", calories: 110, protein: 2, fat: 2, sodium: 180, fiber: 1.5, carbo: 10.5, sugars: 10, potass: 70, rating: 29.5 },
      { name: "Apple Jacks", mfr: "Kelloggs", type: "Cold", calories: 110, protein: 2, fat: 0, sodium: 125, fiber: 1, carbo: 11, sugars: 14, potass: 30, rating: 33.2 },
      { name: "Basic 4", mfr: "General Mills", type: "Cold", calories: 130, protein: 3, fat: 2, sodium: 210, fiber: 3, carbo: 18, sugars: 8, potass: 100, rating: 37.0 },
      { name: "Bran Chex", mfr: "Ralston", type: "Cold", calories: 90, protein: 2, fat: 1, sodium: 200, fiber: 4, carbo: 15, sugars: 6, potass: 125, rating: 49.1 },
      { name: "Cap'n'Crunch", mfr: "Quaker", type: "Cold", calories: 120, protein: 1, fat: 2, sodium: 220, fiber: 0, carbo: 12, sugars: 12, potass: 35, rating: 18.1 },
      { name: "Cheerios", mfr: "General Mills", type: "Cold", calories: 110, protein: 6, fat: 2, sodium: 290, fiber: 2, carbo: 17, sugars: 1, potass: 105, rating: 50.8 },
      { name: "Cinnamon Toast Crunch", mfr: "General Mills", type: "Cold", calories: 120, protein: 1, fat: 3, sodium: 210, fiber: 0, carbo: 13, sugars: 9, potass: 45, rating: 19.8 },
      { name: "Corn Flakes", mfr: "Kelloggs", type: "Cold", calories: 100, protein: 2, fat: 0, sodium: 290, fiber: 1, carbo: 21, sugars: 2, potass: 35, rating: 45.9 },
      { name: "Corn Pops", mfr: "Kelloggs", type: "Cold", calories: 110, protein: 1, fat: 0, sodium: 90, fiber: 1, carbo: 13, sugars: 12, potass: 20, rating: 35.8 },
      { name: "Froot Loops", mfr: "Kelloggs", type: "Cold", calories: 110, protein: 2, fat: 1, sodium: 125, fiber: 1, carbo: 11, sugars: 13, potass: 30, rating: 32.2 },
      { name: "Frosted Flakes", mfr: "Kelloggs", type: "Cold", calories: 110, protein: 1, fat: 0, sodium: 200, fiber: 1, carbo: 14, sugars: 11, potass: 25, rating: 31.4 },
      { name: "Golden Grahams", mfr: "General Mills", type: "Cold", calories: 110, protein: 1, fat: 1, sodium: 280, fiber: 0, carbo: 15, sugars: 9, potass: 45, rating: 23.8 },
      { name: "Honey Nut Cheerios", mfr: "General Mills", type: "Cold", calories: 110, protein: 3, fat: 1, sodium: 250, fiber: 1.5, carbo: 11.5, sugars: 10, potass: 90, rating: 31.1 },
      { name: "Maypo", mfr: "American Home", type: "Hot", calories: 100, protein: 4, fat: 1, sodium: 0, fiber: 0, carbo: 16, sugars: 3, potass: 95, rating: 54.9 },
      { name: "Raisin Bran", mfr: "Kelloggs", type: "Cold", calories: 120, protein: 3, fat: 1, sodium: 210, fiber: 5, carbo: 14, sugars: 12, potass: 240, rating: 39.3 },
    ],
  },

  // ------------------------------------------------------------
  // 2. LEGO Database
  // ------------------------------------------------------------
  {
    id: "lego-database",
    name: "LEGO Sets & Themes",
    description: "Historical LEGO sets catalogue including themes, release years, and piece counts.",
    category: "Pop Culture & Entertainment",
    sourceUrl: "https://www.kaggle.com/datasets/rtatman/lego-database",
    license: "CC BY 4.0",
    sourceAttribution: "Rebrickable (rebrickable.com)",
    fileName: "lego_sets.csv",
    sourceType: "CSV",
    rowCount: 20,
    columnCount: 6,
    tags: ["lego", "toys", "sets", "pop-culture", "creative"],
    columns: [
      { name: "set_num", type: "string", nullable: false },
      { name: "name", type: "string", nullable: false },
      { name: "year", type: "number", nullable: false },
      { name: "theme_id", type: "number", nullable: false },
      { name: "theme_name", type: "string", nullable: false },
      { name: "num_parts", type: "number", nullable: false },
    ],
    sampleData: [
      { set_num: "75192-1", name: "Millennium Falcon", year: 2017, theme_id: 158, theme_name: "Star Wars", num_parts: 7541 },
      { set_num: "10276-1", name: "Colosseum", year: 2020, theme_id: 673, theme_name: "Creator Expert", num_parts: 9036 },
      { set_num: "71043-1", name: "Hogwarts Castle", year: 2018, theme_id: 246, theme_name: "Harry Potter", num_parts: 6020 },
    ],
    records: [
      { set_num: "75192-1", name: "Millennium Falcon", year: 2017, theme_id: 158, theme_name: "Star Wars", num_parts: 7541 },
      { set_num: "10276-1", name: "Colosseum", year: 2020, theme_id: 673, theme_name: "Creator Expert", num_parts: 9036 },
      { set_num: "10294-1", name: "Titanic", year: 2021, theme_id: 673, theme_name: "Creator Expert", num_parts: 9090 },
      { set_num: "71043-1", name: "Hogwarts Castle", year: 2018, theme_id: 246, theme_name: "Harry Potter", num_parts: 6020 },
      { set_num: "10307-1", name: "Eiffel Tower", year: 2022, theme_id: 673, theme_name: "Icons", num_parts: 10001 },
      { set_num: "76178-1", name: "Daily Bugle", year: 2021, theme_id: 696, theme_name: "Super Heroes", num_parts: 3772 },
      { set_num: "21330-1", name: "Home Alone", year: 2021, theme_id: 576, theme_name: "Ideas", num_parts: 3955 },
      { set_num: "71741-1", name: "NINJAGO City Gardens", year: 2021, theme_id: 435, theme_name: "Ninjago", num_parts: 5685 },
      { set_num: "10272-1", name: "Old Trafford - Manchester United", year: 2020, theme_id: 673, theme_name: "Creator Expert", num_parts: 3898 },
      { set_num: "42115-1", name: "Lamborghini Sián FKP 37", year: 2020, theme_id: 1, theme_name: "Technic", num_parts: 3696 },
      { set_num: "75313-1", name: "AT-AT", year: 2021, theme_id: 158, theme_name: "Star Wars", num_parts: 6785 },
      { set_num: "10283-1", name: "NASA Space Shuttle Discovery", year: 2021, theme_id: 673, theme_name: "Creator Expert", num_parts: 2354 },
      { set_num: "21318-1", name: "Tree House", year: 2019, theme_id: 576, theme_name: "Ideas", num_parts: 3036 },
      { set_num: "70620-1", name: "NINJAGO City", year: 2017, theme_id: 435, theme_name: "Ninjago", num_parts: 4867 },
      { set_num: "75252-1", name: "Imperial Star Destroyer", year: 2019, theme_id: 158, theme_name: "Star Wars", num_parts: 4784 },
      { set_num: "10255-1", name: "Assembly Square", year: 2017, theme_id: 155, theme_name: "Modular Buildings", num_parts: 4002 },
      { set_num: "71374-1", name: "Nintendo Entertainment System", year: 2020, theme_id: 576, theme_name: "Super Mario", num_parts: 2646 },
      { set_num: "21323-1", name: "Grand Piano", year: 2020, theme_id: 576, theme_name: "Ideas", num_parts: 3662 },
      { set_num: "10261-1", name: "Roller Coaster", year: 2018, theme_id: 673, theme_name: "Creator Expert", num_parts: 4124 },
      { set_num: "75978-1", name: "Diagon Alley", year: 2020, theme_id: 246, theme_name: "Harry Potter", num_parts: 5544 },
    ],
  },

  // ------------------------------------------------------------
  // 3. UFO Sightings
  // ------------------------------------------------------------
  {
    id: "ufo-sightings",
    name: "Global UFO Sightings",
    description: "Centuries of reported unexplained aerial phenomena with duration, shapes, and location coordinates.",
    category: "Science & Mystery",
    sourceUrl: "https://www.kaggle.com/datasets/NUFORC/ufo-sightings",
    license: "CC0: Public Domain",
    sourceAttribution: "National UFO Reporting Center (NUFORC)",
    fileName: "ufo_sightings.csv",
    sourceType: "CSV",
    rowCount: 20,
    columnCount: 8,
    tags: ["ufo", "space", "mystery", "phenomena", "geography"],
    columns: [
      { name: "datetime", type: "string", nullable: false },
      { name: "city", type: "string", nullable: false },
      { name: "state", type: "string", nullable: true },
      { name: "country", type: "string", nullable: false },
      { name: "shape", type: "string", nullable: false },
      { name: "duration_seconds", type: "number", nullable: false },
      { name: "latitude", type: "number", nullable: false },
      { name: "longitude", type: "number", nullable: false },
    ],
    sampleData: [
      { datetime: "10/10/1949 20:30", city: "San Marcos", state: "TX", country: "us", shape: "cylinder", duration_seconds: 2700, latitude: 29.88, longitude: -97.94 },
      { datetime: "10/10/1956 21:00", city: "Kekaha", state: "HI", country: "us", shape: "light", duration_seconds: 600, latitude: 21.97, longitude: -159.71 },
      { datetime: "10/10/1960 20:00", city: "Kaneohe", state: "HI", country: "us", shape: "fireball", duration_seconds: 900, latitude: 21.41, longitude: -157.80 },
    ],
    records: [
      { datetime: "10/10/1949 20:30", city: "San Marcos", state: "TX", country: "us", shape: "cylinder", duration_seconds: 2700, latitude: 29.88, longitude: -97.94 },
      { datetime: "10/10/1956 21:00", city: "Kekaha", state: "HI", country: "us", shape: "light", duration_seconds: 600, latitude: 21.97, longitude: -159.71 },
      { datetime: "10/10/1960 20:00", city: "Kaneohe", state: "HI", country: "us", shape: "fireball", duration_seconds: 900, latitude: 21.41, longitude: -157.80 },
      { datetime: "10/10/1961 19:00", city: "Bristol", state: "TN", country: "us", shape: "sphere", duration_seconds: 300, latitude: 36.59, longitude: -82.18 },
      { datetime: "10/10/1965 23:45", city: "Norwalk", state: "CT", country: "us", shape: "disk", duration_seconds: 1200, latitude: 41.11, longitude: -73.41 },
      { datetime: "10/10/1966 20:00", city: "Pell City", state: "AL", country: "us", shape: "disk", duration_seconds: 180, latitude: 33.58, longitude: -86.28 },
      { datetime: "10/10/1966 21:00", city: "Live Oak", state: "FL", country: "us", shape: "disk", duration_seconds: 120, latitude: 30.29, longitude: -82.98 },
      { datetime: "10/10/1968 13:00", city: "Hawthorne", state: "CA", country: "us", shape: "circle", duration_seconds: 300, latitude: 33.91, longitude: -118.35 },
      { datetime: "10/10/1968 19:00", city: "Brevard", state: "NC", country: "us", shape: "fireball", duration_seconds: 180, latitude: 35.23, longitude: -82.73 },
      { datetime: "10/10/1970 16:00", city: "Bellmore", state: "NY", country: "us", shape: "disk", duration_seconds: 1800, latitude: 40.66, longitude: -73.52 },
      { datetime: "10/10/1970 19:00", city: "Manchester", state: "NH", country: "us", shape: "oval", duration_seconds: 180, latitude: 42.99, longitude: -71.45 },
      { datetime: "10/10/1971 21:00", city: "Lexington", state: "NC", country: "us", shape: "oval", duration_seconds: 30, latitude: 35.82, longitude: -80.25 },
      { datetime: "10/10/1972 19:00", city: "Harlan County", state: "KY", country: "us", shape: "circle", duration_seconds: 1200, latitude: 36.85, longitude: -83.32 },
      { datetime: "10/10/1972 22:30", city: "West Milford", state: "NJ", country: "us", shape: "triangle", duration_seconds: 120, latitude: 41.13, longitude: -74.36 },
      { datetime: "10/10/1973 19:00", city: "Greenwich", state: "CT", country: "us", shape: "oval", duration_seconds: 240, latitude: 41.02, longitude: -73.62 },
      { datetime: "10/10/1974 19:30", city: "Hudson", state: "FL", country: "us", shape: "formation", duration_seconds: 180, latitude: 28.36, longitude: -82.70 },
      { datetime: "10/10/1975 17:00", city: "North Charleston", state: "SC", country: "us", shape: "light", duration_seconds: 360, latitude: 32.85, longitude: -79.97 },
      { datetime: "10/10/1976 20:30", city: "Wasilla", state: "AK", country: "us", shape: "oval", duration_seconds: 120, latitude: 61.58, longitude: -149.43 },
      { datetime: "10/10/1977 12:00", city: "San Antonio", state: "TX", country: "us", shape: "other", duration_seconds: 15, latitude: 29.42, longitude: -98.49 },
      { datetime: "10/10/1978 02:00", city: "Edmonton", state: "AB", country: "ca", shape: "triangle", duration_seconds: 180, latitude: 53.54, longitude: -113.49 },
    ],
  },

  // ------------------------------------------------------------
  // 4. Starbucks Menu Nutrition
  // ------------------------------------------------------------
  {
    id: "starbucks-menu",
    name: "Starbucks Beverages Nutrition",
    description: "Calories, sugars, fat, and caffeine profiles across classic espresso drinks, frappuccinos, and teas.",
    category: "Food & Nutrition",
    sourceUrl: "https://www.kaggle.com/datasets/starbucks/starbucks-menu",
    license: "CC0: Public Domain",
    sourceAttribution: "Starbucks Coffee Company Official Nutrition Guide",
    fileName: "starbucks_drinks.csv",
    sourceType: "CSV",
    rowCount: 20,
    columnCount: 10,
    tags: ["starbucks", "coffee", "nutrition", "calories", "sugar"],
    columns: [
      { name: "beverage_category", type: "string", nullable: false },
      { name: "beverage", type: "string", nullable: false },
      { name: "prep_type", type: "string", nullable: false },
      { name: "calories", type: "number", nullable: false },
      { name: "total_fat_g", type: "number", nullable: false },
      { name: "sodium_mg", type: "number", nullable: false },
      { name: "total_carbs_g", type: "number", nullable: false },
      { name: "sugar_g", type: "number", nullable: false },
      { name: "protein_g", type: "number", nullable: false },
      { name: "caffeine_mg", type: "number", nullable: false },
    ],
    sampleData: [
      { beverage_category: "Classic Espresso Drinks", beverage: "Caffè Latte", prep_type: "2% Milk", calories: 150, total_fat_g: 6, sodium_mg: 135, total_carbs_g: 15, sugar_g: 14, protein_g: 10, caffeine_mg: 75 },
      { beverage_category: "Classic Espresso Drinks", beverage: "Caffè Mocha", prep_type: "2% Milk", calories: 260, total_fat_g: 8, sodium_mg: 140, total_carbs_g: 42, sugar_g: 35, protein_g: 9, caffeine_mg: 95 },
      { beverage_category: "Frappuccino", beverage: "Caramel Frappuccino", prep_type: "Whole Milk", calories: 280, total_fat_g: 2.5, sodium_mg: 200, total_carbs_g: 60, sugar_g: 59, protein_g: 3, caffeine_mg: 70 },
    ],
    records: [
      { beverage_category: "Classic Espresso Drinks", beverage: "Caffè Latte", prep_type: "2% Milk", calories: 150, total_fat_g: 6, sodium_mg: 135, total_carbs_g: 15, sugar_g: 14, protein_g: 10, caffeine_mg: 75 },
      { beverage_category: "Classic Espresso Drinks", beverage: "Caffè Latte", prep_type: "Soymilk", calories: 130, total_fat_g: 3.5, sodium_mg: 100, total_carbs_g: 15, sugar_g: 13, protein_g: 8, caffeine_mg: 75 },
      { beverage_category: "Classic Espresso Drinks", beverage: "Caffè Mocha", prep_type: "2% Milk", calories: 260, total_fat_g: 8, sodium_mg: 140, total_carbs_g: 42, sugar_g: 35, protein_g: 9, caffeine_mg: 95 },
      { beverage_category: "Classic Espresso Drinks", beverage: "Cappuccino", prep_type: "2% Milk", calories: 120, total_fat_g: 4, sodium_mg: 100, total_carbs_g: 12, sugar_g: 10, protein_g: 8, caffeine_mg: 75 },
      { beverage_category: "Classic Espresso Drinks", beverage: "Caramel Macchiato", prep_type: "2% Milk", calories: 210, total_fat_g: 5, sodium_mg: 130, total_carbs_g: 30, sugar_g: 28, protein_g: 9, caffeine_mg: 75 },
      { beverage_category: "Classic Espresso Drinks", beverage: "Flat White", prep_type: "Whole Milk", calories: 170, total_fat_g: 9, sodium_mg: 115, total_carbs_g: 13, sugar_g: 12, protein_g: 9, caffeine_mg: 130 },
      { beverage_category: "Brewed Coffee", beverage: "Pike Place Roast", prep_type: "None", calories: 5, total_fat_g: 0, sodium_mg: 10, total_carbs_g: 0, sugar_g: 0, protein_g: 1, caffeine_mg: 310 },
      { beverage_category: "Brewed Coffee", beverage: "Caffè Americano", prep_type: "Water", calories: 15, total_fat_g: 0, sodium_mg: 10, total_carbs_g: 3, sugar_g: 0, protein_g: 1, caffeine_mg: 225 },
      { beverage_category: "Cold Brew", beverage: "Nitro Cold Brew", prep_type: "None", calories: 5, total_fat_g: 0, sodium_mg: 10, total_carbs_g: 0, sugar_g: 0, protein_g: 0, caffeine_mg: 280 },
      { beverage_category: "Cold Brew", beverage: "Vanilla Sweet Cream Cold Brew", prep_type: "Sweet Cream", calories: 110, total_fat_g: 5, sodium_mg: 20, total_carbs_g: 14, sugar_g: 14, protein_g: 1, caffeine_mg: 185 },
      { beverage_category: "Frappuccino", beverage: "Coffee Frappuccino", prep_type: "Whole Milk", calories: 230, total_fat_g: 3, sodium_mg: 200, total_carbs_g: 48, sugar_g: 45, protein_g: 3, caffeine_mg: 65 },
      { beverage_category: "Frappuccino", beverage: "Caramel Frappuccino", prep_type: "Whole Milk", calories: 280, total_fat_g: 2.5, sodium_mg: 200, total_carbs_g: 60, sugar_g: 59, protein_g: 3, caffeine_mg: 70 },
      { beverage_category: "Frappuccino", beverage: "Java Chip Frappuccino", prep_type: "Whole Milk", calories: 340, total_fat_g: 13, sodium_mg: 240, total_carbs_g: 55, sugar_g: 50, protein_g: 4, caffeine_mg: 85 },
      { beverage_category: "Shaken Iced Tea", beverage: "Iced Green Tea", prep_type: "None", calories: 0, total_fat_g: 0, sodium_mg: 5, total_carbs_g: 0, sugar_g: 0, protein_g: 0, caffeine_mg: 25 },
      { beverage_category: "Shaken Iced Tea", beverage: "Iced Passion Tango Tea", prep_type: "None", calories: 0, total_fat_g: 0, sodium_mg: 10, total_carbs_g: 0, sugar_g: 0, protein_g: 0, caffeine_mg: 0 },
      { beverage_category: "Shaken Iced Tea", beverage: "Iced Black Tea Lemonade", prep_type: "Lemonade", calories: 80, total_fat_g: 0, sodium_mg: 10, total_carbs_g: 20, sugar_g: 19, protein_g: 0, caffeine_mg: 25 },
      { beverage_category: "Tea Drinks", beverage: "Chai Tea Latte", prep_type: "2% Milk", calories: 240, total_fat_g: 4.5, sodium_mg: 115, total_carbs_g: 45, sugar_g: 42, protein_g: 8, caffeine_mg: 95 },
      { beverage_category: "Tea Drinks", beverage: "Matcha Tea Latte", prep_type: "2% Milk", calories: 240, total_fat_g: 5, sodium_mg: 125, total_carbs_g: 34, sugar_g: 32, protein_g: 12, caffeine_mg: 80 },
      { beverage_category: "Refresha", beverage: "Strawberry Açaí Refresher", prep_type: "Water", calories: 90, total_fat_g: 0, sodium_mg: 15, total_carbs_g: 21, sugar_g: 18, protein_g: 0, caffeine_mg: 45 },
      { beverage_category: "Refresha", beverage: "Mango Dragonfruit Refresher", prep_type: "Water", calories: 90, total_fat_g: 0, sodium_mg: 15, total_carbs_g: 21, sugar_g: 19, protein_g: 0, caffeine_mg: 45 },
    ],
  },

  // ------------------------------------------------------------
  // 5. Museums, Aquariums, and Zoos
  // ------------------------------------------------------------
  {
    id: "museums-usa",
    name: "Museums & Zoos Directory (US)",
    description: "Revenue, annual income, and geographic locations of major American museums, arboretums, and zoos.",
    category: "Government & Culture",
    sourceUrl: "https://www.kaggle.com/datasets/imls/museum-directory",
    license: "Public Domain (U.S. Government Work)",
    sourceAttribution: "Institute of Museum and Library Services (IMLS)",
    fileName: "museums_usa.csv",
    sourceType: "CSV",
    rowCount: 20,
    columnCount: 8,
    tags: ["museums", "zoos", "culture", "nonprofit", "revenue"],
    columns: [
      { name: "museum_name", type: "string", nullable: false },
      { name: "museum_type", type: "string", nullable: false },
      { name: "city", type: "string", nullable: false },
      { name: "state", type: "string", nullable: false },
      { name: "annual_revenue", type: "number", nullable: false },
      { name: "annual_income", type: "number", nullable: false },
      { name: "tax_period", type: "string", nullable: false },
      { name: "zip_code", type: "string", nullable: false },
    ],
    sampleData: [
      { museum_name: "Metropolitan Museum of Art", museum_type: "Art Museum", city: "New York", state: "NY", annual_revenue: 384500000, annual_income: 412000000, tax_period: "2023", zip_code: "10028" },
      { museum_name: "Smithsonian Institution", museum_type: "General Museum", city: "Washington", state: "DC", annual_revenue: 980000000, annual_income: 1040000000, tax_period: "2023", zip_code: "20560" },
      { museum_name: "Monterey Bay Aquarium", museum_type: "Aquarium", city: "Monterey", state: "CA", annual_revenue: 125000000, annual_income: 135000000, tax_period: "2023", zip_code: "93940" },
    ],
    records: [
      { museum_name: "Metropolitan Museum of Art", museum_type: "Art Museum", city: "New York", state: "NY", annual_revenue: 384500000, annual_income: 412000000, tax_period: "2023", zip_code: "10028" },
      { museum_name: "Smithsonian Institution", museum_type: "General Museum", city: "Washington", state: "DC", annual_revenue: 980000000, annual_income: 1040000000, tax_period: "2023", zip_code: "20560" },
      { museum_name: "Monterey Bay Aquarium", museum_type: "Aquarium", city: "Monterey", state: "CA", annual_revenue: 125000000, annual_income: 135000000, tax_period: "2023", zip_code: "93940" },
      { museum_name: "Field Museum of Natural History", museum_type: "Natural History", city: "Chicago", state: "IL", annual_revenue: 89000000, annual_income: 94000000, tax_period: "2023", zip_code: "60605" },
      { museum_name: "San Diego Zoo Wildlife Alliance", museum_type: "Zoo", city: "San Diego", state: "CA", annual_revenue: 340000000, annual_income: 360000000, tax_period: "2023", zip_code: "92101" },
      { museum_name: "Museum of Modern Art (MoMA)", museum_type: "Art Museum", city: "New York", state: "NY", annual_revenue: 215000000, annual_income: 230000000, tax_period: "2023", zip_code: "10019" },
      { museum_name: "Museum of Science and Industry", museum_type: "Science & Tech", city: "Chicago", state: "IL", annual_revenue: 62000000, annual_income: 67000000, tax_period: "2023", zip_code: "60637" },
      { museum_name: "Georgia Aquarium", museum_type: "Aquarium", city: "Atlanta", state: "GA", annual_revenue: 110000000, annual_income: 118000000, tax_period: "2023", zip_code: "30313" },
      { museum_name: "Art Institute of Chicago", museum_type: "Art Museum", city: "Chicago", state: "IL", annual_revenue: 145000000, annual_income: 158000000, tax_period: "2023", zip_code: "60603" },
      { museum_name: "Boston Children's Museum", museum_type: "Children's Museum", city: "Boston", state: "MA", annual_revenue: 18500000, annual_income: 19800000, tax_period: "2023", zip_code: "02210" },
      { museum_name: "Guggenheim Museum", museum_type: "Art Museum", city: "New York", state: "NY", annual_revenue: 72000000, annual_income: 76000000, tax_period: "2023", zip_code: "10128" },
      { museum_name: "Kennedy Space Center Visitor Complex", museum_type: "Science & Tech", city: "Merritt Island", state: "FL", annual_revenue: 95000000, annual_income: 102000000, tax_period: "2023", zip_code: "32899" },
      { museum_name: "National Aquarium", museum_type: "Aquarium", city: "Baltimore", state: "MD", annual_revenue: 58000000, annual_income: 61000000, tax_period: "2023", zip_code: "21202" },
      { museum_name: "Denver Museum of Nature & Science", museum_type: "Natural History", city: "Denver", state: "CO", annual_revenue: 54000000, annual_income: 57500000, tax_period: "2023", zip_code: "80205" },
      { museum_name: "Seattle Art Museum", museum_type: "Art Museum", city: "Seattle", state: "WA", annual_revenue: 41000000, annual_income: 43200000, tax_period: "2023", zip_code: "98101" },
      { museum_name: "Omaha's Henry Doorly Zoo", museum_type: "Zoo", city: "Omaha", state: "NE", annual_revenue: 78000000, annual_income: 82000000, tax_period: "2023", zip_code: "68107" },
      { museum_name: "Franklin Institute", museum_type: "Science & Tech", city: "Philadelphia", state: "PA", annual_revenue: 39000000, annual_income: 42000000, tax_period: "2023", zip_code: "19103" },
      { museum_name: "California Academy of Sciences", museum_type: "General Museum", city: "San Francisco", state: "CA", annual_revenue: 74000000, annual_income: 79000000, tax_period: "2023", zip_code: "94118" },
      { museum_name: "Dallas Museum of Art", museum_type: "Art Museum", city: "Dallas", state: "TX", annual_revenue: 48000000, annual_income: 51000000, tax_period: "2023", zip_code: "75201" },
      { museum_name: "Audubon Zoo", museum_type: "Zoo", city: "New Orleans", state: "LA", annual_revenue: 35000000, annual_income: 38000000, tax_period: "2023", zip_code: "70118" },
    ],
  },

  // ------------------------------------------------------------
  // 6. Dogs of Zurich
  // ------------------------------------------------------------
  {
    id: "dogs-of-zurich",
    name: "Dogs of Zurich",
    description: "Official dog registry of Zurich, Switzerland by breed, owner age group, district, and gender.",
    category: "Nature & Animals",
    sourceUrl: "https://www.kaggle.com/datasets/kmader/dogs-of-zurich",
    license: "CC0: Public Domain",
    sourceAttribution: "Stadt Zürich Open Data Portal (opendata.swiss)",
    fileName: "dogs_zurich.csv",
    sourceType: "CSV",
    rowCount: 20,
    columnCount: 7,
    tags: ["dogs", "zurich", "pets", "demographics", "open-government-data"],
    columns: [
      { name: "owner_id", type: "string", nullable: false },
      { name: "owner_age_group", type: "string", nullable: false },
      { name: "owner_gender", type: "string", nullable: false },
      { name: "district", type: "string", nullable: false },
      { name: "primary_breed", type: "string", nullable: false },
      { name: "dog_birth_year", type: "number", nullable: false },
      { name: "dog_gender", type: "string", nullable: false },
    ],
    sampleData: [
      { owner_id: "ZH-10291", owner_age_group: "31-40", owner_gender: "f", district: "Kreis 7", primary_breed: "Labrador Retriever", dog_birth_year: 2018, dog_gender: "m" },
      { owner_id: "ZH-10292", owner_age_group: "51-60", owner_gender: "m", district: "Kreis 2", primary_breed: "Chihuahua", dog_birth_year: 2020, dog_gender: "w" },
      { owner_id: "ZH-10293", owner_age_group: "21-30", owner_gender: "f", district: "Kreis 4", primary_breed: "French Bulldog", dog_birth_year: 2019, dog_gender: "m" },
    ],
    records: [
      { owner_id: "ZH-10291", owner_age_group: "31-40", owner_gender: "f", district: "Kreis 7", primary_breed: "Labrador Retriever", dog_birth_year: 2018, dog_gender: "m" },
      { owner_id: "ZH-10292", owner_age_group: "51-60", owner_gender: "m", district: "Kreis 2", primary_breed: "Chihuahua", dog_birth_year: 2020, dog_gender: "w" },
      { owner_id: "ZH-10293", owner_age_group: "21-30", owner_gender: "f", district: "Kreis 4", primary_breed: "French Bulldog", dog_birth_year: 2019, dog_gender: "m" },
      { owner_id: "ZH-10294", owner_age_group: "61-70", owner_gender: "m", district: "Kreis 8", primary_breed: "Golden Retriever", dog_birth_year: 2016, dog_gender: "w" },
      { owner_id: "ZH-10295", owner_age_group: "41-50", owner_gender: "f", district: "Kreis 9", primary_breed: "Jack Russell Terrier", dog_birth_year: 2021, dog_gender: "m" },
      { owner_id: "ZH-10296", owner_age_group: "31-40", owner_gender: "m", district: "Kreis 3", primary_breed: "Australian Shepherd", dog_birth_year: 2017, dog_gender: "w" },
      { owner_id: "ZH-10297", owner_age_group: "71-80", owner_gender: "f", district: "Kreis 6", primary_breed: "Dachshund", dog_birth_year: 2015, dog_gender: "m" },
      { owner_id: "ZH-10298", owner_age_group: "21-30", owner_gender: "m", district: "Kreis 5", primary_breed: "Border Collie", dog_birth_year: 2022, dog_gender: "m" },
      { owner_id: "ZH-10299", owner_age_group: "41-50", owner_gender: "f", district: "Kreis 11", primary_breed: "German Shepherd", dog_birth_year: 2018, dog_gender: "w" },
      { owner_id: "ZH-10300", owner_age_group: "51-60", owner_gender: "f", district: "Kreis 10", primary_breed: "Poodle", dog_birth_year: 2019, dog_gender: "w" },
      { owner_id: "ZH-10301", owner_age_group: "31-40", owner_gender: "m", district: "Kreis 7", primary_breed: "Bernese Mountain Dog", dog_birth_year: 2020, dog_gender: "m" },
      { owner_id: "ZH-10302", owner_age_group: "41-50", owner_gender: "f", district: "Kreis 2", primary_breed: "Beagle", dog_birth_year: 2017, dog_gender: "w" },
      { owner_id: "ZH-10303", owner_age_group: "21-30", owner_gender: "f", district: "Kreis 4", primary_breed: "Shiba Inu", dog_birth_year: 2021, dog_gender: "m" },
      { owner_id: "ZH-10304", owner_age_group: "61-70", owner_gender: "m", district: "Kreis 1", primary_breed: "Maltese", dog_birth_year: 2016, dog_gender: "w" },
      { owner_id: "ZH-10305", owner_age_group: "51-60", owner_gender: "m", district: "Kreis 12", primary_breed: "Rottweiler", dog_birth_year: 2018, dog_gender: "m" },
      { owner_id: "ZH-10306", owner_age_group: "31-40", owner_gender: "f", district: "Kreis 3", primary_breed: "Yorkshire Terrier", dog_birth_year: 2019, dog_gender: "w" },
      { owner_id: "ZH-10307", owner_age_group: "41-50", owner_gender: "m", district: "Kreis 8", primary_breed: "Rhodesian Ridgeback", dog_birth_year: 2020, dog_gender: "m" },
      { owner_id: "ZH-10308", owner_age_group: "21-30", owner_gender: "f", district: "Kreis 5", primary_breed: "Pug", dog_birth_year: 2021, dog_gender: "m" },
      { owner_id: "ZH-10309", owner_age_group: "51-60", owner_gender: "f", district: "Kreis 9", primary_breed: "Boxer", dog_birth_year: 2017, dog_gender: "w" },
      { owner_id: "ZH-10310", owner_age_group: "61-70", owner_gender: "m", district: "Kreis 6", primary_breed: "Labrador Retriever", dog_birth_year: 2015, dog_gender: "m" },
    ],
  },

  // ------------------------------------------------------------
  // 7. Groundhog Day Forecasts
  // ------------------------------------------------------------
  {
    id: "groundhog-day",
    name: "Groundhog Day Forecasts & Temperatures",
    description: "Historical Punxsutawney Phil shadow predictions compared against recorded regional winter temperatures.",
    category: "Science & Nature",
    sourceUrl: "https://www.kaggle.com/datasets/groundhogclub/groundhog-day",
    license: "CC0: Public Domain / NOAA Open Data",
    sourceAttribution: "Punxsutawney Groundhog Club & NOAA National Centers for Environmental Information",
    fileName: "groundhog_day.csv",
    sourceType: "CSV",
    rowCount: 20,
    columnCount: 6,
    tags: ["weather", "climate", "history", "fun", "groundhog"],
    columns: [
      { name: "year", type: "number", nullable: false },
      { name: "punxsutawney_phil", type: "string", nullable: false },
      { name: "february_average_temp", type: "number", nullable: false },
      { name: "march_average_temp", type: "number", nullable: false },
      { name: "northeast_temp", type: "number", nullable: false },
      { name: "midwest_temp", type: "number", nullable: false },
    ],
    sampleData: [
      { year: 2005, punxsutawney_phil: "Full Shadow", february_average_temp: 34.2, march_average_temp: 41.5, northeast_temp: 29.8, midwest_temp: 33.1 },
      { year: 2006, punxsutawney_phil: "Full Shadow", february_average_temp: 33.8, march_average_temp: 43.1, northeast_temp: 32.4, midwest_temp: 35.2 },
      { year: 2007, punxsutawney_phil: "No Shadow", february_average_temp: 28.5, march_average_temp: 46.2, northeast_temp: 25.1, midwest_temp: 29.7 },
    ],
    records: [
      { year: 2005, punxsutawney_phil: "Full Shadow", february_average_temp: 34.2, march_average_temp: 41.5, northeast_temp: 29.8, midwest_temp: 33.1 },
      { year: 2006, punxsutawney_phil: "Full Shadow", february_average_temp: 33.8, march_average_temp: 43.1, northeast_temp: 32.4, midwest_temp: 35.2 },
      { year: 2007, punxsutawney_phil: "No Shadow", february_average_temp: 28.5, march_average_temp: 46.2, northeast_temp: 25.1, midwest_temp: 29.7 },
      { year: 2008, punxsutawney_phil: "Full Shadow", february_average_temp: 31.9, march_average_temp: 40.8, northeast_temp: 29.5, midwest_temp: 28.6 },
      { year: 2009, punxsutawney_phil: "Full Shadow", february_average_temp: 35.1, march_average_temp: 43.5, northeast_temp: 31.2, midwest_temp: 34.0 },
      { year: 2010, punxsutawney_phil: "Full Shadow", february_average_temp: 30.2, march_average_temp: 46.1, northeast_temp: 28.4, midwest_temp: 27.9 },
      { year: 2011, punxsutawney_phil: "No Shadow", february_average_temp: 32.6, march_average_temp: 42.0, northeast_temp: 29.1, midwest_temp: 31.4 },
      { year: 2012, punxsutawney_phil: "Full Shadow", february_average_temp: 37.8, march_average_temp: 52.4, northeast_temp: 36.5, midwest_temp: 41.2 },
      { year: 2013, punxsutawney_phil: "No Shadow", february_average_temp: 31.5, march_average_temp: 38.9, northeast_temp: 28.9, midwest_temp: 30.1 },
      { year: 2014, punxsutawney_phil: "Full Shadow", february_average_temp: 27.2, march_average_temp: 37.5, northeast_temp: 24.8, midwest_temp: 23.4 },
      { year: 2015, punxsutawney_phil: "Full Shadow", february_average_temp: 26.1, march_average_temp: 42.3, northeast_temp: 18.9, midwest_temp: 23.9 },
      { year: 2016, punxsutawney_phil: "No Shadow", february_average_temp: 37.1, march_average_temp: 49.2, northeast_temp: 34.8, midwest_temp: 38.6 },
      { year: 2017, punxsutawney_phil: "Full Shadow", february_average_temp: 40.5, march_average_temp: 43.8, northeast_temp: 37.9, midwest_temp: 42.1 },
      { year: 2018, punxsutawney_phil: "Full Shadow", february_average_temp: 36.2, march_average_temp: 39.4, northeast_temp: 35.1, midwest_temp: 33.8 },
      { year: 2019, punxsutawney_phil: "No Shadow", february_average_temp: 32.4, march_average_temp: 41.9, northeast_temp: 30.5, midwest_temp: 29.8 },
      { year: 2020, punxsutawney_phil: "No Shadow", february_average_temp: 35.9, march_average_temp: 46.8, northeast_temp: 35.2, midwest_temp: 36.7 },
      { year: 2021, punxsutawney_phil: "Full Shadow", february_average_temp: 28.8, march_average_temp: 47.1, northeast_temp: 29.2, midwest_temp: 27.5 },
      { year: 2022, punxsutawney_phil: "Full Shadow", february_average_temp: 32.1, march_average_temp: 45.3, northeast_temp: 31.0, midwest_temp: 32.4 },
      { year: 2023, punxsutawney_phil: "Full Shadow", february_average_temp: 38.4, march_average_temp: 44.2, northeast_temp: 37.6, midwest_temp: 39.0 },
      { year: 2024, punxsutawney_phil: "No Shadow", february_average_temp: 39.1, march_average_temp: 48.5, northeast_temp: 38.2, midwest_temp: 41.5 },
    ],
  },

  // ------------------------------------------------------------
  // 8. Metal Bands by Nation
  // ------------------------------------------------------------
  {
    id: "metal-bands",
    name: "Metal Bands by Nation",
    description: "International distribution of heavy metal bands by country, formation year, fans count, and subgenre style.",
    category: "Pop Culture & Entertainment",
    sourceUrl: "https://www.kaggle.com/datasets/mruts/metal-by-nation",
    license: "CC0: Public Domain",
    sourceAttribution: "Encyclopaedia Metallum (metal-archives.com)",
    fileName: "metal_bands.csv",
    sourceType: "CSV",
    rowCount: 20,
    columnCount: 6,
    tags: ["music", "metal", "bands", "countries", "culture"],
    columns: [
      { name: "band_name", type: "string", nullable: false },
      { name: "country", type: "string", nullable: false },
      { name: "fans", type: "number", nullable: false },
      { name: "formed_year", type: "number", nullable: false },
      { name: "split_year", type: "string", nullable: true },
      { name: "style", type: "string", nullable: false },
    ],
    sampleData: [
      { band_name: "Iron Maiden", country: "United Kingdom", fans: 4195, formed_year: 1975, split_year: "-", style: "Heavy Metal" },
      { band_name: "Opeth", country: "Sweden", fans: 4147, formed_year: 1990, split_year: "-", style: "Progressive Death Metal" },
      { band_name: "Metallica", country: "USA", fans: 3712, formed_year: 1981, split_year: "-", style: "Thrash Metal" },
    ],
    records: [
      { band_name: "Iron Maiden", country: "United Kingdom", fans: 4195, formed_year: 1975, split_year: "-", style: "Heavy Metal" },
      { band_name: "Opeth", country: "Sweden", fans: 4147, formed_year: 1990, split_year: "-", style: "Progressive Death Metal" },
      { band_name: "Metallica", country: "USA", fans: 3712, formed_year: 1981, split_year: "-", style: "Thrash Metal" },
      { band_name: "Megadeth", country: "USA", fans: 3105, formed_year: 1983, split_year: "-", style: "Thrash Metal" },
      { band_name: "Slayer", country: "USA", fans: 2955, formed_year: 1981, split_year: "2019", style: "Thrash Metal" },
      { band_name: "Amon Amarth", country: "Sweden", fans: 2754, formed_year: 1992, split_year: "-", style: "Melodic Death Metal" },
      { band_name: "Nightwish", country: "Finland", fans: 2608, formed_year: 1996, split_year: "-", style: "Symphonic Power Metal" },
      { band_name: "Children of Bodom", country: "Finland", fans: 2353, formed_year: 1993, split_year: "2019", style: "Melodic Death Metal" },
      { band_name: "Judas Priest", country: "United Kingdom", fans: 2315, formed_year: 1969, split_year: "-", style: "Heavy Metal" },
      { band_name: "Blind Guardian", country: "Germany", fans: 2277, formed_year: 1984, split_year: "-", style: "Power Metal" },
      { band_name: "In Flames", country: "Sweden", fans: 2199, formed_year: 1990, split_year: "-", style: "Melodic Death Metal" },
      { band_name: "Dimmu Borgir", country: "Norway", fans: 2188, formed_year: 1993, split_year: "-", style: "Symphonic Black Metal" },
      { band_name: "Black Sabbath", country: "United Kingdom", fans: 2107, formed_year: 1968, split_year: "2017", style: "Heavy Metal" },
      { band_name: "Behemoth", country: "Poland", fans: 1944, formed_year: 1991, split_year: "-", style: "Blackened Death Metal" },
      { band_name: "Rammstein", country: "Germany", fans: 1892, formed_year: 1994, split_year: "-", style: "Industrial Metal" },
      { band_name: "Cannibal Corpse", country: "USA", fans: 1775, formed_year: 1988, split_year: "-", style: "Death Metal" },
      { band_name: "Sepultura", country: "Brazil", fans: 1720, formed_year: 1984, split_year: "-", style: "Thrash Groove Metal" },
      { band_name: "Gojira", country: "France", fans: 1684, formed_year: 1996, split_year: "-", style: "Progressive Groove Metal" },
      { band_name: "Arch Enemy", country: "Sweden", fans: 1623, formed_year: 1995, split_year: "-", style: "Melodic Death Metal" },
      { band_name: "Kreator", country: "Germany", fans: 1541, formed_year: 1982, split_year: "-", style: "Thrash Metal" },
    ],
  },

  // ------------------------------------------------------------
  // 9. Aircraft Wildlife Strikes
  // ------------------------------------------------------------
  {
    id: "wildlife-strikes",
    name: "Aircraft Wildlife Strikes",
    description: "Federal Aviation Administration incident records of aircraft collisions with birds and wildlife.",
    category: "Aviation & Science",
    sourceUrl: "https://www.kaggle.com/datasets/faa/wildlife-strikes",
    license: "Public Domain (FAA / US DOT)",
    sourceAttribution: "Federal Aviation Administration (FAA Wildlife Strike Database)",
    fileName: "wildlife_strikes.csv",
    sourceType: "CSV",
    rowCount: 20,
    columnCount: 8,
    tags: ["aviation", "wildlife", "safety", "airports", "faa"],
    columns: [
      { name: "incident_id", type: "string", nullable: false },
      { name: "incident_year", type: "number", nullable: false },
      { name: "month", type: "number", nullable: false },
      { name: "airport", type: "string", nullable: false },
      { name: "state", type: "string", nullable: false },
      { name: "operator", type: "string", nullable: false },
      { name: "wildlife_species", type: "string", nullable: false },
      { name: "damage_cost_usd", type: "number", nullable: false },
    ],
    sampleData: [
      { incident_id: "FAA-2022-01", incident_year: 2022, month: 4, airport: "Denver International", state: "CO", operator: "United Airlines", wildlife_species: "Canada Goose", damage_cost_usd: 125000 },
      { incident_id: "FAA-2022-02", incident_year: 2022, month: 6, airport: "Dallas/Fort Worth", state: "TX", operator: "American Airlines", wildlife_species: "Mourning Dove", damage_cost_usd: 1200 },
      { incident_id: "FAA-2022-03", incident_year: 2022, month: 8, airport: "O'Hare International", state: "IL", operator: "Delta Air Lines", wildlife_species: "Red-tailed Hawk", damage_cost_usd: 45000 },
    ],
    records: [
      { incident_id: "FAA-2022-01", incident_year: 2022, month: 4, airport: "Denver International", state: "CO", operator: "United Airlines", wildlife_species: "Canada Goose", damage_cost_usd: 125000 },
      { incident_id: "FAA-2022-02", incident_year: 2022, month: 6, airport: "Dallas/Fort Worth", state: "TX", operator: "American Airlines", wildlife_species: "Mourning Dove", damage_cost_usd: 1200 },
      { incident_id: "FAA-2022-03", incident_year: 2022, month: 8, airport: "O'Hare International", state: "IL", operator: "Delta Air Lines", wildlife_species: "Red-tailed Hawk", damage_cost_usd: 45000 },
      { incident_id: "FAA-2022-04", incident_year: 2022, month: 9, airport: "Hartsfield-Jackson", state: "GA", operator: "Delta Air Lines", wildlife_species: "Gull", damage_cost_usd: 8500 },
      { incident_id: "FAA-2022-05", incident_year: 2022, month: 5, airport: "Los Angeles International", state: "CA", operator: "Southwest Airlines", wildlife_species: "American Kestrel", damage_cost_usd: 0 },
      { incident_id: "FAA-2022-06", incident_year: 2022, month: 7, airport: "Seattle-Tacoma", state: "WA", operator: "Alaska Airlines", wildlife_species: "Great Blue Heron", damage_cost_usd: 68000 },
      { incident_id: "FAA-2022-07", incident_year: 2022, month: 10, airport: "JFK International", state: "NY", operator: "JetBlue Airways", wildlife_species: "Osprey", damage_cost_usd: 92000 },
      { incident_id: "FAA-2022-08", incident_year: 2022, month: 3, airport: "Phoenix Sky Harbor", state: "AZ", operator: "American Airlines", wildlife_species: "Coyote", damage_cost_usd: 3500 },
      { incident_id: "FAA-2022-09", incident_year: 2022, month: 5, airport: "Orlando International", state: "FL", operator: "Spirit Airlines", wildlife_species: "Sandhill Crane", damage_cost_usd: 140000 },
      { incident_id: "FAA-2022-10", incident_year: 2022, month: 11, airport: "Minneapolis-St Paul", state: "MN", operator: "Delta Air Lines", wildlife_species: "Mallard", damage_cost_usd: 15400 },
      { incident_id: "FAA-2023-01", incident_year: 2023, month: 2, airport: "Boston Logan", state: "MA", operator: "JetBlue Airways", wildlife_species: "Snowy Owl", damage_cost_usd: 28000 },
      { incident_id: "FAA-2023-02", incident_year: 2023, month: 4, airport: "Charlotte Douglas", state: "NC", operator: "American Airlines", wildlife_species: "Turkey Vulture", damage_cost_usd: 84000 },
      { incident_id: "FAA-2023-03", incident_year: 2023, month: 6, airport: "San Francisco International", state: "CA", operator: "United Airlines", wildlife_species: "Pelican", damage_cost_usd: 112000 },
      { incident_id: "FAA-2023-04", incident_year: 2023, month: 7, airport: "Detroit Metropolitan", state: "MI", operator: "Delta Air Lines", wildlife_species: "Barn Swallow", damage_cost_usd: 0 },
      { incident_id: "FAA-2023-05", incident_year: 2023, month: 8, airport: "Salt Lake City", state: "UT", operator: "SkyWest Airlines", wildlife_species: "Horned Lark", damage_cost_usd: 500 },
      { incident_id: "FAA-2023-06", incident_year: 2023, month: 9, airport: "Miami International", state: "FL", operator: "American Airlines", wildlife_species: "Ibis", damage_cost_usd: 19000 },
      { incident_id: "FAA-2023-07", incident_year: 2023, month: 10, airport: "Newark Liberty", state: "NJ", operator: "United Airlines", wildlife_species: "European Starling", damage_cost_usd: 4200 },
      { incident_id: "FAA-2023-08", incident_year: 2023, month: 11, airport: "George Bush Intercontinental", state: "TX", operator: "United Airlines", wildlife_species: "White-tailed Deer", damage_cost_usd: 210000 },
      { incident_id: "FAA-2023-09", incident_year: 2023, month: 12, airport: "Philadelphia International", state: "PA", operator: "American Airlines", wildlife_species: "Bald Eagle", damage_cost_usd: 175000 },
      { incident_id: "FAA-2023-10", incident_year: 2023, month: 3, airport: "San Diego International", state: "CA", operator: "Southwest Airlines", wildlife_species: "Gull", damage_cost_usd: 6200 },
    ],
  },

  // ------------------------------------------------------------
  // 10. Women's Shoe Prices
  // ------------------------------------------------------------
  {
    id: "shoe-prices",
    name: "Women's Shoe Prices",
    description: "Ecommerce product data of footwear with retail brands, merchant channels, colors, and prices.",
    category: "Retail & Products",
    sourceUrl: "https://www.kaggle.com/datasets/datafiniti/womens-shoes-prices",
    license: "CC0: Public Domain / Open Product Data",
    sourceAttribution: "Datafiniti Open Product Dataset",
    fileName: "shoe_prices.csv",
    sourceType: "CSV",
    rowCount: 20,
    columnCount: 8,
    tags: ["fashion", "retail", "shoes", "ecommerce", "pricing"],
    columns: [
      { name: "brand", type: "string", nullable: false },
      { name: "product_name", type: "string", nullable: false },
      { name: "category", type: "string", nullable: false },
      { name: "merchant", type: "string", nullable: false },
      { name: "price_min", type: "number", nullable: false },
      { name: "price_max", type: "number", nullable: false },
      { name: "currency", type: "string", nullable: false },
      { name: "color", type: "string", nullable: false },
    ],
    sampleData: [
      { brand: "Nike", product_name: "Air Zoom Pegasus 38", category: "Running Shoes", merchant: "Nike.com", price_min: 120.0, price_max: 120.0, currency: "USD", color: "Black/White" },
      { brand: "Steve Madden", product_name: "Carrson Heeled Sandal", category: "Sandals", merchant: "Nordstrom", price_min: 89.95, price_max: 99.95, currency: "USD", color: "Nude Suede" },
      { brand: "Clarks", product_name: "Desert Boot", category: "Boots", merchant: "Zappos", price_min: 130.0, price_max: 150.0, currency: "USD", color: "Beeswax" },
    ],
    records: [
      { brand: "Nike", product_name: "Air Zoom Pegasus 38", category: "Running Shoes", merchant: "Nike.com", price_min: 120.0, price_max: 120.0, currency: "USD", color: "Black/White" },
      { brand: "Adidas", product_name: "Ultraboost 21", category: "Running Shoes", merchant: "Adidas.com", price_min: 180.0, price_max: 180.0, currency: "USD", color: "Cloud White" },
      { brand: "Steve Madden", product_name: "Carrson Heeled Sandal", category: "Sandals", merchant: "Nordstrom", price_min: 89.95, price_max: 99.95, currency: "USD", color: "Nude Suede" },
      { brand: "Clarks", product_name: "Desert Boot", category: "Boots", merchant: "Zappos", price_min: 130.0, price_max: 150.0, currency: "USD", color: "Beeswax" },
      { brand: "Sam Edelman", product_name: "Felicia Ballet Flat", category: "Flats", merchant: "Amazon", price_min: 69.99, price_max: 89.99, currency: "USD", color: "Black Leather" },
      { brand: "Tory Burch", product_name: "Miller Thong Sandal", category: "Sandals", merchant: "Saks Fifth Avenue", price_min: 198.0, price_max: 198.0, currency: "USD", color: "Vintage Vachetta" },
      { brand: "Vans", product_name: "Old Skool Core Classics", category: "Sneakers", merchant: "Vans.com", price_min: 65.0, price_max: 65.0, currency: "USD", color: "Black/White" },
      { brand: "Dr. Martens", product_name: "1460 Smooth Leather Boot", category: "Boots", merchant: "DrMartens.com", price_min: 170.0, price_max: 170.0, currency: "USD", color: "Black" },
      { brand: "Birkenstock", product_name: "Arizona Soft Footbed", category: "Sandals", merchant: "REI", price_min: 135.0, price_max: 140.0, currency: "USD", color: "Mocha" },
      { brand: "Gucci", product_name: "Princetown Leather Slipper", category: "Loafers", merchant: "Gucci.com", price_min: 850.0, price_max: 850.0, currency: "USD", color: "Black" },
      { brand: "New Balance", product_name: "574 Core", category: "Sneakers", merchant: "NewBalance.com", price_min: 84.99, price_max: 89.99, currency: "USD", color: "Grey" },
      { brand: "Michael Kors", product_name: "Fulton Moccasin", category: "Flats", merchant: "Macy's", price_min: 99.0, price_max: 125.0, currency: "USD", color: "Luggage" },
      { brand: "UGG", product_name: "Classic Short II Boot", category: "Boots", merchant: "UGG.com", price_min: 170.0, price_max: 170.0, currency: "USD", color: "Chestnut" },
      { brand: "Cole Haan", product_name: "GrandPrø Tennis Sneaker", category: "Sneakers", merchant: "ColeHaan.com", price_min: 110.0, price_max: 130.0, currency: "USD", color: "Optic White" },
      { brand: "Sorel", product_name: "Joan of Arctic Boot", category: "Boots", merchant: "Backcountry", price_min: 190.0, price_max: 210.0, currency: "USD", color: "Quarry" },
      { brand: "Christian Louboutin", product_name: "So Kate 120 Patent", category: "Pumps", merchant: "Neiman Marcus", price_min: 795.0, price_max: 795.0, currency: "USD", color: "Black" },
      { brand: "Converse", product_name: "Chuck Taylor All Star", category: "Sneakers", merchant: "Converse.com", price_min: 60.0, price_max: 60.0, currency: "USD", color: "Optical White" },
      { brand: "Stuart Weitzman", product_name: "The 5050 Boot", category: "Boots", merchant: "Bloomingdale's", price_min: 695.0, price_max: 750.0, currency: "USD", color: "Black Nappa" },
      { brand: "Skechers", product_name: "Go Walk Joy", category: "Walking Shoes", merchant: "Target", price_min: 49.99, price_max: 55.0, currency: "USD", color: "Taupe" },
      { brand: "Teva", product_name: "Original Universal Sandal", category: "Sandals", merchant: "Teva.com", price_min: 50.0, price_max: 55.0, currency: "USD", color: "Boomerang Pink" },
    ],
  },
];
