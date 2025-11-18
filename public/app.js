let currentUser = null;
let activePostId = null;
let allComments = [];
let commentOffset = 0;
const firstLoad = 5;
const stepLoad = 3;

// --- LOGIC ẨN/HIỆN NAVBAR KHI CUỘN ---
let lastScrollTop = 0; 
const navbar = document.querySelector(".navbar"); 

window.addEventListener("scroll", function() {
  let currentScroll = window.pageYOffset || document.documentElement.scrollTop;
  if (currentScroll > 50) { 
    if (currentScroll > lastScrollTop) {
      navbar.classList.add("navbar-hidden");
    } else {
      navbar.classList.remove("navbar-hidden");
    }
  } else {
    navbar.classList.remove("navbar-hidden");
  }
  lastScrollTop = currentScroll <= 0 ? 0 : currentScroll; 
}, false);
// --- KẾT THÚC LOGIC NAVBAR ---


/* =============== DOMContentLoaded & SIDEBAR LOGIC =============== */
document.addEventListener("DOMContentLoaded", () => {
  checkLoginStatus();
  loadPosts();

  // --- LOGIC MỞ/ĐÓNG SIDEBAR MỚI ---
  const hamburgerBtn = document.getElementById("hamburger-btn");
  const sidebar = document.getElementById("sidebar");
  const closeSidebarBtn = document.getElementById("close-sidebar-btn");
  const overlay = document.getElementById("sidebar-overlay");

  function openSidebar() {
    sidebar.classList.add("open");
    overlay.classList.add("open");
  }

  function closeSidebar() {
    sidebar.classList.remove("open");
    overlay.classList.remove("open");
  }

  if (hamburgerBtn) hamburgerBtn.addEventListener("click", openSidebar);
  if (closeSidebarBtn) closeSidebarBtn.addEventListener("click", closeSidebar);
  if (overlay) overlay.addEventListener("click", closeSidebar);
  // --- KẾT THÚC LOGIC SIDEBAR ---


  // Logic cũ
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  document.getElementById("close-popup").onclick = () => {
    document.getElementById("comment-popup").classList.add("hidden");
  };

  document.getElementById("load-more-comments").onclick = () => loadCommentChunk();
});


/* =============== CHECK LOGIN (ĐÃ CẬP NHẬT) =============== */
function checkLoginStatus() {
  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username");
  const userId = localStorage.getItem("userId");
  const isAdmin = localStorage.getItem("isAdmin") === "true";

  // Lấy tham chiếu đến các phần tử mới
  const sidebarAuth = document.getElementById("sidebar-auth");
  const sidebarGuest = document.getElementById("sidebar-guest");
  const loginLink = document.getElementById("login-link");
  const registerLink = document.getElementById("register-link");
  const usernameDisplayNav = document.getElementById("username-display-nav");
  const usernameDisplaySidebar = document.getElementById("username-display-sidebar");

  if (token && username) {
    // === ĐÃ ĐĂNG NHẬP ===
    currentUser = { username, userId, isAdmin };

    // 1. Ẩn link Đăng nhập/Đăng ký bên ngoài navbar
    if (loginLink) loginLink.classList.add("hidden");
    if (registerLink) registerLink.classList.add("hidden");

    // 2. Hiển thị tên trên navbar (tùy chọn)
    if (usernameDisplayNav) usernameDisplayNav.textContent = `Xin chào, ${username}!`;

    // 3. Hiển thị nội dung sidebar cho người đã đăng nhập
    if (sidebarAuth) sidebarAuth.classList.remove("hidden");
    if (sidebarGuest) sidebarGuest.classList.add("hidden");
    
    // 4. Cập nhật tên trong sidebar
    if (usernameDisplaySidebar) usernameDisplaySidebar.textContent = `Xin chào, ${username}!`;

    // 5. Hiển thị các nút chức năng trong sidebar
    document.getElementById("logout-btn")?.classList.remove("hidden");
    document.getElementById("create-link")?.classList.remove("hidden");
    if (currentUser.isAdmin) {
      document.getElementById("admin-link")?.classList.remove("hidden");
    }

  } else {
    // === CHƯA ĐĂNG NHẬP ===
    currentUser = null;

    // 1. Hiển thị link Đăng nhập/Đăng ký bên ngoài navbar
    if (loginLink) loginLink.classList.remove("hidden");
    if (registerLink) registerLink.classList.remove("hidden");

    // 2. Ẩn tên trên navbar
    if (usernameDisplayNav) usernameDisplayNav.textContent = "";

    // 3. Hiển thị nội dung sidebar cho khách
    if (sidebarAuth) sidebarAuth.classList.add("hidden");
    if (sidebarGuest) sidebarGuest.classList.remove("hidden");
    
    // 4. Ẩn các nút chức năng (vì chúng nằm trong #sidebar-auth đã bị ẩn)
    document.getElementById("logout-btn")?.classList.add("hidden");
    document.getElementById("create-link")?.classList.add("hidden");
    document.getElementById("admin-link")?.classList.add("hidden");
  }
}


function logout() {
  localStorage.clear();
  location.reload();
}

/* =============== LOAD POSTS (Giữ nguyên) =============== */
async function loadPosts() {
  try {
    const res = await fetch("/posts");
    const posts = await res.json();
    const container = document.getElementById("posts");

    if (!posts.length) {
      container.innerHTML = "<p>Chưa có bài viết nào.</p>";
      return;
    }

    container.innerHTML = posts
      .map(post => `
      <div class="post-card">

        ${
          currentUser && (currentUser.isAdmin || currentUser.userId === post.author?._id)
            ? `<button class="delete-post-btn" data-post-id="${post._id}">🗑</button>`
            : ""
        }

        <h2>${post.title}</h2>

        <p class="post-content">${post.content}</p>

        ${post.files?.map(f => `<img src="${f}">`).join("") || ""}

        <div class="post-meta">
          👤 <b>${post.author?.username || "Ẩn danh"}</b> • 🕓 ${new Date(post.createdAt).toLocaleString()}
        </div>

        <button class="toggle-comments-btn" data-post-id="${post._id}">💬 Bình luận</button>
      </div>
    `)
      .join("");

    document.querySelectorAll(".delete-post-btn").forEach(btn => {
      btn.onclick = () => deletePost(btn.dataset.postId);
    });

    document.querySelectorAll(".toggle-comments-btn").forEach(btn => {
      btn.onclick = () => openComments(btn.dataset.postId);
    });
  } catch (err) {
    console.error("Lỗi tải bài:", err);
  }
}

/* =============== COMMENT POPUP (Giữ nguyên) =============== */
function openComments(postId) {
  activePostId = postId;
  commentOffset = 0;
  document.getElementById("comment-list").innerHTML = "";
  document.getElementById("comment-popup").classList.remove("hidden");
  loadComments();
}

async function loadComments() {
  const res = await fetch(`/comments/${activePostId}`);
  allComments = await res.json();
  loadCommentChunk();

  if (currentUser) {
    document.getElementById("comment-form").classList.remove("hidden");
    document.getElementById("login-hint").classList.add("hidden");
  } else {
    document.getElementById("comment-form").classList.add("hidden");
    document.getElementById("login-hint").classList.remove("hidden");
  }
}

function loadCommentChunk() {
  const list = document.getElementById("comment-list");
  const slice = allComments.slice(0, commentOffset + (commentOffset === 0 ? firstLoad : stepLoad));
  commentOffset = slice.length;

  list.innerHTML = slice.map(c => `
    <div class="comment-item">
      <b>${c.author?.username}</b> • ${new Date(c.createdAt).toLocaleString()}
      <p>${c.content}</p>

      ${
        currentUser && (currentUser.userId === c.author?._id || currentUser.isAdmin)
          ? `<button class="delete-comment-btn" data-id="${c._id}">🗑</button>`
          : ""
      }
    </div>
  `).join("");

  document.querySelectorAll(".delete-comment-btn").forEach(btn => {
    btn.onclick = () => deleteComment(btn.dataset.id);
  });

  document.getElementById("load-more-comments").classList.toggle(
    "hidden",
    commentOffset >= allComments.length
  );
}

/* =============== ADD COMMENT (Giữ nguyên) =============== */
document.getElementById("comment-form").onsubmit = async (e) => {
  e.preventDefault();
  const content = document.getElementById("comment-input").value.trim();
  if (!content) return;

  await fetch(`/comments/${activePostId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: JSON.stringify({ content }),
  });

  document.getElementById("comment-input").value = "";
  loadComments();
};

/* =============== DELETE COMMENT (Giữ nguyên) =============== */
async function deleteComment(id) {
  if (!confirm("Xoá bình luận này?")) return;

  await fetch(`/comments/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

  loadComments();
}

/* =============== DELETE POST (Giữ nguyên) =============== */
async function deletePost(id) {
  if (!confirm("Xoá bài viết này?")) return;

  await fetch(`/posts/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

  loadPosts();
}
