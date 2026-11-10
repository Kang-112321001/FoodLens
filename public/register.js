(() => {
  const form = document.querySelector("#registerForm");
  const result = document.querySelector("#registerResult");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const { username, email, password } = form.elements;
    const name = username.value.trim();
    const checks = [
      [username, [...name].length < 2 ? "姓名至少需要 2 個字元。" : ""],
      [email, !email.validity.valid ? "請輸入有效的 Email。" : ""],
      [password, password.value.length < 8 ? "密碼至少需要 8 個字元。" : ""]
    ];

    for (const [field, message] of checks) {
      field.setAttribute("aria-invalid", String(Boolean(message)));
      document.getElementById(field.getAttribute("aria-describedby")).textContent = message;
    }

    result.textContent = "";
    const invalid = checks.find(([, message]) => message);
    if (invalid) {
      invalid[0].focus();
      return;
    }

    result.textContent = `驗證通過，${name}（${email.value}）。`;
    form.reset();
  });
})();

(() => {
  const button = document.querySelector("#googleSignIn");
  const status = document.querySelector("#googleStatus");

  async function verifyAccount({ credential }) {
    status.textContent = "正在驗證 Google 帳號…";

    try {
      const response = await fetch("./api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const account = await response.json();
      if (account.verified !== true) throw new Error("Unexpected response");

      window.location.replace("./");
    } catch {
      status.textContent = "FoodLens 無法驗證 Google 帳號，請稍後再試。";
    }
  }

  const form = document.querySelector("#registerForm");
  const emailHeading = form.previousElementSibling;
  const logout = document.createElement("button");
  logout.type = "button";
  logout.textContent = "登出 FoodLens";
  logout.hidden = true;
  status.after(logout);

  function showSignedIn(name) {
    status.textContent = `已登入 FoodLens：${name}`;
    button.hidden = true;
    form.hidden = true;
    emailHeading.hidden = true;
    document.querySelector("#registerResult").textContent = "";
    logout.hidden = false;
  }

  logout.addEventListener("click", async () => {
    logout.disabled = true;
    try {
      const response = await fetch("./api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      window.google?.accounts.id.disableAutoSelect();
      window.location.reload();
    } catch {
      status.textContent = "登出失敗，請再試一次。";
      logout.disabled = false;
    }
  });

  fetch("./api/auth/me")
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(account => {
      if (account.signedIn) showSignedIn(account.name);
    })
    .catch(() => {
      if (!button.hidden) status.textContent = "暫時無法讀取登入狀態。";
    });

  const script = document.createElement("script");
  script.src = "https://accounts.google.com/gsi/client";
  script.async = true;
  script.addEventListener("load", () => {
    google.accounts.id.initialize({
      client_id: "170495812018-ci1ki1uk91ahg1jee4lu3p7qek6sr4ou.apps.googleusercontent.com",
      callback: verifyAccount
    });
    google.accounts.id.renderButton(button, {
      theme: "outline",
      size: "large",
      text: "continue_with",
      locale: "zh-TW"
    });
  });
  script.addEventListener("error", () => {
    status.textContent = "Google 登入按鈕載入失敗，請重新整理再試。";
  });
  document.head.append(script);
})();
