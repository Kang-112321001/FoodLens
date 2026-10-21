const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const extractedDir = path.join(__dirname, "..", "data", "extracted");
const reportPath = path.join(__dirname, "..", "data", "profile-report.json");

function findCsvFile(directory) {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, item.name);

    if (item.isDirectory()) {
      const found = findCsvFile(fullPath);
      if (found) return found;
    }

    if (item.isFile() && item.name.toLowerCase().endsWith(".csv")) {
      return fullPath;
    }
  }

  return null;
}

const csvPath = findCsvFile(extractedDir);

if (!csvPath) {
  console.error("找不到 CSV 檔案，請確認資料已解壓縮到 data/extracted/。");
  process.exit(1);
}

let totalRows = 0;
let headers = [];
let emptyCounts = {};
let duplicateTraceCodeCount = 0;
let invalidNutritionValueCount = 0;

const traceCodes = new Set();

const nutritionFields = [
  "每份熱量", "每份蛋白質", "每份脂肪", "每份飽和脂肪",
  "每份碳水化合物", "每份糖", "每份鈉",
  "每100公克熱量", "每100公克蛋白質", "每100公克脂肪",
  "每100公克飽和脂肪", "每100公克碳水化合物", "每100公克糖", "每100公克鈉",
  "每100毫升熱量", "每100毫升蛋白質", "每100毫升脂肪",
  "每100毫升飽和脂肪", "每100毫升碳水化合物", "每100毫升糖", "每100毫升鈉"
];

fs.createReadStream(csvPath)
  .pipe(csv())
  .on("headers", (currentHeaders) => {
    headers = currentHeaders;
    headers.forEach((header) => {
      emptyCounts[header] = 0;
    });
  })
  .on("data", (row) => {
    totalRows += 1;

    headers.forEach((header) => {
      if (!row[header] || row[header].trim() === "") {
        emptyCounts[header] += 1;
      }
    });

    const traceCode = (row["產品追溯系統串接碼"] || "").trim();

    if (traceCode) {
      if (traceCodes.has(traceCode)) {
        duplicateTraceCodeCount += 1;
      } else {
        traceCodes.add(traceCode);
      }
    }

    nutritionFields.forEach((field) => {
      const value = (row[field] || "").trim();

      if (value && Number.isNaN(Number(value))) {
        invalidNutritionValueCount += 1;
      }
    });
  })
  .on("end", () => {
    const report = {
      fileName: path.basename(csvPath),
      totalRows,
      columnCount: headers.length,
      headers,
      emptyCounts,
      duplicateTraceCodeCount,
      invalidNutritionValueCount
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

    console.log("資料品質檢查完成。");
    console.log(`來源檔案：${report.fileName}`);
    console.log(`總筆數：${report.totalRows}`);
    console.log(`欄位數：${report.columnCount}`);
    console.log(`重複追溯碼筆數：${report.duplicateTraceCodeCount}`);
    console.log(`非數字營養欄位值：${report.invalidNutritionValueCount}`);
    console.log("完整報告：data/profile-report.json");
  })
  .on("error", (error) => {
    console.error("讀取 CSV 失敗：", error.message);
  });