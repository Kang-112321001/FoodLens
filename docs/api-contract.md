# FoodLens API 契約

## 基本規則

- Base URL：`/112321001/api`
- 資料格式：JSON
- 營養缺值回傳 `null`，不代表 `0`。
- 食品比較最多兩項，且必須使用相同營養基準。
- 密碼、Session Token 不會出現在一般 API 回應中。

---

## 1. 食品搜尋

### `GET /foods`

查詢食品名稱或分類。

| 參數 | 類型 | 必填 | 說明 |
|---|---|---:|---|
| `q` | string | 否 | 食品名稱關鍵字 |
| `category` | string | 否 | 食品分類 |
| `page` | integer | 否 | 頁碼，預設 1 |
| `pageSize` | integer | 否 | 每頁筆數，預設 20，最大 50 |

成功回應：`200 OK`

```json
{
  "items": [
    {
      "foodId": 1,
      "foodName": "無糖豆漿",
      "brandName": "範例品牌",
      "companyName": "範例公司",
      "categoryName": "飲料"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1
}
```

---

## 2. 食品明細

### `GET /foods/:foodId`

查詢單一食品與營養資料。

成功回應：`200 OK`

```json
{
  "foodId": 1,
  "traceCode": "TFDA-EXAMPLE-001",
  "foodName": "無糖豆漿",
  "brandName": "範例品牌",
  "companyName": "範例公司",
  "categoryName": "飲料",
  "sourceName": "食藥署食品追溯追蹤系統消費者查詢資料集",
  "nutrition": [
    {
      "basisType": "per_100ml",
      "basisAmount": 100,
      "basisUnit": "ml",
      "caloriesKcal": 35,
      "proteinG": 3.2,
      "fatG": 1.8,
      "saturatedFatG": null,
      "carbohydrateG": 1.5,
      "sugarG": 0,
      "sodiumMg": 45
    }
  ]
}
```

---

## 3. 食品比較

### `GET /foods/compare`

比較兩項食品的營養資料。

| 參數 | 類型 | 必填 | 說明 |
|---|---|---:|---|
| `foodId` | integer | 是 | 食品 ID，可傳兩次 |
| `basisType` | string | 是 | `per_serving`、`per_100g`、`per_100ml` |

範例：

```text
/112321001/api/foods/compare?foodId=1&foodId=2&basisType=per_100ml
```

成功回應：`200 OK`

```json
{
  "basisType": "per_100ml",
  "items": [
    {
      "foodId": 1,
      "foodName": "無糖豆漿",
      "caloriesKcal": 35,
      "proteinG": 3.2,
      "fatG": 1.8,
      "sugarG": 0,
      "sodiumMg": 45
    },
    {
      "foodId": 2,
      "foodName": "低糖豆漿",
      "caloriesKcal": 52,
      "proteinG": 3,
      "fatG": 2,
      "sugarG": 5,
      "sodiumMg": 60
    }
  ]
}
```

---

## 4. 註冊

### `POST /auth/register`

```json
{
  "username": "foodlens_user",
  "password": "example-password"
}
```

成功回應：`201 Created`

```json
{
  "userId": 1,
  "username": "foodlens_user"
}
```

---

## 5. 登入

### `POST /auth/login`

```json
{
  "username": "foodlens_user",
  "password": "example-password"
}
```

成功回應：`200 OK`

```json
{
  "userId": 1,
  "username": "foodlens_user"
}
```

登入成功後，伺服器以安全 Cookie 保存 Session。

---

## 6. 登出

### `POST /auth/logout`

成功回應：`204 No Content`

---

## 7. 我的收藏清單

### `GET /favorites`

需登入。

成功回應：`200 OK`

```json
{
  "items": [
    {
      "foodId": 1,
      "foodName": "無糖豆漿",
      "categoryName": "飲料",
      "createdAt": "2026-10-06 12:00:00"
    }
  ]
}
```

---

## 8. 新增收藏

### `POST /favorites`

需登入。

```json
{
  "foodId": 1
}
```

成功回應：`201 Created`

```json
{
  "message": "收藏成功"
}
```

---

## 9. 移除收藏

### `DELETE /favorites/:foodId`

需登入。

成功回應：`204 No Content`

---

## 錯誤格式

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "foodId 必須為正整數"
  }
}
```

| HTTP 狀態碼 | 錯誤代碼 | 說明 |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | 參數格式錯誤或缺少必要欄位 |
| 401 | `UNAUTHORIZED` | 尚未登入或 Session 已失效 |
| 404 | `FOOD_NOT_FOUND` | 找不到指定食品 |
| 409 | `USERNAME_EXISTS` | 帳號已存在 |
| 409 | `FAVORITE_EXISTS` | 食品已在收藏清單中 |
| 422 | `BASIS_MISMATCH` | 食品沒有指定基準，無法比較 |
| 500 | `INTERNAL_ERROR` | 伺服器未預期錯誤 |c