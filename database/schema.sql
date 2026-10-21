PRAGMA foreign_keys = ON;

-- 食品基本資料：官方資料原始資訊與可搜尋欄位
CREATE TABLE IF NOT EXISTS Foods (
    food_id INTEGER PRIMARY KEY AUTOINCREMENT,
    trace_code TEXT NOT NULL UNIQUE,
    food_name TEXT NOT NULL,
    brand_name TEXT,
    company_name TEXT,
    category_name TEXT,
    source_name TEXT NOT NULL,
    source_updated_at TEXT,
    raw_food_name TEXT,
    raw_category_name TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 食品營養資料：同一食品可有「每份、每100g、每100mL」不同基準
CREATE TABLE IF NOT EXISTS FoodNutrition (
    nutrition_id INTEGER PRIMARY KEY AUTOINCREMENT,
    food_id INTEGER NOT NULL,
    basis_type TEXT NOT NULL
        CHECK (basis_type IN ('per_serving', 'per_100g', 'per_100ml')),
    basis_amount REAL NOT NULL,
    basis_unit TEXT NOT NULL
        CHECK (basis_unit IN ('g', 'ml', 'serving')),

    calories_kcal REAL,
    protein_g REAL,
    fat_g REAL,
    saturated_fat_g REAL,
    carbohydrate_g REAL,
    sugar_g REAL,
    sodium_mg REAL,

    raw_nutrition_text TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (food_id)
        REFERENCES Foods(food_id)
        ON DELETE CASCADE,

    UNIQUE (food_id, basis_type)
);

-- 會員資料：密碼只保存雜湊值，不保存明碼
CREATE TABLE IF NOT EXISTS Users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 使用者收藏的食品
CREATE TABLE IF NOT EXISTS Favorites (
    user_id INTEGER NOT NULL,
    food_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id, food_id),

    FOREIGN KEY (user_id)
        REFERENCES Users(user_id)
        ON DELETE CASCADE,

    FOREIGN KEY (food_id)
        REFERENCES Foods(food_id)
        ON DELETE CASCADE
);

-- 登入狀態：保存 Session Token 的雜湊值
CREATE TABLE IF NOT EXISTS Sessions (
    session_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES Users(user_id)
        ON DELETE CASCADE
);

-- 每次官方資料匯入的紀錄
CREATE TABLE IF NOT EXISTS ImportRuns (
    import_run_id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_name TEXT NOT NULL,
    source_file_name TEXT,
    source_url TEXT,
    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TEXT,
    total_rows INTEGER NOT NULL DEFAULT 0,
    inserted_rows INTEGER NOT NULL DEFAULT 0,
    updated_rows INTEGER NOT NULL DEFAULT 0,
    skipped_rows INTEGER NOT NULL DEFAULT 0,
    failed_rows INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'completed', 'failed')),
    notes TEXT
);

-- 常用查詢索引
CREATE INDEX IF NOT EXISTS idx_foods_food_name
ON Foods(food_name);

CREATE INDEX IF NOT EXISTS idx_foods_category_name
ON Foods(category_name);

CREATE INDEX IF NOT EXISTS idx_food_nutrition_food_id
ON FoodNutrition(food_id);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
ON Sessions(expires_at);