document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  const usernameDisplay = document.getElementById("username-display");
  const createLink = document.getElementById("create-link");
  const adminLink = document.getElementById("admin-link");
  const loginLink = document.getElementById("login-link");
  const registerLink = document.getElementById("register-link");
  const logoutBtn = document.getElementById("logout-btn");

  // Ẩn/hiện menu tùy theo đăng nhập
  if (token) {
    try {
      const res = await fetch("/auth/me", {
        headers: { "Authorization": "Bearer " + token },
      });

      if (!res.ok) throw new Error("Token hết hạn");
      const user = await res.json();

      usernameDisplay.textContent = "👤 " + user.username;
      loginLink.classList.add("hidden");
      registerLink.classList.add("hidden");
      logoutBtn.classList.remove("hidden");

      // Nếu là user hoặc admin đều có thể đăng bài
      if (user.role === "user" || user.role === "admin") {
        createLink.classList.remove("hidden");
      }

      // Nếu là admin thì thêm link quản trị
      if (user.role === "admin") {
        adminLink.classList.remove("hidden");
      }
    } catch (err) {
      console.error(err);
      localStorage.removeItem("token");
    }
  } else {
    usernameDisplay.textContent = "";
    createLink.classList.add("hidden");
    adminLink.classList.add("hidden");
    loginLink.classList.remove("hidden");
    registerLink.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
  }

  // Nút đăng xuất
  logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "login.html";
  });
});
