/* StudyNest main app. Plain JS, no build step. */
(() => {
const $ = (s, e = document) => e.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const D = () => DB.d, save = () => DB.save();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sid = () => sessionStorage.sn_u || localStorage.sn_u;
const me = () => D().users.find(u => u.id === sid());
const user = id => D().users.find(u => u.id === id) || { name: 'Deleted user' };
const rm = id => D().rooms.find(r => r.id === id);
const ini = n => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
const hue = n => [...n].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
const av = (n, s = '') => `<span class="av ${s}" style="--h:${hue(n)}" title="${esc(n)}">${esc(ini(n))}</span>`;
const ago = ts => { const m = (Date.now() - ts) / 6e4 | 0; return m < 1 ? 'just now' : m < 60 ? m + 'm ago' : m < 1440 ? (m / 60 | 0) + 'h ago' : (m / 1440 | 0) + 'd ago'; };
const fmt = s => String(s / 60 | 0).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
const act = t => { D().acts.unshift({ u: me().id, t, ts: Date.now() }); };
const notify = (u, text) => D().notes.unshift({ id: DB.id(), u, text, read: 0, ts: Date.now() });
const toast = t => { const e = document.createElement('div'); e.className = 'toast'; e.textContent = t; $('#toasts').append(e); setTimeout(() => e.remove(), 2800); };
const burst = () => { for (let i = 0; i < 24; i++) { const e = document.createElement('span'); e.className = 'fx'; e.textContent = ['🎉', '⭐', '✨'][i % 3]; e.style.left = Math.random() * 100 + 'vw'; e.style.animationDelay = Math.random() * .6 + 's'; document.body.append(e); setTimeout(() => e.remove(), 2800); } };
const dlg = h => { const d = $('#dlg'); d.innerHTML = h; d.showModal(); d.onclick = e => { if (e.target === d || e.target.dataset.x !== undefined) d.close(); }; };

/* ---------- progress helpers ---------- */
const mine = id => D().log.filter(l => l.u === id);
const dk = ts => new Date(ts).toDateString();
const dayMin = (id, ts) => mine(id).filter(l => dk(l.ts) === dk(ts)).reduce((a, l) => a + l.m, 0);
const total = id => mine(id).reduce((a, l) => a + l.m, 0);
const streak = id => { let n = 0; while (dayMin(id, Date.now() - n * 864e5) > 0) n++; return n; };
const level = id => 1 + Math.floor(total(id) / 100);
const avg = r => { const v = Object.values(r.rate); return v.length ? (v.reduce((a, b) => a + b) / v.length).toFixed(1) : '–'; };
const members = r => r.members.filter(m => m.s === 'in');
const st = r => { const m = r.members.find(x => x.u === me().id); return m ? (m.s === 'in' ? 'Enrolled' : 'Pending') : members(r).length >= r.cap ? 'Full' : r.priv ? 'Request' : 'Open'; };

/* ---------- theme ---------- */
document.documentElement.dataset.theme = localStorage.sn_theme || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light');

/* ---------- auth ---------- */
let mode = 'login';
const err = t => { $('#err').textContent = t; };
$('.tabs').onclick = e => {
  const m = e.target.dataset.m; if (!m) return; mode = m;
  [...$('.tabs').children].forEach(b => b.classList.toggle('on', b.dataset.m === m));
  $('#fn').hidden = $('#fr').hidden = m === 'login'; err('');
};
$('#authForm').onsubmit = e => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target)), em = (f.email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(em)) return err('Enter a valid email address.');
  let u = D().users.find(x => x.email === em);
  if (mode === 'login') {
    if (!u || u.pass !== f.pass) return err('Email or password is incorrect.');
    if (!u.on) return err('This account is suspended. Contact an admin.');
  } else {
    if (!(f.name || '').trim()) return err('Enter your full name.');
    if (u) return err('That email is already registered. Log in instead.');
    if (f.pass.length < 6 || !/\d/.test(f.pass) || !/[a-z]/i.test(f.pass)) return err('Password needs 6+ characters with letters and numbers.');
    u = { id: DB.id(), name: f.name.trim(), email: em, pass: f.pass, role: f.role, bio: '', goal: 60, on: 1 };
    D().users.push(u); notify(u.id, 'Welcome to StudyNest! Join a room to start your first session.');
  }
  sessionStorage.sn_u = localStorage.sn_u = u.id; save(); e.target.reset(); err(''); location.hash = '#/dash'; boot();
};
const logout = () => { sessionStorage.removeItem('sn_u'); localStorage.removeItem('sn_u'); location.hash = ''; boot(); };

/* ---------- shell ---------- */
function boot() {
  const u = me(); $('#auth').hidden = !!u; $('#app').hidden = !u;
  if (!u) return;
  if (!u.on) { toast('Account suspended'); return logout(); }
  const L = [['dash', 'Dashboard', '◧'], ['rooms', 'Rooms', '▦'], ['progress', 'Progress', '◔'], ['profile', 'Profile', '◉']];
  if (u.role === 'admin') L.push(['admin', 'Admin', '⚙']);
  $('#nav').innerHTML = `<div class="logo">Study<span>Nest</span></div>` + L.map(([h, t, i]) => `<a href="#/${h}" data-h="${h}"><i>${i}</i><b>${t}</b></a>`).join('') + `<button class="navb" data-act="out"><i>⎋</i><b>Log out</b></button>`;
  $('#me').innerHTML = av(u.name);
  route();
}

/* ---------- views ---------- */
let q = '', cat = 'All', sort = 'pop', tick = null;
const tm = { len: 25, left: 1500, run: false, rid: null };
const kpi = (l, v) => `<div class="card k"><b>${v}</b><span>${l}</span></div>`;
const card = r => { const s = st(r); return `<article class="card room"><div><span class="tag">${esc(r.cat)}</span>${r.priv ? '<span class="tag lock">Private</span>' : ''}${r.flag ? '<span class="tag">Flagged</span>' : ''}</div><h3>${esc(r.title)}</h3><p>${esc(r.desc)}</p><div class="meta"><span>👥 ${members(r).length}/${r.cap}</span><span>★ ${avg(r)}</span><span class="chip ${s}">${s}</span></div><a class="btn sm" href="#/room/${r.id}">Open room</a></article>`; };
const activity = L => L.slice(0, 6).map(a => `<div class="task"><span>${esc(a.t)}</span><small class="mut" style="margin-left:auto">${ago(a.ts)}</small></div>`).join('') || '<p class="mut">No activity yet. Join a room to get started.</p>';

function dash() {
  const u = me(), t = dayMin(u.id, Date.now()), my = D().rooms.filter(r => r.members.some(m => m.u === u.id && m.s === 'in'));
  return `<h1>Hello, ${esc(u.name.split(' ')[0])}</h1><p class="mut">Here is where your study stands today.</p>
  <div class="grid kpi">${kpi('Minutes today', t)}${kpi('Day streak', streak(u.id))}${kpi('Rooms joined', my.length)}${kpi('Level', level(u.id))}</div>
  <div class="card"><div class="row between"><h2 style="margin:0">Daily goal</h2><small class="mut">${t} / ${u.goal} min</small></div><div class="bar"><i style="width:${Math.min(100, t / u.goal * 100)}%"></i></div></div>
  <h2>My rooms</h2><div class="grid cards">${my.map(card).join('') || '<p class="mut">You have not joined a room yet. <a href="#/rooms">Browse rooms</a></p>'}</div>
  <h2>Recent activity</h2><div class="card">${activity(D().acts.filter(a => a.u === u.id))}</div>`;
}

function rooms() {
  const u = me(), s = q.toLowerCase();
  const L = D().rooms.filter(r => (!r.flag || u.role === 'admin') && (cat === 'All' || r.cat === cat) && (r.title + r.desc + r.cat).toLowerCase().includes(s))
    .sort((a, b) => sort === 'pop' ? members(b).length - members(a).length : sort === 'rated' ? (avg(b) === '–' ? 0 : avg(b)) - (avg(a) === '–' ? 0 : avg(a)) : 0);
  return `<div class="head"><div><h1>Study rooms</h1><p>${L.length} room${L.length === 1 ? '' : 's'} found</p></div><button class="btn" data-act="new">Create room</button></div>
  <div class="row wrap">${['All', ...D().cats].map(c => `<button class="chip ${c === cat ? 'on' : ''}" data-act="cat" data-id="${esc(c)}">${esc(c)}</button>`).join('')}
  <select data-chg="sort" style="width:auto;margin:0 0 0 auto" aria-label="Sort rooms"><option value="pop" ${sort === 'pop' ? 'selected' : ''}>Most members</option><option value="rated" ${sort === 'rated' ? 'selected' : ''}>Top rated</option><option value="new" ${sort === 'new' ? 'selected' : ''}>Newest</option></select></div>
  <div class="grid cards">${L.map(card).join('') || '<div class="card">No rooms match. Try another category or create one.</div>'}</div>`;
}

function room(id) {
  const r = rm(id); if (!r) return '<p>Room not found. <a href="#/rooms">Back to rooms</a></p>';
  const u = me(), m = r.members.find(x => x.u === u.id), inn = m && m.s === 'in', own = r.owner === u.id || u.role === 'admin', s = st(r), mine_ = r.rate[u.id] || 0;
  const pend = r.members.filter(x => x.s === 'wait');
  if (tm.rid !== id) { tm.rid = id; }
  const join = inn ? `<button class="ghost" data-act="leave" data-id="${id}">Leave room</button>` : m ? '<span class="chip Pending">Waiting for approval</span>' : `<button class="btn" data-act="join" data-id="${id}" ${s === 'Full' ? 'disabled' : ''}>${s === 'Full' ? 'Room is full' : r.priv ? 'Request to join' : 'Join room'}</button>`;
  const timer = `<div class="card timer"><h2 style="margin-top:0">Focus timer</h2><div class="ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="54"/><circle id="rg" cx="60" cy="60" r="54" stroke-dasharray="339.3" stroke-dashoffset="${339.3 * (1 - tm.left / (tm.len * 60))}"/></svg><b id="tt">${fmt(tm.left)}</b></div>
    <div class="row c">${[[25, 'Focus 25'], [50, 'Focus 50'], [5, 'Break 5']].map(([n, l]) => `<button class="chip ${tm.len === n ? 'on' : ''}" data-act="len" data-id="${n}">${l}</button>`).join('')}</div>
    <div class="row c"><button class="btn" data-act="tgl" data-id="${id}">${tm.run ? 'Pause' : 'Start'}</button><button class="ghost" data-act="rst">Reset</button></div></div>`;
  const tasks = `<div class="card"><h2 style="margin-top:0">Shared tasks</h2>${r.tasks.map((t, i) => `<div class="task ${t.d ? 'd' : ''}"><input type="checkbox" data-act="tdone" data-id="${id}" data-i="${i}" ${t.d ? 'checked' : ''} aria-label="Done"><span>${esc(t.t)}</span><button class="link" data-act="tdel" data-id="${id}" data-i="${i}">Remove</button></div>`).join('') || '<p class="mut">No tasks yet.</p>'}
    <form data-f="task" data-id="${id}" class="row"><input name="t" placeholder="Add a task" required maxlength="80"><button class="btn sm">Add</button></form></div>`;
  const chat = `<div class="card"><div class="row between"><h2 style="margin:0">Room chat</h2><span class="stars" aria-label="Rate this room">${[1, 2, 3, 4, 5].map(n => `<button data-act="rate" data-id="${id}" data-i="${n}" class="${n <= mine_ ? 'on' : ''}" aria-label="${n} stars">★</button>`).join('')}</span></div>
    <div class="chat">${r.msgs.slice(-30).map((x, i, a) => `<div class="msg">${av(user(x.u).name, 'sm')}<div><b>${esc(user(x.u).name)}</b> <small class="mut">${ago(x.ts)}</small>${x.u === u.id || u.role === 'admin' ? ` <button class="link" data-act="mdel" data-id="${id}" data-i="${r.msgs.indexOf(x)}">Delete</button>` : ''}<br>${esc(x.t)}</div></div>`).join('')}</div>
    ${inn ? `<form data-f="msg" data-id="${id}" class="row"><input name="t" placeholder="Write a comment…" required maxlength="240" autocomplete="off"><button class="btn sm">Send</button></form>` : '<small class="mut">Join the room to take part in the chat.</small>'}</div>`;
  const people = `<div class="card"><h2 style="margin-top:0">Members (${members(r).length}/${r.cap})</h2><div class="row wrap">${members(r).map(x => `<span class="row">${av(user(x.u).name, 'sm')}<small>${esc(user(x.u).name)}${x.u === r.owner ? ' (owner)' : ''}</small></span>`).join('')}</div>
    ${own && pend.length ? `<h2>Join requests</h2>${pend.map(x => `<div class="task"><span>${esc(user(x.u).name)}</span><span style="margin-left:auto"><button class="btn sm" data-act="ok" data-id="${id}" data-u="${x.u}">Approve</button> <button class="ghost sm" data-act="no" data-id="${id}" data-u="${x.u}">Reject</button></span></div>`).join('')}` : ''}</div>`;
  return `<a href="#/rooms" class="mut">← All rooms</a><div class="head" style="margin-top:8px"><div><span class="tag">${esc(r.cat)}</span>${r.priv ? '<span class="tag lock">Private</span>' : ''}<h1>${esc(r.title)}</h1><p>${esc(r.desc)} · ★ ${avg(r)}</p></div>
    <div class="row wrap">${join}${own ? `<button class="ghost" data-act="edit" data-id="${id}">Edit</button><button class="ghost danger" data-act="del" data-id="${id}">Delete</button>` : ''}</div></div>
    <div class="two"><div>${inn ? timer + tasks : '<div class="card mut">Join this room to unlock the timer and shared tasks.</div>'}</div><div>${chat}${people}</div></div>`;
}

const chart = id => {
  const days = [...Array(7)].map((_, i) => { const t = Date.now() - (6 - i) * 864e5; return [new Date(t).toLocaleDateString('en', { weekday: 'short' }), dayMin(id, t)]; });
  const mx = Math.max(60, ...days.map(d => d[1]));
  return `<svg viewBox="0 0 280 124" class="chart" role="img" aria-label="Minutes studied in the last 7 days">${days.map((d, i) => { const h = d[1] / mx * 90; return `<rect x="${i * 40 + 8}" y="${100 - h}" width="24" height="${h}" rx="6"><title>${d[1]} min</title></rect><text x="${i * 40 + 20}" y="114">${d[0]}</text>`; }).join('')}</svg>`;
};
const heat = id => `<div class="heat">${[...Array(28)].map((_, i) => { const m = dayMin(id, Date.now() - (27 - i) * 864e5); return `<i class="${m > 90 ? 'l3' : m > 45 ? 'l2' : m > 0 ? 'l1' : ''}" title="${m} min"></i>`; }).join('')}</div>`;
const badges = u => [[total(u.id) > 0, 'First session'], [streak(u.id) >= 7, '7-day streak'], [total(u.id) >= 100, '100 minutes'], [D().rooms.some(r => r.owner === u.id), 'Room creator'], [D().rooms.filter(r => r.members.some(m => m.u === u.id && m.s === 'in')).length >= 3, 'Social learner']].map(([o, t]) => `<span class="badge ${o ? '' : 'off'}">${o ? '🏅' : '🔒'} ${t}</span>`).join('');

function progress() {
  const u = me(), top = [...D().users].filter(x => x.role !== 'admin').sort((a, b) => total(b.id) - total(a.id)).slice(0, 5);
  return `<h1>Your progress</h1><div class="grid kpi">${kpi('Total minutes', total(u.id))}${kpi('Day streak', streak(u.id))}${kpi('Level', level(u.id))}${kpi('Sessions', mine(u.id).length)}</div>
  <div class="two"><div class="card"><h2 style="margin-top:0">Last 7 days</h2>${chart(u.id)}</div><div class="card"><h2 style="margin-top:0">Last 28 days</h2>${heat(u.id)}</div></div>
  <div class="two"><div class="card"><h2 style="margin-top:0">Badges</h2>${badges(u)}</div><div class="card"><h2 style="margin-top:0">Leaderboard</h2>${top.map((x, i) => `<div class="task">${i + 1}. ${av(x.name, 'sm')}<span>${esc(x.name)}${x.id === u.id ? ' (you)' : ''}</span><b style="margin-left:auto">${total(x.id)} min</b></div>`).join('')}</div></div>
  <h2>Activity log</h2><div class="card">${activity(D().acts.filter(a => a.u === u.id))}</div>`;
}

function profile() {
  const u = me();
  return `<h1>Profile</h1><div class="two"><form class="card" data-f="prof"><div class="row">${av(u.name, 'xl')}<div><b>${esc(u.name)}</b><br><small class="mut">${esc(u.email)} · ${u.role}</small></div></div>
  <label>Name<input name="name" value="${esc(u.name)}" required maxlength="40"></label><label>Bio<textarea name="bio" maxlength="120">${esc(u.bio)}</textarea></label>
  <label>Daily goal (minutes)<input name="goal" type="number" min="10" max="600" value="${u.goal}"></label><button class="btn" style="margin-top:12px">Save profile</button></form>
  <div class="card"><h2 style="margin-top:0">Badges</h2>${badges(u)}<h2>Stats</h2><p class="mut">${total(u.id)} minutes studied · level ${level(u.id)} · ${streak(u.id)}-day streak</p></div></div>`;
}

function admin() {
  const U = D().users;
  return `<div class="head"><div><h1>Admin console</h1><p>Manage users, moderate rooms and broadcast announcements.</p></div><div class="row"><button class="ghost" data-act="csv">Export users CSV</button><button class="ghost danger" data-act="reset">Reset demo data</button></div></div>
  <div class="grid kpi">${kpi('Users', U.length)}${kpi('Rooms', D().rooms.length)}${kpi('Minutes logged', D().log.reduce((a, l) => a + l.m, 0))}${kpi('Flagged rooms', D().rooms.filter(r => r.flag).length)}</div>
  <h2>Users</h2><div class="card tw"><table><tr><th>Name</th><th>Email</th><th>Role</th><th>Minutes</th><th>Status</th></tr>${U.map(x => `<tr><td>${esc(x.name)}</td><td>${esc(x.email)}</td><td><select data-chg="role" data-id="${x.id}" style="margin:0;width:auto" ${x.id === me().id ? 'disabled' : ''}><option ${x.role === 'learner' ? 'selected' : ''}>learner</option><option ${x.role === 'admin' ? 'selected' : ''}>admin</option></select></td><td>${total(x.id)}</td><td><button class="chip ${x.on ? 'Open' : 'Full'}" data-act="susp" data-id="${x.id}" ${x.id === me().id ? 'disabled' : ''}>${x.on ? 'Active' : 'Suspended'}</button></td></tr>`).join('')}</table></div>
  <h2>Room moderation</h2><div class="card tw"><table><tr><th>Room</th><th>Owner</th><th>Members</th><th>Actions</th></tr>${D().rooms.map(r => `<tr><td><a href="#/room/${r.id}">${esc(r.title)}</a>${r.flag ? ' 🚩' : ''}</td><td>${esc(user(r.owner).name)}</td><td>${members(r).length}</td><td><button class="link" data-act="flag" data-id="${r.id}">${r.flag ? 'Approve' : 'Flag'}</button> · <button class="link danger" data-act="del" data-id="${r.id}">Remove</button></td></tr>`).join('')}</table></div>
  <div class="two"><div class="card"><h2 style="margin-top:0">Categories</h2><div class="row wrap">${D().cats.map(c => `<span class="chip">${esc(c)} <button class="link" data-act="catdel" data-id="${esc(c)}" aria-label="Remove ${esc(c)}">✕</button></span>`).join('')}</div><form data-f="cat" class="row"><input name="c" placeholder="New category" required maxlength="24"><button class="btn sm">Add</button></form></div>
  <div class="card"><h2 style="margin-top:0">Announcement</h2><form data-f="ann"><input name="t" placeholder="Message to all users" required maxlength="120"><button class="btn sm">Broadcast</button></form></div></div>
  <h2>Platform activity</h2><div class="card">${activity(D().acts)}</div>`;
}

/* ---------- router ---------- */
const R = { dash, rooms, room, progress, profile, admin };
function route() {
  const u = me(); if (!u) return;
  let [, p, id] = location.hash.split('/'); p = R[p] ? p : 'dash'; if (p === 'admin' && u.role !== 'admin') p = 'dash';
  const v = $('#view'); v.innerHTML = R[p](id); v.classList.remove('in'); void v.offsetWidth; v.classList.add('in');
  $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.h === p)); badge();
}
const badge = () => { const n = D().notes.filter(x => x.u === sid() && !x.read).length; $('#bc').hidden = !n; $('#bc').textContent = n; };
const popup = () => { const L = D().notes.filter(n => n.u === sid()); $('#bp').innerHTML = `<div class="row between"><b>Notifications</b><button class="link" data-act="readall">Mark all read</button></div>` + (L.slice(0, 8).map(n => `<div class="note ${n.read ? '' : 'new'}">${esc(n.text)}<small class="mut">${ago(n.ts)}</small></div>`).join('') || '<p class="mut">You are all caught up.</p>'); };

/* ---------- timer ---------- */
const paint = () => { const t = $('#tt'); if (t) { t.textContent = fmt(tm.left); $('#rg').style.strokeDashoffset = 339.3 * (1 - tm.left / (tm.len * 60)); } };
function logMin(rid, m) {
  const u = me(), b = dayMin(u.id, Date.now()); if (m < 1) return;
  D().log.push({ u: u.id, m, ts: Date.now(), room: rid }); act(`Studied ${m} min in ${rm(rid)?.title || 'a room'}`);
  if (b < u.goal && b + m >= u.goal) { notify(u.id, 'Daily goal reached. Great work!'); burst(); }
  save(); toast(`+${m} min logged`);
}
function stopTimer(saveProgress) {
  clearInterval(tick); const el = tm.len * 60 - tm.left;
  if (saveProgress && tm.run && tm.len > 5) logMin(tm.rid, Math.floor(el / 60));
  tm.run = false; tm.left = tm.len * 60;
}

/* ---------- actions ---------- */
function roomForm(r) {
  dlg(`<h2 style="margin-top:0">${r ? 'Edit room' : 'Create room'}</h2><form data-f="room" data-id="${r ? r.id : ''}"><input name="title" placeholder="Room title" required maxlength="50" value="${esc(r?.title)}" aria-label="Title">
  <select name="cat" aria-label="Category">${D().cats.map(c => `<option ${r && r.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
  <textarea name="desc" placeholder="What will you study here?" required maxlength="200" aria-label="Description">${esc(r?.desc)}</textarea>
  <label>Capacity<input name="cap" type="number" min="2" max="50" value="${r ? r.cap : 10}"></label>
  <label class="chk"><input type="checkbox" name="priv" ${r?.priv ? 'checked' : ''}> Private: owner approves join requests</label>
  <div class="row c"><button type="button" class="ghost" data-x>Cancel</button><button class="btn">Save room</button></div></form>`);
}
const A = {
  out: logout,
  theme() { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = localStorage.sn_theme = t; },
  bell() { const p = $('#bp'); popup(); p.hidden = !p.hidden; },
  readall() { D().notes.forEach(n => { if (n.u === sid()) n.read = 1; }); save(); popup(); badge(); },
  cat(id) { cat = id; route(); },
  new() { roomForm(); },
  edit(id) { roomForm(rm(id)); },
  join(id) { const r = rm(id), u = me(); if (r.members.some(m => m.u === u.id)) return;
    if (members(r).length >= r.cap) return toast('This room is full');
    r.members.push({ u: u.id, s: r.priv ? 'wait' : 'in' });
    if (r.priv) { notify(r.owner, `${u.name} asked to join ${r.title}`); toast('Request sent. The owner will review it.'); } else { act('Joined room ' + r.title); toast('You joined ' + r.title); }
    save(); route(); },
  leave(id) { const r = rm(id); r.members = r.members.filter(m => m.u !== me().id); stopTimer(true); act('Left room ' + r.title); save(); route(); },
  ok(id, b) { const r = rm(id), m = r.members.find(x => x.u === b.dataset.u); m.s = 'in'; notify(m.u, `Your request to join ${r.title} was approved`); save(); toast('Approved'); route(); },
  no(id, b) { const r = rm(id); r.members = r.members.filter(x => x.u !== b.dataset.u); notify(b.dataset.u, `Your request to join ${r.title} was declined`); save(); toast('Rejected'); route(); },
  del(id) { const r = rm(id); if (!confirm(`Delete "${r.title}" for everyone?`)) return; D().rooms = D().rooms.filter(x => x.id !== id); save(); toast('Room deleted'); if (location.hash.startsWith('#/room')) location.hash = '#/rooms'; else route(); },
  flag(id) { const r = rm(id); r.flag = r.flag ? 0 : 1; notify(r.owner, r.flag ? `${r.title} was flagged by an admin` : `${r.title} was approved by an admin`); save(); route(); },
  tgl(id) { tm.rid = id; if (tm.run) { tm.run = false; clearInterval(tick); } else { tm.run = true; tick = setInterval(() => { tm.left--; paint();
      if (tm.left <= 0) { clearInterval(tick); tm.run = false; if (tm.len > 5) { logMin(tm.rid, tm.len); burst(); } else toast('Break over. Back to focus.'); tm.left = tm.len * 60; route(); } }, 1000); } route(); },
  rst() { stopTimer(false); route(); },
  len(id) { stopTimer(false); tm.len = +id; tm.left = tm.len * 60; route(); },
  tdone(id, b) { const t = rm(id).tasks[b.dataset.i]; t.d = t.d ? 0 : 1; if (t.d) act('Completed task: ' + t.t); save(); route(); },
  tdel(id, b) { rm(id).tasks.splice(+b.dataset.i, 1); save(); route(); },
  mdel(id, b) { rm(id).msgs.splice(+b.dataset.i, 1); save(); route(); },
  rate(id, b) { rm(id).rate[me().id] = +b.dataset.i; save(); toast('Thanks for your rating'); route(); },
  susp(id) { const x = user(id); x.on = x.on ? 0 : 1; save(); route(); },
  catdel(id) { D().cats = D().cats.filter(c => c !== id); save(); route(); },
  reset() { if (confirm('Reset all demo data? Registered users and rooms will be lost.')) { DB.reset(); logout(); } },
  csv() { const rows = [['Name', 'Email', 'Role', 'Minutes'], ...D().users.map(u => [u.name, u.email, u.role, total(u.id)])];
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' })); a.download = 'studynest-users.csv'; a.click(); }
};
const F = {
  room(d) { const o = { title: d.title.trim(), cat: d.cat, desc: d.desc.trim(), cap: Math.max(2, +d.cap || 10), priv: !!d.priv };
    if (d.id) Object.assign(rm(d.id), o); else { D().rooms.unshift({ id: DB.id(), ...o, owner: me().id, flag: 0, members: [{ u: me().id, s: 'in' }], msgs: [], tasks: [], rate: {} }); act('Created room ' + o.title); }
    save(); $('#dlg').close(); toast('Room saved'); route(); },
  task(d) { rm(d.id).tasks.push({ t: d.t.trim(), d: 0 }); save(); route(); },
  msg(d) { const r = rm(d.id), u = me(); r.msgs.push({ u: u.id, t: d.t.trim(), ts: Date.now() }); if (r.owner !== u.id) notify(r.owner, `${u.name} commented in ${r.title}`); save(); route(); const c = $('.chat'); if (c) c.scrollTop = c.scrollHeight; },
  prof(d) { const u = me(); u.name = d.name.trim(); u.bio = d.bio.trim(); u.goal = Math.min(600, Math.max(10, +d.goal || 60)); save(); toast('Profile saved'); boot(); },
  cat(d) { const c = d.c.trim(); if (!D().cats.includes(c)) D().cats.push(c); save(); route(); },
  ann(d) { D().users.forEach(u => notify(u.id, '📢 ' + d.t.trim())); act('Sent announcement'); save(); toast('Announcement sent'); route(); }
};

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (b) { if (b.dataset.act !== 'bell' && b.dataset.act !== 'readall') $('#bp').hidden = true; A[b.dataset.act]?.(b.dataset.id, b); return; }
  if (!e.target.closest('#bp')) $('#bp').hidden = true;
});
document.addEventListener('submit', e => { const f = e.target.dataset.f; if (!f) return; e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); d.id = e.target.dataset.id; F[f](d); });
document.addEventListener('change', e => {
  const c = e.target.dataset.chg; if (!c) return;
  if (c === 'sort') { sort = e.target.value; route(); }
  if (c === 'role') { user(e.target.dataset.id).role = e.target.value; save(); toast('Role updated'); }
});
$('#gs').oninput = e => { q = e.target.value; if (location.hash !== '#/rooms') location.hash = '#/rooms'; else route(); };
document.addEventListener('keydown', e => { if (e.key === '/' && !e.target.matches('input,textarea,select')) { e.preventDefault(); $('#gs').focus(); } if (e.key === 'Escape') $('#bp').hidden = true; });
addEventListener('hashchange', () => { if (!location.hash.startsWith('#/room/')) stopTimer(true); route(); });
addEventListener('storage', e => { if (e.key === 'sn_v1') { DB.reload(); if (!document.activeElement.matches('input,textarea,select')) route(); } });
boot();
})();
