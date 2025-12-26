let currentUser = null;
let activePostId = null;
let allComments = [];
let commentOffset = 0;
const firstLoad = 5;
const stepLoad = 3;


let lastScrollTop = 0; 
const navbar = document.querySelector(".navbar"); 

window.addEventListener("scroll", function() {
  if (!navbar) return;
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



document.addEventListener("DOMContentLoaded", () => {
  checkLoginStatus();


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




  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  const closePopup = document.getElementById("close-popup");
  if (closePopup) closePopup.onclick = () => {
    const cp = document.getElementById("comment-popup");
    if (cp) cp.classList.add("hidden");
  };

  const loadMoreCommentsBtn = document.getElementById("load-more-comments");
  if (loadMoreCommentsBtn) loadMoreCommentsBtn.onclick = () => loadCommentChunk();
});


function checkLoginStatus() {
  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username");
  const role = localStorage.getItem("role");
  const loginLink = document.getElementById("login-link");
  const registerLink = document.getElementById("register-link");
  const userDisplaySidebar = document.getElementById("username-display-sidebar");
  const adminLink = document.getElementById("admin-link");
  const createLink = document.getElementById("create-link");
  const profileLink = document.getElementById("profile-link");
  const navAvatar = document.getElementById("nav-avatar");
  const logoutNav = document.getElementById('logout-nav');
  const sidebarAuth = document.getElementById('sidebar-auth');
  const sidebarGuest = document.getElementById('sidebar-guest');

  if (token && username) {
    if (loginLink) loginLink.classList.add("hidden");
    if (registerLink) registerLink.classList.add("hidden");
    if (userDisplaySidebar) userDisplaySidebar.textContent = username;
    if (profileLink) profileLink.classList.remove('hidden');
    const avatar = localStorage.getItem('avatar') || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random`;
    if (navAvatar) navAvatar.src = avatar;
    if (createLink) createLink.classList.remove("hidden");
    if (userDisplaySidebar) userDisplaySidebar.textContent = `Xin chào, ${username}!`;
    if (sidebarAuth) sidebarAuth.classList.remove('hidden');
    if (sidebarGuest) sidebarGuest.classList.add('hidden');


    if (role === "admin" && adminLink) {
      adminLink.classList.remove("hidden");
    }
    // Show/hide both potential logout controls (navbar & sidebar)
    if (logoutNav) { logoutNav.classList.remove('hidden'); logoutNav.onclick = () => { if (confirm('Đăng xuất?')) { localStorage.clear(); location.reload(); } }; }
  } else {
    if (adminLink) adminLink.classList.add("hidden");
    if (createLink) createLink.classList.add("hidden");
    if (sidebarAuth) sidebarAuth.classList.add('hidden');
    if (sidebarGuest) sidebarGuest.classList.remove('hidden');
    if (profileLink) profileLink.classList.add('hidden');
    if (navAvatar) navAvatar.src = '';
    if (logoutNav) logoutNav.classList.add('hidden');
    if (logoutBtn) logoutBtn.classList.add('hidden');
  }
}

function handleAuthError(response) {
  if (response.status === 401 || response.status === 403) {
    alert("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!");
    

    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("userId");
    localStorage.removeItem("role");
    

    window.location.href = "login.html";
    return true;
  }
  return false;
}
function logout() {
  localStorage.clear();
  location.reload();
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
        currentUser && (currentUser.userId === c.author?._id || currentUser.role === 'admin')
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

async function deleteComment(id) {
  if (!confirm("Xoá bình luận này?")) return;

  await fetch(`/comments/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

  loadComments();
}

async function deletePost(id) {
  if (!confirm("Xoá bài viết này?")) return;

  await fetch(`/posts/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

  loadPosts();
}

// Fallback delegation: ensure hamburger/close/overlay clicks toggle sidebar
document.addEventListener('click', (e) => {
  const target = e.target;
  // robust closest lookup: handle text nodes in older browsers
  const hamburger = (target && target.closest) ? target.closest('#hamburger-btn') : null;
  const closeBtn = (target && target.closest) ? target.closest('#close-sidebar-btn') : null;
  const overlayClicked = (target && target.closest) ? target.closest('#sidebar-overlay') : null;

  // fallback: if closest isn't available or didn't find, try element containment
  const hbEl = document.getElementById('hamburger-btn');
  const closeEl = document.getElementById('close-sidebar-btn');
  const overlayEl = document.getElementById('sidebar-overlay');
  const sidebar = document.getElementById('sidebar');

  const isHamburger = hamburger || (hbEl && (hbEl === target || hbEl.contains(target)));
  const isClose = closeBtn || (closeEl && (closeEl === target || closeEl.contains(target)));
  const isOverlay = overlayClicked || (overlayEl && (overlayEl === target || overlayEl.contains(target)));

  if (isHamburger) {
    if (sidebar) sidebar.classList.add('open');
    if (overlayEl) overlayEl.classList.add('open');
  }
  if (isClose || isOverlay) {
    if (sidebar) sidebar.classList.remove('open');
    if (overlayEl) overlayEl.classList.remove('open');
  }
});
