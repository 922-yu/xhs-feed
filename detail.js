/* 详情页逻辑：多图相册 + 评论(回复/点赞/发布) + 关注/点赞/收藏
   通过 ?from=a|b 决定返回哪个发现页；不在页面上显示任何组标识 */

(function () {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const from = (params.get("from") || "a").toLowerCase(); // a.html / b.html

  const post = (window.POSTS || []).find(p => p.id === id);
  if (!post) { location.replace(from + ".html"); return; }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
  function fmt(n) {
    if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, "") + "w";
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    return String(n);
  }

  // 多图相册：优先用帖子自带的 album 列表（可含 .jpg/.png/.mp4），否则默认 cover/img1/img2
  const album = (Array.isArray(post.album) && post.album.length)
    ? post.album
    : ["cover.jpg", "img1.jpg", "img2.jpg"].map(f => "posts/" + post.id + "/" + f);

  // 本地存储：评论点赞状态 + 受访者发布的评论
  const LS_LIKE = "xhs_clike_" + post.id;
  const LS_POST = "xhs_post_" + post.id;
  let clkLike = {}; try { clkLike = JSON.parse(localStorage.getItem(LS_LIKE) || "{}"); } catch (e) {}
  let posted = []; try { posted = JSON.parse(localStorage.getItem(LS_POST) || "[]"); } catch (e) {}

  let liked = false, starred = false, following = false;

  function renderBody() {
    return post.body.map(b => {
      if (b.t === "p") return '<p class="body-p">' + esc(b.x) + "</p>";
      if (b.t === "h") return '<div class="body-h">' + esc(b.x) + "</div>";
      if (b.t === "img") return ""; // 图片已移到顶部相册
      if (b.t === "tags") return '<div class="tags">' + b.x.map(t => '<span class="tag">' + esc(t) + "</span>").join("") + "</div>";
      return "";
    }).join("");
  }

  // 单条评论（含回复）
  function renderComment(c, key) {
    const on = !!clkLike[key];
    const base = c.likes || 0;
    let html =
      '<div class="comment" data-key="' + key + '">' +
        '<div class="avatar lg" style="background:' + (c.avColor || "#eee") + '">' + (c.avatar || "🙂") + "</div>" +
        '<div class="c-main">' +
          '<div class="c-name">' + esc(c.user) +
            (c.pin ? '<span class="pin-tag">置顶</span>' : "") +
            (c.mine ? '<span class="mine-tag">我</span>' : "") + "</div>" +
          '<div class="c-text">' + esc(c.text) + "</div>" +
          '<div class="c-meta"><span>' + esc(c.meta || "") + "</span>" +
            '<span class="c-like' + (on ? " on" : "") + '" data-like="' + key + '"><span class="hk">' + (on ? "❤️" : "♡") + '</span> <span class="lk">' + fmt(base + (on ? 1 : 0)) + "</span></span>" +
            (c.replies && c.replies.length ? '<span class="c-reply-toggle" data-key="' + key + '">' + c.replies.length + "条回复 ›</span>" : "") +
          "</div>";
    if (c.replies && c.replies.length) {
      const r0 = c.replies[0];
      const rk0 = key + "-r0";
      const rl0 = !!clkLike[rk0];
      html += '<div class="reply-first">' +
        '<span class="r-name">' + esc(r0.user) + "：</span>" +
        '<span class="r-text">' + esc(r0.text) + "</span>" +
        '<span class="r-like' + (rl0 ? " on" : "") + '" data-like="' + rk0 + '"><span class="hk">' + (rl0 ? "❤️" : "♡") + "</span></span>" +
        "</div>";
      if (c.replies.length > 1) {
        html += '<div class="c-reply-toggle" data-key="' + key + '">展开 ' + (c.replies.length - 1) + " 条回复 ›</div>";
        html += '<div class="replies" data-replies="' + key + '">';
        c.replies.slice(1).forEach((r, i) => {
          const rk = key + "-r" + (i + 1);
          const rl = !!clkLike[rk];
          html += '<div class="reply" data-key="' + rk + '">' +
            '<span class="r-name">' + esc(r.user) + "：</span>" +
            '<span class="r-text">' + esc(r.text) + "</span>" +
            '<span class="r-like' + (rl ? " on" : "") + '" data-like="' + rk + '"><span class="hk">' + (rl ? "❤️" : "♡") + "</span></span>" +
            "</div>";
        });
        html += "</div>";
      }
    }
    html += "</div></div>";
    return html;
  }

  let sortedComments = []; // 排序后的评论列表（键 cN 的下标以此为准，避免点赞取数错位）
  function renderComments() {
    sortedComments = (post.commentsList || []).slice().sort((a, b) => {
      if (!!a.pin !== !!b.pin) return (b.pin ? 1 : 0) - (a.pin ? 1 : 0);
      return (b.likes || 0) - (a.likes || 0);
    });
    let html = sortedComments.map((c, i) => renderComment(c, "c" + i)).join("");
    html += posted.slice().reverse().map((c, i) => renderComment(c, "p" + i)).join("");
    return html;
  }

  function totalComments() { return (post.comments || 0) + posted.length; }

  const html =
    '<div class="album" id="album">' +
      '<div class="album-track" id="albumTrack">' +
        album.map(src => {
          if (/\.(mp4|webm|mov)$/i.test(src)) {
            return '<video class="album-img" src="' + src + '" controls playsinline preload="metadata"></video>';
          }
          return '<img class="album-img" src="' + src + '" alt="" draggable="false">';
        }).join("") +
      "</div>" +
      (album.length > 1 ? '<div class="album-dots">' + album.map((_, i) => '<span class="dot' + (i === 0 ? " on" : "") + '" data-dot="' + i + '"></span>').join("") + "</div>" : "") +
    "</div>" +
    '<div class="detail-body">' +
      '<div class="author-row">' +
        '<div class="avatar lg" style="background:' + post.avColor + '">' + post.avatar + "</div>" +
        '<span class="nm">' + esc(post.author) + "</span>" +
        '<button class="follow-btn" id="followBtn">关注</button>' +
      "</div>" +
      '<div class="title-x">' + esc(post.title) + "</div>" +
      renderBody() +
    "</div>" +
    '<div class="comments" id="comments"><h3>共 <span id="cmtTotal">' + totalComments() + "</span> 条评论</h3>" +
      '<div id="cmtList">' + renderComments() + "</div>" +
    "</div>";

  document.getElementById("detail").innerHTML = html;

  // ---- 相册滑动（指针拖拽 + 圆点 + 键盘，兼容手机触摸）----
  const albumEl = document.getElementById("album");
  const track = document.getElementById("albumTrack");
  const dots = albumEl.querySelectorAll(".dot");
  const n = album.length;
  let cur = 0;

  function setDots() { dots.forEach((d, k) => d.classList.toggle("on", k === cur)); }
  function go(i, animate) {
    cur = Math.max(0, Math.min(n - 1, i));
    track.style.transition = animate === false ? "none" : "transform .28s ease";
    track.style.transform = "translateX(" + (-cur * 100) + "%)";
    setDots();
  }
  go(0, false);

  // 拖拽（Pointer Events 同时覆盖鼠标与触摸）
  let dragging = false, startX = 0, dx = 0, dragOnVideo = false;
  albumEl.addEventListener("pointerdown", function (e) {
    if (n <= 1) return;
    dragOnVideo = e.target.tagName === "VIDEO";
    if (dragOnVideo) return; // 不干扰视频控制条
    dragging = true; startX = e.clientX; dx = 0;
    track.style.transition = "none";
    albumEl.setPointerCapture(e.pointerId);
  });
  albumEl.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    dx = e.clientX - startX;
    track.style.transform = "translateX(calc(" + (-cur * 100) + "% + " + dx + "px))";
  });
  function endDrag() {
    if (!dragging) return;
    dragging = false;
    if (dx <= -50 && cur < n - 1) go(cur + 1);
    else if (dx >= 50 && cur > 0) go(cur - 1);
    else go(cur); // 弹回
    dx = 0;
  }
  albumEl.addEventListener("pointerup", endDrag);
  albumEl.addEventListener("pointercancel", endDrag);

  // 鼠标滚轮横向翻页（触控板左右滑）
  let wheelLock = false;
  albumEl.addEventListener("wheel", function (e) {
    if (n <= 1 || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    if (wheelLock) return;
    wheelLock = true;
    go(cur + (e.deltaX > 0 ? 1 : -1));
    setTimeout(() => wheelLock = false, 350);
  }, { passive: false });

  // 键盘左右
  document.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight" && cur < n - 1) go(cur + 1);
    if (e.key === "ArrowLeft" && cur > 0) go(cur - 1);
  });

  // 圆点点击
  dots.forEach(d => d.addEventListener("click", () => go(+d.dataset.dot)));

  // 图片加载失败占位
  albumEl.querySelectorAll("img.album-img").forEach(im => im.addEventListener("error", function () {
    const d = document.createElement("div"); d.className = "img-fallback"; d.style.height = "300px"; d.textContent = post.title; im.replaceWith(d);
  }));

  // ---- 评论点赞 / 展开回复（事件委托）----
  const cmtList = document.getElementById("cmtList");
  function bindLikeBase() {
    document.querySelectorAll("[data-like]").forEach(el => {
      const key = el.dataset.like;
      let base = 0;
      const m = key.match(/^c(\d+)(?:-r(\d+))?$/);
      if (m) {
        const c = sortedComments[+m[1]];
        if (c) base = m[2] !== undefined ? (c.replies && c.replies[+m[2]] ? c.replies[+m[2]].likes || 0 : 0) : (c.likes || 0);
      } else {
        const pm = key.match(/^p(\d+)$/);
        if (pm) { const idx = posted.length - 1 - (+pm[1]); base = (posted[idx] && posted[idx].likes) || 0; }
      }
      el.dataset.base = base;
    });
  }
  bindLikeBase();

  cmtList.addEventListener("click", function (e) {
    const likeEl = e.target.closest("[data-like]");
    if (likeEl) {
      const key = likeEl.dataset.like;
      const on = !clkLike[key];
      clkLike[key] = on;
      localStorage.setItem(LS_LIKE, JSON.stringify(clkLike));
      const base = Number(likeEl.dataset.base || 0);
      const lk = likeEl.querySelector(".lk"); if (lk) lk.textContent = fmt(base + (on ? 1 : 0));
      likeEl.classList.toggle("on", on);
      const hk = likeEl.querySelector(".hk"); if (hk) hk.textContent = on ? "❤️" : "♡";
      return;
    }
    const tog = e.target.closest(".c-reply-toggle");
    if (tog) {
      const rep = document.querySelector('[data-replies="' + tog.dataset.key + '"]');
      if (rep) {
        const open = rep.classList.toggle("open");
        tog.textContent = open ? "收起回复 ∧" : "展开 " + rep.childElementCount + " 条回复 ›";
      }
    }
  });

  // ---- 受访者发布评论 ----
  const input = document.getElementById("cmtInput");
  function postComment() {
    const txt = (input.value || "").trim();
    if (!txt) return;
    const c = { user: "我", avatar: "🙂", avColor: "#bbf7d0", text: txt, meta: "刚刚", likes: 0, mine: true };
    posted.push(c);
    localStorage.setItem(LS_POST, JSON.stringify(posted));
    cmtList.innerHTML = renderComments();
    bindLikeBase();
    document.getElementById("cmtTotal").textContent = totalComments();
    const cc = document.getElementById("cmtCnt"); if (cc) cc.textContent = totalComments();
    input.value = "";
  }
  input.addEventListener("keydown", function (e) { if (e.key === "Enter") postComment(); });

  // ---- 顶部返回（返回来源发现页，不显示组标识）----
  document.getElementById("backBtn").addEventListener("click", function () { location.href = from + ".html"; });
  const cmtCnt = document.getElementById("cmtCnt"); if (cmtCnt) cmtCnt.textContent = totalComments();

  // ---- 底部操作栏（点赞 / 收藏）----
  const likeAct = document.getElementById("likeAct");
  const starAct = document.getElementById("starAct");
  const likeCnt = document.getElementById("likeCnt");
  const starCnt = document.getElementById("starCnt");
  likeCnt.textContent = fmt(post.likes); starCnt.textContent = fmt(post.stars);
  likeAct.addEventListener("click", function () {
    liked = !liked; likeAct.classList.toggle("liked", liked);
    likeAct.querySelector(".ic").textContent = liked ? "❤️" : "🤍";
    likeCnt.textContent = fmt(post.likes + (liked ? 1 : 0));
  });
  starAct.addEventListener("click", function () {
    starred = !starred; starAct.classList.toggle("starred", starred);
    starAct.querySelector(".ic").textContent = starred ? "⭐" : "☆";
    starCnt.textContent = fmt(post.stars + (starred ? 1 : 0));
  });
  const followBtn = document.getElementById("followBtn");
  followBtn.addEventListener("click", function () {
    following = !following; followBtn.classList.toggle("following", following);
    followBtn.textContent = following ? "已关注" : "关注";
  });

  document.addEventListener("keydown", function (e) { if (e.key === "Escape") location.href = from + ".html"; });
})();
