const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const databasePath = path.join(__dirname, "..", "database", "foodlens.db");
const db = new sqlite3.Database(databasePath);

db.serialize(() => {
  db.get("SELECT COUNT(*) AS count FROM Foods;", (error, foods) => {
    if (error) throw error;

    console.log(`Foods：${foods.count} 筆`);

    db.all(
      `SELECT
        basis_type AS basisType,
        COUNT(*) AS count,
        SUM(calories_kcal IS NULL) AS caloriesNullCount
      FROM FoodNutrition
      GROUP BY basis_type
      ORDER BY basis_type;`,
      (nutritionError, nutritionRows) => {
        if (nutritionError) throw nutritionError;

        console.log("FoodNutrition：");
        nutritionRows.forEach((row) => {
          console.log(
            `- ${row.basisType}：${row.count} 筆，熱量缺值：${row.caloriesNullCount} 筆`
          );
        });

        db.get(
          `SELECT COUNT(*) AS count
           FROM FoodNutrition n
           LEFT JOIN Foods f ON n.food_id = f.food_id
           WHERE f.food_id IS NULL;`,
          (orphanError, orphan) => {
            if (orphanError) throw orphanError;

            console.log(`營養資料孤兒筆數：${orphan.count}`);

            db.get(
              `SELECT status, inserted_rows, failed_rows
               FROM ImportRuns
               ORDER BY import_run_id DESC
               LIMIT 1;`,
              (runError, importRun) => {
                if (runError) throw runError;

                console.log("最近一次匯入：");
                console.log(importRun);

                db.close();
              }
            );
          }
        );
      }
    );
  });
});