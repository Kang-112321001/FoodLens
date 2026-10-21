# W06 Fetch API / AJAX 實作紀錄

## 一、實作功能

FoodLens 前端使用 `fetch()` 呼叫 Express 食品查詢 API，由 Express 查詢 SQLite 資料庫，再將 JSON 資料回傳前端並更新食品卡片。

本週完成：

- 使用 `fetch()` 發送食品查詢請求。
- 使用 Express 建立食品查詢 API。
- 使用 SQLite 儲存食品與營養資料。
- 將 API 回傳的 JSON 轉換為食品卡片。
- 搜尋時不重新載入整個頁面。
- 顯示載入中、無結果及 API 錯誤狀態。
- 使用 `try...catch...finally` 處理錯誤。

## 二、資料處理流程

```text
使用者輸入食品名稱
↓
提交搜尋表單
↓
submit event
↓
loadFoods()
↓
fetch()
↓
GET /api/foods?q=關鍵字
↓
Express 接收請求
↓
查詢 SQLite
↓
回傳 JSON
↓
response.json()
↓
renderFoods()
↓
更新 DOM
↓
顯示食品卡片
```

這個流程符合：

```text
Event → Function → fetch() → HTTP → API → JSON → Function → DOM → UI
```

## 三、食品查詢 API

### Request

```http
GET /api/foods?q=豆漿
```

### Query Parameter

| 參數 | 用途 |
|---|---|
| `q` | 食品名稱搜尋關鍵字 |

如果沒有提供 `q`，API 會回傳前 20 筆食品資料。

### Response

```json
{
  "query": "豆漿",
  "count": 5,
  "foods": [
    {
      "food_id": 1,
      "trace_code": "食品追溯碼",
      "food_name": "食品名稱",
      "brand_name": null,
      "company_name": "食品公司",
      "category_name": "飲品類",
      "basis_type": "per_100ml",
      "basis_amount": 100,
      "basis_unit": "ml",
      "calories_kcal": 35,
      "protein_g": 3.2,
      "fat_g": 1.8,
      "sugar_g": 0,
      "sodium_mg": 45
    }
  ]
}
```

## 四、AJAX 說明

AJAX 是 Asynchronous JavaScript and XML 的縮寫。現在實務上通常使用 JSON，而不是 XML。

FoodLens 搜尋食品時，JavaScript 會在背景向 API 發送請求。API 回傳資料後，只有食品結果區域會被更新，不需要重新載入整個網頁。

因此使用者可以在同一個頁面中搜尋不同食品，操作過程比較流暢。

## 五、主要 JavaScript Function

### `loadFoods(keyword)`

負責：

1. 建立 API URL。
2. 將關鍵字放入 `q` Query Parameter。
3. 使用 `fetch()` 發送 GET Request。
4. 檢查 HTTP Response。
5. 使用 `response.json()` 解析 JSON。
6. 呼叫 `renderFoods()` 更新頁面。
7. 處理 HTTP、Network 及資料載入錯誤。

### `renderFoods(foods)`

負責：

1. 更新結果筆數。
2. 將食品陣列轉換成食品卡片。
3. 顯示食品名稱、公司、營養基準、熱量、糖及鈉。
4. 沒有結果時顯示提示訊息。

### `formatBasis(food)`

負責將資料庫中的營養基準轉換成使用者容易理解的文字：

| basis_type | 顯示內容 |
|---|---|
| `per_100g` | 每 100 g |
| `per_100ml` | 每 100 mL |
| `per_serving` | 每份及實際份量 |

### `escapeHtml(value)`

負責將特殊字元轉換為 HTML Entity，避免資料內容直接被瀏覽器解讀為 HTML。

## 六、錯誤處理

`loadFoods()` 使用 `try...catch...finally` 處理請求：

```javascript
try {
  const response = await fetch(apiUrl);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  renderFoods(data.foods);
} catch (error) {
  console.error("Food API request failed:", error);
} finally {
  searchButton.disabled = false;
}
```

錯誤處理方式：

- 使用 `response.ok` 判斷 HTTP Status 是否成功。
- HTTP 錯誤會透過 `throw new Error()` 交給 `catch`。
- Network Error 或伺服器無法連線時，也會進入 `catch`。
- 發生錯誤時，頁面顯示「目前無法載入食品資料」。
- `finally` 會恢復搜尋按鈕，避免按鈕一直停留在停用狀態。
- API 成功回傳空陣列時，不視為系統錯誤，而是顯示找不到符合條件的食品。

## 七、Debug 紀錄

### 問題

最初使用以下指令啟動網站：

```powershell
npx.cmd http-server public -p 7777 -a 0.0.0.0
```

這個方式只能提供 HTML、CSS 和 JavaScript 等靜態檔案，不能處理 `/api/foods`。

### 判斷過程

1. HTML 和 CSS 可以正常顯示，表示靜態檔案沒有問題。
2. FoodLens 的食品搜尋需要查詢 SQLite。
3. 瀏覽器不能直接存取 SQLite，必須經過 Express API。
4. `http-server` 沒有 Express Route，因此不能提供 `/api/foods`。
5. 使用 `Test-NetConnection localhost -Port 7777` 確認 Port 是否開啟。
6. 使用 `Get-NetTCPConnection` 確認 Port 7777 是由 Node 程序占用。

### 解決方式

改用 Express 啟動完整網站：

```powershell
node server/server.js
```

或：

```powershell
npm.cmd start
```

### 判斷結果

這個問題位於伺服器層，因為原本的靜態伺服器沒有 API 功能。它不是 DOM、JSON 或 CORS 問題。

## 八、CORS 說明

CORS 是 Cross-Origin Resource Sharing，中文為跨來源資源共享。

Origin 由以下三個部分組成：

```text
Protocol + Host + Port
```

目前 FoodLens 網頁與 API 都使用：

```text
http://localhost:7777
```

兩者的 Protocol、Host、Port 都相同，因此屬於 Same-Origin，不會被 CORS 阻擋。

如果前端位於：

```text
http://localhost:5500
```

API 位於：

```text
http://localhost:7777
```

即使 Host 都是 localhost，Port 不同仍然屬於 Cross-Origin。

### CORS 重點

- CORS 是瀏覽器對網頁 JavaScript 執行的安全限制。
- Postman 或 curl 不會執行瀏覽器的 Same-Origin Policy。
- 因此可能發生 Postman 成功，但 Browser 被 CORS 阻擋。
- `Access-Control-Allow-Origin` 通常應由 API Server 的 Response Header 提供。
- 不能只在前端加入 `Access-Control-Allow-Origin` 解決問題。
- 不應將關閉瀏覽器 CORS 當成正式解法。

## 九、AI Coding Review

### 1. `fetch()` 在哪個 Function？

在 `loadFoods()` 中。

### 2. 什麼 Event 觸發它？

搜尋表單的 `submit` Event 會呼叫 `loadFoods()`。頁面第一次載入時也會主動呼叫一次。

### 3. HTTP Method 是什麼？

使用 `GET`。

### 4. Authentication 怎麼提供？

目前食品查詢是公開 API，不需要登入、API Key 或 Access Token。

### 5. Response 是什麼格式？

Response 格式是 JSON。

### 6. 哪個 Function 處理 JSON？

`loadFoods()` 使用 `response.json()` 將 JSON Response 轉換成 JavaScript Object。

### 7. 哪個 Function 更新 DOM？

`renderFoods()` 負責更新結果筆數及食品卡片。

### 8. HTTP Error 怎麼處理？

程式使用 `response.ok` 檢查 HTTP Status。如果失敗，就丟出 Error 並交給 `catch` 顯示錯誤訊息。

### 9. 是否為 Cross-Origin？

不是。前端與 API 都使用 `http://localhost:7777`，因此是 Same-Origin。

### 10. 如果出現 CORS，應去哪一層修正？

應檢查：

- Frontend Origin。
- API Origin。
- API Server 的 CORS Response Headers。
- 是否出現 OPTIONS Preflight Request。
- OAuth 或 API 平台設定的允許來源。

不能只修改前端程式，也不能讓 AI 猜測實際的 Origin、Redirect URI 或 OAuth Scope。

## 十、安全性處理

- SQL 使用參數化查詢，沒有直接拼接使用者輸入。
- 搜尋關鍵字限制為最多 50 個字元。
- LIKE 查詢會處理 `%`、`_` 和反斜線等特殊字元。
- DOM 輸出使用 `escapeHtml()` 處理特殊字元。
- 資料庫的 `NULL` 顯示為 `—`，不會錯誤轉換為 0。
- 前端沒有放置資料庫密碼、Client Secret、Private API Secret 或 Token。
- API 發生錯誤時，不會將完整資料庫錯誤內容回傳給使用者。

## 十一、測試結果

| 測試項目 | 預期結果 | 實際結果 |
|---|---|---|
| 開啟首頁 | 自動載入前 20 筆食品 | 通過 |
| 搜尋「豆漿」 | 只顯示名稱包含豆漿的資料 | 通過 |
| 搜尋不存在的名稱 | 顯示無搜尋結果提示 | 通過 |
| 清空搜尋欄 | 重新顯示前 20 筆食品 | 通過 |
| API 回傳 JSON | 包含 query、count、foods | 通過 |
| SQLite 缺值 | 顯示為 `—` | 通過 |

## 十二、AI 協作提示詞

```text
請為 FoodLens 加入食品查詢功能。

Page：FoodLens 食品營養查詢首頁。
DOM：搜尋表單、#foodKeyword、.food-results、#results-title span。
Event：使用者提交搜尋表單。
Function：新增 loadFoods() 與 renderFoods()。
API：使用 fetch() 以 GET 呼叫 ./api/foods?q=關鍵字。
JSON：讀取 response 中的 foods 陣列。
DOM：將食品資料轉換成食品卡片，並更新搜尋結果筆數。

錯誤處理：
1. 檢查 response.ok。
2. 使用 try...catch 處理 HTTP 與 Network Error。
3. 空資料顯示找不到符合條件的食品。
4. API 錯誤顯示稍後再試。

限制：
1. 不使用外部 JavaScript Framework。
2. 不將 SQLite 資料庫直接提供給瀏覽器。
3. 不將 NULL 當作 0。
4. 不將 Secret 或資料庫密碼放入前端。
5. 保留目前 HTML 與 CSS 的版面設計。
```