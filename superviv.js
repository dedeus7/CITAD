/* Supervivencia: variante de combate con personajes secretos, vidas, Ataque y Armadura */
Party.register({
  id: 'superviv', name: 'Supervivencia', emoji: '🩸', players: '1-8', min: 1, wide: true,
  desc: '12 criaturas secretas, 7 vidas cada uno, cartas de Ataque y Armadura. El último en pie gana. Se puede jugar contra bots.',
  create(P) {
'use strict';

/* ---------- utilidades ---------- */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const app = $('#app');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
const toast = P.toast;
const isHost = P.isHost, myId = P.myId;
let players = P.players();
const room = P.room;
let screen = '';
function show(name, html) { screen = name; app.innerHTML = html; }
function on(sel, ev, fn) { const el = typeof sel === 'string' ? $(sel) : sel; if (el) el.addEventListener(ev, fn); }
const send = (id, m) => { if (!String(id).startsWith('bot')) P.send(id, m); }, broadcast = m => P.broadcast(m), toHost = m => P.toHost(m);
let BOTS = {}; // id -> {name, color}
const pl = id => players.find(p => p.id === id) || room.players.find(p => p.id === id) || BOTS[id] || { name: '¿?', color: '#888' };
const isBot = id => !!BOTS[id] && id.startsWith('bot');
const nm = id => esc(pl(id).name);
const chip = id => `<b style="color:${pl(id).color}">${nm(id)}</b>`;

let actx = null;
function audio() { try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) {} return actx; }
function tone(f, d = 0.2, type = 'sine', vol = 0.1) { const a = audio(); if (!a) return; try { const o = a.createOscillator(), g = a.createGain(), t = a.currentTime; o.type = type; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + 0.02); } catch (e) {} }
const SFX = {
  coin: () => { tone(1320, .08, 'square', .05); setTimeout(() => tone(1760, .12, 'square', .05), 70); },
  hit: () => { tone(120, .25, 'sawtooth', .12); setTimeout(() => tone(80, .3, 'square', .08), 60); },
  shield: () => tone(900, .2, 'triangle', .08),
  heal: () => [660, 880, 1100].forEach((f, i) => setTimeout(() => tone(f, .2, 'sine', .08), i * 80)),
  turn: () => [392, 587].forEach((f, i) => setTimeout(() => tone(f, .3, 'sine', .1), i * 140)),
  bad: () => tone(140, .4, 'sawtooth', .08),
  fanfare: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, .3, 'triangle', .12), i * 130)),
};

/* =====================================================
   REGLAS (todos los números en un sitio, fáciles de equilibrar)
   ===================================================== */
const R = {
  lives: 7, maxLives: 7, maxArmor: 6, startGold: 2, startCards: 4,
  vampSteal: 2,     // vida máxima que roba el Vampiro por ataque
  wolfArmor: 2,     // armadura que gana el Licántropo tras atacar
  hunterBack: 2,    // daño que devuelve el Cazador al Fantasma
  hunterGold: 2,    // oro que cobra el Cazador al empezar su turno
  dragonBonus: 2,   // daño extra del Dragón
  demonTargets: 2,  // a cuántos jugadores golpea el Demonio con un ataque
  levDamage: 2, levCost: 2, // Leviatán: daño a todos y vidas que pierde
  angelHeal: 2, angelRevive: 2,
  sirenDamage: 1,
  doomRound: 10,    // desde esta ronda, la noche quita 1 vida a todos al acabar cada ronda
};
const CHAR = {
  1: { n: 'Medusa', e: '🐍', d: 'Petrifica a un personaje: si alguien lo tiene, pierde su turno entero.' },
  2: { n: 'Goblin', e: '👺', d: 'Al atacar, roba 1 de oro al objetivo por cada punto de daño que cause.' },
  3: { n: 'Fantasma', e: '👻', d: 'Sus ataques atraviesan la armadura y van directos a las vidas… salvo contra el Cazador de Brujas.' },
  4: { n: 'Cazador de Brujas', e: '🗡️', d: `Cobra ${R.hunterGold} de oro al empezar. Si el Fantasma le ataca, el ataque falla y el Fantasma recibe ${R.hunterBack} de daño.` },
  5: { n: 'Sirena', e: '🧜', d: `Canto: elige a un jugador; pierde ${R.sirenDamage} vida (sin armadura que valga) y le robas 1 carta al azar.` },
  6: { n: 'Licántropo', e: '🐺', d: `Después de atacar, gana ${R.wolfArmor} de armadura.` },
  7: { n: 'Vampiro', e: '🧛', d: `Al atacar, se cura tantas vidas como daño haga a las vidas del objetivo (máx. ${R.vampSteal}).` },
  8: { n: 'Mago', e: '🧙', d: 'Roba 1 carta extra al empezar. Al atacar, se cura 1 vida.' },
  9: { n: 'Ángel', e: '😇', d: `Revive a un jugador caído con ${R.angelRevive} vidas (una vez por jugador) o cura ${R.angelHeal} vidas a quien quiera.` },
  10: { n: 'Demonio', e: '👹', d: `Su ataque golpea a ${R.demonTargets} jugadores a la vez con todo el daño.` },
  11: { n: 'Dragón', e: '🐉', d: `Su ataque hace +${R.dragonBonus} de daño.` },
  12: { n: 'Leviatán', e: '🌊', d: `Maremoto: ${R.levDamage} de daño a todos los demás, pero pierde ${R.levCost} vidas (necesita más de ${R.levCost}).` },
};
const RANKS = Object.keys(CHAR).map(Number);
const KIND = {
  a1: { t: 'atk', v: 1, k: 0, n: 'Daga', e: '🔪', q: 8 }, a2: { t: 'atk', v: 2, k: 1, n: 'Espada', e: '⚔️', q: 8 }, a3: { t: 'atk', v: 3, k: 2, n: 'Hacha', e: '🪓', q: 6 }, a4: { t: 'atk', v: 4, k: 3, n: 'Lanza de fuego', e: '🔥', q: 4 },
  d1: { t: 'arm', v: 1, k: 0, n: 'Escudo de madera', e: '🪵', q: 8 }, d2: { t: 'arm', v: 2, k: 1, n: 'Cota de malla', e: '⛓️', q: 6 }, d3: { t: 'arm', v: 3, k: 2, n: 'Armadura de placas', e: '🛡️', q: 4 },
};
const CARDS = []; Object.entries(KIND).forEach(([key, d]) => { for (let i = 0; i < d.q; i++) CARDS.push(key); });
const K = id => KIND[CARDS[id]];

/* =====================================================
   ANFITRIÓN
   ===================================================== */
const BOT_NAMES = [['🤖 Drácula', '#c0392b'], ['🤖 Morgana', '#8e44ad'], ['🤖 Nosferatu', '#7f8c8d'], ['🤖 Lilith', '#e84393'], ['🤖 Grendel', '#27ae60'], ['🤖 Baba Yaga', '#d35400'], ['🤖 Kraken', '#2980b9'], ['🤖 Banshee', '#16a085']];
let settings = { bots: 0 };
let S = null;
const inRoom = id => room.players.some(p => p.id === id) || isBot(id);
const alive = () => S.order.filter(id => inRoom(id) && S.lives[id] > 0);
const holder = r => S.owner[r];
function log(txt) { S.log.push(txt); if (S.log.length > 80) S.log.shift(); }
function hostBegin() {
  const humans = room.players.map(p => p.id);
  const nb = Math.max(0, Math.min(settings.bots, 8 - humans.length));
  BOTS = {}; shuffle(BOT_NAMES).slice(0, nb).forEach((b, i) => { BOTS['bot' + (i + 1)] = { name: b[0], color: b[1] }; });
  const ids = humans.concat(Object.keys(BOTS));
  if (ids.length < 2) { toast('Añade al menos un bot o espera a otro jugador'); return; }
  if (ids.length > 8) { toast('Máximo 8 jugadores'); return; }
  S = { order: shuffle(ids), deck: shuffle(CARDS.map((_, i) => i)), discard: [], gold: {}, hand: {}, lives: {}, armor: {}, chars: {}, round: 0, log: [], phase: 'draft', revived: {}, out: [], first: null };
  ids.forEach(id => { S.gold[id] = R.startGold; S.lives[id] = R.lives; S.armor[id] = 0; S.hand[id] = []; });
  ids.forEach(id => S.hand[id] = drawN(R.startCards));
  log(`🩸 Empieza la partida: ${R.lives} vidas, ${R.startGold} de oro y ${R.startCards} cartas para cada uno.`);
  startRound();
}
function drawN(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    if (!S.deck.length) { if (!S.discard.length) break; S.deck = shuffle(S.discard); S.discard = []; }
    out.push(S.deck.pop());
  }
  return out;
}
function startRound() {
  S.round++; S.phase = 'draft'; S.petrified = null; S.owner = {}; S.revealed = {}; S.rank = 0; S.turn = null;
  const al = alive(); S.order.forEach(id => S.chars[id] = []);
  const n = al.length, k = n <= 3 ? 2 : 1;
  let pool = shuffle(RANKS.slice());
  const faceDown = pool.pop();
  const upN = Math.max(0, pool.length - (n * k + 2));
  const faceUp = pool.splice(0, upN);
  // elige primero quien tenga menos vidas (empate: el siguiente en la mesa tras el último que empezó)
  const startIdx = S.first ? (S.order.indexOf(S.first) + 1) % S.order.length : 0;
  const seat = S.order.slice(startIdx).concat(S.order.slice(0, startIdx)).filter(id => al.includes(id));
  const minL = Math.min(...seat.map(id => S.lives[id]));
  const firstId = seat.find(id => S.lives[id] === minL); S.first = firstId;
  const fi = seat.indexOf(firstId), ring = seat.slice(fi).concat(seat.slice(0, fi));
  const queue = []; for (let i = 0; i < k; i++) queue.push(...ring);
  S.draft = { avail: pool.sort((a, b) => a - b), faceUp: faceUp.sort((a, b) => a - b), faceDown, queue };
  log(`🌙 Ronda ${S.round}. Elige primero ${pl(firstId).name} (el más herido).` + (faceUp.length ? ` Fuera de juego a la vista: ${faceUp.map(r => CHAR[r].e).join(' ')}.` : ''));
  draftNext();
}
function draftNext() {
  const d = S.draft;
  while (d.queue.length && !alive().includes(d.queue[0])) d.queue.shift();
  if (!d.queue.length) { S.phase = 'turns'; S.rank = 0; log('🎭 Todos han elegido. ¡Que empiece la noche!'); return nextRank(); }
  sync();
}
function hostPick(id, rank) {
  const d = S.draft;
  if (S.phase !== 'draft' || d.queue[0] !== id || !d.avail.includes(rank)) return;
  d.avail = d.avail.filter(r => r !== rank); d.queue.shift();
  S.chars[id].push(rank); S.owner[rank] = id;
  draftNext();
}
function nextRank() {
  S.turn = null;
  if (checkEnd()) return;
  while (++S.rank <= 12) {
    const r = S.rank, id = S.owner[r];
    if (!id || !inRoom(id)) continue;
    S.revealed[r] = id;
    if (S.lives[id] <= 0) { log(`${CHAR[r].e} ${CHAR[r].n} era ${pl(id).name}, pero ya ha caído.`); continue; }
    if (S.petrified === r) { log(`🗿 ${CHAR[r].e} ${CHAR[r].n} era ${pl(id).name}: está petrificado y pierde el turno.`); continue; }
    log(`${CHAR[r].e} Turno de ${CHAR[r].n}: ${pl(id).name}.`);
    S.turn = { id, rank: r, acted: false, attacked: false, armored: false, ability: false, choose: null };
    if (r === 4) { S.gold[id] += R.hunterGold; log(`🗡️ El Cazador cobra ${R.hunterGold} de oro.`); }
    if (r === 8) { S.hand[id].push(...drawN(1)); log('🧙 El Mago roba 1 carta extra.'); }
    return sync();
  }
  endRound();
}
function endRound() {
  if (S.round >= R.doomRound) {
    log('🌑 La noche eterna se cierra: todos pierden 1 vida.');
    alive().forEach(id => hurt(id, 1, true, null));
  }
  if (checkEnd()) return;
  startRound();
}
// daño: devuelve {armor, life}
function hurt(id, dmg, direct, by) {
  if (S.lives[id] <= 0 || dmg <= 0) return { armor: 0, life: 0 };
  let a = 0;
  if (!direct) { a = Math.min(S.armor[id], dmg); S.armor[id] -= a; }
  const l = Math.min(S.lives[id], dmg - a);
  S.lives[id] -= l;
  if (S.lives[id] <= 0) { S.out.push(id); log(`☠️ ¡${pl(id).name} ha caído!`); broadcast({ t: 'fx', k: 'dead', id }); }
  return { armor: a, life: l };
}
const heal = (id, n) => { const before = S.lives[id]; S.lives[id] = Math.min(R.maxLives, S.lives[id] + n); return S.lives[id] - before; };
function checkEnd() {
  if (S.phase === 'end') return true;
  const al = alive();
  if (al.length <= 1) { endGame(al[0] || null); return true; }
  return false;
}
function endGame(winner) {
  S.phase = 'end'; S.turn = null;
  // clasificación: ganador y después en orden inverso de caída
  const fallen = S.out.slice().reverse().filter((id, i, a) => a.indexOf(id) === i && id !== winner);
  const rank = (winner ? [winner] : []).concat(fallen).filter(inRoom);
  S.order.forEach(id => { if (inRoom(id) && !rank.includes(id)) rank.push(id); });
  const PTS = [6, 3, 1], night = {};
  rank.forEach((id, i) => { night[id] = PTS[i] || 0; const p = room.players.find(q => q.id === id); if (p) p.score += night[id]; });
  P.broadcastPlayers();
  log(winner ? `🏆 ¡${pl(winner).name} es el último superviviente!` : '🏁 No queda nadie en pie…');
  sync({ final: { rank, night, winner } });
}
function attackOne(id, r, tg, val) {
  const name = pl(tg).name;
  if (r === 3 && holder(4) === tg) {
    S.revealed[4] = tg;
    log(`🗡️ ¡${name} era el Cazador de Brujas! El ataque del Fantasma falla y le devuelve ${R.hunterBack} de daño.`);
    hurt(id, R.hunterBack, true, tg); return { armor: 0, life: 0 };
  }
  const res = hurt(tg, val, r === 3, id);
  log(`💥 ${pl(id).name} ataca a ${name} con ${val} de daño` + (res.armor ? ` (la armadura para ${res.armor})` : '') + `: −${res.life} vida${res.life === 1 ? '' : 's'}.`);
  if (r === 2) { const g = Math.min(S.gold[tg], res.armor + res.life); if (g) { S.gold[tg] -= g; S.gold[id] += g; log(`👺 El Goblin le roba ${g} de oro.`); } }
  if (r === 7) { const h = heal(id, Math.min(R.vampSteal, res.life)); if (h) log(`🧛 El Vampiro se bebe ${h} vida${h === 1 ? '' : 's'}.`); }
  return res;
}
function hostAct(id, m) {
  const T = S && S.turn;
  if (!T || S.phase !== 'turns' || T.id !== id) return;
  const r = T.rank, g = S.gold, hand = S.hand[id];
  const err = t => send(id, { t: 'err', text: t });
  const others = alive().filter(x => x !== id);
  switch (m.a) {
    case 'gold': if (T.acted) return; T.acted = true; g[id] += 2; log(`🪙 ${pl(id).name} coge 2 de oro.`); break;
    case 'draw': {
      if (T.acted) return; T.acted = true;
      const cs = drawN(2);
      if (cs.length <= 1) { hand.push(...cs); log(`🃏 ${pl(id).name} roba una carta.`); } else T.choose = cs;
      break;
    }
    case 'keep':
      if (!T.choose || !T.choose.includes(m.card)) return;
      hand.push(m.card); S.discard.push(...T.choose.filter(c => c !== m.card)); T.choose = null; log(`🃏 ${pl(id).name} roba una carta.`); break;
    case 'armor': {
      if (!T.acted) return err('Primero coge oro o cartas');
      if (T.choose) return err('Elige antes qué carta te quedas');
      if (T.armored) return err('Solo puedes equiparte 1 armadura por turno');
      if (!hand.includes(m.card) || K(m.card).t !== 'arm') return;
      const d = K(m.card); if (g[id] < d.k) return err('No tienes oro suficiente');
      if (S.armor[id] >= R.maxArmor) return err(`Ya tienes la armadura al máximo (${R.maxArmor})`);
      g[id] -= d.k; hand.splice(hand.indexOf(m.card), 1); S.discard.push(m.card); T.armored = true;
      S.armor[id] = Math.min(R.maxArmor, S.armor[id] + d.v);
      log(`🛡️ ${pl(id).name} se equipa ${d.e} ${d.n} (+${d.v} armadura).`); broadcast({ t: 'fx', k: 'shield' });
      break;
    }
    case 'attack': {
      if (!T.acted) return err('Primero coge oro o cartas');
      if (T.choose) return err('Elige antes qué carta te quedas');
      if (T.attacked) return err('Solo puedes atacar 1 vez por turno');
      if (!hand.includes(m.card) || K(m.card).t !== 'atk') return;
      const d = K(m.card); if (g[id] < d.k) return err('No tienes oro suficiente');
      const max = r === 10 ? R.demonTargets : 1;
      const tgs = [...new Set(m.targets || [])].filter(x => others.includes(x)).slice(0, max);
      if (!tgs.length) return;
      g[id] -= d.k; hand.splice(hand.indexOf(m.card), 1); S.discard.push(m.card); T.attacked = true;
      const val = d.v + (r === 11 ? R.dragonBonus : 0);
      tgs.forEach(tg => attackOne(id, r, tg, val));
      if (S.lives[id] > 0) {
        if (r === 6) { S.armor[id] = Math.min(R.maxArmor, S.armor[id] + R.wolfArmor); log(`🐺 El Licántropo aúlla y gana ${R.wolfArmor} de armadura.`); }
        if (r === 8) { const h = heal(id, 1); if (h) log('🧙 El Mago se cura 1 vida.'); }
      }
      broadcast({ t: 'fx', k: 'hit', ids: tgs });
      break;
    }
    case 'petrify':
      if (r !== 1 || T.ability || !(m.rank >= 2 && m.rank <= 12)) return; T.ability = true; S.petrified = m.rank;
      log(`🐍 La Medusa clava la mirada en ${CHAR[m.rank].e} ${CHAR[m.rank].n}.`); break;
    case 'sing': {
      if (r !== 5 || T.ability || !others.includes(m.target)) return; T.ability = true;
      const th = S.hand[m.target]; let stole = 0;
      if (th.length) { const c = th.splice(Math.floor(Math.random() * th.length), 1)[0]; hand.push(c); stole = 1; }
      log(`🧜 La Sirena canta para ${pl(m.target).name}${stole ? ' y le roba una carta' : ''}.`);
      hurt(m.target, R.sirenDamage, true, id); broadcast({ t: 'fx', k: 'hit', ids: [m.target] });
      break;
    }
    case 'angel': {
      if (r !== 9 || T.ability) return;
      const tg = m.target;
      if (!inRoom(tg)) return;
      if (S.lives[tg] <= 0) {
        if (S.revived[tg]) return err('Ese jugador ya fue revivido una vez');
        T.ability = true; S.revived[tg] = 1; S.lives[tg] = R.angelRevive; S.out = S.out.filter(x => x !== tg);
        if (!S.order.includes(tg)) S.order.push(tg);
        log(`😇 ¡El Ángel devuelve a la vida a ${pl(tg).name} con ${R.angelRevive} vidas!`);
      } else { T.ability = true; const h = heal(tg, R.angelHeal); log(`😇 El Ángel cura ${h} vida${h === 1 ? '' : 's'} a ${pl(tg).name}.`); }
      broadcast({ t: 'fx', k: 'heal' });
      break;
    }
    case 'wave': {
      if (r !== 12 || T.ability) return;
      if (S.lives[id] <= R.levCost) return err(`Necesitas más de ${R.levCost} vidas`);
      T.ability = true; S.lives[id] -= R.levCost;
      log(`🌊 ¡Maremoto! El Leviatán pierde ${R.levCost} vidas y golpea a todos con ${R.levDamage} de daño.`);
      others.forEach(tg => { const res = hurt(tg, R.levDamage, false, id); log(`🌊 ${pl(tg).name}: ${res.armor ? `armadura −${res.armor}, ` : ''}−${res.life} vida${res.life === 1 ? '' : 's'}.`); });
      broadcast({ t: 'fx', k: 'hit', ids: others });
      break;
    }
    case 'end':
      if (!T.acted) return err('Antes de terminar, coge oro o cartas');
      if (T.choose) return err('Elige antes qué carta te quedas');
      return nextRank();
    default: return;
  }
  if (S.lives[id] <= 0) return nextRank(); // p. ej. Fantasma castigado por el Cazador
  if (checkEnd()) return;
  sync();
}
function sync(extra) {
  const pub = {
    phase: S.phase, round: S.round, log: S.log.slice(-16), petrified: S.petrified, rank: S.rank, revealed: S.revealed, deck: S.deck.length,
    doom: S.round >= R.doomRound, bots: BOTS,
    draft: S.phase === 'draft' ? { faceUp: S.draft.faceUp, picking: S.draft.queue[0] } : null,
    turn: S.turn ? { id: S.turn.id, rank: S.turn.rank, acted: S.turn.acted, attacked: S.turn.attacked, armored: S.turn.armored, ability: S.turn.ability, choosing: !!S.turn.choose } : null,
    ps: S.order.filter(inRoom).map(id => ({ id, gold: S.gold[id], cards: S.hand[id].length, lives: S.lives[id], armor: S.armor[id], revived: !!S.revived[id] })),
    ...(extra || {}),
  };
  S.order.filter(inRoom).forEach(id => send(id, { t: 'st', pub, me: {
    hand: S.hand[id], chars: S.chars[id] || [],
    avail: S.phase === 'draft' && S.draft.queue[0] === id ? S.draft.avail : null,
    choose: S.turn && S.turn.id === id ? S.turn.choose : null,
  } }));
  scheduleBot();
}
/* ---------- IA sencilla para los bots ---------- */
let botTimer = null, botSteps = 0, botKey = '';
function scheduleBot() {
  clearTimeout(botTimer);
  if (!S || S.phase === 'end') return;
  const who = S.phase === 'draft' ? S.draft.queue[0] : S.turn && S.turn.id;
  if (!who || !isBot(who)) return;
  const key = S.phase + S.round + ':' + S.rank + ':' + who;
  if (key !== botKey) { botKey = key; botSteps = 0; }
  botTimer = setTimeout(() => {
    try { botMove(who); } catch (e) { console.warn('bot', e); }
    // si la acción no cambió nada (rechazada), volver a intentarlo: el contador acaba terminando el turno
    const now = S && S.phase !== 'end' && (S.phase === 'draft' ? S.draft.queue[0] : S.turn && S.turn.id);
    if (now === who) scheduleBot();
  }, humansAlive() ? (S.phase === 'draft' ? 600 : 650 + Math.random() * 450) : 200); // si solo quedan bots, van rápido
}
const pickR = a => a[Math.floor(Math.random() * a.length)];
const humansAlive = () => alive().some(id => !isBot(id));
function botMove(id) {
  if (!S || S.phase === 'end') return;
  if (S.phase === 'draft') {
    if (S.draft.queue[0] !== id) return;
    const av = S.draft.avail, hurtMe = S.lives[id] <= 3;
    const pref = av.filter(r => hurtMe ? [9, 8, 7, 6].includes(r) : [11, 10, 1, 3, 12].includes(r));
    return hostPick(id, (pref.length && Math.random() < 0.6 ? pickR(pref) : pickR(av)));
  }
  const T = S.turn; if (!T || T.id !== id) return;
  const r = T.rank, hand = S.hand[id], gold = S.gold[id];
  const foes = alive().filter(x => x !== id);
  const weakest = (ign) => foes.slice().sort((a, b) => (S.lives[a] + (ign ? 0 : S.armor[a])) - (S.lives[b] + (ign ? 0 : S.armor[b])));
  const can = t => hand.filter(c => K(c).t === t && K(c).k <= gold).sort((a, b) => K(b).v - K(a).v);
  const doIt = m => hostAct(id, m);
  if (++botSteps > 10) return doIt(T.acted ? { a: 'end' } : { a: 'gold' });
  if (T.choose) {
    const wantArm = S.armor[id] < 2;
    const best = T.choose.slice().sort((a, b) => ((K(b).t === 'arm') === wantArm) - ((K(a).t === 'arm') === wantArm) || K(b).v - K(a).v)[0];
    return doIt({ a: 'keep', card: best });
  }
  if (!T.acted) return doIt({ a: hand.length < 2 || (gold >= 3 && Math.random() < 0.5) ? 'draw' : 'gold' });
  if (!T.ability) {
    if (r === 1) return doIt({ a: 'petrify', rank: pickR([3, 7, 8, 9, 10, 11, 12].filter(x => !S.chars[id].includes(x))) });
    if (r === 5 && foes.length) return doIt({ a: 'sing', target: weakest(true)[0] });
    if (r === 9) { const ally = S.lives[id] < R.maxLives ? id : null; if (ally) return doIt({ a: 'angel', target: ally }); }
    if (r === 12 && S.lives[id] > R.levCost + 2 && foes.length >= 2) return doIt({ a: 'wave' });
  }
  const arm = can('arm');
  if (!T.armored && arm.length && S.armor[id] < 3) return doIt({ a: 'armor', card: arm[0] });
  const atk = can('atk');
  if (!T.attacked && atk.length && foes.length) {
    const tg = weakest(r === 3);
    // el Fantasma no ataca a quien ya se ha revelado como Cazador
    const list = r === 3 ? tg.filter(x => S.revealed[4] !== x) : tg;
    if (list.length) return doIt({ a: 'attack', card: atk[0], targets: list.slice(0, r === 10 ? R.demonTargets : 1) });
  }
  if (!T.armored && arm.length && S.armor[id] < R.maxArmor) return doIt({ a: 'armor', card: arm[0] });
  return doIt({ a: 'end' });
}
function hostLeave(id) {
  if (!S || S.phase === 'end') return;
  log(`🚪 ${pl(id).name} abandona la partida.`);
  if (checkEnd()) return;
  if (S.phase === 'draft') { S.draft.queue = S.draft.queue.filter(x => x !== id); draftNext(); }
  else if (S.turn && S.turn.id === id) nextRank();
  else sync();
}
function hostHandle(id, m) {
  if (!m || !S) return;
  if (m.t === 'pick') hostPick(id, m.rank);
  else if (m.t === 'act') hostAct(id, m);
  else if (m.t === 'skip' && id === 'host' && S.turn) { log(`⏭️ El anfitrión salta el turno de ${pl(S.turn.id).name}.`); nextRank(); }
}

/* =====================================================
   VISTAS
   ===================================================== */
let G = null, ME = null, ui = { mode: null, card: null, tg: [] };
const bg = () => '<div class="sv-bg"></div>';
function cardHTML(id, extra = '', cls = '') {
  const d = K(id);
  return `<button class="svc ${d.t} ${cls}" data-c="${id}" ${extra}><span class="svk">${d.k}</span><span class="sve">${d.e}</span><span class="svv">${d.t === 'atk' ? '⚔️' : '🛡️'} ${d.v}</span><span class="svn">${esc(d.n)}</span></button>`;
}
const hearts = (n, max = R.maxLives) => `<span class="svh">${'❤️'.repeat(Math.max(0, n))}${'🖤'.repeat(Math.max(0, max - n))}</span>`;
const charTag = r => `<span class="svtag">${CHAR[r].e} ${CHAR[r].n}</span>`;
const revealedOf = id => Object.entries(G.revealed || {}).filter(([r, x]) => x === id).map(([r]) => +r);

function renderSetup() {
  show('setup', `${bg()}
    <div class="hubtop"><h1>🩸 Super<span>vivencia</span></h1><div class="codechip"><b>${esc(P.code)}</b></div></div>
    <div class="card"><div class="svprev">${RANKS.map(r => `<div class="svpc"><span>${CHAR[r].e}</span><small>${r}</small></div>`).join('')}</div></div>
    ${isHost ? `<div class="card"><label class="lbl" style="margin-top:0">🤖 Bots (rivales controlados por la máquina)</label>
      <select id="bots">${[0, 1, 2, 3, 4, 5, 6, 7].filter(n => n + room.players.length <= 8).map(n => `<option value="${n}"${settings.bots === n ? ' selected' : ''}>${n === 0 ? 'Sin bots' : n + ' bot' + (n === 1 ? '' : 's')}</option>`).join('')}</select>
      <div class="mute" style="font-size:12px;margin-top:6px">${room.players.length} persona${room.players.length === 1 ? '' : 's'} en la sala${settings.bots ? ` + ${settings.bots} bot${settings.bots === 1 ? '' : 's'}` : ''}. Los bots no son muy listos, pero sirven para probar.</div></div>
      <button class="btn go" id="go">🩸 Empezar la noche</button>${P.homeButton()}` : `<div class="card" style="text-align:center"><b>Esperando al anfitrión…</b>${settings.bots ? `<div class="mute" style="font-size:13px;margin-top:4px">Jugaréis con ${settings.bots} bot${settings.bots === 1 ? '' : 's'}</div>` : ''}</div>`}
    <div class="card"><h3 style="margin-bottom:8px">Cómo se juega</h3><ul class="rules">
      <li>Empiezas con <b>${R.lives} vidas ❤️</b>, ${R.startGold} de oro y ${R.startCards} cartas. Hay cartas de <b>Ataque ⚔️</b> y de <b>Armadura 🛡️</b>; cada una cuesta el oro que marca.</li>
      <li>Cada ronda, empezando por el <b>más herido</b>, cada uno elige <b>en secreto</b> una criatura (con 2-3 jugadores, dos). Hay una oculta y algunas fuera de juego.</li>
      <li>Las criaturas se llaman por orden (1 → 12). En tu turno: coge <b>2 de oro</b> o <b>roba 2 cartas y quédate 1</b>. Después puedes <b>atacar una vez</b>, <b>equiparte una armadura</b> y usar el poder de tu criatura.</li>
      <li>El daño gasta primero la <b>armadura</b> (máx. ${R.maxArmor}) y luego las vidas. A 0 vidas, quedas fuera… salvo que un Ángel te devuelva a la vida.</li>
      <li>Desde la ronda ${R.doomRound}, la noche eterna quita 1 vida a todos al final de cada ronda. <b>El último en pie gana.</b></li>
    </ul></div>`);
  if (isHost) { on('#bots', 'change', e => { settings.bots = +e.target.value; broadcast({ t: 'set', settings }); }); on('#go', 'click', () => { audio(); hostBegin(); }); P.bindHome(); }
}
function overlay(html) {
  const ov = document.createElement('div'); ov.className = 'svov';
  ov.innerHTML = `<div class="card svovc">${html}<button class="btn sec" data-close style="margin-top:12px">Cerrar</button></div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov || e.target.hasAttribute('data-close')) ov.remove(); });
}
const charsOverlay = () => overlay(`<h3 style="margin-bottom:8px">🎭 Criaturas</h3>${RANKS.map(r => `<div class="svrow"><span class="ce">${CHAR[r].e}</span><div><b>${r}. ${CHAR[r].n}</b><div class="mute" style="font-size:13px">${CHAR[r].d}</div></div></div>`).join('')}
  <h3 style="margin:12px 0 6px">🃏 Cartas</h3><div class="mute" style="font-size:13px">${Object.values(KIND).map(d => `${d.e} ${d.n}: ${d.t === 'atk' ? '⚔️' : '🛡️'}${d.v}, cuesta ${d.k} 🪙 (×${d.q})`).join('<br>')}</div>`);

function render() {
  if (!G) return;
  if (G.final) return renderEnd();
  $$('.svov').forEach(e => e.remove());
  const T = G.turn, mine = T && T.id === myId;
  const me = G.ps.find(p => p.id === myId) || { gold: 0, lives: 0, armor: 0 };
  let head = '';
  if (G.phase === 'draft') head = G.draft.picking === myId ? `<div class="phase">🎭 Elige tu criatura</div>` : `<div class="phase-sub">🎭 ${chip(G.draft.picking)} está eligiendo criatura…</div>`;
  else if (T) head = mine ? `<div class="phase">${CHAR[T.rank].e} ¡Tu turno, ${CHAR[T.rank].n}!</div>` : `<div class="phase-sub">${CHAR[T.rank].e} Turno de <b>${CHAR[T.rank].n}</b>: ${chip(T.id)}</div>`;
  const status = `<div class="svstat">Ronda ${G.round}${G.doom ? ' · 🌑 noche eterna' : ''}${G.petrified ? ` · 🗿 ${CHAR[G.petrified].e}` : ''} · 🂠 ${G.deck}</div>`;
  let main = '';
  if (me.lives <= 0) main = `<div class="note w" style="text-align:center">☠️ Has caído. Sigue la partida… quizá un Ángel te devuelva a la vida.</div>`;
  if (G.phase === 'draft' && ME.avail) main += draftPanel();
  else if (mine) main += turnPanel(T, me);
  const plist = G.ps.map(p => {
    const rev = revealedOf(p.id), isT = T && T.id === p.id, dead = p.lives <= 0;
    return `<div class="svpl${isT ? ' act' : ''}${dead ? ' dead' : ''}" data-pid="${p.id}"><div class="svplh"><span class="dot" style="background:${pl(p.id).color}"></span><b>${nm(p.id)}</b>${p.id === myId ? '<span class="tag">TÚ</span>' : ''}<span class="svpls">🛡️${p.armor} 🪙${p.gold} 🃏${p.cards}</span></div>
      <div class="svplc">${dead ? '☠️ Caído' + (p.revived ? ' (ya revivió una vez)' : '') : hearts(p.lives)} ${rev.map(charTag).join('')}</div></div>`;
  }).join('');
  const myChars = ME.chars.length ? ME.chars.map(r => `<span class="svtag big${G.petrified === r && G.revealed[r] ? ' dead' : ''}">${CHAR[r].e} ${r}. ${CHAR[r].n}</span>`).join('') : '<span class="mute" style="font-size:13px">Sin criatura todavía</span>';
  show('game', `${bg()}
    <div class="svtop">${status}<button class="btn small sec" id="help">🎭 Criaturas</button></div>
    ${head}${main}
    <div class="card svme"><div class="svmeh"><span>${myChars}</span></div>
      <div class="svbig">${hearts(me.lives)}<span>🛡️ <b>${me.armor}</b></span><span>🪙 <b>${me.gold}</b></span></div>
      <div class="lbl">🃏 Tu mano (${ME.hand.length})</div>
      <div class="svgrid">${ME.hand.map(c => cardHTML(c, mine ? '' : 'disabled', usable(c, me, T) ? 'ok' : '')).join('') || '<div class="mute">No tienes cartas</div>'}</div></div>
    <div class="lbl">Jugadores</div><div class="svlist">${plist}</div>
    <div class="card svlog"><div class="lbl" style="margin-top:0">📜 Crónica</div>${G.log.slice().reverse().map(l => `<div>${esc(l)}</div>`).join('')}</div>
    ${isHost && T && !mine ? '<button class="btn small sec" id="skip" style="margin-top:8px">⏭️ Saltar turno (si alguien se ha quedado colgado)</button>' : ''}`);
  bindGame(T, me);
}
function usable(c, me, T) {
  if (!T || T.id !== myId || !T.acted || T.choosing) return false;
  const d = K(c); if (me.gold < d.k) return false;
  return d.t === 'atk' ? !T.attacked : !T.armored && me.armor < R.maxArmor;
}
function draftPanel() {
  return `<div class="card"><div class="mute" style="font-size:13px;margin-bottom:8px">${G.draft.faceUp.length ? `Fuera de juego: ${G.draft.faceUp.map(r => CHAR[r].e + ' ' + CHAR[r].n).join(', ')}. ` : ''}Hay otra criatura oculta que nadie puede elegir.</div>
    <div class="svdraft">${ME.avail.map(r => `<button class="svdc" data-pick="${r}"><span class="ce">${CHAR[r].e}</span><b>${r}. ${CHAR[r].n}</b><small>${CHAR[r].d}</small></button>`).join('')}</div></div>`;
}
function targetButtons(attr, list, sub = () => '') {
  return `<div class="pgrid">${list.map(p => `<button class="pbtn${ui.tg.includes(p.id) ? ' wsel' : ''}" ${attr}="${p.id}"><span class="dot" style="background:${pl(p.id).color}"></span>${nm(p.id)}<small style="margin-left:auto;font-weight:700">${sub(p)}</small></button>`).join('')}</div>`;
}
function turnPanel(T, me) {
  const r = T.rank, back = '<button class="btn sec small" id="mback" style="margin-top:8px">← Volver</button>';
  const foes = G.ps.filter(p => p.id !== myId && p.lives > 0);
  if (ME.choose) return `<div class="card"><h3 style="margin-bottom:6px">🃏 Quédate una carta</h3><div class="svgrid">${ME.choose.map(c => cardHTML(c, 'data-keep="1"')).join('')}</div></div>`;
  if (ui.mode === 'attack') {
    const d = K(ui.card), max = r === 10 ? R.demonTargets : 1, val = d.v + (r === 11 ? R.dragonBonus : 0);
    return `<div class="card"><h3 style="margin-bottom:4px">${d.e} Atacar con ${esc(d.n)} (${val} de daño)</h3><div class="mute" style="font-size:13px;margin-bottom:8px">${max > 1 ? `Elige hasta ${max} objetivos.` : 'Elige a quién atacas.'}${r === 3 ? ' 👻 Tu ataque ignora la armadura.' : ''}</div>
      ${targetButtons('data-tg', foes, p => `❤️${p.lives} 🛡️${p.armor}`)}<button class="btn go" id="atk" ${ui.tg.length ? '' : 'disabled'}>💥 Atacar</button>${back}</div>`;
  }
  if (ui.mode === 'petrify') return `<div class="card"><h3 style="margin-bottom:6px">🐍 ¿Qué criatura petrificas?</h3><div class="mute" style="font-size:13px;margin-bottom:8px">Eliges una criatura, no un jugador. Si nadie la tiene, no pasa nada.</div>
    <div class="svdraft">${RANKS.filter(x => x >= 2).map(x => `<button class="svdc sm" data-pet="${x}"><span class="ce">${CHAR[x].e}</span><b>${x}. ${CHAR[x].n}</b></button>`).join('')}</div>${back}</div>`;
  if (ui.mode === 'sing') return `<div class="card"><h3 style="margin-bottom:6px">🧜 ¿A quién encantas?</h3>${targetButtons('data-sing', foes, p => `❤️${p.lives} 🃏${p.cards}`)}${back}</div>`;
  if (ui.mode === 'angel') {
    const dead = G.ps.filter(p => p.lives <= 0 && !p.revived), live = G.ps.filter(p => p.lives > 0);
    return `<div class="card"><h3 style="margin-bottom:6px">😇 Poder del Ángel</h3>${dead.length ? `<div class="lbl" style="margin-top:0">Revivir (vuelve con ${R.angelRevive} vidas)</div>${targetButtons('data-ang', dead, () => '☠️')}` : ''}
      <div class="lbl">Curar ${R.angelHeal} vidas</div>${targetButtons('data-ang', live, p => `❤️${p.lives}`)}${back}</div>`;
  }
  const btns = [];
  if (!T.acted) btns.push('<button class="btn go" data-a="gold">🪙 Coger 2 de oro</button>', '<button class="btn go" data-a="draw">🃏 Robar cartas</button>');
  if (!T.ability) {
    if (r === 1) btns.push('<button class="btn pink" data-mode="petrify">🐍 Petrificar a una criatura</button>');
    if (r === 5) btns.push('<button class="btn pink" data-mode="sing">🧜 Canto de sirena</button>');
    if (r === 9) btns.push('<button class="btn pink" data-mode="angel">😇 Revivir o curar</button>');
    if (r === 12 && me.lives > R.levCost) btns.push(`<button class="btn pink" data-a="wave">🌊 Maremoto (−${R.levCost} vidas tuyas)</button>`);
  }
  const hint = !T.acted ? 'Primero: coge oro o roba cartas.' : `Toca una carta en verde para ${!T.attacked ? 'atacar' : ''}${!T.attacked && !T.armored ? ' o ' : ''}${!T.armored ? 'equiparte armadura' : ''}.`;
  return `<div class="card svturn"><div class="mute" style="font-size:13px;margin-bottom:8px">${T.attacked && T.armored && T.acted ? 'Ya has atacado y te has equipado este turno.' : hint}</div><div class="cbtns">${btns.join('')}</div>
    ${T.acted ? '<button class="btn sec" data-a="end" style="margin-top:8px">✔ Terminar turno</button>' : ''}</div>`;
}
function act(a, extra = {}) { toHost({ t: 'act', a, ...extra }); }
function bindGame(T, me) {
  on('#help', 'click', charsOverlay);
  $$('[data-pick]').forEach(b => b.addEventListener('click', () => { toHost({ t: 'pick', rank: +b.dataset.pick }); buzz(20); $$('[data-pick]').forEach(x => x.disabled = true); }));
  $$('[data-a]').forEach(b => b.addEventListener('click', () => { if (b.dataset.a === 'gold') SFX.coin(); act(b.dataset.a); }));
  $$('[data-mode]').forEach(b => b.addEventListener('click', () => { ui.mode = b.dataset.mode; ui.tg = []; render(); }));
  on('#mback', 'click', () => { ui.mode = null; ui.tg = []; render(); });
  $$('[data-keep]').forEach(b => b.addEventListener('click', () => act('keep', { card: +b.dataset.c })));
  $$('[data-pet]').forEach(b => b.addEventListener('click', () => { act('petrify', { rank: +b.dataset.pet }); ui.mode = null; }));
  $$('[data-sing]').forEach(b => b.addEventListener('click', () => { act('sing', { target: b.dataset.sing }); ui.mode = null; }));
  $$('[data-ang]').forEach(b => b.addEventListener('click', () => { act('angel', { target: b.dataset.ang }); ui.mode = null; }));
  $$('[data-tg]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.tg, max = T && T.rank === 10 ? R.demonTargets : 1, i = ui.tg.indexOf(id);
    if (i >= 0) ui.tg.splice(i, 1); else { if (ui.tg.length >= max) ui.tg.shift(); ui.tg.push(id); }
    render();
  }));
  on('#atk', 'click', () => { act('attack', { card: ui.card, targets: ui.tg.slice() }); ui.mode = null; ui.tg = []; });
  if (T && T.id === myId && !ui.mode) $$('.svme .svc').forEach(b => b.addEventListener('click', () => {
    const c = +b.dataset.c, d = K(c);
    if (!T.acted) return toast('Primero coge oro o roba cartas');
    if (me.gold < d.k) return toast(`Te falta ${d.k - me.gold} de oro`);
    if (d.t === 'atk') { if (T.attacked) return toast('Ya has atacado este turno'); ui.mode = 'attack'; ui.card = c; ui.tg = []; const foes = G.ps.filter(p => p.id !== myId && p.lives > 0); if (foes.length === 1) ui.tg = [foes[0].id]; render(); window.scrollTo(0, 0); }
    else act('armor', { card: c });
  }));
  on('#skip', 'click', () => toHost({ t: 'skip' }));
}
function renderEnd() {
  const f = G.final, MED = ['🥇', '🥈', '🥉'];
  show('svend', `${bg()}<div class="mid" style="flex:none;margin-top:16px"><div style="font-size:60px">${f.winner ? '🏆' : '🌑'}</div>
    <div class="title">${f.winner ? `¡${nm(f.winner)} sobrevive a la noche!` : 'Nadie ha sobrevivido'}</div></div>
    <div class="card"><ul class="plist">${f.rank.map((id, i) => `<li><span class="med" style="width:28px">${MED[i] || ''}</span><span class="dot" style="background:${pl(id).color}"></span><span class="nm">${nm(id)}${id === myId ? '<span class="tag">TÚ</span>' : ''}</span><span style="color:var(--ok);font-weight:900">${f.night[id] ? '+' + f.night[id] : ''}</span></li>`).join('')}</ul>
    <div class="mute" style="font-size:12px;margin-top:6px">Ordenados por quién aguantó más · en verde, puntos para la clasificación</div></div>
    <div class="card svlog"><div class="lbl" style="margin-top:0">📜 Últimos momentos</div>${G.log.slice(-8).reverse().map(l => `<div>${esc(l)}</div>`).join('')}</div>
    ${isHost ? '<button class="btn go" id="again">🔁 Otra noche</button>' : '<div class="sub">Esperando al anfitrión…</div>'}${P.homeButton()}`);
  SFX.fanfare();
  on('#again', 'click', () => broadcast({ t: 'setup' })); P.bindHome();
}

function onMsg(m) {
  switch (m.t) {
    case 'set': settings = m.settings; if (screen === 'setup') renderSetup(); break;
    case 'setup': clearTimeout(botTimer); S = null; G = null; ui = { mode: null, card: null, tg: [] }; renderSetup(); break;
    case 'st': {
      const prevTurn = G && G.turn && G.turn.id === myId && G.turn.rank;
      const prevPick = G && G.phase === 'draft' && G.draft.picking === myId;
      const prevMe = G && G.ps.find(p => p.id === myId);
      G = m.pub; ME = m.me; if (!isHost) BOTS = G.bots || {};
      const now = G.ps.find(p => p.id === myId);
      if (prevMe && now && now.lives < prevMe.lives) { buzz([120, 60, 120]); document.body.classList.add('svhurt'); setTimeout(() => document.body.classList.remove('svhurt'), 450); }
      if (prevMe && now && now.lives > prevMe.lives) SFX.heal();
      const nowTurn = G.turn && G.turn.id === myId && G.turn.rank;
      if (nowTurn && nowTurn !== prevTurn) { SFX.turn(); buzz([60, 40, 60]); ui.mode = null; }
      if (G.phase === 'draft' && G.draft.picking === myId && !prevPick) { SFX.turn(); buzz(60); }
      if (!nowTurn) ui.mode = null;
      if (ui.mode === 'attack' && !(ME.hand || []).includes(ui.card)) ui.mode = null;
      render(); break;
    }
    case 'err': toast(m.text); SFX.bad(); break;
    case 'fx': if (m.k === 'hit') SFX.hit(); else if (m.k === 'shield') SFX.shield(); else if (m.k === 'heal') SFX.heal(); else if (m.k === 'dead') { SFX.bad(); if (m.id === myId) buzz([300, 100, 300]); } break;
  }
}

if (location.hash === '#debug') { window.__S = () => S; window.__SV = { R, CHAR, CARDS, KIND, hurt: (...a) => hurt(...a) }; }
return {
  open() { if (isHost) { if (room.players.length === 1 && !settings.bots) settings.bots = 3; settings.bots = Math.min(settings.bots, 8 - room.players.length); broadcast({ t: 'set', settings }); } renderSetup(); },
  onMsg,
  onHost: (id, m) => hostHandle(id, m),
  onPlayers(list) { players = list; if (isHost && settings.bots + room.players.length > 8) { settings.bots = 8 - room.players.length; broadcast({ t: 'set', settings }); } if (screen === 'setup') renderSetup(); },
  onLeave: hostLeave,
  destroy() { clearTimeout(botTimer); S = null; G = null; $$('.svov').forEach(e => e.remove()); },
};
  }
});
