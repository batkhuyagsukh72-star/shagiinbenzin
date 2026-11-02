/* Шаг — шатахуун хүргэлт · Nomad Web Studio */
(function () {
'use strict';

/* ================= Тохиргоо ================= */
const SB_URL = 'https://pctetxltrszccxtoprvl.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjdGV0eGx0cnN6Y2N4dG9wcnZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2MDcxNjMsImV4cCI6MjEwOTE4MzE2M30.aNdhY84-zfweZHhXaopHXtkdKxXsHR13nS4-6r01Fb4';
const sb = supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } });

const FUELS = { A92: { l: 'А-92', c: 'var(--f92)' }, A95: { l: 'А-95', c: 'var(--f95)' }, E92: { l: 'Евро-92', c: 'var(--fe92)' }, DT: { l: 'Дизель', c: 'var(--fdt)' } };
const DISTRICTS = ['Баянгол', 'Баянзүрх', 'Сонгинохайрхан', 'Сүхбаатар', 'Хан-Уул', 'Чингэлтэй', 'Налайх', 'Багануур', 'Багахангай'];
const ST = { pending: 'Төлбөр хүлээгдэж буй', new: 'Шинэ', accepted: 'Хүлээн авсан', enroute: 'Замд', delivered: 'Хүргэгдсэн', confirmed: 'Баталгаажсан', expired: 'Хугацаа дууссан', dispute: 'Гомдолтой', refunded: 'Буцаалт хийсэн' };
const FLOW = ['new', 'accepted', 'enroute', 'delivered', 'confirmed'];
const UB = [47.9185, 106.9176];
const PAY = { cash: 'Бэлнээр (хүргэлтийн үед)', transfer: 'Дансаар шилжүүлсэн', qpay_out: 'QPay-р (сайтаас гадуур)', later: 'Дараа тооцоо хийнэ' };
const PAY_S = { cash: 'бэлэн', transfer: 'данс', qpay_out: 'QPay гадуур', later: 'дараа тооцоо' };
const DEFAULT_IMG = 'a/tanker-dawn.jpg';

/* ================= Туслах ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
const money = (n) => fmt(n) + '₮';
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fl = (k) => FUELS[k] || { l: k, c: 'var(--fog)' };
const phoneFmt = (p) => (p ? String(p).replace(/\D/g, '').replace(/^(\d{4})(\d{4})$/, '$1 $2') : '');
const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } } };

function parts(iso) {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ulaanbaatar', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(iso));
  const g = (t) => (p.find((x) => x.type === t) || {}).value;
  return { y: g('year'), m: g('month'), d: g('day'), h: g('hour'), mi: g('minute') };
}
const fmtDT = (iso) => { if (!iso) return '—'; const p = parts(iso); return `${p.m}.${p.d} ${p.h}:${p.mi}`; };
const fmtT = (iso) => { if (!iso) return ''; const p = parts(iso); return `${p.h}:${p.mi}`; };
function ago(iso) {
  if (!iso) return 'байршил шинэчлээгүй';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'дөнгөж сая'; if (m < 60) return m + ' мин өмнө'; if (m < 1440) return Math.floor(m / 60) + ' цагийн өмнө';
  return fmtDT(iso);
}
function km(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 6371, r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lng - a.lng) * r;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const etaMin = (k) => (k == null ? null : Math.max(5, Math.round((k * 1.35) / 24 * 60 + 4)));

let toastT;
function toast(msg, err) { const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), err ? 5000 : 2800); }
function nice(e) {
  let m = (e && (e.message || e.error_description || e.error)) || String(e);
  if (/Invalid login credentials/i.test(m)) m = 'Нэвтрэх нэр эсвэл ПИН код буруу байна';
  if (/provider is not enabled|Unsupported provider/i.test(m)) m = 'Google нэвтрэлт хараахан идэвхжээгүй байна. Нэр, ПИН кодоор нэвтэрнэ үү';
  if (/Failed to fetch|NetworkError/i.test(m)) m = 'Сүлжээний алдаа. Интернэтээ шалгаад дахин оролдоно уу';
  return m;
}
async function rpc(name, args) { const { data, error } = await sb.rpc(name, args || {}); if (error) throw new Error(error.message); return data; }
async function fn(name, body) {
  const { data, error } = await sb.functions.invoke(name, { body });
  if (error) { let m = error.message; try { const j = await error.context.json(); m = j.error || m; } catch { /* */ } throw new Error(m); }
  if (data && data.error && !data.order) throw new Error(data.error);
  return data;
}
function busy(btn, on, label) { if (!btn) return; if (on) { btn.dataset.l = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>' + (label ? ' ' + label : ''); } else { btn.disabled = false; if (btn.dataset.l) btn.innerHTML = btn.dataset.l; } }
async function pinEmail(username) {
  const u = String(username || '').trim().toLocaleLowerCase('mn');
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(u));
  return 'u' + [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 24) + '@users.shagiinbenzin.mn';
}
const lockSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';
const youIcon = () => L.divIcon({ className: '', html: '<div class="you"></div>', iconSize: [0, 0] });
const truckIcon = () => L.divIcon({ className: '', html: '<div class="truck">⛽</div>', iconSize: [0, 0] });
const tiles = (m) => L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }).addTo(m);
function geo() {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('Таны төхөөрөмж байршил тодорхойлохгүй байна'));
    navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => rej(new Error('Байршил авах зөвшөөрөл өгөөгүй байна. Газрын зураг дээр дарж заана уу')), { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  });
}

/* ================= Төлөв ================= */
const S = { session: null, profile: null, settings: { min_liters: 10, max_liters: 500, work_hours: '24/7' }, listings: [], fuel: null, sort: 'dist', q: '', you: store.get('shag_you'), sel: null, map: null, layer: null, youMk: null, view: '' };

/* ================= Модал ================= */
let modalCleanup = [];
function openModal(title, html) { closeModal(true); $('#mTitle').textContent = title; $('#mBody').innerHTML = html; $('#modal').hidden = false; document.body.style.overflow = 'hidden'; $('#mBody').scrollTop = 0; $('.sheet').scrollTop = 0; }
function onClose(f) { modalCleanup.push(f); }
function closeModal(silent) { modalCleanup.forEach((f) => { try { f(); } catch { /* */ } }); modalCleanup = []; if (!silent) { $('#modal').hidden = true; document.body.style.overflow = ''; } }
$('#mClose').onclick = () => closeModal();
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });

/* ================= Нэвтрэлт ================= */
async function loadProfile() {
  if (!S.session) { S.profile = null; return; }
  const { data } = await sb.from('profiles').select('*').eq('id', S.session.user.id).maybeSingle();
  S.profile = data || null;
}
function renderHeader() {
  const p = S.profile, on = !!S.session;
  $('#loginBtn').hidden = on; $('#userChip').hidden = !on;
  if (on) $('#userName').textContent = (p && (p.display_name || p.username || p.email)) || S.session.user.email || 'Хэрэглэгч';
  $('[data-nav="minii"]').hidden = !on;
  const sn = $('[data-nav="niiluulegch"]'); sn.hidden = !(p && (p.role === 'supplier' || p.role === 'admin')); sn.textContent = p && p.role === 'admin' ? 'Миний зар' : 'Нийлүүлэгч';
  $('[data-nav="admin"]').hidden = !(p && p.role === 'admin');
}
$('#loginBtn').onclick = () => openAuth();
$('#logoutBtn').onclick = async () => { await sb.auth.signOut(); toast('Гарлаа'); location.hash = ''; };

function openAuth(after, mode) {
  let tab = mode || 'login';
  const draw = () => {
    openModal(tab === 'login' ? 'Нэвтрэх' : 'Бүртгүүлэх', `
      <button class="btn btn-google" type="button" id="gBtn"><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.3-.4-3.5z"/></svg>Google-ээр ${tab === 'login' ? 'нэвтрэх' : 'бүртгүүлэх'}</button>
      <div class="divider">эсвэл нэр, ПИН кодоор</div>
      <div class="seg2" role="group" aria-label="Нэвтрэх эсвэл бүртгүүлэх"><button type="button" data-t="login" aria-pressed="${tab === 'login'}">Нэвтрэх</button><button type="button" data-t="signup" aria-pressed="${tab === 'signup'}">Шинээр бүртгүүлэх</button></div>
      <form id="authForm" class="form" novalidate>
        ${tab === 'signup' ? `<label class="inp">Таны нэр<input id="aName" autocomplete="name" maxlength="60" placeholder="Жишээ нь: Бат"></label>
        <label class="inp">Утасны дугаар<input id="aPhone" type="tel" inputmode="numeric" maxlength="8" autocomplete="tel-national" placeholder="99xxxxxx"></label>` : ''}
        <label class="inp">Нэвтрэх нэр<input id="aUser" autocomplete="username" maxlength="24" autocapitalize="none" spellcheck="false" placeholder="жишээ нь: bat88"></label>
        <label class="inp">ПИН код (6 оронтой)<input id="aPin" type="password" inputmode="numeric" maxlength="6" autocomplete="${tab === 'login' ? 'current-password' : 'new-password'}" placeholder="••••••"></label>
        ${tab === 'signup' ? `<label class="inp">ПИН код давтах<input id="aPin2" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" placeholder="••••••"></label>
        <label class="consent"><input type="checkbox" id="aOk"><span><a href="#nokhtsol" target="_blank">Үйлчилгээний нөхцөл</a>, <a href="#nuutslal" target="_blank">нууцлалын бодлогыг</a> зөвшөөрч байна</span></label>` : ''}
        <button class="btn btn-primary" type="submit" id="aGo">${tab === 'login' ? 'Нэвтрэх' : 'Бүртгүүлэх'}</button>
        ${tab === 'login' ? '<p class="muted small" style="margin:0">ПИН кодоо мартсан бол доорх “Админтай холбогдох” хэсгээр хандана уу.</p>' : ''}
      </form>`);
    $$('#mBody .seg2 button').forEach((b) => (b.onclick = () => { tab = b.dataset.t; draw(); }));
    $('#gBtn').onclick = async () => {
      if (after) store.set('shag_after', 'resume');
      const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
      if (error) toast(nice(error), true);
    };
    $('#authForm').onsubmit = async (e) => {
      e.preventDefault();
      const btn = $('#aGo'), user = $('#aUser').value.trim(), pin = $('#aPin').value.trim();
      if (user.length < 3) return toast('Нэвтрэх нэрээ бичнэ үү', true);
      if (!/^\d{6}$/.test(pin)) return toast('ПИН код 6 оронтой тоо', true);
      busy(btn, true);
      try {
        if (tab === 'signup') {
          const name = $('#aName').value.trim(), phone = $('#aPhone').value.replace(/\D/g, '');
          if (name.length < 2) throw new Error('Нэрээ бичнэ үү');
          if (!/^[5-9]\d{7}$/.test(phone)) throw new Error('Утасны дугаар 8 оронтой');
          if (pin !== $('#aPin2').value.trim()) throw new Error('ПИН код таарахгүй байна');
          if (!$('#aOk').checked) throw new Error('Нөхцөлийг зөвшөөрнө үү');
          await fn('pin-auth', { action: 'signup', username: user, pin, name, phone });
        }
        const { error } = await sb.auth.signInWithPassword({ email: await pinEmail(user), password: pin });
        if (error) throw error;
        closeModal();
        toast(tab === 'signup' ? 'Бүртгэл үүслээ. Тавтай морил!' : 'Нэвтэрлээ');
        if (after) setTimeout(after, 350);
      } catch (err) { toast(nice(err), true); } finally { busy(btn, false); }
    };
  };
  draw();
}

/* ================= Нүүр: үнэ, төрөл, газрын зураг ================= */
async function loadListings() {
  try { S.listings = (await rpc('list_listings', { p_fuel: null })) || []; } catch (e) { S.listings = []; console.error(e); }
  renderPylon(); renderFuels(); if (S.fuel) renderBoard();
}
function stats() {
  return Object.keys(FUELS).map((k) => { const ps = S.listings.filter((l) => l.fuel === k).map((l) => l.price); return { k, min: ps.length ? Math.min(...ps) : null, n: ps.length }; });
}
let pylonOnce = false;
function renderPylon() {
  $('#pylonRows').innerHTML = stats().map((r, i) => `<button type="button" class="prow" data-f="${r.k}" style="--c:${fl(r.k).c};--i:${i}"><span class="ftag">${fl(r.k).l}</span><span class="led"><span class="ghost">8,888</span><span class="val" data-min="${r.min || 0}">${r.min ? fmt(r.min) : '—'}</span></span><em>${r.n} зар</em></button>`).join('');
  const total = S.listings.length;
  $('#pylonLive').textContent = total ? total + ' идэвхтэй зар' : 'одоогоор зар алга';
  $('#pylonTime').textContent = fmtT(new Date().toISOString()) + ' шинэчлэгдсэн';
  $$('#pylonRows .prow').forEach((b) => (b.onclick = () => { selectFuel(b.dataset.f); $('#zahialah').scrollIntoView({ behavior: RM ? 'auto' : 'smooth' }); }));
  if (!pylonOnce && !RM) { pylonOnce = true; $$('#pylonRows .val').forEach((el, i) => { const m = +el.dataset.min; if (!m) return; const t0 = performance.now() + i * 140, from = m - 600; const step = (t) => { const k = Math.max(0, Math.min(1, (t - t0) / 1000)), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(from + (m - from) * e); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }); }
}
function renderFuels() {
  $('#fuels').innerHTML = stats().map((r) => `<button type="button" class="fuel" data-f="${r.k}" aria-pressed="${S.fuel === r.k}" style="--c:${fl(r.k).c}"><b>${fl(r.k).l}</b><span class="p">${r.min ? money(r.min) + '-өөс' : '—'}</span><small>${r.n ? r.n + ' нийлүүлэгч' : 'Одоогоор зар алга'}</small></button>`).join('');
  $$('#fuels .fuel').forEach((b) => (b.onclick = () => selectFuel(b.dataset.f)));
  if (S.profile && S.profile.role === 'supplier' && !$('#supNote')) $('#fuels').insertAdjacentHTML('afterend', '<p class="note" id="supNote">Нийлүүлэгчийн эрхээр нэвтэрсэн тул зөвхөн өөрийн зар харагдана.</p>');
}
function selectFuel(f) {
  S.fuel = f; S.sel = null; $('#boardWrap').hidden = false; renderFuels(); initMap();
  const mp = $('#map'), ls = $('#list');
  if (!RM) { mp.classList.add('pop'); ls.classList.add('pop'); clearTimeout(S.popT); S.popT = setTimeout(() => { mp.classList.remove('pop'); ls.classList.remove('pop'); }, 1400); }
  renderBoard();
  setTimeout(() => { S.map.invalidateSize(); fitMarkers(); }, 60);
  if (innerWidth < 860) setTimeout(() => $('#boardWrap').scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }), 120);
}
function initMap() {
  if (S.map) return;
  S.map = L.map('map', { zoomControl: true, scrollWheelZoom: false }).setView(UB, 12);
  tiles(S.map); S.layer = L.layerGroup().addTo(S.map);
  S.map.on('click', (e) => setYou(e.latlng.lat, e.latlng.lng, 'газрын зураг дээр заасан цэг'));
  S.map.on('focus', () => S.map.scrollWheelZoom.enable());
  if (S.you) placeYou();
}
function placeYou() {
  if (!S.map || !S.you) return;
  if (!S.youMk) { S.youMk = L.marker([S.you.lat, S.you.lng], { icon: youIcon(), draggable: true, zIndexOffset: 1000 }).addTo(S.map); S.youMk.on('dragend', () => { const p = S.youMk.getLatLng(); setYou(p.lat, p.lng, 'газрын зураг дээр заасан цэг'); }); }
  else S.youMk.setLatLng([S.you.lat, S.you.lng]);
  $('#youLabel').textContent = S.you.label || 'заасан цэг';
}
function setYou(lat, lng, label) { S.you = { lat, lng, label }; store.set('shag_you', S.you); placeYou(); renderBoard(); }
$('#locBtn').onclick = async (e) => { const b = e.currentTarget; busy(b, true); try { const p = await geo(); setYou(p.lat, p.lng, 'таны одоогийн байршил'); S.map.setView([p.lat, p.lng], 14); } catch (err) { toast(nice(err), true); } finally { busy(b, false); } };
$('#sortSel').onchange = (e) => { S.sort = e.target.value; renderBoard(); };
$('#q').oninput = (e) => { S.q = e.target.value.trim().toLocaleLowerCase('mn'); renderBoard(); };
function visible() {
  let v = S.listings.filter((l) => l.fuel === S.fuel);
  if (S.q) v = v.filter((l) => [l.supplier_name, l.base_district, l.base_khoroo, l.base_org, l.place].join(' ').toLocaleLowerCase('mn').includes(S.q));
  const d = (l) => { const k = km(S.you, l); return k == null ? 1e9 : k; };
  v.sort((a, b) => (S.sort === 'price' ? a.price - b.price : S.sort === 'new' ? new Date(b.created_at) - new Date(a.created_at) : d(a) - d(b)));
  return v;
}
function fitMarkers() {
  const pts = visible().filter((l) => l.lat != null).map((l) => [l.lat, l.lng]);
  if (S.you) pts.push([S.you.lat, S.you.lng]);
  if (pts.length > 1) S.map.fitBounds(pts, { padding: [40, 40], maxZoom: 14 }); else if (pts.length === 1) S.map.setView(pts[0], 13);
}
function renderBoard() {
  if (!S.fuel) return;
  const v = visible();
  if (S.layer) {
    S.layer.clearLayers();
    v.filter((l) => l.lat != null).forEach((l, i) => {
      const mk = L.marker([l.lat, l.lng], { icon: L.divIcon({ className: '', html: `<div class="mk${S.sel === l.id ? ' on' : ''}" style="--c:${fl(l.fuel).c};--i:${Math.min(i, 10)}"><b>${fmt(l.price)}₮</b><i></i></div>`, iconSize: [0, 0] }), zIndexOffset: S.sel === l.id ? 900 : 0 });
      mk.on('click', () => { S.sel = l.id; renderBoard(); const c = $(`.card[data-id="${l.id}"]`); if (c) c.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'nearest' }); });
      S.layer.addLayer(mk);
    });
  }
  if (!v.length) { $('#list').innerHTML = `<div class="empty">${fl(S.fuel).l} шатахуунтай идэвхтэй зар одоогоор алга. Өөр төрөл сонгох эсвэл түр хүлээнэ үү.</div>`; return; }
  $('#list').innerHTML = v.map((l, i) => {
    const k = km(S.you, l), eta = etaMin(k), pct = Math.round((l.avail_l / Math.max(1, l.total_l)) * 100);
    const base = [l.base_district && l.base_district + ' дүүрэг', l.base_khoroo, l.base_org].filter(Boolean).join(', ') || '—';
    return `<article class="card${S.sel === l.id ? ' on' : ''}" data-id="${l.id}" style="--c:${fl(l.fuel).c};--i:${Math.min(i, 8)}">
      <div class="ph">${l.photo_url ? `<img src="${esc(l.photo_url)}" alt="${esc(l.supplier_name)}-ийн тээврийн хэрэгсэл" loading="${i < 3 ? 'eager' : 'lazy'}">` : ''}<span class="chip">${fl(l.fuel).l}</span></div>
      <div class="bd">
        <div class="r1"><h3>${esc(l.supplier_name)}</h3>${k != null ? `<span class="dist">${k.toFixed(1)} км<br><span class="muted">~${eta} мин</span></span>` : '<span class="dist muted">зай —</span>'}</div>
        <div class="price"><span class="n">${fmt(l.price)}</span><span class="u">₮ / литр</span></div>
        <div class="stock"><div class="bar"><i style="width:${pct}%"></i></div><span><b>${fmt(l.avail_l)}</b> / ${fmt(l.total_l)} л байгаа</span></div>
        <dl class="meta"><dt>Байнгын хаяг</dt><dd>${esc(base)}</dd><dt>Одоо</dt><dd>${esc(l.place || 'байршил')} · <span class="muted">${ago(l.loc_at)}</span></dd><dt>Нийтэлсэн</dt><dd class="mono">${fmtDT(l.created_at)}</dd><dt>Хүргэлт</dt><dd>Хүргэлттэй · үнэгүй</dd></dl>
        <div class="r3"><span class="lock">${lockSvg}Утасны дугаар төлбөрийн дараа нээгдэнэ</span><span style="display:flex;gap:8px">${l.lat != null ? `<button class="btn btn-ghost btn-sm" type="button" data-show="${l.id}">Зураг дээр</button>` : ''}<button class="btn btn-primary btn-sm" type="button" data-order="${l.id}">Захиалах</button></span></div>
      </div></article>`;
  }).join('');
}
$('#list').addEventListener('click', (e) => {
  const o = e.target.closest('[data-order]'), s = e.target.closest('[data-show]');
  if (o) startOrder(+o.dataset.order);
  else if (s) { const l = S.listings.find((x) => x.id === +s.dataset.show); S.sel = l.id; renderBoard(); S.map.setView([l.lat, l.lng], 15); $('.mapbox').scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'nearest' }); }
});

/* ================= Захиалга ================= */
function startOrder(id) {
  const l = S.listings.find((x) => x.id === id); if (!l) return;
  if (!S.session) { toast('Захиалахын тулд нэвтэрнэ үү'); openAuth(() => startOrder(id)); return; }
  if (S.profile && S.profile.role === 'supplier') { toast('Нийлүүлэгчийн эрхээр захиалах боломжгүй', true); return; }
  orderForm(l);
}
function orderForm(l) {
  const st = S.settings, min = st.min_liters, max = Math.min(st.max_liters, l.avail_l);
  if (max < min) { toast('Энэ зарын үлдэгдэл хүрэлцэхгүй байна', true); return; }
  let lit = Math.min(Math.max(40, min), max), when = 'now';
  let loc = S.you ? { lat: S.you.lat, lng: S.you.lng } : null;
  const p = S.profile || {};
  openModal('Шатахуун захиалах', `
    <div class="sum"><img src="${esc(l.photo_url || DEFAULT_IMG)}" alt=""><div><b>${esc(l.supplier_name)} · ${fl(l.fuel).l}</b><span>${money(l.price)}/л · ${fmt(l.avail_l)} л байгаа · хүргэлт үнэгүй</span></div></div>
    <div class="pump" aria-live="polite"><div class="pump-row"><label>Литр</label><span class="d s" id="pLit">0</span></div><div class="pump-row"><label>Нийт дүн ₮</label><span class="d" id="pTot">0</span></div></div>
    <div class="stepper"><button type="button" id="lMinus" aria-label="5 литр хасах">−</button><input id="lIn" type="number" inputmode="numeric" min="${min}" max="${max}" step="5" value="${lit}" aria-label="Литр"><button type="button" id="lPlus" aria-label="5 литр нэмэх">+</button></div>
    <div class="quick">${[20, 40, 60, 100, 200, 500].filter((q) => q >= min && q <= max).map((q) => `<button type="button" data-q="${q}">${q} л</button>`).join('')}</div>
    <div class="break" id="brk"></div>
    <div class="eyebrow">Хүргэх байршил</div>
    <div class="minimap" id="mm"></div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center"><button type="button" class="btn btn-ghost btn-sm" id="mmLoc">◎ Миний одоогийн байршил</button><span class="muted small" id="mmTxt">${loc ? 'Цэгийг чирж нарийвчилж болно' : 'Газрын зураг дээр дарж хүргэх цэгээ заана уу'}</span></div>
    <div class="grid2">
      <label class="inp">Дүүрэг<select id="oDist">${DISTRICTS.map((d) => `<option>${d}</option>`).join('')}</select></label>
      <label class="inp">Хороо<input id="oKh" maxlength="40" placeholder="жишээ нь 1-р хороо"></label>
      <label class="inp full">Байгууллагын нэр (байвал)<input id="oOrg" maxlength="120" placeholder="жишээ нь Төв шуудан"></label>
      <label class="inp full">Дэлгэрэнгүй хаяг, зогсоол<input id="oAddr" maxlength="300" placeholder="Байр, орц, зогсоолын байрлал"></label>
      <label class="inp">Машины улсын дугаар<input id="oCar" maxlength="20" placeholder="0000 УБА" autocapitalize="characters"></label>
      <label class="inp">Утасны дугаар<input id="oPhone" type="tel" inputmode="numeric" maxlength="8" value="${esc(p.phone || '')}" placeholder="99xxxxxx"></label>
      <label class="inp full">Нэмэлт тайлбар<input id="oNote" maxlength="300" placeholder="Машины өнгө, загвар гэх мэт"></label>
    </div>
    <div class="eyebrow">Хүргэх цаг</div>
    <div class="seg2" role="group" aria-label="Хүргэх цаг"><button type="button" data-w="now" aria-pressed="true">Аль болох хурдан</button><button type="button" data-w="at" aria-pressed="false">Цаг товлох</button></div>
    <label class="inp" id="whenBox" hidden>Товлосон цаг<input id="oWhen" type="datetime-local"></label>
    <p class="muted small" style="margin:0">Төлбөр эхлэхэд таны литр ${st.pending_minutes || 15} минут нөөцлөгдөж, үнэ одоогийн ${money(l.price)}-өөр түгжигдэнэ. Захиалснаар <a href="#nokhtsol" target="_blank">үйлчилгээний нөхцөлийг</a> зөвшөөрнө.</p>
    <button class="btn btn-primary" type="button" id="toPay">QPay-р төлөх</button>`);
  const inp = $('#lIn');
  const upd = (v) => {
    lit = Math.max(min, Math.min(max, Math.round(v || 0))); inp.value = lit; const tot = lit * l.price;
    $('#pLit').textContent = lit; $('#pTot').textContent = fmt(tot);
    $('#brk').innerHTML = `<div><span>${fl(l.fuel).l} ${lit} л × ${money(l.price)}</span><span>${money(tot)}</span></div><div><span>Хүргэлт</span><span>үнэгүй</span></div><div class="tot"><span>Нийт төлөх</span><span>${money(tot)}</span></div>`;
    $('#toPay').textContent = 'QPay-р төлөх · ' + money(tot); $('#lMinus').disabled = lit <= min; $('#lPlus').disabled = lit >= max;
  };
  $('#lMinus').onclick = () => upd(lit - 5); $('#lPlus').onclick = () => upd(lit + 5);
  inp.onchange = () => upd(+inp.value); inp.oninput = () => { if (+inp.value >= min && +inp.value <= max) upd(+inp.value); };
  $$('#mBody .quick button').forEach((b) => (b.onclick = () => upd(+b.dataset.q)));
  upd(lit);
  // жижиг газрын зураг
  const mm = L.map('mm', { zoomControl: true }).setView(loc ? [loc.lat, loc.lng] : UB, loc ? 15 : 12); tiles(mm);
  let mk = null;
  const setLoc = (lat, lng) => { loc = { lat, lng }; if (!mk) { mk = L.marker([lat, lng], { icon: youIcon(), draggable: true }).addTo(mm); mk.on('dragend', () => { const q = mk.getLatLng(); loc = { lat: q.lat, lng: q.lng }; }); } else mk.setLatLng([lat, lng]); $('#mmTxt').textContent = 'Цэгийг чирж нарийвчилж болно'; };
  if (loc) setLoc(loc.lat, loc.lng);
  if (l.lat != null) L.marker([l.lat, l.lng], { icon: L.divIcon({ className: '', html: `<div class="mk" style="--c:${fl(l.fuel).c}"><b>${fmt(l.price)}₮</b><i></i></div>`, iconSize: [0, 0] }) }).addTo(mm);
  mm.on('click', (e) => setLoc(e.latlng.lat, e.latlng.lng));
  setTimeout(() => mm.invalidateSize(), 80);
  onClose(() => mm.remove());
  $('#mmLoc').onclick = async (e) => { const b = e.currentTarget; busy(b, true); try { const q = await geo(); setLoc(q.lat, q.lng); mm.setView([q.lat, q.lng], 16); } catch (err) { toast(nice(err), true); } finally { busy(b, false); } };
  $$('#mBody .seg2 button').forEach((b) => (b.onclick = () => { when = b.dataset.w; $$('#mBody .seg2 button').forEach((x) => x.setAttribute('aria-pressed', x === b)); $('#whenBox').hidden = when !== 'at'; if (when === 'at' && !$('#oWhen').value) { const d = new Date(Date.now() + 3600e3); d.setMinutes(0, 0, 0); $('#oWhen').value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); } }));
  $('#toPay').onclick = async (e) => {
    const btn = e.currentTarget;
    const phone = $('#oPhone').value.replace(/\D/g, ''), addr = $('#oAddr').value.trim(), org = $('#oOrg').value.trim();
    if (!loc) return toast('Газрын зураг дээр хүргэх цэгээ заана уу', true);
    if (!$('#oKh').value.trim()) { $('#oKh').focus(); return toast('Хороогоо бичнэ үү', true); }
    if (!addr && !org) { $('#oAddr').focus(); return toast('Хаяг эсвэл байгууллагын нэрээ бичнэ үү', true); }
    if (!/^[5-9]\d{7}$/.test(phone)) { $('#oPhone').focus(); return toast('Утасны дугаар 8 оронтой', true); }
    let sched = null;
    if (when === 'at') { const v = $('#oWhen').value; if (!v) return toast('Товлох цагаа сонгоно уу', true); const d = new Date(v); if (d.getTime() < Date.now()) return toast('Ирээдүйн цаг сонгоно уу', true); sched = d.toISOString(); }
    busy(btn, true, 'Нэхэмжлэх үүсгэж байна');
    try {
      const r = await fn('qpay', { action: 'create', listing_id: l.id, liters: lit, phone, lat: loc.lat, lng: loc.lng, district: $('#oDist').value, khoroo: $('#oKh').value.trim(), org, address: addr, car: $('#oCar').value.trim(), note: $('#oNote').value.trim(), scheduled_at: sched });
      setYou(loc.lat, loc.lng, 'хүргэх цэг');
      loadListings();
      payStep(r.order, r.qpay, r.error);
    } catch (err) { toast(nice(err), true); busy(btn, false); }
  };
}

function payStep(o, q, warn) {
  openModal('QPay төлбөр', `
    <div class="qr-wrap"><div class="qr" id="qrBox">${q && q.qr ? '' : '<span class="muted small">QR алга</span>'}</div><div>
      <div class="muted small">Захиалга <span class="mono">#${o.order_no}</span></div>
      <div style="font-size:26px;font-weight:800;margin:4px 0" class="mono">${money(o.total)}</div>
      <div class="muted small">Литр нөөцлөгдсөн хугацаа</div><div class="timer" id="tmr">--:--</div></div></div>
    ${warn ? `<div class="note err">${esc(warn)}</div>` : '<div class="note">Банкны аппаар QR уншуулах эсвэл утсан дээрээ банкаа сонгоно уу. Төлбөр ормогц энэ цонх автоматаар шинэчлэгдэнэ.</div>'}
    ${q && q.urls && q.urls.length ? `<div class="banks">${q.urls.map((u) => `<a href="${esc(u.link)}" rel="noopener">${u.logo ? `<img src="${esc(u.logo)}" alt="" loading="lazy">` : ''}<span>${esc(u.name)}</span></a>`).join('')}</div>` : ''}
    ${q && q.short ? `<a class="btn btn-ghost" href="${esc(q.short)}" target="_blank" rel="noopener">QPay хуудсаар төлөх</a>` : ''}
    <button class="btn btn-primary" type="button" id="payCheck">Төлбөр шалгах</button>
    ${S.profile && S.profile.role === 'admin' ? '<button class="btn btn-ghost btn-sm" type="button" id="paySim">Туршилтын төлбөр (зөвхөн админ)</button>' : ''}`);
  if (q && q.qr) { try { const qr = qrcode(0, 'M'); qr.addData(q.qr); qr.make(); $('#qrBox').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); } catch { $('#qrBox').innerHTML = '<span class="muted small">QR үүсгэж чадсангүй</span>'; } }
  const exp = new Date(o.expires_at).getTime();
  const tick = () => { const s = Math.max(0, Math.round((exp - Date.now()) / 1000)); const t = $('#tmr'); if (t) t.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); if (s <= 0) { stop(); $('#mBody').insertAdjacentHTML('afterbegin', '<div class="note err">Төлбөрийн хугацаа дууссан. Дахин захиална уу.</div>'); } };
  let done = false;
  const paid = () => { if (done) return; done = true; stop(); toast('Төлбөр баталгаажлаа'); loadListings(); trackView(o.id); };
  const check = async (manual) => {
    try { const r = await fn('qpay', { action: 'check', order_id: o.id }); if (r.paid_at || r.result === 'paid') paid(); else if (manual) toast('Төлбөр хараахан ороогүй байна'); }
    catch (err) { if (manual) toast(nice(err), true); }
  };
  const t1 = setInterval(tick, 1000), t2 = setInterval(() => check(false), 6000);
  const ch = sb.channel('pay-' + o.id).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: 'id=eq.' + o.id }, (pl) => { if (pl.new && pl.new.paid_at) paid(); }).subscribe();
  const stop = () => { clearInterval(t1); clearInterval(t2); sb.removeChannel(ch); };
  onClose(stop); tick();
  $('#payCheck').onclick = async (e) => { const b = e.currentTarget; busy(b, true); await check(true); busy(b, false); };
  const sim = $('#paySim'); if (sim) sim.onclick = async () => { try { await fn('qpay', { action: 'simulate', order_id: o.id }); paid(); } catch (err) { toast(nice(err), true); } };
}

async function trackView(id) {
  let o;
  try { o = ((await rpc('my_orders')) || []).find((x) => x.id === id); } catch (err) { toast(nice(err), true); return; }
  if (!o) { toast('Захиалга олдсонгүй', true); return; }
  const paid = !!o.paid_at;
  const sup = await rpc('order_supplier', { p_order: id }).catch(() => null);
  const contact = paid ? await rpc('support_contact').catch(() => null) : null;
  const idx = FLOW.indexOf(o.status), canConfirm = ['accepted', 'enroute', 'delivered'].includes(o.status);
  const k = sup && sup.lat != null ? km({ lat: sup.lat, lng: sup.lng }, { lat: o.lat, lng: o.lng }) : null;
  openModal('Захиалга #' + o.order_no, `
    <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between"><span class="pill p-${o.status}">${ST[o.status] || o.status}</span><span class="muted small mono">${fmtDT(o.created_at)}</span></div>
    ${paid && sup ? `<div class="contact"><div><small>Нийлүүлэгч · ${esc(sup.name)}</small><a class="mono" href="tel:${esc(sup.phone || '')}" style="text-decoration:none">${phoneFmt(sup.phone) || '—'}</a></div><button class="btn btn-ok btn-sm" type="button" id="cpy">Хуулах</button></div>
      <div class="minimap" id="tm"></div>
      <p class="muted small" style="margin:-4px 0 0">${k != null ? `Нийлүүлэгч таны цэгээс <b class="mono">${k.toFixed(1)} км</b>, ойролцоогоор <b class="mono">${etaMin(k)} минутын</b> дараа очно. ` : ''}Нийлүүлэгчийн байршил: ${esc(sup.place || '')} · ${ago(sup.loc_at)}</p>`
      : o.status === 'pending' ? '<div class="note warn">Төлбөр хүлээгдэж байна. Төлбөр орсны дараа нийлүүлэгчийн утасны дугаар, байршил нээгдэнэ.</div>' : ''}
    ${o.status === 'dispute' ? '<div class="note warn">Таны гомдлыг админ хүлээн авсан. Удахгүй холбогдоно.</div>' : ''}
    ${o.status === 'expired' ? '<div class="note">Төлбөр хугацаандаа ороогүй тул захиалга хүчингүй болсон.</div>' : ''}
    ${paid ? `<ol class="track">${FLOW.map((s, i) => { const d = o.status === 'confirmed' || i < idx; return `<li class="${d ? 'done' : i === idx ? 'now' : ''}"><span class="dot">${d ? '✓' : i + 1}</span><div><b>${ST[s]}</b></div><time></time></li>`; }).join('')}</ol>` : ''}
    <div class="break"><div><span>${fl(o.fuel).l} · ${o.liters} л × ${money(o.unit_price)}</span><span>${money(o.total)}</span></div>
      <div><span>Хаяг</span><span style="font-family:var(--body)">${esc([o.district, o.khoroo, o.org_name, o.address].filter(Boolean).join(', '))}</span></div>
      ${o.car_plate ? `<div><span>Машин</span><span>${esc(o.car_plate)}</span></div>` : ''}
      <div><span>Хүргэх цаг</span><span style="font-family:var(--body)">${o.scheduled_at ? fmtDT(o.scheduled_at) : 'Аль болох хурдан'}</span></div></div>
    ${o.status === 'pending' && o.qpay_qr && new Date(o.expires_at) > new Date() ? '<button class="btn btn-primary" type="button" id="rePay">Төлөх</button>' : ''}
    ${canConfirm ? '<button class="btn btn-primary" type="button" id="cfm">Шатахуунаа хүлээн авлаа</button>' : ''}
    ${['pending', 'new', 'accepted', 'enroute'].includes(o.status) ? '<button class="btn btn-ghost" type="button" id="reLoc">◎ Хүргэх байршлаа одоогийн байршлаар солих</button>' : ''}
    ${paid && !['refunded'].includes(o.status) ? '<details><summary class="muted small" style="cursor:pointer">Гомдол гаргах</summary><div class="form" style="margin-top:10px"><label class="inp">Юу болсон бэ?<textarea id="dspMsg" placeholder="Жишээ нь: ирээгүй, литр дутуу"></textarea></label><button class="btn btn-danger" type="button" id="dsp">Админд илгээх</button></div></details>' : ''}
    ${contact && (contact.phone1 || contact.phone2 || contact.email) ? `<div class="note"><b>Шагийн тусламж</b> · ${esc(contact.work_hours || '24/7')}<br>${[contact.phone1, contact.phone2].filter(Boolean).map((x) => `<a class="mono" href="tel:${esc(x)}">${esc(phoneFmt(x) || x)}</a>`).join(' · ')}${contact.email ? ' · <span class="mono">' + esc(contact.email) + '</span>' : ''}</div>` : ''}`);
  if (paid && sup) {
    $('#cpy').onclick = () => { const t = sup.phone || ''; if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => toast('Хуулагдлаа: ' + phoneFmt(t)), () => toast(phoneFmt(t))); else toast(phoneFmt(t)); };
    const tm = L.map('tm', { zoomControl: true }); tiles(tm);
    const pts = [[o.lat, o.lng]]; L.marker([o.lat, o.lng], { icon: youIcon() }).addTo(tm);
    let truck = null; if (sup.lat != null) { truck = L.marker([sup.lat, sup.lng], { icon: truckIcon() }).addTo(tm); pts.push([sup.lat, sup.lng]); }
    if (pts.length > 1) tm.fitBounds(pts, { padding: [30, 30], maxZoom: 15 }); else tm.setView(pts[0], 14);
    setTimeout(() => tm.invalidateSize(), 80);
    const iv = setInterval(async () => { const s2 = await rpc('order_supplier', { p_order: id }).catch(() => null); if (s2 && s2.lat != null) { if (!truck) truck = L.marker([s2.lat, s2.lng], { icon: truckIcon() }).addTo(tm); else truck.setLatLng([s2.lat, s2.lng]); } }, 20000);
    onClose(() => { clearInterval(iv); tm.remove(); });
  }
  const ch = sb.channel('trk-' + id).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: 'id=eq.' + id }, (pl) => { if (pl.new && pl.new.status !== o.status) { toast('Төлөв: ' + (ST[pl.new.status] || pl.new.status)); trackView(id); } }).subscribe();
  onClose(() => sb.removeChannel(ch));
  const rp = $('#rePay'); if (rp) rp.onclick = () => payStep(o, { qr: o.qpay_qr, short: o.qpay_short, urls: o.qpay_urls || [] });
  const cf = $('#cfm'); if (cf) cf.onclick = async () => { busy(cf, true); try { await rpc('customer_confirm', { p_order: id }); toast('Баярлалаа! Захиалга хаагдлаа.'); trackView(id); if (S.view === 'minii') renderMyOrders(); } catch (err) { toast(nice(err), true); busy(cf, false); } };
  const rl = $('#reLoc'); if (rl) rl.onclick = async () => { busy(rl, true); try { const q = await geo(); await rpc('customer_update_location', { p_order: id, p_lat: q.lat, p_lng: q.lng, p_address: null }); toast('Хүргэх байршил шинэчлэгдлээ'); trackView(id); } catch (err) { toast(nice(err), true); busy(rl, false); } };
  const ds = $('#dsp'); if (ds) ds.onclick = async () => { const m = $('#dspMsg').value.trim(); if (m.length < 3) return toast('Юу болсныг бичнэ үү', true); busy(ds, true); try { await rpc('customer_dispute', { p_order: id, p_message: m }); toast('Админд илгээлээ'); trackView(id); } catch (err) { toast(nice(err), true); busy(ds, false); } };
}

/* ================= Миний захиалга ================= */
async function renderMyOrders() {
  const box = $('#myOrders');
  if (!S.session) { box.innerHTML = `<div class="gate"><p class="muted">Захиалгаа харахын тулд нэвтэрнэ үү.</p><button class="btn btn-primary" type="button" id="gl">Нэвтрэх</button></div>`; $('#gl').onclick = () => openAuth(renderMyOrders); return; }
  box.innerHTML = '<div class="box-b"><span class="spin"></span></div>';
  let list = [];
  try { list = (await rpc('my_orders')) || []; } catch (err) { box.innerHTML = `<div class="box-b note err">${esc(nice(err))}</div>`; return; }
  if (!list.length) { box.innerHTML = '<div class="empty" style="border:0">Захиалга алга. <a href="#zahialah">Шатахуун захиалах</a></div>'; return; }
  box.innerHTML = list.map((o) => `<div class="order"><div class="o1"><b>#${o.order_no}</b><span class="pill p-${o.status}">${ST[o.status] || o.status}</span></div>
    <div class="o2"><span><strong>${fl(o.fuel).l} · ${o.liters} л</strong></span><span class="mono">${money(o.total)}</span><span>${esc(o.supplier_name)}</span><span class="mono">${fmtDT(o.created_at)}</span></div>
    <div class="o3"><button class="btn btn-ghost btn-sm" type="button" data-open="${o.id}">Дэлгэрэнгүй</button></div></div>`).join('');
  $$('#myOrders [data-open]').forEach((b) => (b.onclick = () => trackView(b.dataset.open)));
}

/* ================= Нийлүүлэгч ================= */
const SUP = { orders: [], listings: [], watch: null, lastSent: 0, lastPos: null, sound: store.get('shag_sound') === true, seen: new Set(), ch: null, edit: null };
let audioCtx = null;
function beep() { if (!SUP.sound) return; try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); [0, 0.25, 0.5].forEach((t) => { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination); g.gain.setValueAtTime(0.25, audioCtx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + t + 0.2); o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + 0.21); }); } catch { /* */ } }
function gate(root, msg, withLogin) { root.innerHTML = `<div class="gate"><p class="muted">${msg}</p>${withLogin ? '<button class="btn btn-primary" type="button" id="gl">Нэвтрэх</button>' : ''}</div>`; const g = $('#gl', root); if (g) g.onclick = () => openAuth(route); }
async function renderSupplier() {
  const root = $('#supRoot');
  if (!S.session) return gate(root, 'Нийлүүлэгчийн самбарт нэвтэрнэ үү.', true);
  if (!S.profile || !['supplier', 'admin'].includes(S.profile.role)) return gate(root, 'Нийлүүлэгчийн эрхийг админ олгоно. Админтай холбогдоно уу.');
  const pr = S.profile, isAdm = pr.role === 'admin';
  root.innerHTML = `
    <div class="panel-head"><div><div class="eyebrow">${isAdm ? 'Админ · миний зар, хүргэлт' : 'Нийлүүлэгчийн самбар'}</div><h1>${esc(pr.display_name || 'Нийлүүлэгч')}</h1></div>
      <div style="display:flex;flex-wrap:wrap;gap:8px"><button class="btn btn-ghost btn-sm" type="button" id="sndBtn"></button><button class="btn btn-ghost btn-sm" type="button" id="geoBtn"></button></div></div>
    <p class="muted small" id="geoTxt" style="margin:6px 0 0"></p>
    <form class="${pr.phone ? 'note' : 'note warn'}" id="pf" novalidate style="margin-top:14px;display:grid;gap:10px">
      ${pr.phone ? `<div style="display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:space-between"><span>Захиалагч төлбөр төлсний дараа харагдах: <b>${esc(pr.display_name || '—')}</b> · <b class="mono">${phoneFmt(pr.phone)}</b></span><button class="btn btn-ghost btn-sm" type="button" id="pfEdit">Засах</button></div>` : '<b>Зар нийтлэхийн өмнө захиалагчид харагдах нэр, утасны дугаараа оруулна уу.</b>'}
      <div class="grid2" id="pfBox"${pr.phone ? ' hidden' : ''}>
        <label class="inp">Захиалагчид харагдах нэр<input id="pfName" maxlength="60" value="${esc(pr.display_name || '')}" placeholder="жишээ нь Шаг хүргэлт"></label>
        <label class="inp">Утасны дугаар<input id="pfPhone" type="tel" inputmode="numeric" maxlength="8" autocomplete="tel-national" value="${esc(pr.phone || '')}" placeholder="99xxxxxx"></label>
        <div class="full"><button class="btn btn-primary btn-sm" type="submit" id="pfGo">Хадгалах</button></div>
      </div>
    </form>
    <div class="kpis" id="supK"></div>
    <div class="cols">
      <div class="box"><div class="box-h"><h3>Ирсэн захиалгууд</h3><span class="muted small">Төлбөр орсон захиалга л харагдана</span></div><div class="olist" id="supO"></div></div>
      <div class="box"><div class="box-h"><h3>Миний зарууд</h3><span class="muted small" id="supLc"></span></div><div id="supL"></div>
        <form class="box-b grid2" id="lf" novalidate style="border-top:1px solid var(--line)"></form></div>
    </div><div style="height:70px"></div>`;
  const pe = $('#pfEdit'); if (pe) pe.onclick = () => { $('#pfBox').hidden = !$('#pfBox').hidden; };
  $('#pf').onsubmit = async (e) => {
    e.preventDefault(); const b = $('#pfGo'), ph = $('#pfPhone').value.replace(/\D/g, ''), nm = $('#pfName').value.trim();
    if (nm.length < 2) { $('#pfName').focus(); return toast('Нэрээ бичнэ үү', true); }
    if (!/^[5-9]\d{7}$/.test(ph)) { $('#pfPhone').focus(); return toast('Утасны дугаар 8 оронтой', true); }
    busy(b, true);
    try { await rpc('update_my_profile', { p_name: nm, p_phone: ph }); await loadProfile(); renderHeader(); toast('Хадгалагдлаа'); renderSupplier(); }
    catch (err) { toast(nice(err), true); busy(b, false); }
  };
  $('#sndBtn').onclick = () => { SUP.sound = !SUP.sound; store.set('shag_sound', SUP.sound); if (SUP.sound) beep(); drawTools(); };
  $('#geoBtn').onclick = () => { if (SUP.watch != null) stopWatch(); else startWatch(); drawTools(); };
  drawTools();
  if (store.get('shag_geo') === true && SUP.watch == null) startWatch();
  await loadSupplier();
  if (!SUP.ch) SUP.ch = sb.channel('sup-orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { if (S.view === 'niiluulegch') loadSupplier(); }).subscribe();
}
function drawTools() {
  const s = $('#sndBtn'), g = $('#geoBtn'); if (!s) return;
  s.textContent = SUP.sound ? '🔔 Дуут дохио: асаалттай' : '🔕 Дуут дохио асаах';
  g.textContent = SUP.watch != null ? '◉ Байршил автоматаар шинэчилж байна' : '◎ Байршлаа автоматаар шинэчлэх';
  g.className = 'btn btn-sm ' + (SUP.watch != null ? 'btn-ok' : 'btn-primary');
}
function startWatch() {
  if (!navigator.geolocation) return toast('Төхөөрөмж байршил дэмжихгүй', true);
  store.set('shag_geo', true);
  SUP.watch = navigator.geolocation.watchPosition(async (p) => {
    const pos = { lat: p.coords.latitude, lng: p.coords.longitude }; const moved = SUP.lastPos ? km(SUP.lastPos, pos) * 1000 : 1e9;
    if (Date.now() - SUP.lastSent < 30000 && moved < 150) return;
    SUP.lastSent = Date.now(); SUP.lastPos = pos;
    try { const n = await rpc('supplier_update_location', { p_lat: pos.lat, p_lng: pos.lng, p_place: null }); const t = $('#geoTxt'); if (t) t.textContent = `Байршил ${fmtT(new Date().toISOString())}-д шинэчлэгдлээ · ${n} зар`; } catch (err) { const t = $('#geoTxt'); if (t) t.textContent = nice(err); }
  }, (err) => { toast('Байршлын зөвшөөрөл өгөөгүй байна', true); stopWatch(); drawTools(); }, { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 });
  const t = $('#geoTxt'); if (t) t.textContent = 'Энэ хуудсыг нээлттэй байлгавал байршил 30 секунд тутам шинэчлэгдэнэ.';
}
function stopWatch() { if (SUP.watch != null) navigator.geolocation.clearWatch(SUP.watch); SUP.watch = null; store.set('shag_geo', false); }
async function loadSupplier() {
  try {
    const [o, l] = await Promise.all([rpc('supplier_orders'), sb.from('listings').select('*').eq('supplier_id', S.session.user.id).order('created_at', { ascending: false })]);
    SUP.orders = o || []; SUP.listings = (l.data) || [];
  } catch (err) { toast(nice(err), true); }
  const fresh = SUP.orders.filter((x) => x.status === 'new' && !SUP.seen.has(x.id));
  if (fresh.length && SUP.seen.size) beep();
  SUP.orders.forEach((x) => SUP.seen.add(x.id));
  drawSupplier(new Set(fresh.map((x) => x.id)));
}
function drawSupplier(freshIds) {
  if (!$('#supO')) return;
  const today = parts(new Date().toISOString()), isToday = (iso) => { const p = parts(iso); return p.y === today.y && p.m === today.m && p.d === today.d; };
  const td = SUP.orders.filter((o) => isToday(o.paid_at) && o.status !== 'refunded');
  $('#supK').innerHTML = [
    ['Шинэ захиалга', SUP.orders.filter((o) => o.status === 'new').length, 'хүлээн авах', 'hot'],
    ['Явцад', SUP.orders.filter((o) => ['accepted', 'enroute', 'delivered'].includes(o.status)).length, 'хүлээн авсан → хүргэгдсэн', ''],
    ['Өнөөдөр зарсан', fmt(td.reduce((a, o) => a + o.liters, 0)) + ' л', td.length + ' захиалга', ''],
    ['Өнөөдрийн борлуулалт', money(td.reduce((a, o) => a + o.total, 0)), 'төлөгдсөн захиалга', ''],
    ['Идэвхтэй зар', SUP.listings.filter((l) => l.status === 'active').length, S.profile.role === 'admin' ? 'хязгааргүй' : 'хязгаар ' + (S.profile.max_listings ?? '—'), ''],
  ].map((k) => `<div class="kpi ${k[3]}"><span>${k[0]}</span><b>${k[1]}</b><small>${k[2]}</small></div>`).join('');
  const NEXT = { new: ['accepted', 'Хүлээн авах'], accepted: ['enroute', 'Замд гарлаа'], enroute: ['delivered', 'Хүргэгдсэн'] };
  $('#supO').innerHTML = SUP.orders.length ? SUP.orders.map((o) => {
    const n = NEXT[o.status];
    const addrTxt = [o.district, o.khoroo, o.org_name, o.address].filter(Boolean).join(', ');
    const dir = o.lat != null ? `https://www.google.com/maps/dir/?api=1&destination=${o.lat},${o.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addrTxt + ', Улаанбаатар')}`;
    const man = o.manual ? `<div class="note${o.pay_method === 'cash' ? ' warn' : ''}">Утсаар ирсэн захиалга (админ бүртгэсэн) · ${o.pay_method === 'cash' ? `<b>Бэлнээр ${money(o.total)} авна</b>` : o.pay_method === 'later' ? 'Төлбөрийг админ дараа тооцно' : esc(PAY[o.pay_method] || '') + ' төлөгдсөн'}</div>` : '';
    return `<div class="order${freshIds && freshIds.has(o.id) ? ' fresh' : ''}"><div class="o1"><b>#${o.order_no}</b><span class="pill p-${o.status}">${ST[o.status] || o.status}</span></div>
      <div class="o2"><span><strong>${fl(o.fuel).l} · ${o.liters} л</strong></span><span class="mono">${money(o.total)}</span><span class="mono">${fmtDT(o.paid_at)}</span>${o.scheduled_at ? `<span>Товлосон: <strong class="mono">${fmtDT(o.scheduled_at)}</strong></span>` : '<span>Аль болох хурдан</span>'}</div>
      ${man}<div class="o2"><span>Захиалагч${o.manual_name ? ' ' + esc(o.manual_name) : ''}: <a class="mono" href="tel:${esc(o.customer_phone)}"><strong>${phoneFmt(o.customer_phone)}</strong></a></span>${o.car_plate ? `<span>Машин: <strong>${esc(o.car_plate)}</strong></span>` : ''}</div>
      <div class="o2"><span>${esc(addrTxt)}${o.note ? ' · ' + esc(o.note) : ''}</span></div>
      ${o.late_paid ? '<div class="note warn">Хугацаа дууссаны дараа төлөгдсөн, үлдэгдлээ шалгана уу.</div>' : ''}
      <div class="o3">${n ? `<button class="btn btn-primary btn-sm" type="button" data-st="${n[0]}" data-id="${o.id}">${n[1]}</button>` : o.status === 'delivered' ? '<span class="muted small">Захиалагч баталгаажуулахыг хүлээж байна</span>' : ''}
        ${['new', 'accepted', 'enroute'].includes(o.status) ? `<a class="btn btn-ghost btn-sm" href="${dir}" target="_blank" rel="noopener">${o.lat != null ? 'Чиглэл (Google Maps)' : 'Хаягаар хайх (Google Maps)'}</a>` : ''}</div></div>`;
  }).join('') : '<div class="empty" style="border:0">Төлөгдсөн захиалга одоогоор алга. Шинэ захиалга ирэхэд энд гарч дуут дохио өгнө.</div>';
  $$('#supO [data-st]').forEach((b) => (b.onclick = async () => { busy(b, true); try { const r = await rpc('supplier_set_status', { p_order: b.dataset.id, p_status: b.dataset.st }); toast(ST[r] || ST[b.dataset.st]); await loadSupplier(); } catch (err) { toast(nice(err), true); busy(b, false); } }));
  const act = SUP.listings.filter((l) => l.status !== 'finished').length;
  $('#supLc').textContent = S.profile.role === 'admin' ? `${act} зар` : `${act} / ${S.profile.max_listings ?? '—'} зар`;
  $('#supL').innerHTML = SUP.listings.length ? SUP.listings.map((l) => `<div class="my"><div class="my1"><span class="chip" style="--c:${fl(l.fuel).c}">${fl(l.fuel).l}</span><b class="mono">${money(l.price)}</b><span class="mono muted small">${fmt(l.avail_l)} / ${fmt(l.total_l)} л</span><span class="pill p-${l.status}">${{ active: 'Идэвхтэй', paused: 'Түр зогссон', finished: 'Дууссан' }[l.status]}</span></div>
      <div class="muted small">${esc(l.place || 'Одоогийн газар бичээгүй')} · ${ago(l.loc_at)} · Нийтэлсэн ${fmtDT(l.created_at)}</div>
      <div class="o3"><select class="isel" data-ls="${l.id}" aria-label="Зарын төлөв"><option value="active"${l.status === 'active' ? ' selected' : ''}>Идэвхтэй</option><option value="paused"${l.status === 'paused' ? ' selected' : ''}>Түр зогссон</option><option value="finished"${l.status === 'finished' ? ' selected' : ''}>Дууссан</option></select><button class="btn btn-ghost btn-sm" type="button" data-edit="${l.id}">Засах</button></div></div>`).join('') : '<div class="empty" style="border:0">Зар алга. Доорх маягтаар эхний зараа нэмнэ үү.</div>';
  $$('#supL [data-ls]').forEach((s) => (s.onchange = async () => { try { await rpc('supplier_set_listing_status', { p_id: +s.dataset.ls, p_status: s.value }); toast('Зарын төлөв шинэчлэгдлээ'); loadSupplier(); } catch (err) { toast(nice(err), true); } }));
  $$('#supL [data-edit]').forEach((b) => (b.onclick = () => { SUP.edit = SUP.listings.find((x) => x.id === +b.dataset.edit); drawForm(); $('#lf').scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' }); }));
  drawForm();
}
async function resizeImage(file, max = 1280) {
  const img = await createImageBitmap(file); const r = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob(res, 'image/jpeg', 0.82));
}
function drawForm() {
  const f = $('#lf'); if (!f) return; const e = SUP.edit;
  f.innerHTML = `<div class="full" style="display:flex;justify-content:space-between;align-items:center;gap:10px"><b>${e ? 'Зар засах' : 'Шинэ зар нэмэх'}</b>${e ? '<button class="btn btn-ghost btn-sm" type="button" id="lfCancel">Болих</button>' : ''}</div>
    <label class="inp">Шатахууны төрөл<select id="lFuel">${Object.keys(FUELS).map((k) => `<option value="${k}"${e && e.fuel === k ? ' selected' : ''}>${fl(k).l}</option>`).join('')}</select></label>
    <label class="inp">1 литрийн үнэ (₮)<input id="lPrice" type="number" inputmode="numeric" min="500" max="20000" value="${e ? e.price : ''}" placeholder="2690"></label>
    <label class="inp">Нийт байгаа хэмжээ (л)<input id="lTotal" type="number" inputmode="numeric" min="1" value="${e ? e.total_l : ''}" placeholder="3000"></label>
    <label class="inp">Одоо үлдсэн (л)<input id="lAvail" type="number" inputmode="numeric" min="0" value="${e ? e.avail_l : ''}" placeholder="нийттэй адил"></label>
    <label class="inp">Байнгын дүүрэг<select id="lDist">${DISTRICTS.map((d) => `<option${e && e.base_district === d ? ' selected' : ''}>${d}</option>`).join('')}</select></label>
    <label class="inp">Хороо<input id="lKh" maxlength="40" value="${esc(e ? e.base_khoroo || '' : '')}" placeholder="жишээ нь 3-р хороо"></label>
    <label class="inp full">Байгууллагын нэр<input id="lOrg" maxlength="120" value="${esc(e ? e.base_org || '' : '')}" placeholder="жишээ нь Туул Ойл ХХК"></label>
    <label class="inp full">Яг одоо явж буй газар<input id="lPlace" maxlength="200" value="${esc(e ? e.place || '' : '')}" placeholder="жишээ нь Энхтайваны өргөн чөлөө, 3-р хороолол"></label>
    <label class="inp">Төлөв<select id="lSt"><option value="active">Идэвхтэй</option><option value="paused"${e && e.status === 'paused' ? ' selected' : ''}>Түр зогссон</option><option value="finished"${e && e.status === 'finished' ? ' selected' : ''}>Дууссан</option></select></label>
    <label class="inp">Зураг<input id="lImg" type="file" accept="image/jpeg,image/png,image/webp"></label>
    <p class="muted small full" style="margin:0">Одоогийн байршил таны утасны GPS-ээс автоматаар авна. Хүргэлт үнэгүй.</p>
    <div class="full"><button class="btn btn-primary" type="submit" id="lGo">${e ? 'Хадгалах' : 'Зар нийтлэх'}</button></div>`;
  const c = $('#lfCancel'); if (c) c.onclick = () => { SUP.edit = null; drawForm(); };
  f.onsubmit = async (ev) => {
    ev.preventDefault(); const btn = $('#lGo');
    const price = +$('#lPrice').value, total = +$('#lTotal').value, availRaw = $('#lAvail').value;
    if (!(price >= 500 && price <= 20000)) return toast('1 литрийн үнэ 500 – 20,000₮', true);
    if (!(total >= 1)) return toast('Нийт хэмжээгээ оруулна уу', true);
    const avail = availRaw === '' ? (e ? Math.min(e.avail_l, total) : total) : +availRaw;
    if (avail < 0 || avail > total) return toast('Үлдэгдэл 0-ээс нийт хэмжээний хооронд', true);
    busy(btn, true);
    try {
      let pos = SUP.lastPos;
      if (!pos && !e) { try { pos = await geo(); SUP.lastPos = pos; } catch { /* байршилгүйгээр хадгална */ } }
      let photo = null; const file = $('#lImg').files[0];
      if (file) { const blob = await resizeImage(file); const path = `${S.session.user.id}/${Date.now()}.jpg`; const up = await sb.storage.from('listing-photos').upload(path, blob, { contentType: 'image/jpeg' }); if (up.error) throw up.error; photo = sb.storage.from('listing-photos').getPublicUrl(path).data.publicUrl; }
      await rpc('supplier_save_listing', { p_id: e ? e.id : null, p_fuel: $('#lFuel').value, p_price: price, p_total: total, p_avail: avail, p_district: $('#lDist').value, p_khoroo: $('#lKh').value.trim(), p_org: $('#lOrg').value.trim(), p_place: $('#lPlace').value.trim(), p_lat: pos ? pos.lat : null, p_lng: pos ? pos.lng : null, p_photo: photo, p_status: $('#lSt').value });
      toast(e ? 'Хадгалагдлаа' : 'Зар нийтлэгдлээ'); SUP.edit = null; await loadSupplier(); loadListings();
    } catch (err) { toast(nice(err), true); } finally { busy(btn, false); }
  };
}

/* ================= Админ ================= */
const ADM = { tab: 'orders', status: '', dash: null, ch: null, days: 7 };
async function renderAdmin() {
  const root = $('#admRoot');
  if (!S.session) return gate(root, 'Админ хэсэгт нэвтэрнэ үү.', true);
  if (!S.profile || S.profile.role !== 'admin') return gate(root, 'Энэ хэсэг зөвхөн админд нээлттэй.');
  root.innerHTML = `
    <div class="panel-head"><div><div class="eyebrow">Админ · бүх үйлдэл нэг цонхонд</div><h1 id="admDate">Өнөөдөр</h1></div><span class="muted small">${S.profile.admin_level === 'owner' ? 'Эзэмшигч' : 'Менежер'} эрхээр</span></div>
    <div class="kpis" id="admK"></div>
    <div class="cols">
      <div class="box"><div class="box-h"><h3>Орлого</h3><select class="isel" id="admDays" aria-label="Хугацаа"><option value="7">7 хоног</option><option value="30">30 хоног</option></select></div><div class="box-b chart" id="admChart"></div>
        <div class="tbl-wrap" style="border-top:1px solid var(--line)"><table class="tbl"><thead><tr><th>Өнөөдөр · төрлөөр</th><th>Захиалга</th><th>Литр</th><th>Орлого</th></tr></thead><tbody id="admFuel"></tbody></table></div>
        <div class="tbl-wrap" style="border-top:1px solid var(--line)"><table class="tbl"><thead><tr><th>Өнөөдөр · нийлүүлэгчээр</th><th>Захиалга</th><th>Литр</th><th>Орлого</th></tr></thead><tbody id="admSup"></tbody></table></div></div>
      <div class="box"><div class="box-h"><h3>Үйлдлийн бүртгэл</h3><span class="muted small">хэн, хэзээ, юу хийсэн</span></div><ul class="feed" id="feed"></ul></div>
    </div>
    <div class="box" style="margin:16px 0 70px"><div class="tabbar" role="tablist" id="admTabs"></div><div id="admBody"></div></div>`;
  $('#admDays').value = String(ADM.days);
  $('#admDays').onchange = (e) => { ADM.days = +e.target.value; loadDash(); };
  await Promise.all([loadDash(), loadFeed()]);
  drawTabs();
  if (!ADM.ch) ADM.ch = sb.channel('adm').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_log' }, (pl) => { if (S.view !== 'admin') return; prependFeed(pl.new); clearTimeout(ADM.t); ADM.t = setTimeout(() => { loadDash(); if (['orders', 'feedback', 'listings'].includes(ADM.tab)) drawTabs(); }, 800); }).subscribe();
}
async function loadDash() {
  try { ADM.dash = await rpc('admin_dashboard', { p_days: ADM.days }); } catch (err) { toast(nice(err), true); return; }
  const d = ADM.dash;
  $('#admDate').textContent = 'Өнөөдөр, ' + d.today.slice(5).replace('-', '.');
  $('#admK').innerHTML = [
    ['Өнөөдрийн орлого', money(d.today_revenue), d.today_orders + ' төлөгдсөн захиалга', 'hot'],
    ['Зарагдсан литр', fmt(d.today_liters) + ' л', 'өнөөдөр', ''],
    ['Шинэ захиалга', d.new_orders, 'хүлээн аваагүй', d.new_orders ? 'hot' : ''],
    ['Явцад', d.active_orders, 'шинэ → хүргэгдсэн', ''],
    ['Гомдол · санал', d.disputes + ' · ' + d.open_feedback, 'шийдвэрлээгүй', d.disputes ? 'alert' : ''],
    ['Идэвхтэй зар', d.active_listings, d.suppliers + ' нийлүүлэгч · ' + d.customers + ' захиалагч', ''],
  ].map((k) => `<div class="kpi ${k[3]}"><span>${k[0]}</span><b>${k[1]}</b><small>${k[2]}</small></div>`).join('');
  drawChart(d.daily || []);
  const row = (a, name) => `<tr><td>${name}</td><td class="n">${a.n}</td><td class="n">${fmt(a.liters)} л</td><td class="n">${money(a.rev)}</td></tr>`;
  $('#admFuel').innerHTML = (d.by_fuel || []).map((a) => row(a, `<span class="chip" style="--c:${fl(a.fuel).c}">${fl(a.fuel).l}</span>`)).join('') || '<tr><td colspan="4" class="muted">Өнөөдөр борлуулалт алга</td></tr>';
  $('#admSup').innerHTML = (d.by_supplier || []).map((a) => row(a, esc(a.name))).join('') || '<tr><td colspan="4" class="muted">—</td></tr>';
}
function drawChart(days) {
  const W = 640, H = 220, pl = 52, pr = 12, pt = 18, pb = 28, iw = W - pl - pr, ih = H - pt - pb;
  const vals = days.map((d) => d.rev / 1e6), top = Math.max(0.5, ...vals);
  const raw = top / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw), max = Math.ceil(top / step) * step;
  const y = (v) => pt + ih - (v / max) * ih, bw = (iw / Math.max(1, days.length)) * 0.6;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Өдрийн орлого, сая төгрөгөөр">`;
  for (let t = 0; t <= max + 1e-9; t += step) s += `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" stroke="#1E2C38"/><text x="${pl - 8}" y="${y(t) + 4}" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="11" fill="#6B7B88">${+t.toFixed(2)}</text>`;
  const every = Math.ceil(days.length / 10);
  days.forEach((d, i) => { const cx = pl + (iw / days.length) * (i + 0.5), last = i === days.length - 1, v = d.rev / 1e6;
    s += `<rect x="${cx - bw / 2}" y="${y(v)}" width="${bw}" height="${Math.max(0, pt + ih - y(v))}" rx="4" fill="${last ? '#FFB02E' : '#2C4052'}"><title>${d.d}: ${money(d.rev)} · ${d.n} захиалга</title></rect>`;
    if (i % every === 0 || last) s += `<text x="${cx}" y="${H - 9}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="${last ? '#FFD08A' : '#6B7B88'}">${d.d}</text>`;
    if (last) s += `<text x="${cx}" y="${y(v) - 6}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="12" font-weight="700" fill="#FFD08A">${v.toFixed(2)}</text>`; });
  $('#admChart').innerHTML = s + '</svg><p class="muted small" style="margin:6px 0 0">сая ₮ · төлөгдсөн захиалга, гараар нэмсэн хүргэлт орно (буцаалт хассан)</p>';
}
async function loadFeed() { const { data } = await sb.from('audit_log').select('*').order('at', { ascending: false }).limit(80); $('#feed').innerHTML = (data || []).map(feedLi).join('') || '<li><span class="muted">Бүртгэл алга</span></li>'; }
const feedLi = (f) => `<li><time>${fmtDT(f.at)}</time><div><b>${esc(f.actor || 'Систем')}</b> <span>${esc(f.action)}${f.entity === 'order' && f.entity_id ? ' · #' + esc(f.entity_id) : ''}</span></div></li>`;
function prependFeed(f) { const u = $('#feed'); if (u) u.insertAdjacentHTML('afterbegin', feedLi(f)); }
const TABS = [['orders', 'Захиалга'], ['listings', 'Зарууд'], ['suppliers', 'Нийлүүлэгчид'], ['customers', 'Хэрэглэгчид'], ['feedback', 'Санал, гомдол'], ['settings', 'Тохиргоо']];
function tbl(h, rows) { return `<div class="tbl-wrap"><table class="tbl"><thead><tr>${h.map((x) => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${h.length}" class="muted">Мэдээлэл алга</td></tr>`}</tbody></table></div>`; }
async function drawTabs() {
  const d = ADM.dash || {};
  $('#admTabs').innerHTML = TABS.map(([k, v]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${ADM.tab === k}">${v}${k === 'orders' && d.new_orders ? `<span>${d.new_orders}</span>` : ''}${k === 'feedback' && d.open_feedback ? `<span>${d.open_feedback}</span>` : ''}</button>`).join('');
  $$('#admTabs [data-tab]').forEach((b) => (b.onclick = () => { ADM.tab = b.dataset.tab; drawTabs(); }));
  const B = $('#admBody'); B.innerHTML = '<div class="box-b"><span class="spin"></span></div>';
  try {
    if (ADM.tab === 'orders') {
      const list = await rpc('admin_orders', { p_status: ADM.status || null, p_limit: 300 });
      B.innerHTML = `<div class="box-b" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center"><button class="btn btn-primary btn-sm" type="button" id="manBtn">+ Гараар хүргэлт нэмэх</button><select class="isel" id="ofS" aria-label="Төлвөөр шүүх"><option value="">Бүх төлөв</option>${Object.entries(ST).map(([k, v]) => `<option value="${k}"${ADM.status === k ? ' selected' : ''}>${v}</option>`).join('')}</select><button class="btn btn-ghost btn-sm" type="button" id="csv">Excel (CSV) татах</button></div>` +
        tbl(['№', 'Огноо', 'Захиалагч', 'Нийлүүлэгч', 'Төрөл, литр', 'Дүн', 'Хаяг', 'Төлөв', ''], list.map((o) => `<tr><td class="n">#${o.order_no}</td><td class="n">${fmtDT(o.created_at)}${o.scheduled_at ? `<div class="muted small">товлосон ${fmtDT(o.scheduled_at)}</div>` : ''}</td><td>${esc(o.customer_name)}<div class="mono small muted">${phoneFmt(o.customer_phone)}</div></td><td>${esc(o.supplier_name)}</td><td>${fl(o.fuel).l} · ${o.liters} л</td><td class="n">${money(o.total)}${o.qpay_payment_id === 'ADMIN-TEST' ? '<div class="small" style="color:#FFB3A8">туршилт</div>' : ''}${o.manual ? `<div class="tag-man">гараар · ${esc(PAY_S[o.pay_method] || '')}</div>` : ''}</td><td class="small" style="min-width:180px">${esc([o.district, o.khoroo, o.org_name, o.address].filter(Boolean).join(', '))}${o.car_plate ? ' · ' + esc(o.car_plate) : ''}</td>
          <td>${o.paid_at ? `<select class="isel" data-os="${o.id}" aria-label="Төлөв">${['new', 'accepted', 'enroute', 'delivered', 'confirmed', 'dispute', 'refunded'].map((k) => `<option value="${k}"${o.status === k ? ' selected' : ''}>${ST[k]}</option>`).join('')}</select>` : `<span class="pill p-${o.status}">${ST[o.status]}</span>`}</td>
          <td class="act">${o.status === 'pending' ? `<button class="btn btn-ghost btn-sm" type="button" data-sim="${o.id}" title="QPay-гүйгээр төлсөнд тооцох (туршилт)">Туршилтын төлбөр</button>` : ''}</td></tr>`));
      $('#ofS').onchange = (e) => { ADM.status = e.target.value; drawTabs(); };
      $('#csv').onclick = () => csv(list);
      $('#manBtn').onclick = () => manualOrder();
      $$('#admBody [data-os]').forEach((s) => (s.onchange = async () => { try { await rpc('admin_set_order_status', { p_order: s.dataset.os, p_status: s.value }); toast('Төлөв шинэчлэгдлээ'); loadDash(); } catch (err) { toast(nice(err), true); drawTabs(); } }));
      $$('#admBody [data-sim]').forEach((b) => (b.onclick = async () => { busy(b, true); try { await fn('qpay', { action: 'simulate', order_id: b.dataset.sim }); toast('Туршилтын төлбөр бүртгэгдлээ'); drawTabs(); loadDash(); } catch (err) { toast(nice(err), true); busy(b, false); } }));
    }
    if (ADM.tab === 'listings') {
      const [list, sups] = await Promise.all([rpc('admin_listings'), rpc('admin_users', { p_role: 'supplier' })]);
      const act = (sups || []).filter((u) => !u.blocked);
      const lform = act.length ? `<form class="box-b grid2" id="alf" novalidate style="border-bottom:1px solid var(--line)"><b class="full">Нийлүүлэгчийн өмнөөс зар нэмэх</b>
        <label class="inp full">Нийлүүлэгч<select id="aSup">${act.map((u) => `<option value="${u.id}">${esc(u.display_name || u.username || '—')}</option>`).join('')}</select></label>
        <label class="inp">Шатахууны төрөл<select id="aFuel">${Object.keys(FUELS).map((k) => `<option value="${k}">${fl(k).l}</option>`).join('')}</select></label>
        <label class="inp">1 литрийн үнэ (₮)<input id="aPrice" type="number" inputmode="numeric" min="500" max="20000" placeholder="2690"></label>
        <label class="inp">Нийт байгаа хэмжээ (л)<input id="aTotal" type="number" inputmode="numeric" min="1" placeholder="3000"></label>
        <label class="inp">Төлөв<select id="aSt"><option value="active">Идэвхтэй</option><option value="paused">Түр зогссон</option></select></label>
        <label class="inp">Байнгын дүүрэг<select id="aDist">${DISTRICTS.map((d) => `<option>${d}</option>`).join('')}</select></label>
        <label class="inp">Хороо<input id="aKh" maxlength="40" placeholder="жишээ нь 3-р хороо"></label>
        <label class="inp">Байгууллагын нэр<input id="aOrg" maxlength="120"></label>
        <label class="inp">Яг одоо явж буй газар<input id="aPlace" maxlength="200"></label>
        <p class="muted small full" style="margin:0">Газрын зураг дээрх байршил нийлүүлэгч самбараа нээж, байршлаа шинэчлэхэд гарна.</p>
        <div class="full"><button class="btn btn-primary" type="submit" id="aGo">Зар нэмэх</button></div></form>` : '<div class="box-b note">Зар нэмэхийн тулд эхлээд “Нийлүүлэгчид” хэсэгт нийлүүлэгч нэмнэ үү.</div>';
      B.innerHTML = lform + tbl(['Нийлүүлэгч', 'Төрөл', 'Үнэ', 'Үлдэгдэл', 'Одоо', 'Нийтэлсэн', 'Төлөв'], list.map((l) => `<tr><td>${esc(l.supplier_name)}</td><td><span class="chip" style="--c:${fl(l.fuel).c}">${fl(l.fuel).l}</span></td><td class="n">${money(l.price)}</td><td class="n">${fmt(l.avail_l)} / ${fmt(l.total_l)} л</td><td class="small">${esc(l.place || '—')}<div class="muted">${ago(l.loc_at)}</div></td><td class="n">${fmtDT(l.created_at)}</td>
        <td><select class="isel" data-ls="${l.id}" aria-label="Зарын төлөв"><option value="active"${l.status === 'active' ? ' selected' : ''}>Идэвхтэй</option><option value="paused"${l.status === 'paused' ? ' selected' : ''}>Түр зогссон</option><option value="finished"${l.status === 'finished' ? ' selected' : ''}>Дууссан</option></select></td></tr>`));
      $$('#admBody [data-ls]').forEach((s) => (s.onchange = async () => { try { await rpc('admin_set_listing_status', { p_id: +s.dataset.ls, p_status: s.value }); toast('Шинэчлэгдлээ'); loadListings(); } catch (err) { toast(nice(err), true); } }));
      const alf = $('#alf'); if (alf) alf.onsubmit = async (e) => {
        e.preventDefault(); const b = $('#aGo'), price = +$('#aPrice').value, total = +$('#aTotal').value;
        if (!(price >= 500 && price <= 20000)) { $('#aPrice').focus(); return toast('1 литрийн үнэ 500 – 20,000₮', true); }
        if (!(total >= 1)) { $('#aTotal').focus(); return toast('Нийт хэмжээгээ оруулна уу', true); }
        busy(b, true);
        try { await rpc('admin_save_listing', { p_supplier: $('#aSup').value, p_fuel: $('#aFuel').value, p_price: price, p_total: total, p_district: $('#aDist').value, p_khoroo: $('#aKh').value.trim(), p_org: $('#aOrg').value.trim(), p_place: $('#aPlace').value.trim(), p_status: $('#aSt').value }); toast('Зар нэмэгдлээ'); drawTabs(); loadDash(); loadListings(); }
        catch (err) { toast(nice(err), true); busy(b, false); }
      };
    }
    if (ADM.tab === 'suppliers' || ADM.tab === 'customers') {
      const role = ADM.tab === 'suppliers' ? 'supplier' : 'customer';
      const list = await rpc('admin_users', { p_role: role });
      const form = `<form class="box-b grid2" id="uf" novalidate style="border-bottom:1px solid var(--line)"><b class="full">${role === 'supplier' ? 'Шинэ нийлүүлэгч нэмэх' : 'Хэрэглэгч нэмэх'}</b>
        <label class="inp">${role === 'supplier' ? 'Нийлүүлэгчийн нэр (харагдах)' : 'Нэр'}<input id="uName" maxlength="60"></label>
        <label class="inp">Утасны дугаар<input id="uPhone" type="tel" inputmode="numeric" maxlength="8"></label>
        <label class="inp">Нэвтрэх нэр<input id="uUser" maxlength="24" autocapitalize="none"></label>
        <label class="inp">Анхны ПИН код (6 оронтой)<input id="uPin" inputmode="numeric" maxlength="6"></label>
        ${role === 'supplier' ? '<label class="inp">Зарын дээд тоо<input id="uMax" type="number" min="0" max="100" value="5"></label>' : ''}
        <div class="full"><button class="btn btn-primary" type="submit" id="uGo">Нэмэх</button> <span class="muted small">Нэвтрэх нэр, ПИН кодыг тухайн хүнд өөрөө дамжуулна уу.</span></div></form>`;
      B.innerHTML = form + tbl(role === 'supplier' ? ['Нийлүүлэгч', 'Утасны дугаар', 'Идэвхтэй зар', 'Зарын хязгаар', 'Нийт борлуулалт', 'Төлөв', ''] : ['Нэр', 'Утасны дугаар', 'Имэйл / нэр', 'Төлсөн захиалга', 'Бүртгүүлсэн', 'Төлөв', ''],
        list.map((u) => {
          const nm = esc(u.display_name || u.username || u.email || '—'), stp = u.blocked ? '<span class="pill p-blocked">Хаагдсан</span>' : '<span class="pill p-active">Идэвхтэй</span>';
          const blk = u.id === S.session.user.id ? '' : `<button class="btn btn-ghost btn-sm" type="button" data-blk="${u.id}" data-v="${!u.blocked}">${u.blocked ? 'Нээх' : 'Хаах'}</button>`;
          const pin = (u.email == null && u.username) ? `<button class="btn btn-ghost btn-sm" type="button" data-pin="${u.id}">ПИН сэргээх</button>` : '';
          if (role === 'supplier') return `<tr><td><b>${nm}</b><div class="muted small">${esc(u.username || '')}</div></td><td class="n">${phoneFmt(u.phone)}</td><td class="n">${u.active_listings}</td><td><input class="isel" style="width:70px" type="number" min="0" max="100" value="${u.max_listings}" data-max="${u.id}" aria-label="Зарын хязгаар"></td><td class="n">${money(u.sales)}</td><td>${stp}</td><td class="act">${pin}${blk}</td></tr>`;
          return `<tr><td><b>${nm}</b></td><td class="n">${phoneFmt(u.phone)}</td><td class="small">${esc(u.email || u.username || '')}</td><td class="n">${u.orders_paid}</td><td class="n">${fmtDT(u.created_at)}</td><td>${stp}</td><td class="act"><button class="btn btn-ghost btn-sm" type="button" data-role="${u.id}" data-r="supplier">Нийлүүлэгч болгох</button>${pin}${blk}</td></tr>`;
        }));
      const uf = $('#uf'); if (uf) uf.onsubmit = async (e) => { e.preventDefault(); const b = $('#uGo'); busy(b, true); try { await fn('admin-users', { action: 'create', role, name: $('#uName').value, phone: $('#uPhone').value, username: $('#uUser').value, pin: $('#uPin').value, max_listings: $('#uMax') ? +$('#uMax').value : 5 }); toast('Бүртгэл үүслээ'); drawTabs(); loadDash(); } catch (err) { toast(nice(err), true); busy(b, false); } };
      $$('#admBody [data-blk]').forEach((b) => (b.onclick = async () => { try { await rpc('admin_set_blocked', { p_user: b.dataset.blk, p_blocked: b.dataset.v === 'true' }); toast(b.dataset.v === 'true' ? 'Хаагдлаа' : 'Нээгдлээ'); drawTabs(); } catch (err) { toast(nice(err), true); } }));
      $$('#admBody [data-max]').forEach((i) => (i.onchange = async () => { try { await rpc('admin_set_role', { p_user: i.dataset.max, p_role: 'supplier', p_level: null, p_max: +i.value }); toast('Зарын хязгаар шинэчлэгдлээ'); } catch (err) { toast(nice(err), true); } }));
      $$('#admBody [data-role]').forEach((b) => (b.onclick = async () => { try { await rpc('admin_set_role', { p_user: b.dataset.role, p_role: b.dataset.r, p_level: null, p_max: null }); toast('Эрх шинэчлэгдлээ'); drawTabs(); loadDash(); } catch (err) { toast(nice(err), true); } }));
      $$('#admBody [data-pin]').forEach((b) => (b.onclick = () => {
        openModal('ПИН код сэргээх', `<label class="inp">Шинэ ПИН код (6 оронтой)<input id="npin" inputmode="numeric" maxlength="6"></label><button class="btn btn-primary" type="button" id="npGo">Хадгалах</button><p class="muted small" style="margin:0">Шинэ кодыг тухайн хүнд өөрөө дамжуулна уу.</p>`);
        $('#npGo').onclick = async (e) => { const x = e.currentTarget; busy(x, true); try { await fn('admin-users', { action: 'reset_pin', user_id: b.dataset.pin, pin: $('#npin').value.trim() }); closeModal(); toast('ПИН код солигдлоо'); } catch (err) { toast(nice(err), true); busy(x, false); } };
      }));
    }
    if (ADM.tab === 'feedback') {
      const list = await rpc('admin_feedback');
      B.innerHTML = tbl(['Огноо', 'Төрөл', 'Захиалга', 'Хэнээс', 'Мессеж', 'Төлөв', ''], list.map((f) => `<tr><td class="n">${fmtDT(f.created_at)}</td><td>${esc(f.kind)}</td><td class="n">${f.order_no ? '#' + f.order_no : f.order_ref ? esc(f.order_ref) + '<div class="muted small">бичсэн</div>' : '—'}</td><td>${esc(f.user_name || 'Зочин')}<div class="mono small muted">${phoneFmt(f.phone)}</div></td><td style="min-width:240px">${esc(f.message)}${f.reply ? `<div class="muted small">Хариу: ${esc(f.reply)}</div>` : ''}</td><td><span class="pill p-${f.status}">${f.status === 'open' ? 'Нээлттэй' : 'Шийдвэрлэсэн'}</span></td><td class="act">${f.status === 'open' ? `<button class="btn btn-ok btn-sm" type="button" data-fb="${f.id}">Шийдвэрлэсэн</button>` : ''}</td></tr>`));
      $$('#admBody [data-fb]').forEach((b) => (b.onclick = async () => { try { await rpc('admin_feedback_done', { p_id: +b.dataset.fb, p_reply: null }); toast('Шийдвэрлэсэн'); drawTabs(); loadDash(); } catch (err) { toast(nice(err), true); } }));
    }
    if (ADM.tab === 'settings') {
      const s = await rpc('admin_get_settings');
      B.innerHTML = `<form class="box-b grid2" id="sf" novalidate>
        <label class="inp">Нэг захиалгын доод литр<input id="sMin" type="number" min="1" value="${s.min_liters}"></label>
        <label class="inp">Нэг захиалгын дээд литр<input id="sMax" type="number" min="1" value="${s.max_liters}"></label>
        <label class="inp">Төлбөр хүлээх хугацаа (мин)<input id="sPend" type="number" min="5" max="60" value="${s.pending_minutes}"></label>
        <label class="inp">Ажлын цаг<input id="sHours" value="${esc(s.work_hours || '24/7')}"></label>
        <label class="inp">Тусламжийн утасны дугаар 1<input id="sP1" type="tel" value="${esc(s.contact_phone1 || '')}"></label>
        <label class="inp">Тусламжийн утасны дугаар 2<input id="sP2" type="tel" value="${esc(s.contact_phone2 || '')}"></label>
        <label class="inp full">Тусламжийн имэйл<input id="sMail" type="email" value="${esc(s.contact_email || '')}"></label>
        <p class="muted small full" style="margin:0">Тусламжийн утасны дугаар, имэйл зөвхөн төлбөр төлсөн хэрэглэгчид харагдана.</p>
        <div class="full"><button class="btn btn-primary" type="submit" id="sGo">Хадгалах</button></div></form>`;
      $('#sf').onsubmit = async (e) => { e.preventDefault(); const b = $('#sGo'); busy(b, true); try { await rpc('admin_update_settings', { p: { min_liters: +$('#sMin').value, max_liters: +$('#sMax').value, pending_minutes: +$('#sPend').value, work_hours: $('#sHours').value, contact_phone1: $('#sP1').value, contact_phone2: $('#sP2').value, contact_email: $('#sMail').value } }); toast('Хадгалагдлаа'); loadSettings(); } catch (err) { toast(nice(err), true); } finally { busy(b, false); } };
    }
  } catch (err) { B.innerHTML = `<div class="box-b note err">${esc(nice(err))}</div>`; }
}
function csv(list) {
  const cols = [['order_no', '№'], ['created_at', 'Огноо'], ['paid_at', 'Төлсөн'], ['status', 'Төлөв'], ['customer_name', 'Захиалагч'], ['customer_phone', 'Утасны дугаар'], ['supplier_name', 'Нийлүүлэгч'], ['fuel', 'Төрөл'], ['liters', 'Литр'], ['unit_price', 'Үнэ'], ['total', 'Дүн'], ['district', 'Дүүрэг'], ['khoroo', 'Хороо'], ['org_name', 'Байгууллага'], ['address', 'Хаяг'], ['car_plate', 'Машин'], ['pay', 'Төлбөр']];
  const val = (o, k) => (k === 'pay' ? (o.manual ? 'Гараар · ' + (PAY[o.pay_method] || '') : o.qpay_payment_id === 'ADMIN-TEST' ? 'Туршилт' : o.paid_at ? 'QPay' : '') : k === 'created_at' || k === 'paid_at' ? (o[k] ? fmtDT(o[k]) : '') : k === 'status' ? ST[o[k]] || o[k] : k === 'fuel' ? fl(o[k]).l : o[k] ?? '');
  const lines = [cols.map((c) => c[1]).join(',')].concat(list.map((o) => cols.map(([k]) => '"' + String(val(o, k)).replace(/"/g, '""') + '"').join(',')));
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })); a.download = 'shag-zahialga-' + new Date().toISOString().slice(0, 10) + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* Утсаар ирсэн захиалгыг админ гараар бүртгэх */
async function manualOrder() {
  let list = [];
  try { list = ((await rpc('admin_listings')) || []).filter((l) => l.status !== 'finished' && l.avail_l > 0); } catch (err) { return toast(nice(err), true); }
  if (!list.length) return toast('Үлдэгдэлтэй зар алга. Эхлээд “Зарууд” хэсэгт зар нэмнэ үү', true);
  let loc = null, when = 'now', pay = 'cash', mm = null, mk = null;
  openModal('Гараар хүргэлт нэмэх', `
    <p class="muted small" style="margin:0">Утсаар болон биечлэн ирсэн захиалгыг бүртгэнэ. Нийлүүлэгчийн самбарт “Шинэ” захиалга болж шууд орно, захиалагчийн утасны дугаар нийлүүлэгчид харагдана.</p>
    <label class="inp">Нийлүүлэгч, зар<select id="moL">${list.map((l) => `<option value="${l.id}">${esc(l.supplier_name)} · ${fl(l.fuel).l} · ${money(l.price)}/л · ${fmt(l.avail_l)} л</option>`).join('')}</select></label>
    <div class="grid2">
      <label class="inp">Литр<input id="moLit" type="number" inputmode="numeric" min="1" value="40"></label>
      <label class="inp">1 литрийн үнэ (₮)<input id="moPrice" type="number" inputmode="numeric" min="500" max="20000"></label>
    </div>
    <div class="pump" aria-live="polite"><div class="pump-row"><label>Нийт дүн ₮</label><span class="d" id="moTot">0</span></div></div>
    <div class="eyebrow">Захиалагч</div>
    <div class="grid2">
      <label class="inp">Нэр<input id="moName" maxlength="80" placeholder="жишээ нь Бат"></label>
      <label class="inp">Утасны дугаар<input id="moPhone" type="tel" inputmode="numeric" maxlength="8" placeholder="99xxxxxx"></label>
      <label class="inp">Дүүрэг<select id="moDist">${DISTRICTS.map((d) => `<option>${d}</option>`).join('')}</select></label>
      <label class="inp">Хороо<input id="moKh" maxlength="40" placeholder="жишээ нь 1-р хороо"></label>
      <label class="inp full">Байгууллагын нэр (байвал)<input id="moOrg" maxlength="120"></label>
      <label class="inp full">Дэлгэрэнгүй хаяг, зогсоол<input id="moAddr" maxlength="300" placeholder="Байр, орц, зогсоолын байрлал"></label>
      <label class="inp">Машины улсын дугаар<input id="moCar" maxlength="20" placeholder="0000 УБА" autocapitalize="characters"></label>
      <label class="inp">Нэмэлт тайлбар<input id="moNote" maxlength="300"></label>
    </div>
    <details id="moMapD"><summary class="muted small" style="cursor:pointer">Газрын зураг дээр хүргэх цэг заах (заавал биш)</summary><div class="minimap" id="moMap" style="margin-top:10px"></div><p class="muted small" id="moMapT" style="margin:6px 0 0">Газрын зураг дээр дарж цэг заана уу</p></details>
    <div class="eyebrow">Хүргэх цаг</div>
    <div class="seg2" role="group" aria-label="Хүргэх цаг" id="moWhenG"><button type="button" data-w="now" aria-pressed="true">Аль болох хурдан</button><button type="button" data-w="at" aria-pressed="false">Цаг товлох</button></div>
    <label class="inp" id="moWhenBox" hidden>Товлосон цаг<input id="moWhen" type="datetime-local"></label>
    <div class="eyebrow">Төлбөр</div>
    <div class="seg2 four" role="group" aria-label="Төлбөрийн хэлбэр" id="moPayG">${Object.entries(PAY).map(([k, v]) => `<button type="button" data-p="${k}" aria-pressed="${k === pay}">${v}</button>`).join('')}</div>
    <button class="btn btn-primary" type="button" id="moGo">Хүргэлт нэмэх</button>`);
  const sel = () => list.find((l) => l.id === +$('#moL').value);
  const upd = () => { const l = sel(), lit = Math.max(0, Math.round(+$('#moLit').value || 0)), pr = +$('#moPrice').value || l.price; $('#moTot').textContent = fmt(lit * pr); $('#moGo').textContent = 'Хүргэлт нэмэх · ' + money(lit * pr); };
  const setPrice = () => { $('#moPrice').value = sel().price; $('#moLit').max = sel().avail_l; upd(); };
  $('#moL').onchange = setPrice; $('#moLit').oninput = upd; $('#moPrice').oninput = upd; setPrice();
  $('#moMapD').addEventListener('toggle', () => {
    if (!$('#moMapD').open || mm) { if (mm) setTimeout(() => mm.invalidateSize(), 60); return; }
    mm = L.map('moMap', { zoomControl: true }).setView(UB, 12); tiles(mm);
    mm.on('click', (e) => { loc = { lat: e.latlng.lat, lng: e.latlng.lng }; if (!mk) { mk = L.marker([loc.lat, loc.lng], { icon: youIcon(), draggable: true }).addTo(mm); mk.on('dragend', () => { const q = mk.getLatLng(); loc = { lat: q.lat, lng: q.lng }; }); } else mk.setLatLng([loc.lat, loc.lng]); $('#moMapT').textContent = 'Цэг заагдлаа. Чирж нарийвчилж болно'; });
    setTimeout(() => mm.invalidateSize(), 80);
  });
  onClose(() => { if (mm) mm.remove(); });
  $$('#moWhenG button').forEach((b) => (b.onclick = () => { when = b.dataset.w; $$('#moWhenG button').forEach((x) => x.setAttribute('aria-pressed', x === b)); $('#moWhenBox').hidden = when !== 'at'; if (when === 'at' && !$('#moWhen').value) { const d = new Date(Date.now() + 3600e3); d.setMinutes(0, 0, 0); $('#moWhen').value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); } }));
  $$('#moPayG button').forEach((b) => (b.onclick = () => { pay = b.dataset.p; $$('#moPayG button').forEach((x) => x.setAttribute('aria-pressed', x === b)); }));
  $('#moGo').onclick = async (e) => {
    const btn = e.currentTarget, l = sel(), lit = Math.round(+$('#moLit').value || 0), pr = Math.round(+$('#moPrice').value || 0);
    const phone = $('#moPhone').value.replace(/\D/g, ''), addr = $('#moAddr').value.trim(), org = $('#moOrg').value.trim();
    if (!(lit >= 1)) { $('#moLit').focus(); return toast('Литрээ оруулна уу', true); }
    if (lit > l.avail_l) { $('#moLit').focus(); return toast(`Зарын үлдэгдэл ${fmt(l.avail_l)} л байна`, true); }
    if (!(pr >= 500 && pr <= 20000)) { $('#moPrice').focus(); return toast('1 литрийн үнэ 500 – 20,000₮', true); }
    if (!/^[5-9]\d{7}$/.test(phone)) { $('#moPhone').focus(); return toast('Утасны дугаар 8 оронтой', true); }
    if (!addr && !org && !loc) { $('#moAddr').focus(); return toast('Хаяг, байгууллага эсвэл газрын зураг дээрх цэгийн аль нэгийг оруулна уу', true); }
    let sched = null;
    if (when === 'at') { const v = $('#moWhen').value; if (!v) return toast('Товлох цагаа сонгоно уу', true); sched = new Date(v).toISOString(); }
    busy(btn, true, 'Бүртгэж байна');
    try {
      const r = await rpc('admin_create_order', { p_listing: l.id, p_liters: lit, p_name: $('#moName').value.trim(), p_phone: phone, p_lat: loc ? loc.lat : null, p_lng: loc ? loc.lng : null, p_district: $('#moDist').value, p_khoroo: $('#moKh').value.trim(), p_org: org, p_address: addr, p_car: $('#moCar').value.trim(), p_note: $('#moNote').value.trim(), p_scheduled: sched, p_method: pay, p_price: pr });
      closeModal(); toast(`Хүргэлт #${r.order_no} нэмэгдлээ · нийлүүлэгчид илгээгдлээ`); ADM.status = ''; drawTabs(); loadDash(); loadListings();
    } catch (err) { toast(nice(err), true); busy(btn, false); }
  };
}

/* ================= Хууль зүйн хуудас ================= */
const DOCS = {
  nuutslal: `<div class="eyebrow">Шаг</div><h1>Нууцлалын бодлого</h1><p class="muted">Хүчин төгөлдөр: 2026.11.02</p>
    <p>Шаг (shagiinbenzin.mn) нь Хүний хувийн мэдээллийг хамгаалах тухай хуулийн дагуу таны мэдээллийг зөвхөн шатахуун хүргэх үйлчилгээ үзүүлэхэд ашиглана.</p>
    <h3>Ямар мэдээлэл цуглуулдаг вэ</h3><ul><li>Нэр, нэвтрэх нэр эсвэл Google имэйл</li><li>Утасны дугаар</li><li>Хүргэх байршил (газрын зураг дээрх цэг), дүүрэг, хороо, хаяг, байгууллагын нэр, машины улсын дугаар</li><li>Захиалга, төлбөрийн түүх (картын болон дансны мэдээллийг бид хадгалдаггүй, төлбөрийг QPay боловсруулна)</li><li>Нийлүүлэгчийн хувьд: ажлын үеийн байршил (зөвхөн самбар нээлттэй, байршил шинэчлэх асаалттай үед)</li></ul>
    <h3>Хэнд харагдах вэ</h3><p>Таны утасны дугаар, хаяг зөвхөн таны төлбөр төлсөн захиалгын нийлүүлэгчид, нийлүүлэгчийн утасны дугаар зөвхөн танд төлбөрийн дараа харагдана. Бусад хэрэглэгч, нийлүүлэгчид таны дугаар харагдахгүй. Админ үйлчилгээг хянах зорилгоор бүх захиалгыг харна.</p>
    <h3>Хадгалах хугацаа</h3><p>Захиалгын мэдээллийг тайлан, маргаан шийдвэрлэх зорилгоор 3 жил хадгална. Бүртгэлээ устгуулах бол “Админтай холбогдох” хэсгээр хүсэлт илгээнэ үү.</p>
    <h3>Аюулгүй байдал</h3><p>Мэдээллийг шифрлэсэн холболтоор дамжуулж, эрхийн хяналттай сан дээр хадгална. ПИН кодоо бусдад бүү хэлээрэй.</p>
    <h3>Газрын зураг, күүки</h3><p>Газрын зургийг OpenStreetMap-аас ачаалдаг. Бид зар сурталчилгааны күүки ашигладаггүй; нэвтрэлтийг таны хөтөч дээр хадгална.</p>`,
  nokhtsol: `<div class="eyebrow">Шаг</div><h1>Үйлчилгээний нөхцөл</h1><p class="muted">Хүчин төгөлдөр: 2026.11.02</p>
    <h3>1. Үйлчилгээ</h3><p>Шаг нь шатахуун нийлүүлэгчдийн зарыг нэгтгэж, хэрэглэгч захиалга өгөх, QPay-р төлөх, нийлүүлэгч хүргэлт хийх боломжийг олгоно. Хүргэлт үнэгүй.</p>
    <h3>2. Бүртгэл</h3><p>Хэрэглэгч Google эсвэл нэр, 6 оронтой ПИН кодоор бүртгүүлнэ. Нэвтрэх мэдээллээ хадгалах үүргийг хэрэглэгч хариуцна. Худал мэдээлэл, хуурамч захиалга өгсөн бүртгэлийг админ хааж болно.</p>
    <h3>3. Захиалга, үнэ</h3><p>Үнэ захиалга үүсгэх үеийн 1 литрийн үнээр тогтоно. Төлбөр эхлэхэд литр тодорхой хугацаанд (анхдагчаар 15 минут) нөөцлөгдөнө; хугацаандаа төлөгдөөгүй захиалга автоматаар хүчингүй болно.</p>
    <h3>4. Төлбөр</h3><p>Сайтаар өгсөн захиалгын төлбөрийг QPay-р урьдчилан төлнө. Төлбөр баталгаажсаны дараа хүргэлт гарна. Шагийн тусламжийн утсаар өгсөн захиалгыг админ бүртгэх бөгөөд төлбөрийн хэлбэрийг тухайн үед тохиролцоно.</p>
    <h3>5. Хүргэлт</h3><p>Нийлүүлэгч хэрэглэгчийн заасан байршилд очиж шатахууныг өгнө. Сайтад харагдах ирэх хугацаа нь зайнаас тооцсон ойролцоо утга. Хэрэглэгч хүргэлт хүлээн авсны дараа “Хүлээн авлаа” товчоор баталгаажуулна.</p>
    <h3>6. Аюулгүй ажиллагаа</h3><p>Шатахуун цэнэглэх үед хөдөлгүүрээ унтрааж, тамхи татахгүй, нийлүүлэгчийн зааврыг дагана.</p>
    <h3>7. Гомдол</h3><p>Захиалгатай холбоотой гомдлыг захиалгын дэлгэрэнгүй хэсгээс эсвэл “Санал хүсэлт” маягтаар илгээнэ. Админ 24/7 хүлээн авна.</p>`,
  butsaalt: `<div class="eyebrow">Шаг</div><h1>Төлбөр, буцаалт</h1><p class="muted">Хүчин төгөлдөр: 2026.11.02</p>
    <p>Төлбөр төлөгдсөний дараа хүргэлт шууд гардаг тул захиалгыг хэрэглэгч өөрөө цуцлах боломжгүй.</p>
    <h3>Буцаалт хийх тохиолдол</h3><ul><li>Нийлүүлэгч захиалгыг биелүүлэх боломжгүй болсон</li><li>Хүргэлт огт ирээгүй эсвэл литр дутуу ирсэн нь нотлогдсон</li><li>Хугацаа дууссаны дараа төлбөр орж, үлдэгдэл хүрэлцээгүй</li></ul>
    <h3>Хэрхэн хүсэх вэ</h3><p>Захиалгын дэлгэрэнгүй хэсгийн “Гомдол гаргах” эсвэл “Админтай холбогдох” маягтаар захиалгын дугаараа бичиж илгээнэ. Админ шалгаад буцаалтыг төлбөр төлсөн дансанд нь шилжүүлнэ.</p>`,
};

/* ================= Санал хүсэлт ================= */
$('#fbForm').onsubmit = async (e) => {
  e.preventDefault(); const b = e.submitter || $('#fbForm button'), m = $('#fbMsg').value.trim();
  if (m.length < 3) { $('#fbMsg').focus(); return toast('Мессежээ бичнэ үү', true); }
  busy(b, true);
  const kind = ($('#fbForm input[name="fbType"]:checked') || {}).value || 'Санал', ref = $('#fbOrder').value.trim().replace(/^#/, '');
  try { await rpc('submit_feedback', { p_kind: kind, p_message: m, p_phone: $('#fbPhone').value, p_order: null, p_order_ref: ref || null }); $('#fbMsg').value = ''; $('#fbOrder').value = ''; toast('Илгээгдлээ. Админ хүлээн авлаа.'); } catch (err) { toast(nice(err), true); } finally { busy(b, false); }
};

/* ================= Чиглүүлэлт ================= */
function route() {
  const h = location.hash.replace('#', '');
  const v = ['minii', 'niiluulegch', 'admin'].includes(h) ? h : ['nuutslal', 'nokhtsol', 'butsaalt'].includes(h) ? 'doc' : 'home';
  const prev = S.view; S.view = v === 'doc' ? h : v;
  ['home', 'minii', 'niiluulegch', 'admin', 'doc'].forEach((k) => ($('#v-' + k).hidden = k !== v));
  $('#holboo').classList.toggle('app', v !== 'home' && v !== 'doc');
  $$('.nav a').forEach((a) => a.setAttribute('aria-current', a.dataset.nav === v ? 'page' : 'false'));
  const vid = $('#hvid'); if (vid) { if (v === 'home' && !RM) vid.play().catch(() => {}); else vid.pause(); }
  if (v === 'minii') renderMyOrders();
  if (v === 'niiluulegch') renderSupplier();
  if (v === 'admin') renderAdmin();
  if (v === 'doc') $('#docRoot').innerHTML = DOCS[h];
  if (v === 'home' && h === 'zahialah') setTimeout(() => $('#zahialah').scrollIntoView({ behavior: RM ? 'auto' : 'smooth' }), 30);
  else if (prev !== S.view) window.scrollTo(0, 0);
  if (S.map && v === 'home') setTimeout(() => S.map.invalidateSize(), 50);
}
window.addEventListener('hashchange', route);
$('#ctaOrder').onclick = (e) => { e.preventDefault(); if (location.hash !== '#zahialah') location.hash = 'zahialah'; else route(); };

async function loadSettings() { try { const s = await rpc('public_settings'); if (s) S.settings = s; } catch { /* анхдагч */ } }

/* ================= Эхлэл ================= */
let booted = false;
sb.auth.onAuthStateChange((ev, session) => {
  S.session = session;
  setTimeout(async () => {
    await loadProfile(); renderHeader();
    if (!booted) { booted = true; route(); } else if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT' || ev === 'USER_UPDATED') { await loadListings(); route(); }
    if (ev === 'SIGNED_IN' && store.get('shag_after') === 'resume') { store.set('shag_after', null); location.hash = 'zahialah'; }
    if (/[?&](code|error)=/.test(location.search)) history.replaceState(null, '', location.pathname + location.hash);
  }, 0);
});
loadSettings(); loadListings();
sb.channel('listings-pub').on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, () => { clearTimeout(S.lt); S.lt = setTimeout(loadListings, 1500); }).subscribe();
if (RM) { const v = $('#hvid'); if (v) { v.removeAttribute('autoplay'); v.pause(); } }
})();
