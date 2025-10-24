// ====================== TRẠNG THÁI NGƯỜI DÙNG ======================
let currentUser = null;

// ====================== KHỞI ĐỘNG ======================
document.addEventListener("DOMContentLoaded", () => {
  checkLoginStatus();
  loadPosts();
  document.getElementById("logout-btn").addEventListener("click", logout);
});

// ====================== KIỂM TRA ĐĂNG NHẬP ======================
function checkLoginStatus() {
  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username");
  const isAdmin = localStorage.getItem("isAdmin") === "true";
  const userId = localStorage.getItem("userId");

  if (!token || !username) return;

  currentUser = { _id: userId, username, isAdmin };

  document.getElementById("username-display").textContent = `Xin chào, ${username}!`;
  document.getElementById("login-link")?.classList.add("hidden");
  document.getElementById("register-link")?.classList.add("hidden");
  document.getElementById("logout-btn")?.classList.remove("hidden");
  document.getElementById("create-link")?.classList.remove("hidden");

  if (isAdmin) document.getElementById("admin-link")?.classList.remove("hidden");
}

function logout() {
  localStorage.clear();
  window.location.reload();
}

// ====================== TẢI DANH SÁCH BÀI VIẾT ======================
async function loadPosts() {
  try {
    const res = await fetch("/posts");
    const posts = await res.json();
    const container = document.getElementById("posts");

    if (!posts.length) {
      container.innerHTML = "<p>Chưa có bài viết nào.</p>";
      return;
    }

    container.innerHTML = posts.map(post => `
      <div class="post-card">
        <h2><a href="post.html?id=${post._id}">${post.title}</a></h2>
        <p class="post-content">${post.content}</p>

        ${post.files?.length ? post.files.map(f => {
          const ext = f.split('.').pop().toLowerCase();
          return ["jpg","jpeg","png","gif","webp"].includes(ext)
            ? `<img src="${f}" alt="Ảnh đính kèm"/>`
            : `<a href="${f}" target="_blank">${f.split("/").pop()}</a>`;
        }).join("<br>") : ""}

        <div class="post-meta">
          👤 <b>${post.author?.username || "Ẩn danh"}</b> • 🕓 ${new Date(post.createdAt).toLocaleString()}
        </div>

        <button class="toggle-comments-btn" data-post-id="${post._id}">💬 Bình luận</button>
        <div id="comments-${post._id}" class="comments-box" style="display:none;"></div>
      </div>
    `).join("");

  } catch (err) {
    console.error("Lỗi tải bài viết:", err);
  }
}

// ====================== CLICK HANDLER ======================
document.addEventListener("click", (e) => {

  // Mở bình luận
  if (e.target.classList.contains("toggle-comments-btn")) {
    toggleComments(e.target.dataset.postId);
  }

  // Gửi reply theo @username
  if (e.target.classList.contains("reply-btn")) {
    const username = e.target.dataset.username;
    const box = e.target.closest(".comments-box");
    const textarea = box.querySelector("textarea");
    textarea.value = `@${username} `;
    textarea.focus();
  }

});

// ====================== HIỆN BÌNH LUẬN ======================
async function toggleComments(postId) {
  const box = document.getElementById(`comments-${postId}`);
  box.style.display = box.style.display === "block" ? "none" : "block";
  if (box.style.display === "block") loadComments(postId);
}

// ====================== LOAD COMMENT ======================
async function loadComments(postId) {
  const box = document.getElementById(`comments-${postId}`);
  box.innerHTML = "<p>Đang tải bình luận...</p>";

  const res = await fetch(`/comments/${postId}`);
  const comments = await res.json();

  box.innerHTML = `
    <div class="comment-list">
      ${comments.map(c => `
        <div class="comment-item">
          <b>${c.author?.username || "Ẩn danh"}</b>
          <span> • ${new Date(c.createdAt).toLocaleString()}</span>
          <p>${c.content}</p>

          ${currentUser ? `<button class="reply-btn" data-username="${c.author.username}">↪ Trả lời</button>` : ""}
        </div>
      `).join("")}
    </div>

    ${currentUser ? `
    <form class="comment-form" onsubmit="postComment('${postId}', this); return false;">
      <textarea placeholder="Viết bình luận..." required></textarea>
      <button type="submit">Đăng</button>
    </form>` : `<p>Hãy đăng nhập để bình luận.</p>`}
  `;
}

// ====================== GỬI COMMENT ======================
async function postComment(postId, form) {
  const token = localStorage.getItem("token");
  const content = form.querySelector("textarea").value.trim();
  if (!content) return;

  await fetch(`/comments/${postId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ content })
  });

  form.reset();
  loadComments(postId);
}
