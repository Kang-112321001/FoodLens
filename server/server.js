const express = require("express");
const path = require("path");

const app = express();
const PORT = 7777;
const STUDENT_ID = "112321001";

// 讓網址 /112321001/ 顯示 public 資料夾中的網站
app.use(`/${STUDENT_ID}`, express.static(path.join(__dirname, "..", "public")));

// 開啟根網址時，自動導向學號路徑
app.get("/", (req, res) => {
  res.redirect(`/${STUDENT_ID}/`);
});

app.listen(PORT, () => {
  console.log(`FoodLens 已啟動：http://localhost:${PORT}/${STUDENT_ID}/`);
});