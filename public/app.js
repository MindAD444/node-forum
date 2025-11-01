let currentUser = null;
let activePostId = null;
let allComments = [];
let commentOffset = 0;
const firstLoad = 5;
const stepLoad = 3;

/* =============== CHECK LOGIN =============== */
document.addEventListener("DOMContentLoaded", () => {
  checkLoginStatus();
  loadPosts();

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  document.getElementById("close-popup").onclick = () => {
    document.getElementById("comment-popup").classList.add("hidden");
  };

  document.getElementById("load-more-comments").onclick = () => loadCommentChunk();
});

function checkLoginStatus() {
  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username");
  const userId = localStorage.getItem("userId");
  const isAdmin = localStorage.getItem("isAdmin") === "true";

  if (!token || !username) return;

  currentUser = { username, userId, isAdmin };

  document.getElementById("username-display").textContent = `Xin chào, ${username}!`;
  document.getElementById("login-link")?.classList.add("hidden");
  document.getElementById("register-link")?.classList.add("hidden");
  document.getElementById("logout-btn")?.classList.remove("hidden");
  document.getElementById("create-link")?.classList.remove("hidden");
}

function logout() {
  localStorage.clear();
  location.reload();
}

/* =============== LOAD POSTS =============== */
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

/* =============== COMMENT POPUP =============== */
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

/* =============== ADD COMMENT =============== */
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

/* =============== DELETE COMMENT =============== */
async function deleteComment(id) {
  if (!confirm("Xoá bình luận này?")) return;

  await fetch(`/comments/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

  loadComments();
}

/* =============== DELETE POST =============== */
async function deletePost(id) {
  if (!confirm("Xoá bài viết này?")) return;

  await fetch(`/posts/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

  loadPosts();
}