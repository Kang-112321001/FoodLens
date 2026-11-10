const photoFile = require("node:path").join(__dirname, "../database/food-photos.json");
const photoFs = require("node:fs");
const foodPhotos = photoFs.existsSync(photoFile) ? require(photoFile) : {};

const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const app = express();

const PORT = 7777;
const STUDENT_ID = "112321001";

const publicDir = path.join(__dirname, "..", "public");
const databasePath = path.join(
  __dirname,
  "..",
  "database",
  "foodlens.db"
);

const database = new sqlite3.Database(databasePath, (error) => {
  if (error) {
    console.error("Database connection failed:", error.message);
    return;
  }

  console.log("SQLite database connected.");
});

app.use(express.json());

function escapeLike(value) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function getFoods(req, res) {
  const keyword = String(req.query.q || "").trim().slice(0, 50);
  const searchPattern = `%${escapeLike(keyword)}%`;

  const sql = `
    SELECT
      f.food_id,
      f.trace_code,
      f.food_name,
      f.brand_name,
      f.company_name,
      f.category_name,
      n.basis_type,
      n.basis_amount,
      n.basis_unit,
      n.calories_kcal,
      n.protein_g,
      n.fat_g,
      n.sugar_g,
      n.sodium_mg
    FROM Foods AS f
    LEFT JOIN FoodNutrition AS n
      ON n.nutrition_id = (
        SELECT selected.nutrition_id
        FROM FoodNutrition AS selected
        WHERE selected.food_id = f.food_id
        ORDER BY
          CASE selected.basis_type
            WHEN 'per_100g' THEN 1
            WHEN 'per_100ml' THEN 2
            WHEN 'per_serving' THEN 3
            ELSE 4
          END
        LIMIT 1
      )
    WHERE (? = '' OR f.food_name LIKE ? ESCAPE '\\')
      AND (? = '' OR f.category_name = ?)
    ORDER BY f.food_name
    LIMIT 20
  `;

  const category = typeof req.query.category === "string" ? req.query.category : "";
  database.all(sql, [keyword, searchPattern, category, category], (error, rows) => {
    if (error) {
      console.error("Food query failed:", error.message);

      res.status(500).json({
        error: "DATABASE_QUERY_FAILED",
        message: "食品資料查詢失敗"
      });

      return;
    }

    res.json({
      query: keyword,
      count: rows.length,
      foods: rows.map(food => ({
        ...food,
        front_photo_url: Object.hasOwn(foodPhotos, food.trace_code)
          ? foodPhotos[food.trace_code]
          : null
      }))
    });
  });
}

app.get("/api/foods", getFoods);
app.get(`/${STUDENT_ID}/api/foods`, getFoods);

function getFoodCategories(req, res) {
  const sql = `
    SELECT category_name AS name, COUNT(*) AS n
    FROM Foods
    WHERE category_name IS NOT NULL AND TRIM(category_name) <> ''
    GROUP BY category_name
    ORDER BY n DESC, name
  `;

  database.all(sql, (error, rows) => {
    if (error) {
      console.error("Food category query failed:", error.message);
      return res.status(500).json({ error: "CATEGORY_QUERY_FAILED" });
    }

    res.json({ categories: rows });
  });
}

app.get("/api/food-categories", getFoodCategories);
app.get(`/${STUDENT_ID}/api/food-categories`, getFoodCategories);

const { OAuth2Client } = require("google-auth-library");
const googleClientId = "170495812018-ci1ki1uk91ahg1jee4lu3p7qek6sr4ou.apps.googleusercontent.com";
const googleClient = new OAuth2Client(googleClientId);

async function verifyGoogleSignIn(req, res) {
  res.set("Cache-Control", "no-store");
  const credential = req.body?.credential;
  if (typeof credential !== "string" || !credential) {
    return res.status(400).json({ error: "MISSING_GOOGLE_CREDENTIAL" });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: googleClientId
    });
    const account = ticket.getPayload();
    if (!account?.sub) {
      return res.status(401).json({ error: "INVALID_GOOGLE_CREDENTIAL" });
    }
    return req.session.regenerate((error) => {
      if (error) return res.status(500).json({ error: "SESSION_CREATE_FAILED" });

      const name = account.name ?? "Google 使用者";
      req.session.user = { googleId: account.sub, name };
      req.session.save((saveError) => {
        if (saveError) return res.status(500).json({ error: "SESSION_SAVE_FAILED" });
        return res.json({ verified: true, name });
      });
    });
  } catch {
    return res.status(401).json({ error: "GOOGLE_VERIFICATION_FAILED" });
  }
}

const session = require("express-session");
const sessionCookie = `${STUDENT_ID}_foodlens_session`;
const sessionCookiePath = `/${STUDENT_ID}/`;
app.use(session({
  name: sessionCookie,
  secret: process.env.SESSION_SECRET ?? require("node:crypto").randomBytes(32).toString("hex"),
  resave: false,
  saveUninitialized: false,
  cookie: { path: sessionCookiePath, httpOnly: true, sameSite: "lax", secure: "auto", maxAge: 60 * 60 * 1000 }
}));

const foodLensOrigin = process.env.FOODLENS_ORIGIN || "http://localhost:7777";

function requireFoodLensOrigin(req, res, next) {
  if (req.get("Origin") !== foodLensOrigin) {
    return res.status(403).json({ error: "UNTRUSTED_ORIGIN" });
  }
  return next();
}

function getLoginStatus(req, res) {
  res.set("Cache-Control", "no-store");
  const user = req.session.user;
  return res.json(user ? { signedIn: true, name: user.name } : { signedIn: false });
}

function signOut(req, res) {
  res.set("Cache-Control", "no-store");
  req.session.destroy((error) => {
    if (error) return res.status(500).json({ error: "SESSION_DESTROY_FAILED" });
    res.clearCookie(sessionCookie, { path: sessionCookiePath });
    return res.sendStatus(204);
  });
}

for (const prefix of ["", `/${STUDENT_ID}`]) {
  app.get(`${prefix}/api/auth/me`, getLoginStatus);
  app.post(`${prefix}/api/auth/logout`, requireFoodLensOrigin, signOut);
}

app.post("/api/auth/google", requireFoodLensOrigin, verifyGoogleSignIn);
app.post(`/${STUDENT_ID}/api/auth/google`, requireFoodLensOrigin, verifyGoogleSignIn);

app.use(express.static(publicDir));
app.use(`/${STUDENT_ID}`, express.static(publicDir));

app.get(`/${STUDENT_ID}`, (req, res) => {
  res.redirect(`/${STUDENT_ID}/`);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Home: http://localhost:${PORT}/`);
  console.log(
    `Student page: http://localhost:${PORT}/${STUDENT_ID}/`
  );
  console.log(
    `Foods API: http://localhost:${PORT}/api/foods`
  );
});

process.on("SIGINT", () => {
  database.close(() => {
    console.log("SQLite database closed.");
    process.exit(0);
  });
});