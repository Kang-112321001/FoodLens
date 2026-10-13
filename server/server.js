const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const app = express();

const PORT = 7777;
const STUDENT_ID = "112321001";

const publicDir = path.join(__dirname, "..", "public");
const databasePath = path.join(
  __dirname,
  "..",
  "database",
  "foodlens.db"
);

const database = new sqlite3.Database(databasePath, (error) => {
  if (error) {
    console.error("Database connection failed:", error.message);
    return;
  }

  console.log("SQLite database connected.");
});

app.use(express.json());

function escapeLike(value) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function getFoods(req, res) {
  const keyword = String(req.query.q || "").trim().slice(0, 50);
  const searchPattern = `%${escapeLike(keyword)}%`;

  const sql = `
    SELECT
      f.food_id,
      f.trace_code,
      f.food_name,
      f.brand_name,
      f.company_name,
      f.category_name,
      n.basis_type,
      n.basis_amount,
      n.basis_unit,
      n.calories_kcal,
      n.protein_g,
      n.fat_g,
      n.sugar_g,
      n.sodium_mg
    FROM Foods AS f
    LEFT JOIN FoodNutrition AS n
      ON n.nutrition_id = (
        SELECT selected.nutrition_id
        FROM FoodNutrition AS selected
        WHERE selected.food_id = f.food_id
        ORDER BY
          CASE selected.basis_type
            WHEN 'per_100g' THEN 1
            WHEN 'per_100ml' THEN 2
            WHEN 'per_serving' THEN 3
            ELSE 4
          END
        LIMIT 1
      )
    WHERE (? = '' OR f.food_name LIKE ? ESCAPE '\\')
    ORDER BY f.food_name
    LIMIT 20
  `;

  database.all(sql, [keyword, searchPattern], (error, rows) => {
    if (error) {
      console.error("Food query failed:", error.message);

      res.status(500).json({
        error: "DATABASE_QUERY_FAILED",
        message: "食品資料查詢失敗"
      });

      return;
    }

    res.json({
      query: keyword,
      count: rows.length,
      foods: rows
    });
  });
}

app.get("/api/foods", getFoods);
app.get(`/${STUDENT_ID}/api/foods`, getFoods);

app.use(express.static(publicDir));
app.use(`/${STUDENT_ID}`, express.static(publicDir));

app.get(`/${STUDENT_ID}`, (req, res) => {
  res.redirect(`/${STUDENT_ID}/`);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Home: http://localhost:${PORT}/`);
  console.log(
    `Student page: http://localhost:${PORT}/${STUDENT_ID}/`
  );
  console.log(
    `Foods API: http://localhost:${PORT}/api/foods`
  );
});

process.on("SIGINT", () => {
  database.close(() => {
    console.log("SQLite database closed.");
    process.exit(0);
  });
});