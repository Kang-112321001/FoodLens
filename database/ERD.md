# FoodLens 資料庫 ERD

```mermaid
erDiagram
    Foods ||--o{ FoodNutrition : "包含"
    Users ||--o{ Favorites : "建立"
    Foods ||--o{ Favorites : "被收藏"
    Users ||--o{ Sessions : "登入"

    Foods {
        INTEGER food_id PK
        TEXT trace_code UK
        TEXT food_name
        TEXT brand_name
        TEXT company_name
        TEXT category_name
        TEXT source_name
        TEXT source_updated_at
        TEXT raw_food_name
        TEXT raw_category_name
    }

    FoodNutrition {
        INTEGER nutrition_id PK
        INTEGER food_id FK
        TEXT basis_type
        REAL basis_amount
        TEXT basis_unit
        REAL calories_kcal
        REAL protein_g
        REAL fat_g
        REAL saturated_fat_g
        REAL carbohydrate_g
        REAL sugar_g
        REAL sodium_mg
        TEXT raw_nutrition_text
    }

    Users {
        INTEGER user_id PK
        TEXT username UK
        TEXT password_hash
        TEXT created_at
        TEXT updated_at
    }

    Favorites {
        INTEGER user_id PK, FK
        INTEGER food_id PK, FK
        TEXT created_at
    }

    Sessions {
        INTEGER session_id PK
        INTEGER user_id FK
        TEXT token_hash UK
        TEXT expires_at
        TEXT created_at
    }

    ImportRuns {
        INTEGER import_run_id PK
        TEXT source_name
        TEXT source_file_name
        TEXT source_url
        TEXT started_at
        TEXT finished_at
        INTEGER total_rows
        INTEGER inserted_rows
        INTEGER updated_rows
        INTEGER skipped_rows
        INTEGER failed_rows
        TEXT status
    }
```

## 設計規則

- `Foods.trace_code`：官方資料的唯一識別碼，不可重複。
- `FoodNutrition`：同一食品可依「每份、每 100g、每 100mL」保存不同營養資料。
- 營養缺值一律保存為 `NULL`，不以 `0` 代替。
- 食品比較只允許相同 `basis_type` 的資料互相比較。
- `Favorites` 使用 `(user_id, food_id)` 複合主鍵，避免重複收藏。
- `Sessions` 僅保存 Token 雜湊值，不保存原始 Token。
- `ImportRuns` 記錄每次官方資料匯入結果，便於追查資料來源與失敗筆數。