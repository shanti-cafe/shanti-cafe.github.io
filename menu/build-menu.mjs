#!/usr/bin/env node
/**
 * Gera assets/menu-shanti.pdf a partir de js/data.js.
 *
 * Uso:
 *   node menu/build-menu.mjs
 *   ./menu/build.sh
 *
 * Os preços e os itens vivem em js/data.js (o mesmo ficheiro que o site usa),
 * por isso o site e o PDF nunca ficam diferentes.
 */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, "..");
const outPdf = path.join(root, "assets", "menu-shanti.pdf");
const tmpHtml = path.join(here, ".menu-build.html");
const chromium = process.env.CHROMIUM || "/usr/bin/chromium";

/* ---------- dados ---------- */
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "js", "data.js"), "utf8"), sandbox);
const DATA = sandbox.window.SHANTI;
const PT = DATA.ui.pt;

const esc = (value) => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const cat = (id) => DATA.menu.find((c) => c.id === id);

const money = (value) => esc(value) + " \u20ac";

function row(item) {
  const tag = item.tag ? `<span class="row-tag">${esc(item.tag.pt)}</span>` : "";
  const alt = item.takeaway
    ? `<small>${esc(PT["menu.takeaway"])} ${money(item.takeaway)}</small>`
    : "";
  return `
        <div class="row">
          <div class="row-info"><span class="row-name">${esc(item.name.pt)}</span>${tag}</div>
          <span class="row-lead"></span>
          <span class="row-price">${money(item.price)}${alt}</span>
        </div>`;
}

function listPage(category, options = {}) {
  return `
      <p class="eyebrow">${esc(options.eyebrow || "Shanti Café")}</p>
      <h1 class="title">${esc(category.title.pt)}</h1>
      <span class="title-rule"></span>
      <p class="note">${esc(category.note.pt)}</p>
      <div class="rows">${category.items.map(row).join("")}
      </div>`;
}

/* ---------- páginas ---------- */
function pageAcai() {
  const acai = cat("acai");
  const sizes = acai.items.filter((item) => item.takeaway);
  const extra = acai.items.find((item) => !item.takeaway);

  const tier = (label, key) => `
          <div class="tier">
            <h2>${label}</h2>
            ${sizes.map((item) => `
            <div class="tier-row"><span>${esc(item.name.pt)}</span><strong>${money(item[key])}</strong></div>`).join("")}
          </div>`;

  return `
      <div class="acai-hero">
        <span class="acai-word">a\u00e7a\u00ed</span>
        <p class="acai-sub">${esc(PT["acai.eyebrow"])}</p>
      </div>
      <div class="tiers">
        ${tier("Na loja", "price")}
        ${tier("Para levar", "takeaway")}
      </div>
      <p class="extra-note">${esc(extra.name.pt)} &middot; ${money(extra.price)}</p>

      <div class="ingredients">
        <h3>${esc(PT["acai.ingredients"])}</h3>
        <div class="ing"><b>${esc(PT["acai.fruit"])}</b><p>${esc(PT["acai.fruitList"])}</p></div>
        <div class="ing"><b>${esc(PT["acai.others"])}</b><p>${esc(PT["acai.othersList"])}</p></div>
        <div class="ing"><b>${esc(PT["acai.toppings"])}</b><p>${esc(PT["acai.toppingsList"])}</p></div>
      </div>
      ${photo("hero-acai", 42)}`;
}

function pageMenus() {
  const menus = cat("menus");
  return `
      <p class="eyebrow">Shanti Caf\u00e9</p>
      <h1 class="title">${esc(menus.title.pt)}</h1>
      <span class="title-rule"></span>
      <p class="note">${esc(menus.note.pt)}</p>
      <div class="cards">
        ${menus.items.map((item) => `
        <article class="card">
          <div class="card-top"><h3>${esc(item.name.pt)}</h3><span class="card-price">${money(item.price)}</span></div>
          ${item.desc ? `<p>${esc(item.desc.pt)}</p>` : ""}
        </article>`).join("")}
      </div>
      <div class="menus-bottom">
        ${photo("queijada", 24)}
        <p class="handmade">feito com carinho, todos os dias</p>
      </div>`;
}

function pageCoffee() {
  const coffee = cat("cafetaria");
  return listPage(coffee) + photo("cafe-gelado", 42);
}

function pageDrinks() {
  const drinks = cat("bebidas");
  return listPage(drinks);
}

function photo(name, height) {
  return `
      <figure class="menu-photo" style="height:${height}mm">
        <img src="../assets/img/${name}.jpg" alt="">
      </figure>`;
}

function pageVisit() {
  return `
      <div class="visit">
        <h3>Obrigada pela visita!</h3>
        <p><strong>Shanti Caf\u00e9 &amp; Loja</strong><br>
        Centro Comercial Olival Parque, Loja 41<br>
        2625-448 Forte da Casa</p>
        <p class="hours">Seg\u2013Sex 09:00\u201319:00 &middot; S\u00e1b 09:00\u201317:30 &middot; Dom fechado<br>
        ${esc(DATA.contact.phoneDisplay)} &middot; @shanti_cafe</p>
      </div>`;
}

/* ---------- montagem ---------- */
const pages = [
  { cls: "", body: pageAcai() },
  { cls: "", body: pageMenus() },
  { cls: "", body: listPage(cat("sandes")) },
  { cls: "page--dense", body: listPage(cat("doces")) },
  { cls: "", body: pageCoffee() },
  { cls: "", body: pageDrinks() }
];

const footer = (index) => `
      <footer class="foot">
        <span class="handles"><span>@shanti_cafe</span><span>${esc(DATA.contact.phoneDisplay)}</span></span>
        <span class="num">${index + 1} / ${pages.length}</span>
      </footer>`;

const html = `<!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<title>Shanti Café — Menu</title>
<link rel="stylesheet" href="print.css">
</head>
<body>
${pages.map((page, i) => `
  <section class="page ${page.cls}${i === pages.length - 1 ? " page--last" : ""}">
    <header class="brand">
      <img class="logo" src="../assets/img/logo-mark.png" alt="Shanti Café">
      <p class="kicker">Café &amp; Loja</p>
      <span class="brand-rule"></span>
    </header>
    <main class="content">${page.body}
    </main>
    ${i === pages.length - 1 ? pageVisit() : ""}
    ${footer(i)}
  </section>`).join("\n")}
</body>
</html>`;

fs.writeFileSync(tmpHtml, html, "utf8");

try {
  execFileSync(chromium, [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--no-pdf-header-footer",
    "--print-to-pdf-no-header",
    "--virtual-time-budget=5000",
    `--print-to-pdf=${outPdf}`,
    `file://${tmpHtml}`
  ], { stdio: ["ignore", "ignore", "pipe"], timeout: 120000 });
} finally {
  fs.unlinkSync(tmpHtml);
}

const kb = (fs.statSync(outPdf).size / 1024).toFixed(0);
console.log(`\u2713 ${path.relative(root, outPdf)} gerado (${pages.length} p\u00e1ginas, ${kb} KB)`);
