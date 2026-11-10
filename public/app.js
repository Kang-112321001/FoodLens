console.log("FoodLens JavaScript 已成功載入");
(() => {
  const nav = document.querySelector("#rootNavigation");
  const cards = document.querySelector("#dashboardCards");
  const status = document.querySelector("#rootStatus");
  const detail = document.querySelector("#rootDetail");
  let latestRequest = 0;

  function element(tag, text = "") {
    const node = document.createElement(tag);
    node.textContent = text;
    return node;
  }

  function button(text, onClick) {
    const node = element("button", text);
    node.type = "button";
    node.addEventListener("click", onClick);
    return node;
  }

  async function getJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function showCategory(name) {
    const request = ++latestRequest;
    status.textContent = `載入${name}中…`;
    detail.replaceChildren();

    try {
      const params = new URLSearchParams({ category: name });
      const { foods } = await getJson(`./api/foods?${params}`);
      if (request !== latestRequest) return;

      if (foods.length === 0) {
        status.textContent = `${name}目前沒有食品。`;
        return;
      }

      const table = element("table");
      table.createCaption().textContent = `${name}（顯示 ${foods.length} 筆，最多 20 筆）`;
      const heading = table.createTHead().insertRow();
      for (const label of ["食品名稱", "廠商", "營養基準", "熱量（kcal）"]) {
        const cell = element("th", label);
        cell.scope = "col";
        heading.append(cell);
      }

      const body = table.createTBody();
      for (const food of foods) {
        const row = body.insertRow();
        const basis = food.basis_amount != null && food.basis_unit
          ? `${food.basis_type === "per_serving" ? "每份 " : "每 "}${food.basis_amount} ${food.basis_unit}`
          : "—";
        for (const value of [food.food_name, food.company_name, basis, food.calories_kcal]) {
          row.insertCell().textContent = value ?? "—";
        }
      }

      detail.append(table);
      status.textContent = "";
      detail.scrollIntoView({ block: "nearest" });
    } catch (error) {
      if (request === latestRequest) {
        status.textContent = `${name}載入失敗（${error.message}）。`;
      }
    }
  }

  async function loadFoodCategories() {
    status.textContent = "載入食品分類中…";

    try {
      const { categories } = await getJson("./api/food-categories");
      for (const { name, n } of categories) {
        const open = () => showCategory(name);
        const card = element("article");
        card.className = "root-card";
        const details = button("查看詳情", open);
        details.setAttribute("aria-label", `查看${name}詳情`);
        card.append(element("h3", name), element("p", n.toLocaleString("zh-TW")), details);
        nav.append(button(name, open));
        cards.append(card);
      }
      status.textContent = categories.length ? "" : "目前沒有食品分類。";
    } catch (error) {
      status.textContent = `食品分類載入失敗（${error.message}）。`;
    }
  }

  loadFoodCategories();
})();

(() => {
  const accountLink = document.querySelector('a[href="./register.html"]');
  if (!accountLink) return;
  const signedOutLabel = accountLink.textContent;

  async function refreshHeaderAccount() {
    try {
      const response = await fetch("./api/auth/me", { cache: "no-store" });
      if (!response.ok) return;
      const { signedIn, name } = await response.json();
      accountLink.textContent = signedIn ? name : signedOutLabel;
      if (signedIn) {
        accountLink.setAttribute("aria-label", `${name}的會員頁`);
      } else {
        accountLink.removeAttribute("aria-label");
      }
    } catch {
      accountLink.textContent = signedOutLabel;
      accountLink.removeAttribute("aria-label");
    }
  }

  window.addEventListener("pageshow", refreshHeaderAccount);
})();
