const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("database/foodlens.db");

db.all(`
  SELECT food_id, food_name, category_name, raw_category_name
  FROM Foods
  ORDER BY food_id
  LIMIT 5
`, (err, rows) => {
  if (err) console.error(err);
  else console.table(rows);
  db.close();
});
