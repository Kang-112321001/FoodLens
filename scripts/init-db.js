const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const databasePath = path.join(__dirname, "..", "database", "foodlens.db");
const schemaPath = path.join(__dirname, "..", "database", "schema.sql");

const schema = fs.readFileSync(schemaPath, "utf8");
const db = new sqlite3.Database(databasePath);

db.serialize(() => {
  db.run("PRAGMA foreign_keys = ON;");

  db.exec(schema, (error) => {
    if (error) {
      console.error("資料庫初始化失敗：", error.message);
      db.close();
      process.exit(1);
    }

    db.all(
      `SELECT name
       FROM sqlite_master
       WHERE type = 'table'
       ORDER BY name;`,
      (queryError, tables) => {
        if (queryError) {
          console.error("資料表查詢失敗：", queryError.message);
        } else {
          console.log("資料庫初始化完成。");
          console.log("目前資料表：");
          tables.forEach((table) => console.log(`- ${table.name}`));
        }

        db.close();
      }
    );
  });
});