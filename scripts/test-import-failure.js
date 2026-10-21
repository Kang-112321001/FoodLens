
"use strict";

const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const sqlite3 = require("sqlite3").verbose();

const ROOT = path.join(__dirname, "..");
const csvPath = path.join(ROOT, "data", "extracted", "188_2.csv");
const databasePath = path.join(ROOT, "database", "foodlens-rollback-test.db");
const reportPath = path.join(ROOT, "data", "import-report.json");

const sourceName = "食藥署食品追溯追蹤系統消費者查詢資料集";

// 預設匯入 2000 筆；--all 匯入完整資料
const args = process.argv.slice(2);
const importAll = args.includes("--all");
const LIMIT = importAll ? Infinity : 2000;

if (args.some(arg => arg !== "--all")) {
  console.error("用法：node scripts/import-test-data.js [--all]");
  process.exit(1);
}

// 空值處理
function textOrNull(value) {
  if (value === undefined || value === null) return null;

  const text = String(value).trim();
  return text.length ? text : null;
}

// 數值解析
function parseNumber(value) {
  const text = textOrNull(value);
  if (text === null) return null;

  const cleaned = text
    .replace(/,/g, "")
    .replace(/，/g, "")
    .trim();

  // 不將範圍、低於檢出值、未檢出當成精確數字
  const match = cleaned.match(
    /^\+?(?:\d+(?:\.\d+)?|\.\d+)\s*(?:kcal|大卡|千卡|公克|毫克|微克|毫升|克|g|mg|μg|µg|ug|ml)?$/i
  );

  if (!match) return null;

  const number = Number(
    cleaned.match(/^\+?(?:\d+(?:\.\d+)?|\.\d+)/)[0]
  );

  return Number.isFinite(number) && number >= 0
    ? number
    : null;
}

// 每份單位解析
function parseServing(value) {
  const text = textOrNull(value);
  if (text === null) return null;

  const normalized = text
    .replace(/，/g, ",")
    .replace(/,/g, "")
    .trim();

  const match = normalized.match(
    /^\s*(\d+(?:\.\d+)?|\.\d+)\s*(公克|克|g|毫升|ml|份)\s*$/i
  );

  if (!match) return null;

  const amount = Number(match[1]);

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const rawUnit = match[2].toLowerCase();

  const unit = ["公克", "克", "g"].includes(rawUnit)
    ? "g"
    : ["毫升", "ml"].includes(rawUnit)
      ? "ml"
      : "serving";

  return { amount, unit };
}

// 營養欄位映射
const fields = [
  ["caloriesKcal", "熱量"],
  ["proteinG", "蛋白質"],
  ["fatG", "脂肪"],
  ["saturatedFatG", "飽和脂肪"],
  ["carbohydrateG", "碳水化合物"],
  ["sugarG", "糖"],
  ["sodiumMg", "鈉"]
];

// 建立營養資料
function createNutrition(row, basisType) {
  const prefixes = {
    per_serving: "每份",
    per_100g: "每100公克",
    per_100ml: "每100毫升"
  };

  const prefix = prefixes[basisType];

  const serving = basisType === "per_serving"
    ? parseServing(row["每一份量"])
    : null;

  if (basisType === "per_serving" && !serving) {
    return null;
  }

  const values = fields.map(([, name]) =>
    parseNumber(row[`${prefix}${name}`])
  );

  if (values.every(value => value === null)) {
    return null;
  }

  const basisAmount = serving ? serving.amount : 100;

  const basisUnit = serving
    ? serving.unit
    : basisType === "per_100g" ? "g" : "ml";

  return {
    basisType,
    basisAmount,
    basisUnit,
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

  for (const [key, prefix] of groups) {
    result[key] = {};

    for (const [field, name] of fields) {
      result[key][field] = row[`${prefix}${name}`] ?? null;
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
      if (error) reject(error);
      else resolve({
        changes: this.changes,
        lastID: this.lastID
      });
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

// 讀取並清洗 CSV
async function loadRows() {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`找不到 CSV：${csvPath}`);
  }

  const selected = new Map();

  const stats = {
    scannedRows: 0,
    skippedRows: 0,
    duplicateCodes: 0
  };

  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(csvPath).pipe(csv());

    stream.on("data", row => {
      if (selected.size >= LIMIT) return;

      stats.scannedRows += 1;

      const traceCode = textOrNull(
        row["產品追溯系統串接碼"]
      );

      const foodName = textOrNull(
        row["產品名稱"]
      );

      if (!traceCode || !foodName) {
        stats.skippedRows += 1;
        return;
      }

      const nutritionList = [
        "per_serving",
        "per_100g",
        "per_100ml"
      ]
        .map(basis => createNutrition(row, basis))
        .filter(Boolean);

      if (!nutritionList.length) {
        stats.skippedRows += 1;
        return;
      }

      if (selected.has(traceCode)) {
        stats.duplicateCodes += 1;
      }

      selected.set(traceCode, {
        traceCode,
        foodName,
        companyName: textOrNull(row["公司名稱"]),
        categoryName: textOrNull(row["產品分類"]),
        sourceUpdatedAt: textOrNull(row["有效起始日"]),
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

// 執行資料匯入
async function importRows() {
  const { rows, stats } = await loadRows();

  const db = await openDatabase(databasePath);

  let transactionStarted = false;

  try {
    await run(db, "PRAGMA foreign_keys = ON");

    const foreignKeys = await get(
      db,
      "PRAGMA foreign_keys"
    );

    if (!foreignKeys || foreignKeys.foreign_keys !== 1) {
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
        sourceName,
        food.sourceUpdatedAt,
        food.foodName,
        food.categoryName
      ]);

      if (counts.inserted + counts.updated === 0) {
        await run(
          db,
          "UPDATE Foods SET food_name = 'ROLLBACK_TEST' WHERE food_id = 1"
        );

        await run(db, "INSERT INTO nonexistent_test_table VALUES (1)");
      }

      if (existing) {
        counts.updated += 1;
      } else {
        counts.inserted += 1;
      }

      const result = await get(
        db,
        "SELECT food_id FROM Foods WHERE trace_code = ?",
        [food.traceCode]
      );

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
          result.food_id,
          nutrition.basisType,
          nutrition.basisAmount,
          nutrition.basisUnit,
          ...nutrition.values,
          food.rawNutritionText
        ]);

        counts.nutrition += 1;
      }
    }

    const notes = JSON.stringify({
      mode: importAll ? "all" : "test",
      scannedRows: stats.scannedRows,
      duplicateCodes: stats.duplicateCodes,
      nutritionRows: counts.nutrition
    });

    // 在同一交易內記錄匯入歷程
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
      VALUES (?, ?, ?, ?, ?, ?, 0, 'completed',
              CURRENT_TIMESTAMP, ?)
    `, [
      sourceName,
      path.basename(csvPath),
      stats.scannedRows,
      counts.inserted,
      counts.updated,
      stats.skippedRows,
      notes
    ]);

    await run(db, "COMMIT");
    transactionStarted = false;

    const report = {
      status: "completed",
      mode: importAll ? "all" : "test",
      sourceFile: path.basename(csvPath),
      scannedRows: stats.scannedRows,
      insertedRows: counts.inserted,
      updatedRows: counts.updated,
      skippedRows: stats.skippedRows,
      duplicateCodes: stats.duplicateCodes,
      nutritionRows: counts.nutrition,
      importedAt: new Date().toISOString()
    };

    try {
      fs.mkdirSync(path.dirname(reportPath), {
        recursive: true
      });

      fs.writeFileSync(
        reportPath,
        JSON.stringify(report, null, 2),
        "utf8"
      );
    } catch (reportError) {
      console.warn(
        "資料庫已提交，但 JSON 報告無法儲存：",
        reportError.message
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
          "回滾失敗：",
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
