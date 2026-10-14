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
    const cellW = 290, cellH = 265, pad = 50;
    const cols = Math.max(3, Math.ceil(Math.sqrt(N * 1.45)));
    const rows = Math.ceil(N / cols);
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
      let w = roll < 0.2 ? 255 + rnd() * 70 : roll < 0.75 ? 175 + rnd() * 60 : 120 + rnd() * 45;
      if (w * ar > 320) w = 320 / ar;
      const h = w * ar;
      const x = pad + c.cx * cellW + (rnd() - 0.15) * Math.max(8, cellW - w * 0.6);
      const y = pad + c.cy * cellH + (rnd() - 0.15) * Math.max(8, cellH - h * 0.6);
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
    S.cam.y = (S.world.h - innerHeight) / 2;
    follow.tx = S.cam.x; follow.ty = S.cam.y;
    applyCam();
  }

  // Mouse: the canvas follows the pointer with an eased lag (Snog style); edges of the
  // screen map to edges of the canvas, so it feels bounded.
  // Touch / pen: drag with inertia.
  const follow = { tx: 0, ty: 0, raf: 0 };
  const EDGE = 0.1; // outer 10% of the screen already reaches the canvas edge
  function followLoop() {
    const dx = follow.tx - S.cam.x, dy = follow.ty - S.cam.y;
    S.cam.x += dx * 0.06; S.cam.y += dy * 0.06;
    applyCam();
    updateHot();
    follow.raf = Math.hypot(dx, dy) > 0.4 ? requestAnimationFrame(followLoop) : 0;
  }
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || !body.classList.contains("r-home") || S.flown) return;
    const u = Math.min(1, Math.max(0, (e.clientX / innerWidth - EDGE) / (1 - 2 * EDGE)));
    const v = Math.min(1, Math.max(0, (e.clientY / innerHeight - EDGE) / (1 - 2 * EDGE)));
    const vw = innerWidth, vh = innerHeight;
    follow.tx = u * (S.world.w - vw);
    follow.ty = -vh * 0.06 + v * (S.world.h - vh + vh * 0.06);
    if (!follow.raf) follow.raf = requestAnimationFrame(followLoop);
    if (Math.abs(u - 0.5) > 0.15 || Math.abs(v - 0.5) > 0.15) hideHint();
  });

  let drag = null, moved = false, inertia = 0;
  canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" || !body.classList.contains("r-home")) return;
    cancelAnimationFrame(inertia);
    drag = { x: e.clientX, y: e.clientY, cx: S.cam.x, cy: S.cam.y, vx: 0, vy: 0, t: performance.now(), lx: e.clientX, ly: e.clientY };
    moved = false;
  });
  addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse") cursor.style.translate = `${e.clientX}px ${e.clientY}px`;
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!moved && Math.hypot(dx, dy) > 6) { moved = true; hideHint(); }
    if (!moved) return;
    const now = performance.now(), dt = Math.max(1, now - drag.t);
    drag.vx = (e.clientX - drag.lx) / dt; drag.vy = (e.clientY - drag.ly) / dt;
    drag.lx = e.clientX; drag.ly = e.clientY; drag.t = now;
    S.cam.x = drag.cx - dx; S.cam.y = drag.cy - dy;
    applyCam();
  });
  addEventListener("pointerup", () => {
    if (!drag) return;
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

  let hintLocked = true; // the hint stays until its intro animation has played
  function hideHint() { if (!hintLocked) hint.classList.add("gone"); }

  // Hover is worked out from the point under the mouse every frame, because the canvas
  // keeps moving under a still cursor and :hover would go stale.
  let hot = null;
  const mouse = { x: -1, y: -1 };
  function updateHot() {
    if (S.flown || mouse.x < 0) return;
    const el = document.elementFromPoint(mouse.x, mouse.y);
    const t = el && el.closest ? el.closest(".tile") : null;
    if (t === hot) return;
    if (hot) hot.classList.remove("hot");
    hot = t;
    if (t) { t.classList.add("hot"); showHover(t); } else hideHover();
  }
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (body.classList.contains("r-home")) updateHot();
  });
  canvas.addEventListener("pointerleave", () => { mouse.x = -1; if (hot) hot.classList.remove("hot"); hot = null; hideHover(); });
  worldEl.addEventListener("focusin", (e) => { const t = e.target.closest(".tile"); if (t) showHover(t, true); });
  worldEl.addEventListener("focusout", hideHover);
  function showHover(t, keyboard) {
    const it = S.bySlug[t.dataset.slug];
    fitGiant(hoverTitle, it.hook);
    hoverTitle.classList.add("on");
    worldEl.classList.add("has-hover");
    cursor.querySelector("span").textContent = "Lihat";
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
    if (hot) hot.classList.remove("hot");
    hot = null;
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
    buildDeck(it, mobile);
    setInfo(false);
    pView.hidden = false;
    pView.classList.remove("enter");
    if (!S.flown) { void pView.offsetWidth; pView.classList.add("enter"); }
    pView.scrollTop = 0;
    fitGiant(pTitle, it.hook);
    pView.focus({ preventScroll: true });
    flyDeckIn(S.flown ? 80 : 450);
  }

  // A fan of the other photos flies up from the bottom and waits under the main picture.
  const pDeck = $("#p-deck");
  const pCue = $("#p-cue");
  function buildDeck(it, mobile) {
    const rest = it.images.slice(1);
    const n = rest.length, mid = (n - 1) / 2;
    const step = mobile ? 15 : 9.5;
    pDeck.innerHTML = rest.map((im, i) => {
      const k = i - mid;
      return `<button type="button" data-i="${i + 1}" data-color="${im.color}" aria-label="Foto ${i + 2}"
        style="--x:${(k * step).toFixed(1)}vw;--y:${(4.5 + Math.abs(k) * 1.6).toFixed(1)}vh;--r:${(k * 5).toFixed(1)}deg">
        <img src="${im.src}" alt="" decoding="async"></button>`;
    }).join("");
    $("#p-cue-text").textContent = `Scroll · ${n} foto lagi`;
    pDeck.classList.remove("away");
    pCue.classList.remove("away");
  }
  function flyDeckIn(delay) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    $$("button", pDeck).forEach((b, i) => {
      b.animate([{ translate: "0 60vh", opacity: 0 }, { translate: "0 0", opacity: 1 }],
        { duration: 750, delay: delay + i * 85, easing: "cubic-bezier(.2,.9,.25,1.15)", fill: "backwards" });
    });
    pCue.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: delay + 500, fill: "backwards" });
  }
  pDeck.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    e.stopPropagation();
    const card = $$(".card", pStack)[+b.dataset.i];
    if (!card) return;
    pStack.classList.add("measure"); // read the card's place in the flow, ignoring sticky
    const y = pStack.offsetTop + card.offsetTop;
    pStack.classList.remove("measure");
    pView.scrollTo({ top: y - parseFloat(getComputedStyle(card).top) + 2, behavior: "smooth" });
  });
  pView.addEventListener("scroll", () => {
    const away = pView.scrollTop > 24;
    pDeck.classList.toggle("away", away);
    pCue.classList.toggle("away", away);
  }, { passive: true });

  // Clicking outside the frame (as wide as the big title, never narrower than the photo) closes.
  function outsideFrame(x) {
    const span = pTitle.firstChild, hero = $(".card.hero", pStack);
    if (!span || !hero) return false;
    const a = span.getBoundingClientRect(), b = hero.getBoundingClientRect();
    return x < Math.min(a.left, b.left) || x > Math.max(a.right, b.right);
  }
  const cursorText = $("span", cursor);
  pView.addEventListener("click", (e) => {
    if (e.target.closest(".p-bar, .p-info, .p-deck")) return;
    if (pInfo.classList.contains("open")) { setInfo(false); return; }
    if (outsideFrame(e.clientX)) closeProduct();
  });
  pView.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const out = !e.target.closest(".p-bar, .p-info, .p-deck") && !pInfo.classList.contains("open") && outsideFrame(e.clientX);
    cursorText.textContent = "Tutup";
    cursor.classList.toggle("on", out);
    pView.style.cursor = out ? "none" : "";
  });
  pView.addEventListener("pointerleave", () => cursor.classList.remove("on"));
  function closeProductView() {
    if (pView.hidden) return;
    cursor.classList.remove("on");
    pView.style.cursor = "";
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
    $$("button", $("#p-deck")).forEach((b) => b.classList.toggle("off", c !== "all" && b.dataset.color !== c));
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
    S.mPath = path;
    renderMobileGrid("");
    const mv = $("#mobile-view"), sticky = $(".m-sticky");
    mv.addEventListener("scroll", () => {
      sticky.classList.toggle("compact", mv.scrollTop > $("#koleksi").offsetTop + 30);
    }, { passive: true });
  }

  // Staggered two-column grid: items alternate left/right so reading order stays newest first,
  // and the right column starts lower to keep a loose, collage feel.
  function renderMobileGrid(q) {
    const items = S.items.filter((it) => matches(it, q));
    const card = (it, i) => `<a class="m-card" href="#/kaos/${encodeURIComponent(it.slug)}" style="--tilt:${((i * 37) % 7 - 3) * 0.6}deg">
        <div class="m-pic">
          <img src="${it.tile.src}" alt="" loading="lazy" decoding="async" width="${it.tile.w}" height="${it.tile.h}">
          ${it.isNew ? `<div class="burst"><svg viewBox="0 0 100 100" aria-hidden="true"><path d="${S.mPath}"/></svg><span>Baru</span></div>` : ""}
        </div>
        <span class="m-hook">${esc(it.hook)}</span>
        <span class="m-price">Mulai ${rupiah(89000)}</span>
      </a>`;
    const left = [], right = [];
    items.forEach((it, i) => (i % 2 ? right : left).push(card(it, i)));
    $("#m-cards").innerHTML = items.length
      ? `<div class="m-col">${left.join("")}</div><div class="m-col m-col-r">${right.join("")}</div>` : "";
    $("#m-empty").hidden = items.length > 0;
  }
  $("#m-search").addEventListener("input", (e) => {
    renderMobileGrid(norm(e.target.value));
    const mv = $("#mobile-view"), top = $("#koleksi").offsetTop;
    if (mv.scrollTop > top) mv.scrollTop = top + 31;
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
    $(".nav-left").setAttribute("href", h.startsWith("/katalog") ? "#/" : "#/katalog");
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
      if (current) fitGiant(pTitle, current.hook);
    });
  });
  mq.addEventListener("change", setMode);
  addEventListener("hashchange", route);

  /* ---------- Intro: show the logo for at least ~1.2s while tiles download, then hand off ---------- */
  const T0 = performance.now();
  function waitForImages(imgs, ms) {
    const all = Promise.all(imgs.map((im) => (im.decode ? im.decode().catch(() => {}) : Promise.resolve())));
    return Promise.race([all, new Promise((r) => setTimeout(r, ms))]);
  }
  // The hint starts as a huge line across the screen, holds, then shrinks into its corner.
  function bigHint(delay) {
    const r = hint.getBoundingClientRect();
    const sc = (innerWidth * 0.94) / r.width;
    const dx = innerWidth / 2 - (r.left + r.width / 2);
    const dy = innerHeight / 2 - (r.top + r.height / 2);
    const big = `translate(${dx}px, ${dy}px) scale(${sc})`;
    hint.animate([
      { transform: big, opacity: 0, offset: 0 },
      { transform: big, opacity: 1, offset: 0.18 },
      { transform: big, opacity: 1, offset: 0.55, easing: "cubic-bezier(.7,0,.2,1)" },
      { transform: "none", opacity: 1, offset: 1 },
    ], { duration: delay ? 2600 : 1, delay, fill: "backwards" })
      .finished.then(() => setTimeout(() => { hintLocked = false; }, 2500));
  }

  async function reveal() {
    const intro = $("#intro");
    const mobile = mq.matches;
    const imgs = mobile ? $$("#m-float img") : $$(".tile img");
    await waitForImages(imgs, 4000);
    const left = 1200 - (performance.now() - T0);
    if (left > 0) await new Promise((r) => setTimeout(r, left));
    const logo = $("#intro-logo");
    const from = logo.getBoundingClientRect();
    const to = $(".brand img").getBoundingClientRect();
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const sc = to.width / from.width;
    logo.style.animation = "none";
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const d = reduce ? 1 : 750;
    logo.animate([{ transform: "none" }, { transform: `translate(${dx}px, ${dy}px) scale(${sc})` }], { duration: d, easing: EASE, fill: "forwards" });
    $(".intro-bg", intro).animate([{ opacity: 1 }, { opacity: 0 }], { duration: d * 0.8, delay: d * 0.35, easing: "ease", fill: "forwards" });
    if (!reduce && body.classList.contains("r-home") && !mobile) {
      const cx = innerWidth / 2, cy = innerHeight / 2;
      S.tiles.forEach((t) => {
        const r = t.getBoundingClientRect();
        if (r.right < 0 || r.left > innerWidth || r.bottom < 0 || r.top > innerHeight) return;
        const dist = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy);
        t.animate([{ opacity: 0, transform: "scale(.55)" }, { opacity: 1, transform: "none" }],
          { duration: 650, delay: 280 + dist * 0.45, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" });
      });
    }
    setTimeout(() => { body.classList.remove("loading"); intro.remove(); }, d + 150);
    if (!mobile && body.classList.contains("r-home")) bigHint(reduce ? 0 : d + 250);
    else hintLocked = false;
  }

  fetch("site/data.json?v=202610141716")
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
      reveal();
    })
    .catch((err) => {
      console.error(err);
      document.body.insertAdjacentHTML("beforeend", '<p style="position:fixed;top:45%;width:100%;text-align:center">Katalog gagal dimuat. Coba muat ulang halaman.</p>');
    });
})();
