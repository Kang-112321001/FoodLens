const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const csvPath = path.join(
  __dirname,
  "..",
  "data",
  "extracted",
  "188_2.csv"
);

const fields = [
  "每一份量",
  "每份熱量",
  "每份蛋白質",
  "每份脂肪",
  "每份糖",
  "每份鈉",
  "每100公克熱量",
  "每100毫升熱量"
];

const samples = {};

fs.createReadStream(csvPath)
  .pipe(csv())
  .on("data", (row) => {
    fields.forEach((field) => {
      const value = (row[field] || "").trim();

      if (value && !samples[field]) {
        samples[field] = value;
      }
    });
  })
  .on("end", () => {
    console.log("第一組非空白營養資料：");
    console.log(samples);
  });