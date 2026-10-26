/* 发现页逻辑：读取 window.POSTS，渲染双列瀑布流
   分组由页面内置变量 window.__GROUP 决定，渲染对应信息流
   页面仅做正常信息流展示 */

(function () {
  // 当前信息流由 __GROUP 变量确定（不读 URL 参数）
  const group = (window.__GROUP || "A").toUpperCase() === "B" ? "B" : "A";

  // 帖子展示顺序（抓取完成后自动填充）
  const ORDER = window.__ORDER || [];

  // 按帖子自身的展示范围字段决定是否在当前信息流展示
  const byId = {};
  (window.POSTS || []).forEach(p => (byId[p.id] = p));

  const feed = (ORDER.length ? ORDER : Object.keys(byId))
    .map(id => byId[id])
    .filter(p => p && (p.groups || ["A", "B"]).includes(group));

  // ---- 工具 ----
  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
  function fmt(n) {
    if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, "") + "w";
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    return String(n);
  }
  function imgFallback(img, label) {
    img.addEventListener("error", function () {
      const d = document.createElement("div");
      d.className = "img-fallback";
      d.style.height = (img.dataset.h || 240) + "px";
      d.textContent = label || "图片";
      img.replaceWith(d);
    });
  }

  // ---- 渲染卡片 ----
  const feedEl = document.getElementById("feed");
  feed.forEach(p => {
    const card = document.createElement("div");
    // 注意力检测帖：保持正常排版，仅加一个很淡的 css 标识，不抢眼
    const isAttn = p.cat === "attention";
    card.className = "card" + (isAttn ? " cat-attention" : "");
    card.dataset.id = p.id;
    const h = p.coverH || 300;
    card.innerHTML =
      '<img class="cover" src="' + p.cover + '" data-h="' + h + '" alt="" loading="lazy">' +
      '<div class="info">' +
        '<div class="title">' + esc(p.title) + "</div>" +
        '<div class="meta">' +
          '<div class="author"><span class="avatar" style="background:' + p.avColor + '">' + p.avatar + "</span>" +
            '<span class="nm">' + esc(p.author) + "</span></div>" +
          '<div class="like"><span class="ic">🤍</span>' + fmt(p.likes) + "</div>" +
        "</div>" +
      "</div>";
    imgFallback(card.querySelector(".cover"), p.title);
    card.addEventListener("click", function () {
      // 记住离开时视口顶部那张卡（锚点），而不是像素位置
      try {
        const cs = Array.prototype.slice.call(document.querySelectorAll(".card"));
        for (let i = 0; i < cs.length; i++) {
          const r = cs[i].getBoundingClientRect();
          if (r.bottom > 8) {
            sessionStorage.setItem("xhs_scroll_" + group,
              JSON.stringify({ id: cs[i].dataset.id, off: Math.round(r.top) }));
            break;
          }
        }
      } catch (e) {}
      location.href = "detail.html?id=" + p.id + "&from=" + group.toLowerCase();
    });
    feedEl.appendChild(card);
  });

  // 返回时按『锚点卡片』恢复位置。
  // 封面 lazy-load 会持续改变上方布局，所以每次重试都按该卡片当时的真实位置重新对齐，
  // 而不是只滚到一个固定像素（后者会被后续加载的图片带偏）。
  try {
    const k = "xhs_scroll_" + group;
    const raw = sessionStorage.getItem(k);
    if (raw !== null) {
      sessionStorage.removeItem(k);
      let anchor = null;
      try { anchor = JSON.parse(raw); } catch (e) { anchor = null; }

      if (anchor && anchor.id) {
        let tries = 0, done = false;
        // 用户一旦自己滚动，立即停止自动对齐
        const stop = function () { done = true; };
        window.addEventListener("wheel", stop, { passive: true });
        window.addEventListener("touchstart", stop, { passive: true });
        const tick = function () {
          if (done) return;
          const el = document.querySelector('.card[data-id="' + anchor.id + '"]');
          if (el) {
            const y = Math.round(el.getBoundingClientRect().top + window.scrollY - anchor.off);
            if (y > 0) window.scrollTo(0, y);
          }
          tries++;
          if (tries >= 30) { done = true; return; }
          setTimeout(tick, 100);
        };
        tick();
        window.addEventListener("load", function () { setTimeout(tick, 60); });
      } else if (Number(raw) > 0) {
        window.scrollTo(0, Number(raw));   // 兼容旧版存的纯数字
      }
    }
  } catch (e) {}
})();
