// Requires Playwright (not a project dependency) and the app running on http://localhost:3000 (npm start).
// Produces a static snapshot of every page for the private artifact link. Usage: node scripts/snapshot/build.cjs <outDir>
// Builds a static snapshot of the running Money Trail app (http://localhost:3000) for publishing
// as a private artifact. Usage: node build.cjs <outDir>
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = process.argv[2];
const BASE = "http://localhost:3000";
const PAGES = [
  ["/", "index.html"],
  ["/cases/glyphosate", "case.html"],
  ["/cases/glyphosate/network", "network.html"],
  ["/cases/glyphosate/revolving-door", "revolving-door.html"],
  ["/cases/glyphosate/claims", "claims.html"],
  ["/methodology", "methodology.html"],
  ["/sources", "sources.html"],
];
const ROUTE = Object.fromEntries(PAGES);
const TAKEN = new Date().toISOString().slice(0, 10);

const SNAPSHOT_CSS = `
.snap-banner{background:var(--surface-2);border-bottom:1px solid var(--border);color:var(--ink-2);font-size:13px;padding-block:8px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
.snap-banner strong{color:var(--ink)}
.snap-graph img{display:block;width:100%;height:auto;border-radius:8px}
`;

const TOGGLE_JS = `
(function(){
  var group=document.querySelector('[role="group"][aria-label="Choose a view"]');
  if(!group) return;
  var buttons=group.querySelectorAll('button');
  var on='bg-ink text-page font-semibold', off='text-ink-2 hover:bg-surface-2';
  function show(v){
    document.querySelectorAll('[data-view]').forEach(function(el){ el.hidden = el.getAttribute('data-view')!==v; });
    buttons.forEach(function(b){
      var active=b.textContent.trim().toLowerCase()===v;
      b.setAttribute('aria-pressed', active?'true':'false');
      on.split(' ').forEach(function(c){ b.classList.toggle(c, active); });
      off.split(' ').forEach(function(c){ b.classList.toggle(c, !active); });
    });
  }
  buttons.forEach(function(b){ b.addEventListener('click', function(){ var v=b.textContent.trim().toLowerCase(); show(v); try{ history.replaceState(null,'','#'+v);}catch(e){} }); });
  var h=(location.hash||'').slice(1);
  show(h==='investigator'?'investigator':'citizen');
})();
`;

function rewriteLinks(html) {
  return html.replace(/href="(\/[^"]*)"/g, (m, href) => {
    const [pathPart, hash] = href.split("#");
    const clean = pathPart.split("?")[0];
    const view = /[?&]view=investigator/.test(pathPart) ? "#investigator" : "";
    const file = ROUTE[clean];
    if (!file) return m;
    return `href="${file}${hash ? "#" + hash : view}"`;
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  let css = null;

  for (const [route, file] of PAGES) {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(BASE + route, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);

    if (!css) {
      const hrefs = await page.$$eval('link[rel="stylesheet"]', (ls) => ls.map((l) => l.getAttribute("href")));
      css = "";
      for (const h of hrefs) css += await (await fetch(new URL(h, BASE))).text() + "\n";
    }

    // Filings table: show every year before capture.
    const sel = await page.$('[data-snapshot="controls"] select');
    if (sel) {
      await page.click('[role="group"][aria-label="Choose a view"] button:has-text("Investigator")'); // the table lives in this view
      await page.waitForTimeout(300);
      await sel.selectOption("all");
      await page.waitForTimeout(300);
    }

    // Network graph: screenshot it in light and dark, then replace the canvas with the images.
    const graph = await page.$('[data-snapshot="graph"]');
    if (graph) {
      await graph.screenshot({ path: path.join(OUT, "network-light.png") });
      await page.emulateMedia({ colorScheme: "dark" });
      await page.waitForTimeout(1500);
      await (await page.$('[data-snapshot="graph"]')).screenshot({ path: path.join(OUT, "network-dark.png") });
      await page.emulateMedia({ colorScheme: "light" });
      await page.waitForTimeout(800);
    }

    const body = await page.evaluate(() => {
      document.querySelectorAll("script, noscript, link[rel=preload], link[rel=modulepreload], next-route-announcer").forEach((e) => e.remove());
      const controls = document.querySelector('[data-snapshot="controls"]');
      if (controls) controls.outerHTML = '<p class="text-sm text-muted">All filings are listed below. Filtering by year or filer and CSV download are available in the full app.</p>';
      const g = document.querySelector('[data-snapshot="graph"]');
      if (g) {
        g.className = "snap-graph rounded-lg border border-line bg-surface";
        g.removeAttribute("style");
        g.innerHTML = '<picture><source srcset="network-dark.png" media="(prefers-color-scheme: dark)"><img src="network-light.png" alt="Network graph of the company, lobbying firms, lobbyists, PACs, officials, organizations and decisions. The table view below lists every node and connection."></picture>';
      }
      const panel = document.querySelector('[data-snapshot="graph-panel"]');
      if (panel) panel.innerHTML = '<p class="text-muted">In the full app you can click any node to see its sources. In this snapshot, open the table view below for every node, connection, side and source link.</p>';
      // Charts were rendered at desktop width: make each SVG scale with its container via its viewBox.
      document.querySelectorAll(".recharts-wrapper").forEach((w) => {
        // Every box from the responsive container down to the wrapper (Recharts adds a 0×0 measuring box in between).
        let el = w;
        while (el && !el.classList.contains("recharts-responsive-container")) {
          el.style.width = "100%";
          el.style.height = "auto";
          el.style.minWidth = "0";
          el.style.overflow = "visible";
          el = el.parentElement;
        }
        if (el) { el.style.width = "100%"; el.style.height = "auto"; el.style.minWidth = "0"; }
      });
      // Connection-type checkboxes only work in the live graph.
      document.querySelectorAll("fieldset").forEach((f) => { if (f.querySelector('input[type="checkbox"]')) f.remove(); });
      document.querySelectorAll("svg.recharts-surface").forEach((svg) => {
        const w = svg.getAttribute("width"), h = svg.getAttribute("height");
        if (!svg.getAttribute("viewBox") && w && h) svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
        svg.setAttribute("width", "100%");
        svg.removeAttribute("height");
        svg.style.width = "100%";
        svg.style.height = "auto";
        svg.style.display = "block";
      });
      // Chart boxes had fixed heights for the live chart; let the scaled SVG set the height.
      document.querySelectorAll(".recharts-responsive-container").forEach((el) => { if (el.parentElement) el.parentElement.style.height = "auto"; });
      return document.body.innerHTML;
    });
    const title = await page.title();

    const banner = `<div class="snap-banner"><strong>Snapshot</strong> of Money Trail taken ${TAKEN}. Chart tooltips, clicking graph nodes and table filters work in the full app; everything else here is the same.</div>`;
    const content = banner + rewriteLinks(body) + `<script>${TOGGLE_JS}</script>`;
    const head = `<title>${title}</title><style>${css}\n${SNAPSHOT_CSS}</style>`;
    let html;
    if (file === "index.html") {
      // The artifact's main page gets the platform's document skeleton, so no html/head/body tags here.
      html = head + "\n" + content;
    } else {
      html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">${head}</head><body class="flex min-h-full flex-col">${content}</body></html>`;
    }
    fs.writeFileSync(path.join(OUT, file), html);
    console.log(`  ${file}  ${(html.length / 1024).toFixed(0)} KB  "${title}"`);
  }
  await browser.close();
})();
