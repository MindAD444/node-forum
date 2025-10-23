// theme.js — quản lý chế độ sáng/tối cho toàn site

// Áp dụng dark mode nếu đã lưu
(function applySavedTheme() {
  const theme = localStorage.getItem("theme");
  if (theme === "dark") document.body.classList.add("dark");
})();

// Gắn sự kiện toggle (nếu trang có nút)
function toggleTheme() {
  document.body.classList.toggle("dark");
  localStorage.setItem(
    "theme",
    document.body.classList.contains("dark") ? "dark" : "light"
  );
}
