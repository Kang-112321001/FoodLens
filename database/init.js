const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// SQLite 資料庫檔案位置
const dbPath = path.join(__dirname, "foodlens.db");

// 開啟資料庫，如果不存在就會自動建立
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("資料庫建立失敗：", err.message);
        return;
    }

    console.log("SQLite 資料庫連線成功");
});

// 建立資料表
db.serialize(() => {

    // 食品資料表
    db.run(`
        CREATE TABLE IF NOT EXISTS foods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT,
            brand TEXT,
            serving_size REAL,
            calories REAL,
            protein REAL,
            fat REAL,
            carbohydrate REAL,
            sugar REAL,
            sodium REAL
        )
    `);

    // 飲食紀錄資料表
    db.run(`
        CREATE TABLE IF NOT EXISTS food_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            food_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            eaten_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (food_id) REFERENCES foods(id)
        )
    `);

});

// 關閉資料庫
db.close((err) => {
    if (err) {
        console.error("關閉資料庫失敗：", err.message);
        return;
    }

    console.log("資料庫初始化完成");
});