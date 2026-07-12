import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const dbConfig = {
  host: process.env.MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "mypass",
  database: process.env.MYSQL_DATABASE || "storebuddy"
};

const dayMs = 24 * 60 * 60 * 1000;

const users = [
  { name: "Admin User", username: "admin", password: "admin123", role: "admin" },
  { name: "Nadeesha Perera", username: "nadeesha", password: "admin123", role: "admin" },
  { name: "Kasun Fernando", username: "kasun", password: "cashier123", role: "cashier" },
  { name: "Tharushi Silva", username: "tharushi", password: "cashier123", role: "cashier" },
  { name: "Mohamed Rizwan", username: "rizwan", password: "cashier123", role: "cashier" },
  { name: "Dinesh Jayawardena", username: "dinesh", password: "stock123", role: "stock_handler" },
  { name: "Chamari Wijesinghe", username: "chamari", password: "stock123", role: "stock_handler" }
];

const categories = [
  ["Dairy", "Milk, yoghurt, cheese and chilled dairy products"],
  ["Biscuits", "Sweet and savoury biscuit varieties"],
  ["Bakery", "Bread, buns and baked snacks"],
  ["Rice & Grains", "Rice, grains and staple dry goods"],
  ["Flour & Baking", "Flour, yeast, mixes and baking ingredients"],
  ["Beverages", "Soft drinks, cordials and bottled beverages"],
  ["Tea & Coffee", "Tea, coffee and malt drinks"],
  ["Sauces & Spreads", "Jams, sauces, chutneys and spreads"],
  ["Personal Care", "Oral care, soap, shampoo and hygiene products"],
  ["Household Cleaning", "Laundry, dishwash and home cleaning products"],
  ["Snacks", "Nuts, chips, bites and ready snacks"],
  ["Frozen Foods", "Frozen meat, seafood and convenience foods"],
  ["Canned Foods", "Canned fish, vegetables and ready ingredients"],
  ["Spices", "Spices, curry powders and seasoning"],
  ["Baby Care", "Baby food, diapers and care essentials"],
  ["Health & Wellness", "Nutrition, wellness drinks and supplements"],
  ["Fruits & Vegetables", "Fresh produce and packed vegetables"],
  ["Meat & Seafood", "Fresh and processed meat and seafood"]
];

const suppliers = [
  ["CBL Foods", "Anura Senanayake", "0112587412", "orders@cblfoods.lk", "High Level Road, Makumbura, Pannipitiya"],
  ["Maliban Biscuit Manufactories", "Saman Kumara", "0112913311", "sales@maliban.lk", "Ratmalana Industrial Estate, Ratmalana"],
  ["Nestle Lanka", "Shalini de Silva", "0114724724", "trade@nestle.lk", "T B Jayah Mawatha, Colombo 10"],
  ["Fonterra Brands Lanka", "Ruwan Gamage", "0112488800", "orders@fonterra.lk", "Nawala Road, Narahenpita"],
  ["Unilever Sri Lanka", "Dinuka Perera", "0114700800", "sales@unilever.lk", "Vincent Perera Mawatha, Colombo 14"],
  ["Sunshine Consumer", "Kavindi Herath", "0114702400", "orders@sunshine.lk", "Havelock Road, Colombo 05"],
  ["Hemas Consumer", "Pradeep Fernando", "0114731731", "sales@hemasconsumer.lk", "Braybrooke Place, Colombo 02"],
  ["Elephant House", "Nimal Weerasinghe", "0112421122", "sales@elephanthouse.lk", "Vauxhall Street, Colombo 02"],
  ["Coca-Cola Sri Lanka", "Suren Peiris", "0112070777", "orders@coca-cola.lk", "Biyagama Export Processing Zone, Biyagama"],
  ["CIC Holdings", "Thisara Bandara", "0112359359", "trade@cic.lk", "CIC House, Colombo 03"],
  ["Prima Ceylon", "Ramesh Rajan", "0112345678", "sales@prima.com.lk", "Prima Complex, Trincomalee"],
  ["MD Foods", "Heshani Samarasinghe", "0112855100", "orders@mdfoods.lk", "Kaduwela Road, Malabe"],
  ["Kist Foods", "Yasiru Madushanka", "0112437700", "sales@kist.lk", "New Nuge Road, Peliyagoda"],
  ["Hayleys Consumer", "Buddhika Karunaratne", "0112627000", "orders@hayleys.com", "Deans Road, Colombo 10"],
  ["Richard Pieris Distributors", "Lalith Amarasekara", "0114310500", "sales@arpico.com", "Hyde Park Corner, Colombo 02"],
  ["Keells Food Products", "Ayesha Fernando", "0112303500", "orders@keells.com", "Union Place, Colombo 02"],
  ["Lanka Sathosa Supply", "Chathura Silva", "0115552200", "supply@sathosa.lk", "Vauxhall Lane, Colombo 02"],
  ["Ruhunu Foods", "Imalka Jayasuriya", "0812421222", "sales@ruhunufoods.lk", "Pilimathalawa, Kandy"],
  ["Harischandra Mills", "Manjula Abeysekara", "0412222244", "orders@harischandra.lk", "Matara Road, Matara"],
  ["Lanka Milk Foods", "Vijitha Gunasekara", "0112575300", "sales@lmf.lk", "Welisara, Ragama"],
  ["Pelwatte Dairy", "Sajith Ariyaratne", "0552276789", "orders@pelwattedairy.lk", "Pelwatte, Buttala"],
  ["Cargills Quality Foods", "Nuwan Liyanage", "0112427777", "orders@cargillsceylon.com", "York Street, Colombo 01"],
  ["Wijaya Products", "Sashika Pathirana", "0112877877", "sales@wijayaproducts.lk", "Kelaniya"],
  ["Nipuna Rice Products", "Gayan Madushan", "0412256522", "orders@nipunarice.lk", "Akurassa Road, Matara"],
  ["Laugfs Supermarkets Wholesale", "Sanjaya Dissanayake", "0115566600", "wholesale@laugfs.lk", "Nawala Road, Nugegoda"],
  ["Daintee Foods", "Roshan Dias", "0112233400", "orders@daintee.lk", "Ratmalana"],
  ["Raigam Marketing", "Supun Alwis", "0114824824", "sales@raigam.lk", "Homagama"],
  ["Edinborough Products", "Kumudu Seneviratne", "0112943300", "orders@edinborough.lk", "Peliyagoda"],
  ["Samaposha", "Lahiru Ekanayake", "0114762600", "sales@samaposha.lk", "Ja-Ela"],
  ["Pussalla Meat Producers", "Isuru Kodikara", "0112299000", "orders@pussalla.lk", "Koswatta, Battaramulla"]
];

const productCatalog = [
  ["Anchor Full Cream Milk 400g", "Dairy", "Fonterra Brands Lanka", 1280, 1120, "pack"],
  ["Anchor Non Fat Milk 400g", "Dairy", "Fonterra Brands Lanka", 1390, 1215, "pack"],
  ["Anchor Newdale Yoghurt 80g", "Dairy", "Fonterra Brands Lanka", 90, 70, "cup"],
  ["Nestle Nespray Milk Powder 400g", "Dairy", "Nestle Lanka", 1220, 1080, "pack"],
  ["Pelwatte Full Cream Milk Powder 400g", "Dairy", "Pelwatte Dairy", 1180, 1030, "pack"],
  ["Highland Fresh Milk 1L", "Dairy", "Lanka Milk Foods", 520, 430, "bottle"],
  ["Kothmale Cheese Wedges 120g", "Dairy", "Cargills Quality Foods", 680, 545, "pack"],
  ["Ambewela Set Yoghurt 80g", "Dairy", "Lanka Milk Foods", 95, 72, "cup"],
  ["Munchee Chocolate Biscuit 100g", "Biscuits", "CBL Foods", 220, 165, "pack"],
  ["Munchee Lemon Puff 200g", "Biscuits", "CBL Foods", 360, 280, "pack"],
  ["Munchee Cream Cracker 190g", "Biscuits", "CBL Foods", 320, 245, "pack"],
  ["Munchee Tikiri Marie 80g", "Biscuits", "CBL Foods", 150, 108, "pack"],
  ["Maliban Lemon Puff 200g", "Biscuits", "Maliban Biscuit Manufactories", 350, 270, "pack"],
  ["Maliban Cream Cracker 190g", "Biscuits", "Maliban Biscuit Manufactories", 315, 240, "pack"],
  ["Maliban Chocolate Cream 100g", "Biscuits", "Maliban Biscuit Manufactories", 210, 160, "pack"],
  ["Maliban Smart Cream Cracker 125g", "Biscuits", "Maliban Biscuit Manufactories", 240, 180, "pack"],
  ["Prima Kottu Mee Chicken 80g", "Snacks", "Prima Ceylon", 160, 115, "pack"],
  ["Prima Kottu Mee Hot & Spicy 80g", "Snacks", "Prima Ceylon", 160, 115, "pack"],
  ["Maggi Chicken Noodles 73g", "Snacks", "Nestle Lanka", 150, 108, "pack"],
  ["Samaposha Cereal Mix 200g", "Health & Wellness", "Samaposha", 360, 275, "pack"],
  ["Prima Flour 1kg", "Flour & Baking", "Prima Ceylon", 290, 230, "pack"],
  ["Nipuna Flour 1kg", "Flour & Baking", "Nipuna Rice Products", 280, 220, "pack"],
  ["Harischandra String Hopper Flour 700g", "Flour & Baking", "Harischandra Mills", 420, 330, "pack"],
  ["Roza White Rice Flour 400g", "Flour & Baking", "CIC Holdings", 260, 195, "pack"],
  ["Motha Baking Powder 100g", "Flour & Baking", "Lanka Sathosa Supply", 240, 175, "bottle"],
  ["Motha Custard Powder 100g", "Flour & Baking", "Lanka Sathosa Supply", 250, 185, "pack"],
  ["Nipuna Samba Rice 5kg", "Rice & Grains", "Nipuna Rice Products", 1680, 1450, "bag"],
  ["Nipuna Nadu Rice 5kg", "Rice & Grains", "Nipuna Rice Products", 1520, 1320, "bag"],
  ["Keells White Raw Rice 5kg", "Rice & Grains", "Lanka Sathosa Supply", 1490, 1290, "bag"],
  ["Araliya Samba Rice 5kg", "Rice & Grains", "Lanka Sathosa Supply", 1710, 1480, "bag"],
  ["Brown Sugar 1kg", "Rice & Grains", "Lanka Sathosa Supply", 390, 315, "pack"],
  ["White Sugar 1kg", "Rice & Grains", "Lanka Sathosa Supply", 375, 300, "pack"],
  ["Dhal 1kg", "Rice & Grains", "CIC Holdings", 520, 425, "pack"],
  ["Chickpeas 500g", "Rice & Grains", "CIC Holdings", 430, 340, "pack"],
  ["Elephant House Cream Soda 1L", "Beverages", "Elephant House", 320, 245, "bottle"],
  ["Elephant House Necto 1L", "Beverages", "Elephant House", 320, 245, "bottle"],
  ["Elephant House Ginger Beer 1L", "Beverages", "Elephant House", 350, 270, "bottle"],
  ["Coca Cola 1L", "Beverages", "Coca-Cola Sri Lanka", 360, 278, "bottle"],
  ["Sprite 1L", "Beverages", "Coca-Cola Sri Lanka", 350, 270, "bottle"],
  ["Fanta Orange 1L", "Beverages", "Coca-Cola Sri Lanka", 350, 270, "bottle"],
  ["Kist Mixed Fruit Nectar 1L", "Beverages", "Kist Foods", 620, 495, "carton"],
  ["MD Orange Cordial 750ml", "Beverages", "MD Foods", 650, 515, "bottle"],
  ["Dilmah Ceylon Tea 200g", "Tea & Coffee", "Sunshine Consumer", 720, 575, "pack"],
  ["Watawala Tea 200g", "Tea & Coffee", "Sunshine Consumer", 650, 515, "pack"],
  ["Zesta Tea 200g", "Tea & Coffee", "Sunshine Consumer", 780, 625, "pack"],
  ["Nescafe Classic 50g", "Tea & Coffee", "Nestle Lanka", 850, 690, "jar"],
  ["Harischandra Coffee 100g", "Tea & Coffee", "Harischandra Mills", 430, 335, "pack"],
  ["Milo Malt Drink 400g", "Health & Wellness", "Nestle Lanka", 1150, 965, "pack"],
  ["MD Mixed Fruit Jam 450g", "Sauces & Spreads", "MD Foods", 640, 510, "jar"],
  ["MD Tomato Sauce 400g", "Sauces & Spreads", "MD Foods", 520, 405, "bottle"],
  ["Kist Tomato Sauce 400g", "Sauces & Spreads", "Kist Foods", 510, 395, "bottle"],
  ["Kist Chilli Sauce 400g", "Sauces & Spreads", "Kist Foods", 540, 420, "bottle"],
  ["Edinborough Mayonnaise 350g", "Sauces & Spreads", "Edinborough Products", 780, 620, "jar"],
  ["Edinborough Barbecue Sauce 350g", "Sauces & Spreads", "Edinborough Products", 690, 545, "bottle"],
  ["Signal Toothpaste 120g", "Personal Care", "Unilever Sri Lanka", 420, 320, "tube"],
  ["Closeup Toothpaste 120g", "Personal Care", "Unilever Sri Lanka", 430, 330, "tube"],
  ["Clogard Toothpaste 120g", "Personal Care", "Hemas Consumer", 390, 295, "tube"],
  ["Sunlight Soap 110g", "Personal Care", "Unilever Sri Lanka", 180, 130, "bar"],
  ["Lifebuoy Soap 100g", "Personal Care", "Unilever Sri Lanka", 190, 140, "bar"],
  ["Lux Soap 100g", "Personal Care", "Unilever Sri Lanka", 210, 155, "bar"],
  ["Velvet Soap 100g", "Personal Care", "Hemas Consumer", 200, 150, "bar"],
  ["Kumarika Shampoo 180ml", "Personal Care", "Hemas Consumer", 690, 540, "bottle"],
  ["Baby Cheramy Cologne 100ml", "Baby Care", "Hemas Consumer", 620, 480, "bottle"],
  ["Pears Baby Soap 75g", "Baby Care", "Unilever Sri Lanka", 270, 205, "bar"],
  ["Sunlight Washing Powder 1kg", "Household Cleaning", "Unilever Sri Lanka", 760, 590, "pack"],
  ["Surf Excel Washing Powder 1kg", "Household Cleaning", "Unilever Sri Lanka", 1180, 940, "pack"],
  ["Diva Washing Powder 1kg", "Household Cleaning", "Hemas Consumer", 720, 560, "pack"],
  ["Sunlight Dishwash Liquid 500ml", "Household Cleaning", "Unilever Sri Lanka", 480, 360, "bottle"],
  ["Harpic Toilet Cleaner 500ml", "Household Cleaning", "Hayleys Consumer", 690, 540, "bottle"],
  ["Dettol Antiseptic Liquid 500ml", "Health & Wellness", "Hayleys Consumer", 1380, 1120, "bottle"],
  ["CBL Ritzbury Chocolate 100g", "Snacks", "CBL Foods", 520, 395, "bar"],
  ["Daintee Toffee 200g", "Snacks", "Daintee Foods", 480, 360, "pack"],
  ["Tipi Tip Cheese Balls 50g", "Snacks", "CBL Foods", 170, 118, "pack"],
  ["Mr. Pop Potato Chips 45g", "Snacks", "CBL Foods", 220, 160, "pack"],
  ["Roasted Peanuts 200g", "Snacks", "Lanka Sathosa Supply", 460, 350, "pack"],
  ["Cashew Nuts 200g", "Snacks", "Hayleys Consumer", 1390, 1125, "pack"],
  ["Keells Chicken Sausages 500g", "Frozen Foods", "Keells Food Products", 1180, 940, "pack"],
  ["Keells Meat Balls 500g", "Frozen Foods", "Keells Food Products", 1250, 995, "pack"],
  ["Cargills Fish Fingers 300g", "Frozen Foods", "Cargills Quality Foods", 980, 770, "pack"],
  ["Elephant House Vanilla Ice Cream 1L", "Frozen Foods", "Elephant House", 920, 725, "tub"],
  ["Elephant House Chocolate Ice Cream 1L", "Frozen Foods", "Elephant House", 960, 760, "tub"],
  ["Lanka Soy Soya Meat 90g", "Canned Foods", "Raigam Marketing", 180, 125, "pack"],
  ["Raigam Soya Meat Chicken 90g", "Canned Foods", "Raigam Marketing", 190, 135, "pack"],
  ["Mackerel Tin 425g", "Canned Foods", "Cargills Quality Foods", 690, 540, "tin"],
  ["Tuna Chunks Tin 185g", "Canned Foods", "Hayleys Consumer", 620, 485, "tin"],
  ["Wijaya Chilli Powder 250g", "Spices", "Wijaya Products", 520, 395, "pack"],
  ["Wijaya Curry Powder 250g", "Spices", "Wijaya Products", 490, 370, "pack"],
  ["Ruhunu Turmeric Powder 100g", "Spices", "Ruhunu Foods", 360, 265, "pack"],
  ["Ruhunu Pepper Powder 100g", "Spices", "Ruhunu Foods", 590, 455, "pack"],
  ["CIC Salt 1kg", "Spices", "CIC Holdings", 120, 82, "pack"],
  ["Fresh Carrot 1kg", "Fruits & Vegetables", "Cargills Quality Foods", 520, 390, "kg"],
  ["Fresh Beans 1kg", "Fruits & Vegetables", "Cargills Quality Foods", 640, 480, "kg"],
  ["Fresh Tomato 1kg", "Fruits & Vegetables", "Cargills Quality Foods", 480, 350, "kg"],
  ["Kolikuttu Banana 1kg", "Fruits & Vegetables", "Cargills Quality Foods", 420, 310, "kg"],
  ["Papaya 1kg", "Fruits & Vegetables", "Cargills Quality Foods", 360, 255, "kg"],
  ["Pussalla Chicken 1kg", "Meat & Seafood", "Pussalla Meat Producers", 1480, 1210, "kg"],
  ["Pussalla Chicken Drumsticks 1kg", "Meat & Seafood", "Pussalla Meat Producers", 1650, 1340, "kg"],
  ["Fresh Fish Thalapath 1kg", "Meat & Seafood", "Cargills Quality Foods", 2450, 1980, "kg"],
  ["Prawns Medium 500g", "Meat & Seafood", "Cargills Quality Foods", 1750, 1390, "pack"],
  ["Milk Rice Mix 500g", "Rice & Grains", "Harischandra Mills", 390, 295, "pack"]
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(items) {
  return items[randomInt(0, items.length - 1)];
}

function weightedRandomItem(items, weightKey = "weight") {
  const totalWeight = items.reduce((total, item) => total + Number(item[weightKey] || 1), 0);
  let cursor = Math.random() * totalWeight;

  for (const item of items) {
    cursor -= Number(item[weightKey] || 1);
    if (cursor <= 0) {
      return item;
    }
  }

  return items[items.length - 1];
}

function weightedRandomUnique(items, count, weightKey = "weight") {
  const selected = [];
  const remaining = [...items];

  while (selected.length < count && remaining.length > 0) {
    const item = weightedRandomItem(remaining, weightKey);
    selected.push(item);
    remaining.splice(remaining.indexOf(item), 1);
  }

  return selected;
}

function money(value) {
  return Number(value.toFixed(2));
}

function mysqlDate(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function daysAgo(days, hour = 9, minute = 0) {
  const date = new Date(Date.now() - days * dayMs);
  date.setHours(hour, minute, randomInt(0, 59), 0);
  return date;
}

function businessTimeForDay(daysBack) {
  return daysAgo(daysBack, randomInt(8, 20), randomInt(0, 59));
}

function isWeekend(date) {
  return date.getDay() === 0 || date.getDay() === 6;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function skuFromName(name, index) {
  const prefix = name
    .replace(/[^A-Za-z0-9 ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part.slice(0, 3).toUpperCase())
    .join("-");
  return `${prefix}-${String(index + 1).padStart(4, "0")}`;
}

function barcodeFor(index) {
  return `479${String(100000000 + index * 137).slice(0, 9)}`;
}

function byName(rows) {
  return new Map(rows.map((row) => [row.name, row]));
}

function saleNumber(index) {
  return `S-${String(1000 + index).padStart(4, "0")}`;
}

function orderNumber(index) {
  return `PO-${String(2000 + index).padStart(4, "0")}`;
}

function demandWeight(product) {
  const text = `${product.name} ${product.categoryName}`.toLowerCase();

  if (/milk powder|rice|sugar|soap|toothpaste|tea|flour|noodles/.test(text)) {
    return 10;
  }

  if (/biscuit|cream cracker|lemon puff|soft drink|cream soda|necto|coca cola|sprite|fanta|sauce|jam|coffee/.test(text)) {
    return 7;
  }

  if (/ice cream|chocolate|cleaning|washing|dishwash|yoghurt|yogurt/.test(text)) {
    return 4;
  }

  if (/spice|chilli|curry|turmeric|pepper|frozen|sausage|meat|chicken|fish|prawn|carrot|beans|tomato|banana|papaya|vegetable|seafood/.test(text)) {
    return 2;
  }

  return 4;
}

function weightedPaymentMethod() {
  return Math.random() < 0.7 ? "Cash" : "Card";
}

function queueActivity(activityLogs, log) {
  activityLogs.push([
    randomUUID(),
    log.userId || null,
    log.action,
    log.entity,
    log.entityId || null,
    log.description,
    mysqlDate(log.createdAt)
  ]);
}

async function batchInsert(connection, table, columns, rows, batchSize = 500) {
  if (rows.length === 0) {
    return;
  }

  const columnList = columns.join(", ");

  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const placeholders = batch.map(() => `(${columns.map(() => "?").join(", ")})`).join(", ");
    await connection.execute(
      `INSERT INTO ${table} (${columnList}) VALUES ${placeholders}`,
      batch.flat()
    );
  }
}

function stockStatusCounts(products) {
  return products.reduce(
    (counts, product) => {
      if (product.stock === 0) {
        counts.outOfStock += 1;
      } else if (product.stock <= product.reorderLevel) {
        counts.lowStock += 1;
      } else {
        counts.healthy += 1;
      }
      return counts;
    },
    { healthy: 0, lowStock: 0, outOfStock: 0 }
  );
}

function balanceInventory(products) {
  const sortedByDemand = [...products].sort((a, b) => a.popularityWeight - b.popularityWeight || a.name.localeCompare(b.name));
  const outOfStockCount = Math.round(products.length * 0.05);
  const lowStockCount = Math.round(products.length * 0.1);
  const outOfStock = new Set(sortedByDemand.slice(0, outOfStockCount).map((product) => product.id));
  const lowStock = new Set(
    sortedByDemand
      .slice(outOfStockCount, outOfStockCount + lowStockCount)
      .map((product) => product.id)
  );

  for (const product of products) {
    if (outOfStock.has(product.id)) {
      product.stock = 0;
    } else if (lowStock.has(product.id)) {
      product.stock = randomInt(1, Math.max(1, product.reorderLevel));
    } else {
      const healthyMinimum = product.reorderLevel + 1;
      const healthyMaximum = product.reorderLevel + 8 + product.popularityWeight * 4;
      product.stock = randomInt(healthyMinimum, healthyMaximum);
    }
  }

  return stockStatusCounts(products);
}

async function main() {
  const connection = await mysql.createConnection(dbConfig);

  try {
    await connection.beginTransaction();
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    await connection.query("TRUNCATE TABLE activity_logs");
    await connection.query("TRUNCATE TABLE sale_items");
    await connection.query("TRUNCATE TABLE sales");
    await connection.query("TRUNCATE TABLE purchase_order_items");
    await connection.query("TRUNCATE TABLE purchase_orders");
    await connection.query("TRUNCATE TABLE products");
    await connection.query("TRUNCATE TABLE suppliers");
    await connection.query("TRUNCATE TABLE categories");
    await connection.query("TRUNCATE TABLE users");
    await connection.query("ALTER TABLE sale_items AUTO_INCREMENT = 1");
    await connection.query("ALTER TABLE purchase_order_items AUTO_INCREMENT = 1");
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");

    const activityLogs = [];
    const purchaseOrderItems = [];
    const saleItems = [];
    const adminUser = { ...users[0], id: randomUUID() };
    const userRows = [adminUser, ...users.slice(1).map((user) => ({ ...user, id: randomUUID() }))];
    const cashierRows = userRows.filter((user) => user.role === "cashier");

    for (const user of userRows) {
      const passwordHash = await bcrypt.hash(user.password, 10);
      await connection.execute(
        `
          INSERT INTO users (id, name, username, password_hash, role, active)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [user.id, user.name, user.username, passwordHash, user.role, 1]
      );

      queueActivity(activityLogs, {
        userId: adminUser.id,
        action: "USER_CREATED",
        entity: "user",
        entityId: user.id,
        description: `${adminUser.name} created user "${user.name}"`,
        createdAt: daysAgo(89, 8, randomInt(0, 45))
      });
    }

    const categoryRows = categories.map(([name, description]) => ({ id: randomUUID(), name, description }));
    const categoryMap = byName(categoryRows);

    for (const category of categoryRows) {
      await connection.execute(
        `
          INSERT INTO categories (id, name, description, active)
          VALUES (?, ?, ?, ?)
        `,
        [category.id, category.name, category.description, 1]
      );

      queueActivity(activityLogs, {
        userId: adminUser.id,
        action: "CATEGORY_CREATED",
        entity: "category",
        entityId: category.id,
        description: `${adminUser.name} created category "${category.name}"`,
        createdAt: daysAgo(randomInt(84, 89), randomInt(8, 17), randomInt(0, 59))
      });
    }

    const supplierRows = suppliers.map(([name, contactPerson, phone, email, address]) => ({
      id: randomUUID(),
      name,
      contactPerson,
      phone,
      email,
      address
    }));
    const supplierMap = byName(supplierRows);

    for (const supplier of supplierRows) {
      await connection.execute(
        `
          INSERT INTO suppliers
            (id, name, contact_person, phone, email, address, active)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [supplier.id, supplier.name, supplier.contactPerson, supplier.phone, supplier.email, supplier.address, 1]
      );

      queueActivity(activityLogs, {
        userId: adminUser.id,
        action: "SUPPLIER_CREATED",
        entity: "supplier",
        entityId: supplier.id,
        description: `${adminUser.name} added supplier "${supplier.name}"`,
        createdAt: daysAgo(randomInt(80, 88), randomInt(8, 17), randomInt(0, 59))
      });
    }

    const productRows = productCatalog.map(([name, categoryName, supplierName, price, costPrice, unit], index) => {
      const reorderLevel = randomInt(12, 35);
      const baseProduct = { name, categoryName };
      const popularityWeight = demandWeight(baseProduct);
      const stock = randomInt(reorderLevel + popularityWeight * 8, reorderLevel + popularityWeight * 22);
      return {
        id: randomUUID(),
        categoryId: categoryMap.get(categoryName).id,
        categoryName,
        supplierId: supplierMap.get(supplierName).id,
        supplierName,
        name,
        sku: skuFromName(name, index),
        barcode: barcodeFor(index),
        price,
        costPrice,
        stock,
        reorderLevel,
        popularityWeight,
        unit,
        description: `${name} supplied by ${supplierName}`
      };
    });

    for (const product of productRows) {
      await connection.execute(
        `
          INSERT INTO products
            (id, category_id, supplier_id, name, sku, barcode, price, cost_price, stock, reorder_level, unit, description, active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          product.id,
          product.categoryId,
          product.supplierId,
          product.name,
          product.sku,
          product.barcode,
          product.price,
          product.costPrice,
          product.stock,
          product.reorderLevel,
          product.unit,
          product.description,
          1
        ]
      );

      queueActivity(activityLogs, {
        userId: adminUser.id,
        action: "PRODUCT_CREATED",
        entity: "product",
        entityId: product.id,
        description: `${adminUser.name} created product "${product.name}"`,
        createdAt: daysAgo(randomInt(72, 86), randomInt(8, 18), randomInt(0, 59))
      });
    }

    let orderDaysBack = 88;
    const pendingOrderStart = 15 - randomInt(2, 3);

    for (let index = 0; index < 15; index += 1) {
      const supplier = randomItem(supplierRows);
      const supplierProducts = productRows.filter((product) => product.supplierId === supplier.id);
      const eligibleProducts = supplierProducts.length >= 5 ? supplierProducts : productRows;
      const itemCount = Math.min(randomInt(5, 12), eligibleProducts.length);
      const selected = weightedRandomUnique(eligibleProducts, itemCount, "popularityWeight");
      const createdAt = daysAgo(Math.max(1, orderDaysBack), randomInt(9, 15), randomInt(0, 59));
      const received = index < pendingOrderStart;
      const receivedAt = received ? addMinutes(createdAt, randomInt(180, 5 * 24 * 60)) : null;
      const purchaseOrderId = randomUUID();
      const purchaseOrderLabel = orderNumber(index + 1);
      orderDaysBack -= randomInt(5, 8);

      await connection.execute(
        `
          INSERT INTO purchase_orders (id, supplier_id, status, created_at, received_at, notes)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          purchaseOrderId,
          supplier.id,
          received ? "received" : "pending",
          mysqlDate(createdAt),
          receivedAt ? mysqlDate(receivedAt) : null,
          `${purchaseOrderLabel} weekly replenishment from ${supplier.name}`
        ]
      );

      queueActivity(activityLogs, {
        userId: adminUser.id,
        action: "PURCHASE_ORDER_CREATED",
        entity: "purchase_order",
        entityId: purchaseOrderId,
        description: `${adminUser.name} created Purchase Order #${purchaseOrderLabel} for "${supplier.name}"`,
        createdAt
      });

      for (const product of selected) {
        const quantity = randomInt(15 + product.popularityWeight * 4, 45 + product.popularityWeight * 12);
        purchaseOrderItems.push([purchaseOrderId, product.id, quantity, product.costPrice]);

        if (received) {
          product.stock += quantity;
          await connection.execute("UPDATE products SET stock = stock + ? WHERE id = ?", [quantity, product.id]);
        }
      }

      if (received) {
        queueActivity(activityLogs, {
          userId: adminUser.id,
          action: "PURCHASE_ORDER_RECEIVED",
          entity: "purchase_order",
          entityId: purchaseOrderId,
          description: `${adminUser.name} received Purchase Order #${purchaseOrderLabel}`,
          createdAt: receivedAt
        });
      }
    }

    let saleIndex = 1;
    const adminRows = userRows.filter((user) => user.role === "admin");
    const stockHandlerRows = userRows.filter((user) => user.role === "stock_handler");

    for (let daysBack = 89; daysBack >= 0; daysBack -= 1) {
      const currentDay = daysAgo(daysBack, 8, 0);
      const baseSalesForDay = randomInt(15, 35);
      const salesForDay = isWeekend(currentDay) ? Math.round(baseSalesForDay * 1.25) : baseSalesForDay;

      for (const admin of adminRows) {
        for (let count = 0; count < randomInt(1, 3); count += 1) {
          queueActivity(activityLogs, {
            userId: admin.id,
            action: "LOGIN",
            entity: "user",
            entityId: admin.id,
            description: `${admin.name} logged into StoreBuddy.`,
            createdAt: businessTimeForDay(daysBack)
          });
        }
      }

      for (const cashier of cashierRows) {
        for (let count = 0; count < randomInt(2, 5); count += 1) {
          queueActivity(activityLogs, {
            userId: cashier.id,
            action: "LOGIN",
            entity: "user",
            entityId: cashier.id,
            description: `${cashier.name} logged into StoreBuddy.`,
            createdAt: businessTimeForDay(daysBack)
          });
        }
      }

      for (const stockHandler of stockHandlerRows) {
        for (let count = 0; count < randomInt(1, 2); count += 1) {
          queueActivity(activityLogs, {
            userId: stockHandler.id,
            action: "LOGIN",
            entity: "user",
            entityId: stockHandler.id,
            description: `${stockHandler.name} logged into StoreBuddy.`,
            createdAt: businessTimeForDay(daysBack)
          });
        }
      }

      for (let saleForDay = 0; saleForDay < salesForDay; saleForDay += 1) {
        const availableProducts = productRows.filter((product) => product.stock > 0);
        if (availableProducts.length === 0) {
          break;
        }

        const cashier = randomItem(cashierRows);
        const saleId = randomUUID();
        const saleLabel = saleNumber(saleIndex);
        const createdAt = businessTimeForDay(daysBack);
        const itemCount = Math.min(randomInt(1, 6), availableProducts.length);
        const selected = weightedRandomUnique(availableProducts, itemCount, "popularityWeight");
        const items = [];
        let subtotal = 0;

        for (const product of selected) {
          if (product.stock <= 0) {
            continue;
          }

          const maxQuantity = Math.min(product.stock, product.price > 1000 ? 2 : 5);
          const quantity = randomInt(1, Math.max(1, maxQuantity));
          const lineTotal = quantity * product.price;

          product.stock -= quantity;
          subtotal += lineTotal;
          items.push({ product, quantity, price: product.price });
        }

        if (items.length === 0) {
          continue;
        }

        subtotal = money(subtotal);

        await connection.execute(
          `
            INSERT INTO sales (id, cashier_id, created_at, subtotal, total, payment_method)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          [saleId, cashier.id, mysqlDate(createdAt), subtotal, subtotal, weightedPaymentMethod()]
        );

        for (const item of items) {
          saleItems.push([saleId, item.product.id, item.quantity, item.price]);
          await connection.execute("UPDATE products SET stock = ? WHERE id = ?", [item.product.stock, item.product.id]);
        }

        queueActivity(activityLogs, {
          userId: cashier.id,
          action: "SALE_COMPLETED",
          entity: "sale",
          entityId: saleId,
          description: `${cashier.name} completed Sale #${saleLabel}`,
          createdAt
        });

        saleIndex += 1;
      }
    }

    const stockStatus = balanceInventory(productRows);

    for (const product of productRows) {
      await connection.execute("UPDATE products SET stock = ? WHERE id = ?", [product.stock, product.id]);
    }

    await batchInsert(
      connection,
      "purchase_order_items",
      ["purchase_order_id", "product_id", "quantity", "cost_price"],
      purchaseOrderItems
    );
    await batchInsert(
      connection,
      "sale_items",
      ["sale_id", "product_id", "quantity", "price"],
      saleItems
    );
    await batchInsert(
      connection,
      "activity_logs",
      ["id", "user_id", "action", "entity", "entity_id", "description", "created_at"],
      activityLogs
    );

    await connection.commit();
    console.log("=================================");
    console.log("StoreBuddy Database Seed Complete");
    console.log("=================================");
    console.log(`Users: ${userRows.length}`);
    console.log(`Categories: ${categoryRows.length}`);
    console.log(`Suppliers: ${supplierRows.length}`);
    console.log(`Products: ${productRows.length}`);
    console.log("Purchase Orders: 15");
    console.log(`Sales: ${saleIndex - 1}`);
    console.log(`Sale Items: ${saleItems.length}`);
    console.log(`Activity Logs: ${activityLogs.length}`);
    console.log("");
    console.log("Stock Status");
    console.log("");
    console.log(`Healthy: ${stockStatus.healthy}`);
    console.log("");
    console.log(`Low Stock: ${stockStatus.lowStock}`);
    console.log("");
    console.log(`Out of Stock: ${stockStatus.outOfStock}`);
  } catch (error) {
    await connection.rollback();
    try {
      await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    } catch {
      // Ignore cleanup errors after rollback.
    }
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("Database seed failed:", error);
  process.exit(1);
});
