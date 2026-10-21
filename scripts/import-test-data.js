
"use strict";

const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const sqlite3 = require("sqlite3").verbose();

const ROOT = path.resolve(__dirname, "..");

const CSV_PATH = path.join(
  ROOT, "data", "extracted", "188_2.csv"
);

const DB_PATH = path.join(
  ROOT, "database", "foodlens.db"
);

const REPORT_PATH = path.join(
  ROOT, "data", "import-report.json"
);

const SOURCE_NAME =
  "食藥署食品追溯追蹤系統消費者查詢資料集";

// 預設 2000 筆，--all 匯入全部資料
const args = process.argv.slice(2);

if (args.some(arg => arg !== "--all")) {
  console.error(
    "用法：node scripts/import-test-data.js [--all]"
  );
  process.exit(1);
}

const allMode = args.includes("--all");
const LIMIT = allMode ? Infinity : 2000;

// 空值處理
function textOrNull(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();
  return text || null;
}

// 數值解析，不將不確定數值當成精確值
function parseNumber(value) {
  const original = textOrNull(value);
  if (original === null) return null;

  const text = original.replace(/[,，]/g, "");

  const match = text.match(
    /^(\+?(?:\d+(?:\.\d+)?|\.\d+))\s*(kcal|大卡|千卡|公克|毫克|微克|毫升|克|g|mg|μg|µg|ug|ml)?$/i
  );

  if (!match) return null;

  const number = Number(match[1]);

  return Number.isFinite(number) && number >= 0
    ? number
    : null;
}

// 每份量解析
function parseServing(value) {
  const text = textOrNull(value)?.replace(/[,，]/g, "");

  if (!text) return null;

  const match = text.match(
    /^\s*(\d+(?:\.\d+)?|\.\d+)\s*(公克|克|g|毫升|ml|份)\s*$/i
  );

  if (!match) return null;

  const amount = Number(match[1]);

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const unitText = match[2].toLowerCase();

  const unit = ["公克", "克", "g"].includes(unitText)
    ? "g"
    : ["毫升", "ml"].includes(unitText)
      ? "ml"
      : "serving";

  return { amount, unit };
}

// 營養欄位映射
const NUTRIENTS = [
  ["calories", "熱量"],
  ["protein", "蛋白質"],
  ["fat", "脂肪"],
  ["saturatedFat", "飽和脂肪"],
  ["carbohydrate", "碳水化合物"],
  ["sugar", "糖"],
  ["sodium", "鈉"]
];

// 建立營養資料
function createNutrition(row, basisType) {
  const prefixes = {
    per_serving: "每份",
    per_100g: "每100公克",
    per_100ml: "每100毫升"
  };

  const serving = basisType === "per_serving"
    ? parseServing(row["每一份量"])
    : null;

  if (basisType === "per_serving" && !serving) {
    return null;
  }

  const prefix = prefixes[basisType];

  const values = NUTRIENTS.map(([, name]) =>
    parseNumber(row[prefix + name])
  );

  if (values.every(value => value === null)) {
    return null;
  }

  return {
    basisType,
    basisAmount: serving ? serving.amount : 100,
    basisUnit: serving
      ? serving.unit
      : basisType === "per_100g" ? "g" : "ml",
    values
  };
}

// 保存原始營養文字
function rawNutrition(row) {
  const result = {
    servingSize: row["每一份量"] ?? null
  };

  const groups = [
    ["perServing", "每份"],
    ["per100g", "每100公克"],
    ["per100ml", "每100毫升"]
  ];

  for (const [group, prefix] of groups) {
    result[group] = {};

    for (const [field, label] of NUTRIENTS) {
      result[group][field] =
        row[prefix + label] ?? null;
    }
  }

  return JSON.stringify(result);
}

// SQLite Promise 封裝
function openDatabase(file) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(file, error => {
      if (error) reject(error);
      else resolve(db);
    });
  });
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(error) {
      if (error) {
        reject(error);
      } else {
        resolve({
          changes: this.changes,
          lastID: this.lastID
        });
      }
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) reject(error);
      else resolve(row);
    });
  });
}

function close(db) {
  return new Promise((resolve, reject) => {
    db.close(error => {
      if (error) reject(error);
      else resolve();
    });
  });
}

// 讀取與清洗 CSV
async function loadRows() {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`找不到 CSV：${CSV_PATH}`);
  }

  const selected = new Map();

  const stats = {
    scannedRows: 0,
    skippedRows: 0,
    duplicateCodes: 0
  };

  await new Promise((resolve, reject) => {
    // 關鍵修正：清理 CSV 欄位名稱
    const stream = fs.createReadStream(CSV_PATH).pipe(
      csv({
        mapHeaders: ({ header }) =>
          header
            .replace(/^\uFEFF/, "")
            .trim()
            .replace(/^"+|"+$/g, "")
      })
    );

    stream.on("data", row => {
      if (selected.size >= LIMIT) return;

      stats.scannedRows++;

      const traceCode = textOrNull(
        row["產品追溯系統串接碼"]
      );

      const foodName = textOrNull(
        row["產品名稱"]
      );

      if (!traceCode || !foodName) {
        stats.skippedRows++;
        return;
      }

      const nutritionList = [
        "per_serving",
        "per_100g",
        "per_100ml"
      ]
        .map(basis => createNutrition(row, basis))
        .filter(Boolean);

      if (nutritionList.length === 0) {
        stats.skippedRows++;
        return;
      }

      if (selected.has(traceCode)) {
        stats.duplicateCodes++;
      }

      selected.set(traceCode, {
        traceCode,
        foodName,

        companyName: textOrNull(
          row["公司名稱"]
        ),

        // 修正分類欄位
        categoryName: textOrNull(
          row["產品分類"]
        ),

        sourceUpdatedAt: textOrNull(
          row["有效起始日"]
        ),

        rawNutritionText: rawNutrition(row),
        nutritionList
      });
    });

    stream.on("end", resolve);
    stream.on("error", reject);
  });

  if (!selected.size) {
    throw new Error(
      "沒有符合條件的食品資料，資料庫未修改。"
    );
  }

  return {
    rows: [...selected.values()],
    stats
  };
}

// 執行匯入
async function importRows() {
  const { rows, stats } = await loadRows();

  if (!fs.existsSync(DB_PATH)) {
    throw new Error(
      "資料庫不存在，請先執行 node scripts/init-db.js"
    );
  }

  const db = await openDatabase(DB_PATH);
  let transactionStarted = false;

  try {
    await run(db, "PRAGMA foreign_keys = ON");

    const fk = await get(
      db,
      "PRAGMA foreign_keys"
    );

    if (fk?.foreign_keys !== 1) {
      throw new Error("外鍵檢查未啟用");
    }

    await run(db, "BEGIN IMMEDIATE TRANSACTION");
    transactionStarted = true;

    const counts = {
      inserted: 0,
      updated: 0,
      nutrition: 0
    };

    for (const food of rows) {
      const existing = await get(
        db,
        "SELECT food_id FROM Foods WHERE trace_code = ?",
        [food.traceCode]
      );

      // Foods Upsert
      await run(db, `
        INSERT INTO Foods (
          trace_code,
          food_name,
          brand_name,
          company_name,
          category_name,
          source_name,
          source_updated_at,
          raw_food_name,
          raw_category_name
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(trace_code) DO UPDATE SET
          food_name = excluded.food_name,
          company_name = excluded.company_name,
          category_name = excluded.category_name,
          source_updated_at = excluded.source_updated_at,
          raw_food_name = excluded.raw_food_name,
          raw_category_name = excluded.raw_category_name,
          updated_at = CURRENT_TIMESTAMP
      `, [
        food.traceCode,
        food.foodName,
        null,
        food.companyName,
        food.categoryName,
        SOURCE_NAME,
        food.sourceUpdatedAt,
        food.foodName,
        food.categoryName
      ]);

      if (existing) {
        counts.updated++;
      } else {
        counts.inserted++;
      }

      const saved = await get(
        db,
        "SELECT food_id FROM Foods WHERE trace_code = ?",
        [food.traceCode]
      );

      if (!saved) {
        throw new Error(
          `食品寫入後無法取得 food_id：${food.traceCode}`
        );
      }

      // FoodNutrition Upsert
      for (const nutrition of food.nutritionList) {
        await run(db, `
          INSERT INTO FoodNutrition (
            food_id,
            basis_type,
            basis_amount,
            basis_unit,
            calories_kcal,
            protein_g,
            fat_g,
            saturated_fat_g,
            carbohydrate_g,
            sugar_g,
            sodium_mg,
            raw_nutrition_text
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(food_id, basis_type) DO UPDATE SET
            basis_amount = excluded.basis_amount,
            basis_unit = excluded.basis_unit,
            calories_kcal = excluded.calories_kcal,
            protein_g = excluded.protein_g,
            fat_g = excluded.fat_g,
            saturated_fat_g = excluded.saturated_fat_g,
            carbohydrate_g = excluded.carbohydrate_g,
            sugar_g = excluded.sugar_g,
            sodium_mg = excluded.sodium_mg,
            raw_nutrition_text = excluded.raw_nutrition_text,
            updated_at = CURRENT_TIMESTAMP
        `, [
          saved.food_id,
          nutrition.basisType,
          nutrition.basisAmount,
          nutrition.basisUnit,
          ...nutrition.values,
          food.rawNutritionText
        ]);

        counts.nutrition++;
      }
    }

    // 記錄 ImportRuns
    await run(db, `
      INSERT INTO ImportRuns (
        source_name,
        source_file_name,
        total_rows,
        inserted_rows,
        updated_rows,
        skipped_rows,
        failed_rows,
        status,
        finished_at,
        notes
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, 0,
        'completed', CURRENT_TIMESTAMP, ?
      )
    `, [
      SOURCE_NAME,
      path.basename(CSV_PATH),
      stats.scannedRows,
      counts.inserted,
      counts.updated,
      stats.skippedRows,
      JSON.stringify({
        mode: allMode ? "all" : "test",
        duplicateCodes: stats.duplicateCodes,
        nutritionRows: counts.nutrition
      })
    ]);

    // 全部成功才提交
    await run(db, "COMMIT");
    transactionStarted = false;

    const report = {
      status: "completed",
      mode: allMode ? "all" : "test",
      sourceFile: path.basename(CSV_PATH),
      scannedRows: stats.scannedRows,
      insertedRows: counts.inserted,
      updatedRows: counts.updated,
      skippedRows: stats.skippedRows,
      duplicateCodes: stats.duplicateCodes,
      nutritionRows: counts.nutrition,
      importedAt: new Date().toISOString()
    };

    try {
      fs.mkdirSync(
        path.dirname(REPORT_PATH),
        { recursive: true }
      );

      fs.writeFileSync(
        REPORT_PATH,
        JSON.stringify(report, null, 2),
        "utf8"
      );
    } catch (error) {
      console.warn(
        "資料庫已提交，但報告儲存失敗：",
        error.message
      );
    }

    console.log("匯入成功：", report);

  } catch (error) {
    if (transactionStarted) {
      try {
        await run(db, "ROLLBACK");
        console.error(
          "交易已回滾，舊資料保留。"
        );
      } catch (rollbackError) {
        console.error(
          "ROLLBACK 失敗：",
          rollbackError.message
        );
      }
    }

    throw error;

  } finally {
    await close(db);
  }
}

importRows().catch(error => {
  console.error("匯入失敗：", error.message);
  process.exitCode = 1;
});
