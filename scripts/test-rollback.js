const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(
  __dirname, "..", "database", "foodlens-rollback-test.db"
);

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.get(
    "SELECT food_id, food_name FROM Foods ORDER BY food_id LIMIT 1",
    (err, original) => {
      if (err || !original) {
        console.error("Cannot read test data:", err);
        db.close();
        return;
      }

      console.log("Before:", original);

      db.run("BEGIN TRANSACTION", err => {
        if (err) {
          console.error(err);
          db.close();
          return;
        }

        db.run(
          "UPDATE Foods SET food_name = ? WHERE food_id = ?",
          ["ROLLBACK_TEST", original.food_id],
          err => {
            if (err) {
              console.error(err);
              db.run("ROLLBACK", () => db.close());
              return;
            }

            console.log("Simulated failure");

            db.run("ROLLBACK", err => {
              if (err) {
                console.error("ROLLBACK failed:", err);
                db.close();
                return;
              }

              db.get(
                "SELECT food_name FROM Foods WHERE food_id = ?",
                [original.food_id],
                (err, result) => {
                  if (err) {
                    console.error(err);
                  } else {
                    console.log("After:", result);
                    console.log(
                      "ROLLBACK:",
                      result.food_name === original.food_name
                        ? "PASS"
                        : "FAIL"
                    );
                  }

                  db.close();
                }
              );
            });
          }
        );
      });
    }
  );
});
