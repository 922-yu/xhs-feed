/* 发现页逻辑：读取 window.POSTS，按所在页面组别渲染双列瀑布流
   分组由页面内置变量 window.__GROUP 决定（'A' 低金融占比 / 'B' 高金融占比）
   页面上不显示任何组标识与金融占比说明，仅做正常信息流展示 */

(function () {
  // 组别来自页面自身设置的变量（不再读 URL 参数、不再有切换开关）
  const group = (window.__GROUP || "A").toUpperCase() === "B" ? "B" : "A";

  // 帖子天然展示顺序（两组内容顺序一致，仅金融帖曝光数量不同）
  const ORDER = window.__ORDER || [];

  // 按每篇帖子的 groups 字段决定本组是否展示
  // A 组：中性1-20 + 女性9 + 男性9 + 金融2(39,40) = 40
  // B 组：中性1-14 + 女性9 + 男性9 + 金融8(39-46) = 40
  // 即中性15-20 仅A；金融41-46 仅B；其余两组都有
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
    card.className = "card";
    card.dataset.id = p.id;
    const h = p.coverH || 300;
    card.innerHTML =
      '<img class="cover" src="' + p.cover + '" data-h="' + h + '" alt="">' +
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
      location.href = "detail.html?id=" + p.id + "&from=" + group.toLowerCase();
    });
    feedEl.appendChild(card);
  });
})();
