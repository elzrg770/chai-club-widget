import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const cfg = window.PORTAL_CONFIG;
const params = new URLSearchParams(location.search);
const DEMO = params.get("demo"); // member | buyer | none  (for previewing without signing in)
const sb = DEMO ? null : createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { flowType: "implicit", detectSessionInUrl: true, persistSession: true } });
const app = document.getElementById("app");

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const S = { user: null, access: new Set(), members: [], purchases: [], products: [], content: [], shop: [] };
const isMember = () => S.access.has("members");
const owns = (key) => S.access.has(key);
const section = (name) => S.content.filter((c) => (c.section || "").toLowerCase() === name.toLowerCase());

function parseDate(s) {
  if (!s) return null;
  const m = String(s).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
  const d = new Date(s);
  return isNaN(d) ? null : d;
}
const fmtDate = (d) => d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

function copyLink(link) {
  const m = String(link || "").match(/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/);
  return m ? `https://docs.google.com/${m[1]}/d/${m[2]}/copy` : null;
}
function picture(item, label) {
  if (item.picture_url) return `<img class="thumb" src="${esc(item.picture_url)}" alt="Preview of ${esc(item.title)}" loading="lazy">`;
  return `<div class="cover" aria-hidden="true"><b>${esc(item.title)}</b><small><span>${esc(label || item.type || "")}</span><i><em>grow</em> gelt</i></small></div>`;
}
function actions(item, open = "Open") {
  const copy = copyLink(item.link);
  if (!item.link) return "";
  return `<div class="btns"><a class="btn primary" href="${esc(item.link)}" target="_blank" rel="noopener">${open}</a>${copy ? `<a class="btn" href="${esc(copy)}" target="_blank" rel="noopener">Make my copy</a>` : ""}</div>`;
}
function tile(item, open) {
  return `<div class="tile">${picture(item)}<div style="display:flex;flex-direction:column;gap:6px">
    ${item.type ? `<span class="kind">${esc(item.type)}</span>` : ""}<h3>${esc(item.title)}</h3>
    ${item.description ? `<p class="desc">${esc(item.description)}</p>` : ""}
    ${item.item_date ? `<span class="meta">${esc(item.item_date)}</span>` : ""}</div>
    <div style="margin-top:auto">${actions(item, open)}</div></div>`;
}
function row(item, go = "Open") {
  return `<div class="row"><div style="min-width:0;display:flex;flex-direction:column;gap:4px">
    ${item.item_date || item.month ? `<span class="meta">${esc([item.item_date, item.type].filter(Boolean).join(" · "))}</span>` : ""}
    <span class="t">${esc(item.title)}</span>${item.description ? `<span class="desc">${esc(item.description)}</span>` : ""}</div>
    ${item.link ? `<a class="go" href="${esc(item.link)}" target="_blank" rel="noopener">${go}</a>` : ""}</div>`;
}
const foot = () => `<p class="foot">Stuck on something? WhatsApp us at <a href="${esc(cfg.supportWhatsAppLink)}" target="_blank" rel="noopener">${esc(cfg.supportWhatsApp)}</a> and we&rsquo;ll help.</p>`;

function header(active) {
  const tabs = [["home", "Home"], ["packages", "Packages"], ["library", "Library"], ["shop", "Shop"], ["account", "Account"]]
    .filter(([k]) => k !== "library" || (isMember() && section("Library").length));
  return `<header><div class="wrap head">
    <a class="brand" href="#home" aria-label="Shluchim Portal home"><img src="https://yzvvqoadsrctfppdiots.supabase.co/storage/v1/object/public/thumbs/site/logo.png" alt="Grow Gelt Solutions"><span>Shluchim Portal</span></a>
    <nav class="tabs" aria-label="Portal">${tabs.map(([k, l]) => `<a href="#${k}"${k === active ? ' aria-current="page"' : ""}>${l}</a>`).join("")}</nav>
    <button class="linkbtn hide-sm" id="signout">Sign out</button></div></header>`;
}

// ---------- screens ----------
function signIn(message = "") {
  app.innerHTML = `<main class="signin"><div class="form"><div>
    <img src="https://yzvvqoadsrctfppdiots.supabase.co/storage/v1/object/public/thumbs/site/logo.png" alt="Grow Gelt Solutions" style="height:64px;width:auto;align-self:flex-start">
    <div><h1 style="font-size:32px">Shluchim Portal</h1>
    <p class="lead">Enter your email and we&rsquo;ll send you a link to sign in. No password needed. Use the email you paid with.</p></div>
    <form id="f" style="display:flex;flex-direction:column;gap:8px">
      <label for="email">Email</label>
      <input id="email" type="email" required autocomplete="email" placeholder="you@yourchabadhouse.org">
      <button class="btn primary" style="min-height:52px;font-size:17px;margin-top:8px" type="submit">Email me a sign-in link</button>
    </form>
    <div id="msg" class="notice" ${message ? "" : "hidden"}>${message}</div>
    <p class="desc">Not a member yet? <a class="u" style="color:var(--green)" href="#shop/mdm">See the Million Dollar Mindset</a> or <a class="u" style="color:var(--green)" href="#shop">browse everything we offer</a>.</p>
    <p class="desc">Trouble signing in? WhatsApp <a class="u" href="${esc(cfg.supportWhatsAppLink)}">${esc(cfg.supportWhatsApp)}</a></p>
  </div></div><div class="photo" aria-hidden="true"></div></main>`;
  document.getElementById("f").onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();
    const msg = document.getElementById("msg");
    msg.hidden = false; msg.textContent = "Sending…";
    if (DEMO) { msg.textContent = "Demo mode: no email sent."; return; }
    const btn = e.submitter; if (btn) btn.disabled = true;
    const { data, error } = await sb.functions.invoke("send-signin-link", { body: { email } });
    if (btn) btn.disabled = false;
    if (error || data?.error) { msg.textContent = data?.error || "We couldn't send the email just now. Please try again or WhatsApp us."; return; }
    msg.innerHTML = `Check your inbox at <b>${esc(email)}</b>. If this email has access, a sign-in link is on its way. It can take a minute, so check spam too. Nothing after a few minutes? WhatsApp <a class="u" href="${esc(cfg.supportWhatsAppLink)}">${esc(cfg.supportWhatsApp)}</a>.`;
  };
}

function homeView() {
  const name = (S.members.find((m) => m.name)?.name || "").split(" ")[0];
  if (isMember()) return memberHome(name);
  if (S.purchases.length || S.products.some((p) => owns(p.access_key))) return buyerHome(name);
  return `<main class="wrap" style="padding-top:40px;padding-bottom:64px"><h1>Welcome${name ? `, ${esc(name)}` : ""}.</h1>
    <p class="lead">We don&rsquo;t see a membership or a package for <b>${esc(S.user.email)}</b> yet.</p>
    <div class="grid" style="margin-top:28px">
      <div class="card"><h2>Join the Million Dollar Mindset</h2><p class="desc">Monthly resources, live Zooms twice a month, the Grow Gelt Library, and every seasonal package.</p><div style="margin-top:16px"><a class="btn primary" href="#shop/mdm">See membership</a></div></div>
      <div class="card"><h2>Paid with a different email?</h2><p class="desc">Sign out and sign in with that email, or WhatsApp us and we&rsquo;ll join the two.</p><div style="margin-top:16px"><button class="btn" id="signout2">Sign out</button></div></div>
    </div>${foot()}</main>`;
}

function memberHome(name) {
  const weekly = section("Weekly").map((c) => ({ ...c, d: parseDate(c.item_date) })).sort((a, b) => (a.d || 0) - (b.d || 0));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let idx = weekly.findIndex((w, i) => w.d && w.d <= today && (!weekly[i + 1]?.d || weekly[i + 1].d > today));
  if (idx < 0) idx = weekly.findIndex((w) => !w.d || w.d >= today);
  const featured = weekly[idx] || null;
  const upcoming = weekly.filter((w, i) => i > idx);
  const month = section("This month");
  const zoom = section("Next Zoom")[0];
  const recs = section("Recordings");
  const monthName = month[0]?.month || featured?.month || "";
  return `<main><div class="wrap" style="padding-top:40px">
      <p class="eyebrow">Million Dollar Mindset${monthName ? ` · ${esc(monthName)}` : ""}</p>
      <h1>Welcome back${name ? `, ${esc(name)}` : ""}.</h1>
      <p class="lead">Here&rsquo;s everything new${monthName ? ` for ${esc(monthName.replace(/\s*\d{4}$/, ""))}` : ""}. Open anything to read it, or click &ldquo;Make my copy&rdquo; to get your own version you can edit.</p></div>
    <div class="wrap cols"><div class="main">
      ${featured ? `<section class="card" style="display:flex;flex-wrap:wrap;gap:20px 28px;align-items:center">
        <div style="flex:1 1 260px;min-width:0">${picture(featured, "Torah Thought")}</div>
        <div style="flex:1.3 1 300px;min-width:0;display:flex;flex-direction:column;gap:10px">
          <p class="eyebrow" style="margin:0;font-size:14px">This week&rsquo;s Torah Thought</p>
          <h2 style="font-size:24px;margin:0">${esc(featured.title)}</h2>
          ${featured.description ? `<p class="desc" style="font-size:16px">${esc(featured.description)}</p>` : ""}
          ${featured.item_date ? `<p class="meta" style="margin:0">For the week of ${esc(fmtDate(featured.d) || featured.item_date)}</p>` : ""}
          <div style="margin-top:6px">${actions(featured, "Read it")}</div></div></section>` : ""}
      ${month.length ? `<section><h2 style="margin-bottom:14px">This month</h2><div class="grid">${month.map((m) => tile(m)).join("")}</div></section>` : ""}
      ${upcoming.length ? `<section class="card"><h2>Coming up: Torah Thoughts</h2>${upcoming.map((u) => row({ ...u, item_date: u.d ? `Week of ${fmtDate(u.d)}` : u.item_date, type: "" })).join("")}</section>` : ""}
    </div><div class="side" ${zoom || recs.length ? "" : "hidden"}>
      ${zoom ? `<section class="dark" id="zooms"><p style="font-size:14px;font-weight:600;color:#c9c9c4">Next live Zoom</p>
        <h2 style="font-size:22px;margin:0">${esc(zoom.title)}</h2>${zoom.item_date ? `<p style="color:#e6e6e1">${esc(zoom.item_date)}</p>` : ""}
        ${zoom.description ? `<p style="font-size:15px;line-height:1.55;color:#c9c9c4">${esc(zoom.description)}</p>` : ""}
        ${zoom.link ? `<a class="btn go" href="${esc(zoom.link)}" target="_blank" rel="noopener">Join Zoom</a>` : ""}</section>` : ""}
      ${recs.length ? `<section class="card"><h2>Missed a Zoom? Watch it here</h2>${recs.map((r) => row(r, "Watch")).join("")}</section>` : ""}
    </div></div>
    <div class="band"><div class="wrap" style="padding-top:48px;padding-bottom:64px">${packagesGrid("Seasonal Packages")}${foot()}</div></div></main>`;
}

function buyerHome(name) {
  return `<main><div class="wrap" style="padding-top:40px;padding-bottom:16px"><h1>Welcome back${name ? `, ${esc(name)}` : ""}.</h1>
    <p class="lead">Everything you&rsquo;ve bought is here, ready whenever you are.</p></div>
    <div class="wrap" style="padding-bottom:24px">${packagesGrid("Your packages", true)}</div>
    <div class="wrap" style="padding-bottom:64px"><div class="card" style="display:flex;flex-wrap:wrap;gap:16px 32px;align-items:center;justify-content:space-between">
      <div style="flex:1 1 360px"><h2>Want everything, every month?</h2><p class="desc">Million Dollar Mindset members get monthly resources, live Zooms twice a month, the full Grow Gelt Library, and every seasonal package.</p></div>
      <a class="btn primary" href="#shop/mdm">See membership</a></div>${foot()}</div></main>`;
}

function packagesGrid(title, onlyOwned = false) {
  const list = S.products.filter((p) => p.portal_package !== false && (onlyOwned ? owns(p.access_key) : true));
  if (!list.length) return `<h2>${esc(title)}</h2><p class="empty">Nothing here yet.</p>`;
  return `<h2 style="font-size:24px;margin-bottom:20px">${esc(title)}</h2><div class="grid">${list.map((p) => {
    const mine = owns(p.access_key);
    return `<div class="tile">${p.image_url ? shopCover(p) : picture({ title: p.name }, mine ? "" : p.price_label || "")}
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><h3>${esc(p.name)}</h3>${mine ? `<span class="pill">Yours</span>` : ""}</div>
      ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ""}
      <div style="margin-top:auto">${mine ? `<a class="btn wide" href="#package/${esc(p.access_key)}">Open package</a>`
        : p.slug && p.public ? `<a class="btn wide" href="#shop/${esc(p.slug)}">See what&rsquo;s inside${p.price_label ? ` · ${esc(p.price_label)}` : ""}</a>`
        : p.buy_url ? `<a class="btn wide" href="${esc(p.buy_url)}">Get it${p.price_label ? ` · ${esc(p.price_label)}` : ""}</a>` : ""}</div></div>`;
  }).join("")}</div>`;
}

function packageView(key) {
  const p = S.products.find((x) => x.access_key === key);
  if (!p) return `<main class="wrap" style="padding-top:40px;padding-bottom:40px"><h1>Package not found</h1><p><a class="u" href="#packages">Back to packages</a></p></main>`;
  if (!owns(key)) return `<main class="wrap" style="padding-top:40px;padding-bottom:64px"><h1>${esc(p.name)}</h1><p class="lead">${esc(p.description || "")}</p>
    ${p.buy_url ? `<p style="margin-top:24px"><a class="btn primary" href="${esc(p.buy_url)}">Get it${p.price_label ? ` · ${esc(p.price_label)}` : ""}</a></p>` : ""}</main>`;
  const items = S.content.filter((c) => c.audience === key);
  const bought = S.purchases.find((x) => x.access_key === key);
  const dfy = bought?.extras?.done_for_you;
  return `<main class="wrap" style="padding-top:40px;padding-bottom:64px"><p class="eyebrow"><a href="#packages">Packages</a></p><h1>${esc(p.name)}</h1>
    ${p.description ? `<p class="lead">${esc(p.description)}</p>` : ""}
    ${dfy ? `<div class="notice" style="margin-top:20px"><b>Your done-for-you presentation is in the works.</b> We&rsquo;ll be in touch about the details.</div>` : ""}
    ${items.length ? `<div class="grid" style="margin-top:28px">${items.map((i) => tile(i)).join("")}</div>` : `<p class="empty" style="margin-top:24px">The materials are being added. Check back soon.</p>`}${foot()}</main>`;
}

function libraryView() {
  const items = section("Library");
  return `<main class="wrap" style="padding-top:40px;padding-bottom:64px"><h1>Library</h1>
    <p class="lead" style="margin-bottom:28px">${items.length} recorded courses and workshops. Watch them in any order, as many times as you like.</p>
    <div style="display:flex;flex-direction:column;gap:6px;max-width:560px;margin-bottom:32px"><label for="q">Search the library</label>
    <input id="q" type="search" placeholder="Try &quot;major gifts&quot; or &quot;Chai Club&quot;"></div>
    <div class="grid" id="lib">${items.map((i) => `<div data-t="${esc((i.title + " " + (i.description || "")).toLowerCase())}">${tile(i, "Watch")}</div>`).join("")}</div>
    <p class="empty" id="none" hidden>Nothing matches that search.</p></main>`;
}

function accountView() {
  const m = S.members.find((x) => x.stripe_customer_id) || S.members[0];
  const active = m && ["active", "trialing", "past_due"].includes(m.mdm_status);
  const until = m?.mdm_current_period_end ? fmtDate(new Date(m.mdm_current_period_end)) : "";
  const amount = m?.mdm_amount_cents != null ? `$${(m.mdm_amount_cents / 100).toLocaleString()}` : "";
  const act = (a, t, d, label, cls = "") => `<div class="row" style="flex-wrap:wrap"><div style="flex:1 1 300px"><h3 style="font-size:17px">${t}</h3><p class="desc">${d}</p></div>
    <button class="btn ${cls}" data-bill="${a}">${label}</button></div>`;
  return `<main class="wrap" style="padding-top:40px;padding-bottom:64px"><h1 style="margin-bottom:28px">Account and billing</h1>
   <div class="cols" style="padding-top:0"><div class="main">
    <section class="card"><h2>Your membership</h2>
     ${active ? `<p style="margin:8px 0 4px;font-size:18px;font-weight:600">Million Dollar Mindset <span class="pill">${m.mdm_status === "past_due" ? "Payment due" : "Active"}</span></p>
       <p style="margin:0 0 4px;font-size:32px;font-weight:700">${esc(amount)} <span class="meta" style="font-size:16px">per ${esc(m.mdm_interval || "month")}</span></p>
       <p class="desc">${m.mdm_cancel_at_period_end ? `Canceled. Your access stays on until ${esc(until)}.` : until ? `Next payment ${esc(until)}.` : ""}</p>
       ${m.mdm_status === "past_due" ? `<div class="notice" style="margin-top:12px">Your last payment didn&rsquo;t go through. Update your card below to keep your access.</div>` : ""}
       ${m.mdm_interval === "month" && cfg.yearlyBilling ? act("yearly", "Switch to yearly billing", "Pay once a year instead of every month.", "Switch to yearly", "primary") : ""}
       ${act("card", "Update your card", "Change the card we charge.", "Update card")}
       ${act("portal", "Receipts and billing details", "Download receipts or update your billing address.", "Open")}
       ${m.mdm_cancel_at_period_end ? "" : act("cancel", "Cancel membership", "Your access stays on until the end of the period you already paid for.", "Cancel membership", "danger")}
       <p class="meta" style="margin:16px 0 0">These buttons open a secure Stripe page, then bring you right back here.</p>`
     : isMember() ? `<p class="desc">Your access is set up by the Grow Gelt team, so there&rsquo;s nothing to manage here.</p>`
     : `<p class="desc">You don&rsquo;t have a membership on this email.</p><p style="margin-top:12px"><a class="btn primary" href="#shop/mdm">See membership</a></p>`}
     <p id="billmsg" class="notice" style="margin-top:16px" hidden></p></section>
    <section class="card"><h2>Your purchases</h2>${S.purchases.length ? `<div style="overflow-x:auto"><table><thead><tr><th>Date</th><th>What</th></tr></thead><tbody>
      ${S.purchases.map((p) => `<tr><td style="white-space:nowrap">${esc(fmtDate(new Date(p.purchased_at)))}</td><td>${esc(S.products.find((x) => x.access_key === p.access_key)?.name || p.access_key)}</td></tr>`).join("")}
      </tbody></table></div>` : `<p class="empty">Packages you buy separately will show here.</p>`}</section>
   </div><div class="side">
    <section class="card"><h2>Signed in as</h2><p class="desc" style="overflow-wrap:anywhere">${esc(S.user.email)}</p>
     <p class="desc" style="margin-top:12px">Bought something with a different email? WhatsApp <a class="u" href="${esc(cfg.supportWhatsAppLink)}">${esc(cfg.supportWhatsApp)}</a> and we&rsquo;ll join them into this account.</p>
     <p style="margin-top:16px"><button class="btn" id="signout3">Sign out</button></p></section>
   </div></div></main>`;
}


// ---------- shop (open to everyone, signed in or not) ----------
function publicHeader() {
  return `<header><div class="wrap head">
    <a class="brand" href="#shop" aria-label="Grow Gelt shop"><img src="https://yzvvqoadsrctfppdiots.supabase.co/storage/v1/object/public/thumbs/site/logo.png" alt="Grow Gelt Solutions"><span>Shop</span></a>
    <a class="btn" href="#signin">Sign in</a></div></header>`;
}
function shopCover(p) {
  if (p.image_url) return `<img class="thumb" src="${esc(p.image_url)}" alt="" loading="lazy">`;
  return `<div class="cover" aria-hidden="true"><b>${esc(p.name)}</b><small><span></span><i><em>grow</em> gelt</i></small></div>`;
}
function shopList() { return S.shop.filter((p) => p.public && p.slug).sort((a, b) => (a.sort ?? 100) - (b.sort ?? 100)); }
function shopView() {
  const items = shopList();
  const mdm = items.find((p) => p.access_key === "mdm");
  const rest = items.filter((p) => p.access_key !== "mdm");
  return `<main><div class="wrap" style="padding-top:40px"><p class="eyebrow">Grow Gelt Solutions</p><h1>Tools and training for shluchim</h1>
    <p class="lead">Fundraising letters, donor presentations, newsletters and coaching, built for Chabad Houses. Pick what you need, or get all of it with the Million Dollar Mindset.</p></div>
    ${mdm ? `<div class="wrap" style="padding-top:28px"><section class="dark" style="display:flex;flex-direction:row;flex-wrap:wrap;gap:16px 32px;align-items:center;justify-content:space-between">
      <div style="flex:1 1 360px;display:flex;flex-direction:column;gap:8px"><p style="font-size:14px;font-weight:600;color:#c9c9c4">Best value</p>
        <h2 style="font-size:26px;margin:0">${esc(mdm.name)} · ${esc(mdm.price_label || "")}</h2>
        <p style="font-size:16px;line-height:1.6;color:#e6e6e1">${esc(mdm.description || "")}</p></div>
      <a class="btn go" style="width:auto;padding:0 24px" href="#shop/${esc(mdm.slug)}">See what&rsquo;s included</a></section></div>` : ""}
    <div class="wrap" style="padding-top:28px;padding-bottom:64px"><div class="grid">${rest.map((p) => `<a class="tile" href="#shop/${esc(p.slug)}" style="text-decoration:none">${shopCover(p)}
      <div style="display:flex;flex-direction:column;gap:2px"><h3>${esc(p.name)}</h3><span class="kind" style="font-size:15px">${esc(p.price_label || "")}</span></div>
      ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ""}
      ${p.in_mdm ? `<p class="meta" style="margin:0">Included with the Million Dollar Mindset</p>` : ""}
      <span class="btn wide" style="margin-top:auto">Learn more</span></a>`).join("")}</div>${foot()}</div></main>`;
}
function productView(slug) {
  const p = shopList().find((x) => x.slug === slug);
  if (!p) return `<main class="wrap" style="padding-top:40px;padding-bottom:64px"><h1>We couldn&rsquo;t find that</h1><p><a class="u" href="#shop">See everything in the shop</a></p></main>`;
  const mdm = shopList().find((x) => x.access_key === "mdm");
  const member = S.user && isMember();
  const owned = S.user && p.portal_package !== false && owns(p.access_key);
  const cta = owned ? `<a class="btn primary" href="#package/${esc(p.access_key)}">Open it in your portal</a>`
    : member && p.in_mdm ? `<p class="notice" style="margin:0">You&rsquo;re a member, so this is already included. <a class="u" href="#home">Go to your portal</a></p>`
    : p.access_key === "mdm" && member ? `<p class="notice" style="margin:0">You&rsquo;re already a member. <a class="u" href="#home">Go to your portal</a></p>`
    : p.cta_url ? `<a class="btn primary" style="min-height:52px;font-size:17px;padding:0 28px" href="${esc(p.cta_url)}">${esc(p.cta_label || "Get it")}</a>` : "";
  return `<main><div class="wrap cols" style="padding-top:40px">
    <div class="main">
      <p class="eyebrow"><a href="#shop">Shop</a></p>
      <h1>${esc(p.name)}</h1>
      ${p.tagline ? `<p class="lead" style="font-size:19px">${esc(p.tagline)}</p>` : ""}
      <div class="show-sm" style="flex-direction:column;gap:12px"><p style="margin:0;font-size:26px;font-weight:700">${esc(p.price_label || "")}</p>${cta}</div>
      ${p.details ? `<p class="desc" style="font-size:17px;max-width:680px">${esc(p.details)}</p>` : ""}
      ${p.includes?.length ? `<section class="card"><h2>What you get</h2><ul style="margin:8px 0 0;padding-left:20px;display:flex;flex-direction:column;gap:8px;font-size:16px;line-height:1.5">${p.includes.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></section>` : ""}
      ${p.image_url ? `<img src="${esc(p.image_url)}" alt="" style="width:100%;max-width:440px;border-radius:8px;border:1px solid var(--line)">` : ""}
    </div>
    <div class="side">
      <section class="card" style="display:flex;flex-direction:column;gap:14px">
        <p style="margin:0;font-size:30px;font-weight:700">${esc(p.price_label || "")}</p>
        ${cta}
        ${p.in_mdm && !member ? `<p class="meta" style="margin:0">Included with the Million Dollar Mindset.</p>` : ""}
        <p class="meta" style="margin:0">Questions? WhatsApp <a class="u" href="${esc(cfg.supportWhatsAppLink)}">${esc(cfg.supportWhatsApp)}</a></p>
      </section>
      ${mdm && p.access_key !== "mdm" && !member ? `<section class="dark"><p style="font-size:14px;font-weight:600;color:#c9c9c4">Get all of it</p>
        <h2 style="font-size:20px;margin:0">${esc(mdm.name)}</h2><p style="font-size:15px;line-height:1.55;color:#e6e6e1">${esc(mdm.description || "")} ${esc(mdm.price_label || "")}.</p>
        <a class="btn go" href="#shop/${esc(mdm.slug)}">See the membership</a></section>` : ""}
    </div></div></main>`;
}
async function loadShop() {
  if (S.shop.length) return;
  if (DEMO) { S.shop = S.products; return; }
  const { data } = await sb.from("products").select("access_key,name,slug,public,sort,price_label,tagline,details,includes,cta_label,cta_url,image_url,in_mdm,description,portal_package").eq("public", true).order("sort");
  S.shop = data || [];
}

// ---------- data + routing ----------
async function load() {
  if (DEMO) return demoData(DEMO);
  const [acc, mem, pur, prod, con] = await Promise.all([
    sb.rpc("my_access"), sb.from("members").select("*"),
    sb.from("purchases").select("*").order("purchased_at", { ascending: false }),
    sb.from("products").select("*").order("sort"), sb.from("content").select("*").order("sort"),
  ]);
  S.access = new Set((acc.data || []).map((r) => (typeof r === "string" ? r : Object.values(r)[0])));
  S.members = mem.data || []; S.purchases = pur.data || []; S.products = prod.data || []; S.content = con.data || [];
}

async function route() {
  const h = location.hash.replace(/^#/, "") || "home";
  const [page, arg] = h.split("/");
  if (page === "shop") {
    await loadShop();
    app.innerHTML = (S.user ? header("shop") : publicHeader()) + (arg ? productView(arg) : shopView());
    window.scrollTo(0, 0); wire(); return;
  }
  if (!S.user) return signIn();
  let html;
  if (page === "library" && isMember()) html = header("library") + libraryView();
  else if (page === "packages") html = header("packages") + `<main class="wrap" style="padding-top:40px;padding-bottom:64px">${packagesGrid("Packages")}${foot()}</main>`;
  else if (page === "package") html = header("packages") + packageView(arg);
  else if (page.startsWith("account")) html = header("account") + accountView();
  else html = header("home") + homeView();
  app.innerHTML = html;
  window.scrollTo(0, 0);
  wire();
}

function wire() {
  for (const id of ["signout", "signout2", "signout3"]) {
    const b = document.getElementById(id);
    if (b) b.onclick = async () => { if (sb) await sb.auth.signOut(); S.user = null; location.hash = ""; signIn(); };
  }
  const q = document.getElementById("q");
  if (q) q.oninput = () => {
    const v = q.value.trim().toLowerCase(); let shown = 0;
    document.querySelectorAll("#lib > div").forEach((d) => { const ok = !v || d.dataset.t.includes(v); d.hidden = !ok; shown += ok; });
    document.getElementById("none").hidden = shown > 0;
  };
  document.querySelectorAll("[data-bill]").forEach((b) => b.onclick = async () => {
    const msg = document.getElementById("billmsg"); msg.hidden = false; msg.textContent = "Opening your secure Stripe page…";
    if (DEMO) { msg.textContent = "Demo mode: this would open Stripe."; return; }
    const { data, error } = await sb.functions.invoke("billing-link", { body: { action: b.dataset.bill } });
    if (error || !data?.url) {
      let why = data?.error || error?.message || "unknown error";
      try { why = (await error.context.json()).error || why; } catch { /* keep the generic reason */ }
      msg.textContent = `We couldn't open Stripe: ${why}. WhatsApp us and we'll help.`; return;
    }
    location.href = data.url;
  });
}

async function start() {
  if (DEMO) { S.user = { email: "demo@example.org" }; await load(); window.onhashchange = route; return route(); }
  // Coming from a sign-in email: trade the one-time code for a session, then clean the address bar.
  const tokenHash = params.get("token_hash");
  if (tokenHash) {
    app.innerHTML = `<main class="wrap" style="padding-top:80px;padding-bottom:80px"><h1>Signing you in…</h1></main>`;
    const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
    history.replaceState(null, "", location.pathname + "#home");
    if (error) return signIn(`That sign-in link has expired or was already used. Enter your email to get a new one.`);
  }
  const { data: { session } } = await sb.auth.getSession();
  S.user = session?.user || null;
  if (S.user) { await load(); if (/access_token|error_description/.test(location.hash)) history.replaceState(null, "", location.pathname + "#home"); }
  sb.auth.onAuthStateChange(async (_e, s) => { const was = S.user?.id; S.user = s?.user || null; if (S.user && S.user.id !== was) { await load(); route(); } });
  window.onhashchange = route;
  route();
}

// ---------- demo data (only used with ?demo=...) ----------
function demoData(kind) {
  const doc = (id) => `https://docs.google.com/document/d/${id}/edit`;
  S.products = [
    { access_key: "biggelt", name: "Big Gelt Donor Presentation Kit", description: "The donor presentation templates and the full workshop that walks you through building it and making the ask.", price_label: "$99", buy_url: "https://growgelt.com/biggelt" },
    { access_key: "hh5787", name: "High Holidays 5787", description: "Appeal letters, emails, pledge cards, Caring Wall and more.", price_label: "$249" },
    { access_key: "chanukah5787", name: "Chanukah 5787", description: "Plug-and-play letters, emails, graphics and social posts.", price_label: "$249" },
  ];
  const all = [
    { section: "Weekly", type: "Torah Thought", title: "Noah and the Limits of “Doing One’s Best”", item_date: "10/12/2026", month: "Cheshvan 5787", link: doc("1_0RPZWD64Yfj4LOU71eO0gJWWg7oynrP_hXY2QnIYhg"), description: "Noah warned his generation but never prayed for them. Real care means pleading for people, not only doing your duty.", picture_url: "https://yzvvqoadsrctfppdiots.supabase.co/storage/v1/object/public/thumbs/drive/1_0RPZWD64Yfj4LOU71eO0gJWWg7oynrP_hXY2QnIYhg.jpg", audience: "members" },
    { section: "Weekly", type: "Torah Thought", title: "“The Canaanites Were Then in the Land” — Ownership in Exile", item_date: "10/19/2026", month: "Cheshvan 5787", link: doc("1AtmFEbvs6hfeF2VnwbBiz4jvyV-xwEDtE50q3_138fs"), description: "A promise about the Land turns into a done deal, while others still rule it.", audience: "members" },
    { section: "Weekly", type: "Torah Thought", title: "Abraham’s Prayer and the Heart of Influence", item_date: "10/26/2026", month: "Cheshvan 5787", link: doc("1bEeilseHKm9Mp_ILsJZD58vZIFS0j5-svY-pBawmBHk"), description: "Noah built an ark. Abraham argued for Sodom. Two very different ways to lead.", audience: "members" },
    { section: "This month", type: "Letter", title: "Cheshvan Thank You Letter", month: "Cheshvan 5787", link: doc("1hgqsHOaHTjyOXzs9lrSx9GiFhJpERb2gghwN6i906II"), description: "A thank-you for gifts made this month. Fill in the name, amount and date.", picture_url: "https://yzvvqoadsrctfppdiots.supabase.co/storage/v1/object/public/thumbs/drive/1hgqsHOaHTjyOXzs9lrSx9GiFhJpERb2gghwN6i906II.jpg", audience: "members" },
    { section: "This month", type: "Letter", title: "Tishrei Thank You Letter 5787", month: "Cheshvan 5787", link: doc("1YxfywT1mdDlu3FyjofTAcrpGxETwGB5f8LXozu_EaQI"), description: "For gifts that came in over the holidays.", picture_url: "https://yzvvqoadsrctfppdiots.supabase.co/storage/v1/object/public/thumbs/drive/1YxfywT1mdDlu3FyjofTAcrpGxETwGB5f8LXozu_EaQI.jpg", audience: "members" },
    { section: "Next Zoom", type: "Zoom", title: "MDM Q&A", item_date: "[Date] · 2:00 PM", link: "https://zoom.us", description: "Bring your questions. Open to every member.", audience: "members" },
    { section: "Recordings", type: "Recording", title: "Tishrei Debrief", item_date: "[Date]", link: "https://fathom.video", audience: "members" },
    { section: "Library", type: "Course", title: "Matching Campaigns", link: "https://growgelt.graphy.com", audience: "members" },
    { section: "Library", type: "Course", title: "Middle Tier Giving", link: "https://growgelt.graphy.com", audience: "members" },
    { section: "Package", type: "Workshop", title: "The Big Gelt workshop", link: "https://growgelt.graphy.com", description: "Walks you through building the presentation and making the ask.", audience: "biggelt" },
    { section: "Package", type: "Template", title: "Donor presentation template (portrait)", link: doc("1_0RPZWD64Yfj4LOU71eO0gJWWg7oynrP_hXY2QnIYhg"), audience: "biggelt" },
  ];
  if (kind === "member") { S.access = new Set(["members", "biggelt", "hh5787", "chanukah5787"]); S.members = [{ email: "demo@example.org", name: "Mendel Demo", stripe_customer_id: "cus_x", mdm_status: "active", mdm_interval: "month", mdm_amount_cents: 15000, mdm_current_period_end: "2026-11-05T00:00:00Z" }]; }
  else if (kind === "buyer") { S.access = new Set(["biggelt"]); S.members = [{ email: "demo@example.org", name: "Mendel Demo", mdm_status: "none" }]; S.purchases = [{ access_key: "biggelt", purchased_at: "2026-10-06T12:00:00Z", extras: { done_for_you: true } }]; }
  else { S.access = new Set(); S.members = []; }
  S.content = all.filter((c) => S.access.has(c.audience));
}

start().catch((e) => { app.innerHTML = `<main class="wrap" style="padding-top:40px;padding-bottom:40px"><h1>Something went wrong</h1><p class="lead">${esc(e.message)}</p></main>`; });
