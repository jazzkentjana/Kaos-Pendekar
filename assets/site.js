/* Pendekar Juara showcase.
   Data comes from site/data.json, which scripts/build_site.py makes from listings/log.csv.
   Routes:  #/  homepage   ·   #/katalog  list   ·   #/kaos/<slug>  product page */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const body = document.body;
  const mq = matchMedia("(max-width: 767px)");
  const EASE = "cubic-bezier(.7,0,.2,1)";
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

  const S = {
    data: null, items: [], bySlug: {},
    cam: { x: 0, y: 0 }, world: { w: 0, h: 0 },
    tiles: [], flown: null, internal: false,
    listSort: "date", listQuery: "", mobileBuilt: false, listBuilt: false,
  };

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const rupiah = (n) => "Rp" + n.toLocaleString("id-ID");
  const shortDate = (d) => { const [y, m, day] = d.split("-").map(Number); return `${day} ${MONTHS[m - 1]} ${y}`; };
  const monthLabel = (d) => { const [y, m] = d.split("-").map(Number); return `${MONTHS[m - 1]} ${y}`; };

  function mulberry32(a) {
    return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  function matches(item, q) {
    if (!q) return true;
    return q.split(" ").every((w) => item._hay.includes(w));
  }

  /* ---------- Giant titles: one line, scaled to fit; very long hooks wrap to two ---------- */
  function fitGiant(el, text) {
    el.innerHTML = `<span>${esc(text)}</span>`;
    el.classList.remove("wrap");
    const span = el.firstChild;
    const maxW = innerWidth * 0.96;
    let fs = Math.min(innerWidth * 0.16, innerHeight * 0.24);
    el.style.fontSize = fs + "px";
    const w = span.getBoundingClientRect().width;
    if (w > maxW) fs *= maxW / w;
    if (fs < innerWidth * 0.07 && text.length > 14) {
      el.classList.add("wrap");
      fs = Math.min(innerWidth * 0.12, innerHeight * 0.17);
      el.style.fontSize = fs + "px";
      let guard = 0;
      while (el.getBoundingClientRect().height > fs * 0.9 * 2 && guard++ < 40) {
        fs *= 0.94;
        el.style.fontSize = fs + "px";
      }
    } else {
      el.style.fontSize = fs + "px";
    }
  }

  /* ---------- Desktop canvas ---------- */
  const canvas = $("#canvas-view");
  const worldEl = $("#world");
  const hoverTitle = $("#hover-title");
  const cursor = $("#cursor");
  const hint = $("#hint");

  function buildCanvas() {
    const items = S.items;
    const rnd = mulberry32(20261014);
    const N = items.length;
    const cellW = 390, cellH = 360, pad = 170;
    const cols = Math.max(3, Math.ceil(Math.sqrt(N * 1.45)));
    const rows = Math.ceil(N / cols) + (N > 12 ? 1 : 0);
    S.world.w = cols * cellW + pad * 2;
    S.world.h = rows * cellH + pad * 2;
    worldEl.style.width = S.world.w + "px";
    worldEl.style.height = S.world.h + "px";

    // Newest shirts land nearest the middle; noise keeps it from looking like rings.
    const ccx = (cols - 1) / 2, ccy = (rows - 1) / 2;
    const cells = [];
    for (let i = 0; i < cols * rows; i++) {
      const cx = i % cols, cy = Math.floor(i / cols);
      cells.push({ cx, cy, d: Math.hypot((cx - ccx) * 1.0, (cy - ccy) * 1.25) + rnd() * 1.4 });
    }
    cells.sort((a, b) => a.d - b.d);

    worldEl.innerHTML = "";
    S.tiles = items.map((it, k) => {
      const c = cells[k];
      const ar = it.tile.h / it.tile.w;
      const roll = rnd();
      let w = roll < 0.22 ? 290 + rnd() * 90 : roll < 0.75 ? 185 + rnd() * 75 : 115 + rnd() * 55;
      if (w * ar > 370) w = 370 / ar;
      const h = w * ar;
      const x = pad + c.cx * cellW + rnd() * Math.max(8, cellW - w * 0.8);
      const y = pad + c.cy * cellH + rnd() * Math.max(8, cellH - h * 0.8);
      const a = document.createElement("a");
      a.className = "tile";
      a.href = "#/kaos/" + encodeURIComponent(it.slug);
      a.style.cssText = `left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;width:${w.toFixed(0)}px;height:${h.toFixed(0)}px`;
      a.dataset.slug = it.slug;
      a.setAttribute("aria-label", it.hook);
      a.innerHTML = `<img src="${it.tile.src}" alt="" width="${it.tile.w}" height="${it.tile.h}" decoding="async" draggable="false">`;
      worldEl.appendChild(a);
      return a;
    });
    centerCamera();
  }

  function clampCam() {
    const vw = innerWidth, vh = innerHeight;
    const { w, h } = S.world;
    if (w <= vw) S.cam.x = (w - vw) / 2;
    else S.cam.x = Math.min(Math.max(S.cam.x, -vw * 0.2), w - vw * 0.8);
    if (h <= vh) S.cam.y = (h - vh) / 2;
    else S.cam.y = Math.min(Math.max(S.cam.y, -vh * 0.2), h - vh * 0.8);
  }
  function applyCam() {
    clampCam();
    worldEl.style.transform = `translate3d(${-S.cam.x}px, ${-S.cam.y}px, 0)`;
  }
  function centerCamera() {
    S.cam.x = (S.world.w - innerWidth) / 2;
    S.cam.y = (S.world.h - innerHeight) / 2 - 20;
    applyCam();
  }

  // Drag, inertia, wheel / trackpad panning
  let drag = null, moved = false, inertia = 0;
  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !body.classList.contains("r-home")) return;
    cancelAnimationFrame(inertia);
    drag = { x: e.clientX, y: e.clientY, cx: S.cam.x, cy: S.cam.y, vx: 0, vy: 0, t: performance.now(), lx: e.clientX, ly: e.clientY };
    moved = false;
  });
  addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse") cursor.style.translate = `${e.clientX}px ${e.clientY}px`;
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!moved && Math.hypot(dx, dy) > 6) { moved = true; canvas.classList.add("dragging"); hideHint(); }
    if (!moved) return;
    const now = performance.now(), dt = Math.max(1, now - drag.t);
    drag.vx = (e.clientX - drag.lx) / dt; drag.vy = (e.clientY - drag.ly) / dt;
    drag.lx = e.clientX; drag.ly = e.clientY; drag.t = now;
    S.cam.x = drag.cx - dx; S.cam.y = drag.cy - dy;
    applyCam();
  });
  addEventListener("pointerup", () => {
    if (!drag) return;
    canvas.classList.remove("dragging");
    if (moved) {
      let vx = drag.vx * 16, vy = drag.vy * 16;
      const step = () => {
        vx *= 0.93; vy *= 0.93;
        S.cam.x -= vx; S.cam.y -= vy; applyCam();
        if (Math.hypot(vx, vy) > 0.3) inertia = requestAnimationFrame(step);
      };
      if (performance.now() - drag.t < 80) inertia = requestAnimationFrame(step);
    }
    drag = null;
  });
  canvas.addEventListener("wheel", (e) => {
    if (!body.classList.contains("r-home")) return;
    e.preventDefault();
    cancelAnimationFrame(inertia);
    S.cam.x += e.deltaX; S.cam.y += e.deltaY;
    applyCam(); hideHint();
  }, { passive: false });

  function hideHint() { hint.classList.add("gone"); }

  // Hover: tile grows, hook fills the bottom of the screen, "Lihat" circle follows the pointer
  worldEl.addEventListener("pointerover", (e) => {
    const t = e.target.closest(".tile");
    if (!t || S.flown) return;
    showHover(t);
  });
  worldEl.addEventListener("pointerout", (e) => {
    const t = e.target.closest(".tile");
    if (!t || (e.relatedTarget && t.contains(e.relatedTarget))) return;
    hideHover();
  });
  worldEl.addEventListener("focusin", (e) => { const t = e.target.closest(".tile"); if (t) showHover(t, true); });
  worldEl.addEventListener("focusout", hideHover);
  function showHover(t, keyboard) {
    const it = S.bySlug[t.dataset.slug];
    fitGiant(hoverTitle, it.hook);
    hoverTitle.classList.add("on");
    worldEl.classList.add("has-hover");
    if (!keyboard) cursor.classList.add("on");
  }
  function hideHover() {
    if (S.flown) return;
    hoverTitle.classList.remove("on");
    worldEl.classList.remove("has-hover");
    cursor.classList.remove("on");
  }

  worldEl.addEventListener("click", (e) => {
    const t = e.target.closest(".tile");
    if (!t) return;
    e.preventDefault();
    if (moved) { moved = false; return; }
    flyTo(t);
  });

  function heroRect() {
    const size = Math.min(innerHeight * 0.68, innerWidth * 0.78);
    return { left: (innerWidth - size) / 2, top: innerHeight * 0.11, width: size, height: size };
  }

  // Homepage → product: other shirts pile into the middle, the clicked one grows into place
  function flyTo(tile) {
    const it = S.bySlug[tile.dataset.slug];
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { go("#/kaos/" + it.slug); return; }
    S.flown = { tile, anims: [] };
    cursor.classList.remove("on");
    worldEl.classList.remove("has-hover");
    const vcx = innerWidth / 2, vcy = innerHeight * 0.45;
    const rnd = mulberry32(it.slug.length * 97);
    S.tiles.forEach((t) => {
      if (t === tile) return;
      const r = t.getBoundingClientRect();
      const dx = vcx - (r.left + r.width / 2) + (rnd() - 0.5) * 60;
      const dy = vcy - (r.top + r.height / 2) + (rnd() - 0.5) * 50;
      S.flown.anims.push(t.animate(
        [{ transform: "none", opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(.5)`, opacity: 0 }],
        { duration: 700, easing: EASE, fill: "forwards", delay: rnd() * 90 }
      ));
    });
    const img = tile.querySelector("img");
    const r = img.getBoundingClientRect();
    const clone = img.cloneNode();
    clone.className = "fly";
    Object.assign(clone.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
    body.appendChild(clone);
    tile.style.visibility = "hidden";
    const h = heroRect();
    const a = clone.animate(
      [{ left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" },
       { left: h.left + "px", top: h.top + "px", width: h.width + "px", height: h.height + "px" }],
      { duration: 760, easing: EASE, fill: "forwards" }
    );
    a.onfinish = () => {
      go("#/kaos/" + it.slug);
      requestAnimationFrame(() => requestAnimationFrame(() => clone.remove()));
    };
  }

  // Product → homepage: shirts fly back out of the pile
  function unfly() {
    const f = S.flown;
    if (!f) return;
    S.flown = null;
    hoverTitle.classList.remove("on");
    f.tile.style.visibility = "";
    f.tile.animate([{ transform: "scale(.6)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 500, easing: EASE });
    f.anims.forEach((a) => {
      a.reverse();
      a.onfinish = () => a.cancel();
    });
  }

  /* ---------- Product page ---------- */
  const pView = $("#product-view");
  const pStack = $("#p-stack");
  const pTitle = $("#p-title");
  const pInfo = $("#p-info");
  const pInfoBtn = $("#p-info-btn");
  const OFFSETS = [0, -15, 13, -7, 16, -11, 6];
  let current = null;

  function openProduct(it) {
    current = it;
    document.title = `${it.hook} — Pendekar Juara`;
    $("#p-buy").href = it.shopee;
    $("#i-buy").href = it.shopee;
    $("#i-hook").textContent = it.hook;
    $("#i-topic").textContent = it.topic;
    $("#i-lines").innerHTML = it.lines.map((l) => `<li>${esc(l)}</li>`).join("");
    $("#i-price").innerHTML = S.data.prices.map((p) => `<tr><td>${esc(p.sizes)}</td><td>${rupiah(p.price)}</td></tr>`).join("");
    $("#i-sizes").innerHTML = S.data.sizes.map((s) => `<span>${s}</span>`).join("");
    $("#i-chart").href = S.data.sizeChart;
    setColor("all");

    const mobile = mq.matches;
    const cards = [`<figure class="card hero" style="--top:11vh;--top-m:14vh" data-color="all"><img src="${it.tile.src}" alt="${esc(it.hook)}, kaos hitam"></figure>`];
    it.images.slice(1).forEach((im, i) => {
      const off = OFFSETS[(i + 1) % OFFSETS.length] * (mobile ? 0.12 : 1);
      const label = `${it.hook}, ${im.kind === "model" ? "dipakai model" : "foto produk"}, ${im.color === "black" ? "hitam" : "putih"}`;
      cards.push(`<figure class="card" style="--top:${11 + (i + 1) * 1.4}vh;--top-m:${14 + (i + 1) * 1.2}vh;translate:${off}vw 0" data-color="${im.color}"><img src="${im.src}" alt="${esc(label)}" loading="lazy" decoding="async"></figure>`);
    });
    pStack.innerHTML = cards.join("");
    setInfo(false);
    pView.hidden = false;
    pView.classList.remove("enter");
    if (!S.flown) { void pView.offsetWidth; pView.classList.add("enter"); }
    pView.scrollTop = 0;
    fitGiant(pTitle, it.hook);
    pView.focus({ preventScroll: true });
  }
  function closeProductView() {
    if (pView.hidden) return;
    pView.hidden = true;
    current = null;
    document.title = "Pendekar Juara — Kaos Meme Viral";
  }
  function setInfo(open) {
    pInfo.classList.toggle("open", open);
    pInfo.setAttribute("aria-hidden", String(!open));
    pInfoBtn.setAttribute("aria-expanded", String(open));
  }
  function setColor(c) {
    $$("#i-colors button").forEach((b) => b.classList.toggle("on", b.dataset.color === c));
    $$(".card", pStack).forEach((card) => {
      const cc = card.dataset.color;
      card.classList.toggle("off", c !== "all" && cc !== "all" && cc !== c);
    });
  }
  pInfoBtn.addEventListener("click", () => setInfo(!pInfo.classList.contains("open")));
  $("#i-colors").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) { setColor(b.dataset.color); pView.scrollTo({ top: 0, behavior: "smooth" }); }
  });
  $("#p-close").addEventListener("click", closeProduct);
  addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || pView.hidden) return;
    if (pInfo.classList.contains("open")) setInfo(false); else closeProduct();
  });
  pStack.addEventListener("click", () => setInfo(false));
  function closeProduct() {
    if (S.internal && history.length > 1) history.back();
    else go("#/");
  }

  /* ---------- Catalog list ---------- */
  const listBody = $("#list-body");
  const peek = $("#list-peek");

  function renderList() {
    const q = norm(S.listQuery);
    let items = S.items.filter((it) => matches(it, q));
    if (S.listSort === "hook") items = [...items].sort((a, b) => a.hook.localeCompare(b.hook, "id"));
    if (S.listSort === "topic") items = [...items].sort((a, b) => a.topic.localeCompare(b.topic, "id"));
    const groups = [];
    if (S.listSort === "date") {
      items.forEach((it) => {
        const label = monthLabel(it.date);
        const g = groups[groups.length - 1];
        if (g && g.label === label) g.items.push(it); else groups.push({ label, items: [it] });
      });
    } else if (items.length) {
      groups.push({ label: S.listSort === "hook" ? "A–Z" : "Topik", items });
    }
    listBody.innerHTML = groups.map((g) => `
      <div class="group">
        <div class="group-label">${esc(g.label)}</div>
        <div class="group-rows">${g.items.map((it) => `
          <a class="row" href="#/kaos/${encodeURIComponent(it.slug)}" data-slug="${esc(it.slug)}">
            <span class="r-hook">${esc(it.hook)}</span>
            <span class="r-topic">${esc(it.topic)}</span>
            <span class="r-date">${shortDate(it.date)}</span>
          </a>`).join("")}
        </div>
      </div>`).join("");
    $("#list-empty").hidden = items.length > 0;
  }
  $("#list-search").addEventListener("input", (e) => { S.listQuery = e.target.value; renderList(); });
  $$(".list-head button").forEach((b) => b.addEventListener("click", () => {
    S.listSort = b.dataset.sort;
    $$(".list-head button").forEach((x) => x.classList.toggle("active", x === b));
    renderList();
  }));
  listBody.addEventListener("pointerover", (e) => {
    const row = e.target.closest(".row");
    if (!row || e.pointerType !== "mouse") return;
    const it = S.bySlug[row.dataset.slug];
    const r = row.getBoundingClientRect();
    if (!peek.src.endsWith(it.tile.src)) peek.src = it.tile.src;
    peek.style.top = Math.min(Math.max(r.top + r.height / 2, 140), innerHeight - 140) + "px";
    peek.classList.add("on");
  });
  listBody.addEventListener("pointerleave", () => peek.classList.remove("on"));
  $("#list-view").addEventListener("scroll", () => peek.classList.remove("on"), { passive: true });

  /* ---------- Mobile homepage ---------- */
  function burstPath(spikes = 14, outer = 50, inner = 41) {
    let d = "";
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 ? inner : outer;
      const a = (Math.PI * i) / spikes - Math.PI / 2;
      d += `${i ? "L" : "M"}${(50 + r * Math.cos(a)).toFixed(2)} ${(50 + r * Math.sin(a)).toFixed(2)}`;
    }
    return d + "Z";
  }
  function buildMobile() {
    if (S.mobileBuilt) return;
    S.mobileBuilt = true;
    const path = burstPath();
    const pos = [
      { right: "-6vw", top: "11svh", w: 38, rot: 9 },
      { right: "4vw", bottom: "16svh", w: 30, rot: -7 },
      { left: "-5vw", bottom: "3svh", w: 33, rot: 6 },
      { right: "-10vw", top: "44svh", w: 26, rot: -12 },
    ];
    $("#m-float").innerHTML = S.items.slice(0, pos.length).map((it, i) => {
      const p = pos[i];
      const place = Object.entries(p).filter(([k]) => ["left", "right", "top", "bottom"].includes(k)).map(([k, v]) => `${k}:${v}`).join(";");
      return `<img src="${it.tile.src}" alt="" style="${place};width:${p.w}vw;rotate:${p.rot}deg;animation-delay:${-i * 1.4}s">`;
    }).join("");
    $("#m-cards").innerHTML = S.items.map((it) => {
      const n = it.hook.length;
      const fs = n <= 6 ? 13 : n <= 12 ? 10 : n <= 20 ? 8.2 : n <= 30 ? 6.8 : 5.8;
      return `<a class="m-card" href="#/kaos/${encodeURIComponent(it.slug)}" data-slug="${esc(it.slug)}">
        <div class="burst"><svg viewBox="0 0 100 100" aria-hidden="true"><path d="${path}"/></svg><span style="font-size:min(${fs}vw, ${fs * 4.6}px)">${esc(it.hook)}</span></div>
        <img src="${it.tile.src}" alt="${esc(it.hook)}" loading="lazy" decoding="async">
        <span class="m-price">${rupiah(89000)} – ${rupiah(99000)}</span>
        <span class="m-go">Lihat →</span>
      </a>`;
    }).join("");
    setStickyH();
  }
  function setStickyH() {
    const h = $(".m-sticky").getBoundingClientRect().height;
    if (h) $("#m-cards").style.setProperty("--sticky-h", h + "px");
  }
  $("#m-search").addEventListener("input", (e) => {
    const q = norm(e.target.value);
    let shown = 0;
    $$(".m-card").forEach((c) => {
      const ok = matches(S.bySlug[c.dataset.slug], q);
      c.hidden = !ok; shown += ok;
    });
    $("#m-empty").hidden = shown > 0;
  });
  $("#m-cta").addEventListener("click", (e) => {
    e.preventDefault();
    const mv = $("#mobile-view");
    mv.scrollTo({ top: $("#koleksi").offsetTop, behavior: "smooth" });
  });

  /* ---------- Router ---------- */
  function go(hash) { S.internal = true; location.hash = hash; }
  addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#/"]');
    if (a && !e.defaultPrevented) S.internal = true;
  });

  function route() {
    const h = location.hash.replace(/^#/, "") || "/";
    const m = h.match(/^\/kaos\/([^/?#]+)/);
    body.classList.remove("r-home", "r-list", "r-product");
    if (m) {
      const it = S.bySlug[decodeURIComponent(m[1])];
      if (!it) { location.replace("#/"); return; }
      body.classList.add("r-product");
      openProduct(it);
      return;
    }
    closeProductView();
    if (h.startsWith("/katalog")) {
      body.classList.add("r-list");
      if (!S.listBuilt) { S.listBuilt = true; renderList(); }
      $("#list-view").scrollTop = 0;
      return;
    }
    body.classList.add("r-home");
    if (S.flown) requestAnimationFrame(unfly);
  }

  function setMode() {
    body.classList.toggle("is-mobile", mq.matches);
    if (mq.matches) buildMobile();
  }

  let rz = 0;
  addEventListener("resize", () => {
    cancelAnimationFrame(rz);
    rz = requestAnimationFrame(() => {
      applyCam();
      setStickyH();
      if (current) fitGiant(pTitle, current.hook);
    });
  });
  mq.addEventListener("change", setMode);
  addEventListener("hashchange", route);

  fetch("site/data.json")
    .then((r) => r.json())
    .then((data) => {
      S.data = data;
      S.items = data.items.map((it) => ({ ...it, _hay: norm([it.hook, it.topic, it.lines.join(" "), it.slug].join(" ")) }));
      S.items.forEach((it) => (S.bySlug[it.slug] = it));
      $("#count").textContent = `(${S.items.length})`;
      $("#m-count").textContent = S.items.length;
      $("#shop-link").href = data.shop;
      buildCanvas();
      setMode();
      route();
    })
    .catch((err) => {
      console.error(err);
      document.body.insertAdjacentHTML("beforeend", '<p style="position:fixed;top:45%;width:100%;text-align:center">Katalog gagal dimuat. Coba muat ulang halaman.</p>');
    });
})();
