# FoodLens 智慧食品辨識與營養紀錄系統

## 專案目的

FoodLens 協助使用者查詢食品營養資訊、比較同類食品，並依實際攝取量換算營養攝取數值。

## MVP 功能

- 食品名稱搜尋
- 顯示食品營養資訊
- 同類食品營養比較
- 輸入實際攝取量並換算營養數值
- 飲食紀錄

## 技術架構

- 前端：HTML、CSS、JavaScript
- 後端：Node.js、Express
- 資料庫：SQLite
- 正式資料處理：Express API 查詢 SQLite 後回傳 JSON

## 本機啟動方式

```bash
node server/server.js