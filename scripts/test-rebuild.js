const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();

const schema = fs.readFileSync("database/schema.sql", "utf8");
const db = new sqlite3.Database("database/foodlens-rebuild-test.db");

db.exec(schema, error => {
  if (error) {
    console.error("REBUILD FAIL:", error.message);
    process.exitCode = 1;
  } else {
    console.log("REBUILD SCHEMA PASS");
  }
  db.close();
});
