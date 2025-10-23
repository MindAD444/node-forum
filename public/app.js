// ==============================
// app.js - Quản lý giao diện và trạng thái người dùng
// ==============================

document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username");

  const loginLink = document.getElementById("login-link");
  const registerLink = document.getElementById("register-link");
  const createLink = document.getElementById("create-link");
  const logoutBtn = document.getElementById("logout-btn");
  const userNameDisplay = document.getElementById("user-name");

  // Nếu người dùng đã đăng nhập
  if (token) {
    if (loginLink) loginLink.classList.add("hidden");
    if (registerLink) registerLink.classList.add("hidden");
    if (createLink) createLink.classList.remove("hidden");
    if (logoutBtn) logoutBtn.classList.remove("hidden");

    if (userNameDisplay && username) {
      userNameDisplay.textContent = `👤 ${username}`;
      userNameDisplay.classList.remove("hidden");
    }
  } 
  // Nếu chưa đăng nhập
  else {
    if (loginLink) loginLink.classList.remove("hidden");
    if (registerLink) registerLink.classList.remove("hidden");
    if (createLink) createLink.classList.add("hidden");
    if (logoutBtn) logoutBtn.classList.add("hidden");
    if (userNameDisplay) userNameDisplay.classList.add("hidden");
  }

  // ==============================
  // Nút Đăng xuất
  // ==============================
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("token");
      localStorage.removeItem("username");
      alert("Bạn đã đăng xuất!");
      window.location.href = "index.html";
    });
  }
});

// ==============================
// HÀM FETCH CÓ TOKEN (nếu cần)
// ==============================
async function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem("token");
  options.headers = options.headers || {};
  if (token) {
    options.headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, options);
  return res;
}
// === HAMBURGER MENU ===
document.addEventListener("DOMContentLoaded", () => {
  const hamburgerBtn = document.getElementById("hamburger-btn");
  const hamburgerMenu = document.getElementById("hamburger-menu");

  if (hamburgerBtn) {
    hamburgerBtn.addEventListener("click", () => {
      hamburgerMenu.classList.toggle("hidden");
    });
  }

  // Ẩn menu khi click ra ngoài
  document.addEventListener("click", (e) => {
    if (!hamburgerBtn.contains(e.target) && !hamburgerMenu.contains(e.target)) {
      hamburgerMenu.classList.add("hidden");
    }
  });
});
document.addEventListener("DOMContentLoaded", () => {
  const hamburgerBtn = document.getElementById("hamburger-btn");
  const hamburgerMenu = document.getElementById("hamburger-menu");
  const themeToggleBtn = document.getElementById("menu-theme-toggle");

  // Bật/tắt menu
  hamburgerBtn.addEventListener("click", () => {
    hamburgerMenu.classList.toggle("hidden");
  });

  // Bật/tắt dark mode
  themeToggleBtn.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
  });

  // Giữ lại chế độ dark khi reload
  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark");
  }
});
