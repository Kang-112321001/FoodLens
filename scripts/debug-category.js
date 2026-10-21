const fs = require("fs");
const csv = require("csv-parser");

const target = "A-101459882-00000-5-15990000-0000000001";

fs.createReadStream("data/extracted/188_2.csv")
  .pipe(csv())
  .on("data", function(row) {
    if (row["產品追溯系統串接碼"] === target) {
      console.log("欄位名稱:", JSON.stringify(Object.keys(row)[0]));
      console.log("第一欄內容:", JSON.stringify(Object.values(row)[0]));
      console.log("分類欄位:", JSON.stringify(row['"產品分類"']));
      this.destroy();
    }
  });
