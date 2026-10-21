const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("database/foodlens.db");

db.get(`
  SELECT
    COUNT(*) AS total,
    COUNT(category_name) AS categorized,
    COUNT(raw_category_name) AS rawCategorized
  FROM Foods
`, (err, result) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log(result);
  }

  db.close();
});
