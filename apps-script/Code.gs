// Vasca Esordienti: il foglio è la memoria dell'app e tiene allineati tutti i dispositivi.
// 1. Cambia la parola d'ordine qui sotto (la stessa che scriverai nell'app).
// 2. Esegui il deployment come app web: esegui come "Me", accesso "Chiunque".
const PAROLA = 'cambia-questa-parola';

const SERIE = ['Data', 'Giorno', 'Gruppo', 'Blocco', 'Serie', 'Giri', 'Ripetizioni', 'Distanza', 'Metri', 'Stile', 'Attrezzi', 'Partenza', 'Nota', 'Chiave'];
const SEDUTE = ['Data', 'Giorno', 'Gruppo', 'Metri', 'Serie', 'SL', 'DO', 'RA', 'FA', 'MX', 'Tecnica', 'Gambe', 'Note', 'Aggiornata', 'Chiave'];
const OBIETTIVI = ['Gruppo', 'Periodo', 'Dal', 'Al', 'Obiettivo', 'Raggiunto', 'Il', 'Id'];
const GARE = ['Gruppo', 'Gara', 'Data', 'Luogo', 'Id'];
const ARCHIVIO = ['Chiave', 'Tipo', 'Aggiornata', 'Dati', 'Server'];

const STILI = {sl: 'SL', do: 'DO', ra: 'RA', fa: 'FA', mx: 'MX'};
const BLOCCHI = {wu: 'Riscaldamento', tec: 'Tecnica', pre: 'Preparatoria', main: 'Serie centrale', comp: 'Complementare', gioco: 'Gioco', def: 'Defaticamento'};
const NOMI = {esa: 'Esordienti A', esb: 'Esordienti B', esc: 'Esordienti C'};
const GIORNI_L = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];

/* ===== unione delle modifiche di più dispositivi (identica nell'app e nello script del foglio) ===== */
var SCADENZA_TOMBE = 180 * 864e5;
function _vince(a, b){
  var ta = a.ts || 0, tb = b.ts || 0;
  return tb > ta || (tb === ta && JSON.stringify(b) > JSON.stringify(a));
}
function unisciTombe(a, b){
  var out = {}, limite = Date.now() - SCADENZA_TOMBE;
  [a, b].forEach(function(t){ Object.keys(t || {}).forEach(function(id){
    var v = t[id] || 0;
    if (v >= limite && (!(id in out) || v > out[id])) out[id] = v;
  }); });
  return out;
}
function unisciElementi(la, lb, tolte){
  var mappa = {};
  [la, lb].forEach(function(l){ (l || []).forEach(function(s){
    if (!s || !s.id) return;
    var x = mappa[s.id];
    if (!x || _vince(x, s)) mappa[s.id] = s;
  }); });
  return Object.keys(mappa).sort().map(function(id){ return mappa[id]; })
    .filter(function(s){ return !(tolte[s.id] >= (s.ts || 0)); });
}
function unisciSeduta(a, b){
  a = a || {}; b = b || {};
  var tolte = unisciTombe(a.tolte, b.tolte);
  var na = {ts:a.notaTs || 0, t:a.nota || ""}, nb = {ts:b.notaTs || 0, t:b.nota || ""};
  var nota = _vince(na, nb) ? nb : na;
  return {g:b.g || a.g || "", d:b.d || a.d || "", serie:unisciElementi(a.serie, b.serie, tolte), tolte:tolte, nota:nota.t, notaTs:nota.ts};
}
function unisciListe(a, b){
  a = a || {}; b = b || {};
  var tolte = unisciTombe(a.tolte, b.tolte);
  return {lista:unisciElementi(a.lista, b.lista, tolte), tolte:tolte};
}
function firmaSeduta(s){
  s = s || {};
  return JSON.stringify([(s.serie || []).map(function(x){ return x.id + ":" + (x.ts || 0); }).sort(), s.nota || "", s.notaTs || 0, Object.keys(s.tolte || {}).sort()]);
}
function firmaLista(l){
  l = l || {};
  return JSON.stringify([(l.lista || []).map(function(x){ return x.id + ":" + (x.ts || 0); }).sort(), Object.keys(l.tolte || {}).sort()]);
}


function doPost(e) {
  let req = {};
  try { req = JSON.parse(e.postData.contents); } catch (err) { return risposta({ok: false, errore: 'Richiesta non leggibile'}); }
  // con la parola di esempio chiunque legga questo codice potrebbe entrare: si rifiuta finché non viene cambiata
  if (PAROLA === 'cambia-questa-parola') return risposta({ok: false, errore: "Nello script cambia la parola d'ordine (riga PAROLA) e rifai il deployment"});
  if (req.token !== PAROLA) return risposta({ok: false, errore: "Parola d'ordine sbagliata"});
  presenza(req.dispositivo);
  // presenze: schede ESORDIENTI A/B/C e PREAGONISTI dello stesso foglio
  if (req.azione === 'presenze_leggi' || req.azione === 'presenze_salva') {
    try {
      return risposta(req.azione === 'presenze_leggi' ? presenzeLeggi() : presenzeSalva(req));
    } catch (err) {
      return risposta({ok: false, errore: String(err && err.message || err)});
    }
  }
  // controllo veloce: dice solo se sul foglio c'è qualcosa di nuovo
  if (req.azione === 'versione') return risposta({ok: true, v: versione(), attivi: attivi()});

  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const fa = foglio(ss, 'Archivio', ARCHIVIO, [], true);
    const archivio = leggiArchivio(fa);
    const adesso = Math.max(Date.now(), versione() + 1);
    let cambiato = false, listeCambiate = false;
    const toccate = [];

    if (req.impostazioni) {
      const v = archivio.impostazioni;
      if (!v || (req.impostazioni.ts || 0) > (v.v.ts || 0)) {
        archivio.impostazioni = {k: 'impostazioni', tipo: 'impostazioni', ts: req.impostazioni.ts || 0, srv: adesso, v: req.impostazioni};
        cambiato = true; listeCambiate = true;
      }
    }
    Object.keys(req.liste || {}).forEach(function (nome) {
      const vecchio = archivio[nome];
      const unito = unisciListe(vecchio ? vecchio.v : null, req.liste[nome]);
      if (!vecchio || firmaLista(unito) !== firmaLista(vecchio.v)) {
        archivio[nome] = {k: nome, tipo: 'lista', ts: adesso, srv: adesso, v: unito};
        cambiato = true; listeCambiate = true;
      }
    });
    (req.sedute || []).forEach(function (s) {
      const vecchio = archivio[s.chiave];
      const unito = unisciSeduta(vecchio ? vecchio.v : null, s.archivio);
      if (!vecchio || firmaSeduta(unito) !== firmaSeduta(vecchio.v)) {
        archivio[s.chiave] = {k: s.chiave, tipo: 'seduta', ts: adesso, srv: adesso, v: unito};
        cambiato = true;
      }
      toccate.push(s.chiave);
    });

    const nomi = ((archivio.impostazioni || {v: {}}).v.nomi) || {};
    const nomeG = function (g) { return nomi[g] || NOMI[g] || g; };
    if (toccate.length) aggiornaSedute(ss, archivio, toccate, nomeG);
    if (listeCambiate || req.liste) aggiornaListe(ss, archivio, nomeG);
    if (cambiato) {
      scrivi(fa, Object.keys(archivio).map(function (k) {
        const x = archivio[k];
        return [x.k, x.tipo, x.ts, JSON.stringify(x.v), x.srv];
      }), ARCHIVIO.length);
      impostaVersione(adesso);
    }
    const dal = Number(req.dal) || 0;
    const voci = Object.keys(archivio).map(function (k) { return archivio[k]; })
      .filter(function (x) { return !dal || x.srv > dal; })
      .map(function (x) { return {k: x.k, tipo: x.tipo, ts: x.ts, v: x.v}; });
    return risposta({ok: true, v: versione(), attivi: attivi(), voci: voci});
  } finally {
    lock.releaseLock();
  }
}

function doGet() { return risposta({ok: true, messaggio: 'Vasca Esordienti collegata'}); }

// ---- versione e dispositivi collegati (in memoria veloce, senza toccare il foglio) ----
function versione() {
  const c = CacheService.getScriptCache();
  const v = c.get('v');
  if (v) return Number(v);
  const p = PropertiesService.getScriptProperties().getProperty('v') || '0';
  c.put('v', p, 21600);
  return Number(p);
}
function impostaVersione(v) {
  PropertiesService.getScriptProperties().setProperty('v', String(v));
  CacheService.getScriptCache().put('v', String(v), 21600);
}
function presenza(id) {
  if (!id) return;
  const c = CacheService.getScriptCache();
  let m = {};
  try { m = JSON.parse(c.get('d') || '{}'); } catch (err) { m = {}; }
  const ora = Date.now();
  m[id] = ora;
  Object.keys(m).forEach(function (k) { if (ora - m[k] > 120000) delete m[k]; });
  c.put('d', JSON.stringify(m), 300);
}
function attivi() {
  let m = {};
  try { m = JSON.parse(CacheService.getScriptCache().get('d') || '{}'); } catch (err) { m = {}; }
  return Object.keys(m).filter(function (k) { return Date.now() - m[k] <= 120000; }).length;
}

// ---- schede leggibili, ricostruite dai dati uniti ----
function metri(s) { return (s.gi || 1) * (s.r || 1) * (s.m || 0); }
function nomeStile(s) { return STILI[s] || s; }
function descr(s) {
  const base = s.r > 1 ? s.r + '×' + s.m : String(s.m);
  return (s.gi > 1 ? s.gi + ' × (' + base + ')' : base) + ' ' + nomeStile(s.s);
}
function tempo(sec) {
  if (!(sec > 0)) return '';
  const m = Math.floor(sec / 60), s = Math.round(sec - m * 60);
  if (s === 60) return (m + 1) + "'00\"";
  return m ? m + "'" + (s < 10 ? '0' : '') + s + '"' : s + '"';
}
function conGambe(s) { return (s.a || []).some(function (a) { return ['gambe', 'tavoletta', 'tavola'].indexOf(String(a).toLowerCase()) >= 0; }); }
function conTecnica(s) { return s.b === 'tec' || (s.a || []).some(function (a) { return a === 'drill' || a === 'scull'; }); }

function costruisci(chiave, sess, nomeG) {
  const serie = (sess.serie || []).slice().sort(function (x, y) { return ((x.o || 0) - (y.o || 0)) || ((x.ts || 0) - (y.ts || 0)); });
  if (!serie.length && !sess.nota) return {serie: [], seduta: null};
  const giorno = data(sess.d), dow = giorno.getDay(), gn = nomeG(sess.g);
  const perStile = {sl: 0, do: 0, ra: 0, fa: 0, mx: 0};
  let tot = 0, tec = 0, gam = 0;
  const righe = serie.map(function (s) {
    const m = metri(s);
    tot += m;
    if (perStile[s.s] !== undefined) perStile[s.s] += m;
    if (conTecnica(s)) tec += m;
    if (conGambe(s)) gam += m;
    return [giorno, GIORNI[dow], gn, BLOCCHI[s.b] || s.b, descr(s), s.gi || 1, s.r, s.m, m, nomeStile(s.s), (s.a || []).join(', '), tempo(s.p), s.n || '', chiave];
  });
  const seduta = [giorno, GIORNI_L[dow], gn, tot, serie.length, perStile.sl, perStile.do, perStile.ra, perStile.fa, perStile.mx, tec, gam, sess.nota || '', new Date(), chiave];
  return {serie: righe, seduta: seduta};
}
function aggiornaSedute(ss, archivio, toccate, nomeG) {
  const set = {};
  toccate.forEach(function (k) { set[k] = true; });
  const fs = foglio(ss, 'Serie', SERIE, [1]);
  const fd = foglio(ss, 'Sedute', SEDUTE, [1]);
  const serie = leggi(fs).filter(function (r) { return !set[r[SERIE.length - 1]]; });
  const righe = leggi(fd).filter(function (r) { return !set[r[SEDUTE.length - 1]]; });
  toccate.forEach(function (k) {
    const x = archivio[k];
    if (!x) return;
    const c = costruisci(k, x.v, nomeG);
    c.serie.forEach(function (r) { serie.push(r); });
    if (c.seduta) righe.push(c.seduta);
  });
  ordina(serie);
  ordina(righe);
  scrivi(fs, serie, SERIE.length);
  scrivi(fd, righe, SEDUTE.length);
}
function aggiornaListe(ss, archivio, nomeG) {
  const righeOb = [];
  ((archivio.obiettivi || {v: {}}).v.lista || []).slice().sort(function (a, b) {
    return a.g < b.g ? -1 : a.g > b.g ? 1 : a.dal < b.dal ? -1 : a.dal > b.dal ? 1 : 0;
  }).forEach(function (p) {
    const voci = (p.voci && p.voci.length) ? p.voci : [{t: '', ok: false, quando: ''}];
    voci.forEach(function (v) {
      righeOb.push([nomeG(p.g), p.titolo, data(p.dal), data(p.al), v.t, v.ok ? 'sì' : 'no', v.quando ? data(v.quando) : '', p.id]);
    });
  });
  scrivi(foglio(ss, 'Obiettivi', OBIETTIVI, [3, 4, 7]), righeOb, OBIETTIVI.length);
  const righeGa = ((archivio.gare || {v: {}}).v.lista || []).slice().sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : 0; })
    .map(function (x) { return [nomeG(x.g), x.nome, data(x.data), x.luogo || '', x.id]; });
  scrivi(foglio(ss, 'Gare', GARE, [3]), righeGa, GARE.length);
}

function leggiArchivio(fa) {
  const out = {};
  leggi(fa).forEach(function (r) {
    if (!r[0]) return;
    try { out[String(r[0])] = {k: String(r[0]), tipo: String(r[1]), ts: Number(r[2]) || 0, srv: Number(r[4]) || 0, v: JSON.parse(r[3])}; } catch (err) {}
  });
  return out;
}
function data(v) { return v instanceof Date ? v : new Date(String(v) + 'T12:00:00'); }
function ordina(r) { r.sort(function (a, b) { return data(a[0]).getTime() - data(b[0]).getTime(); }); }
function foglio(ss, nome, intest, colonneData, nascosto) {
  let f = ss.getSheetByName(nome);
  if (!f) {
    f = ss.insertSheet(nome);
    f.getRange(1, 1, 1, intest.length).setValues([intest]).setFontWeight('bold');
    f.setFrozenRows(1);
    if (nascosto) f.hideSheet();
  }
  const vecchie = f.getRange(1, 1, 1, intest.length).getValues()[0];
  if (vecchie.join('|') !== intest.join('|')) {
    f.getRange(1, 1, 1, Math.max(intest.length, f.getLastColumn())).clearContent();
    f.getRange(1, 1, 1, intest.length).setValues([intest]).setFontWeight('bold');
  }
  colonneData.forEach(function (c) { f.getRange(2, c, Math.max(1, f.getMaxRows() - 1), 1).setNumberFormat('dd/mm/yyyy'); });
  return f;
}
function leggi(f) {
  const n = f.getLastRow() - 1;
  if (n < 1) return [];
  return f.getRange(2, 1, n, f.getLastColumn()).getValues();
}
function scrivi(f, righe, colonne) {
  const n = f.getLastRow() - 1;
  if (n > 0) f.getRange(2, 1, n, Math.max(colonne, f.getLastColumn())).clearContent();
  if (righe.length) f.getRange(2, 1, righe.length, colonne).setValues(righe);
}
function risposta(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// ================= PRESENZE =================
// Una scheda per gruppo, con questa struttura:
//   A Sett. | B Data | C Giorno | D Allenamento | E... atleti | ultima colonna Note
// Nelle celle: PRESENTE oppure ASSENTE (vuoto = non segnato).
// Allenamento = PRESENTE vuol dire che quel giorno l'allenamento c'è stato.
// Il foglio resta leggibile e modificabile anche a mano.
const PR_SCHEDE = ['ESORDIENTI A', 'ESORDIENTI B', 'ESORDIENTI C', 'PREAGONISTI'];
const PR_RIGA1 = 2, PR_COL_DATA = 2, PR_COL_ALLEN = 4, PR_COL_PRIMO = 5, PR_COL_ULTIMA = 60;

function prPulisci(v) {
  return String(v == null ? '' : v).replace(/[ ​-‍﻿]/g, ' ').replace(/\s+/g, ' ').trim();
}
function prCodice(v) {
  const s = prPulisci(v).toUpperCase();
  return s === 'PRESENTE' ? '1' : s === 'ASSENTE' ? '2' : '0';
}
function prTesto(c) { return c === '1' ? 'PRESENTE' : c === '2' ? 'ASSENTE' : ''; }
function prGiorno(v, tz) {
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? '' : Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  // data rimasta come numero (cella senza formato data): numero seriale dei fogli di calcolo
  if (typeof v === 'number' && v > 40000 && v < 60000) return Utilities.formatDate(new Date(Math.round((v - 25569) * 864e5)), 'UTC', 'yyyy-MM-dd');
  return '';
}

function prScheda(ss, nome) {
  if (PR_SCHEDE.indexOf(nome) < 0) throw new Error('Scheda non ammessa: ' + nome);
  const sh = ss.getSheetByName(nome);
  if (!sh) throw new Error('Scheda "' + nome + '" non trovata nel foglio.');
  return sh;
}

// atleti = colonne con un nome in riga 1 tra E e la colonna "Note"; le colonne senza nome si saltano
function prLayout(sh) {
  // un foglio importato da Excel può avere solo 26 colonne: non si legge oltre quelle che esistono
  const ultima = Math.min(PR_COL_ULTIMA, sh.getMaxColumns());
  const riga1 = sh.getRange(1, 1, 1, ultima).getDisplayValues()[0];
  const atleti = [];
  let note = 0;
  for (let c = PR_COL_PRIMO; c <= ultima; c++) {
    const t = prPulisci(riga1[c - 1]);
    if (!t) continue;
    if (t.toUpperCase() === 'NOTE') { note = c; break; }
    if (/[A-Za-zÀ-ÿ]/.test(t)) atleti.push({col: c, nome: t});
  }
  if (!atleti.length) throw new Error('Nessun atleta in riga 1 della scheda "' + sh.getName() + '".');
  if (!note) {
    note = atleti[atleti.length - 1].col + 1;
    if (note > sh.getMaxColumns()) sh.insertColumnAfter(sh.getMaxColumns());
    sh.getRange(1, note).setValue('Note');
  }
  return {atleti: atleti, note: note};
}

// righe dei giorni: si ferma alla prima cella data non valida (sotto ci sono i riepiloghi)
function prRighe(sh, ultimaCol, tz) {
  const n = sh.getLastRow() - PR_RIGA1 + 1;
  if (n <= 0) return [];
  const val = sh.getRange(PR_RIGA1, 1, n, ultimaCol).getValues();
  const out = [];
  for (let i = 0; i < val.length; i++) {
    const d = prGiorno(val[i][PR_COL_DATA - 1], tz);
    if (!d) break;
    out.push({riga: PR_RIGA1 + i, d: d, v: val[i]});
  }
  return out;
}

function presenzeLeggi() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), tz = ss.getSpreadsheetTimeZone();
  const schede = PR_SCHEDE.map(function (nome) {
    const sh = ss.getSheetByName(nome);
    if (!sh) return {nome: nome, manca: true, atleti: [], giorni: []};
    const lay = prLayout(sh);
    return {
      nome: nome,
      atleti: lay.atleti.map(function (a) { return a.nome; }),
      giorni: prRighe(sh, lay.note, tz).map(function (r) {
        let s = '';
        lay.atleti.forEach(function (a) { s += prCodice(r.v[a.col - 1]); });
        return {d: r.d, a: prCodice(r.v[PR_COL_ALLEN - 1]), s: s, n: String(r.v[lay.note - 1] || '')};
      })
    };
  });
  return {ok: true, oggi: Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'), schede: schede};
}

// req = {scheda, data, a?: '0'|'1'|'2', cambi?: {nome: '0'|'1'|'2'}, n?: testo}
// Si scrive solo quello che arriva, per nome: due telefoni che toccano atlete diverse non si pestano i piedi.
function presenzeSalva(req) {
  if (!req.scheda || !req.data) throw new Error('Dati mancanti');
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet(), tz = ss.getSpreadsheetTimeZone();
    const sh = prScheda(ss, req.scheda);
    const lay = prLayout(sh);
    const righe = prRighe(sh, lay.note, tz);
    let r = null;
    for (let i = 0; i < righe.length; i++) if (righe[i].d === req.data) { r = righe[i]; break; }
    if (!r) throw new Error('Data non presente nella scheda: ' + req.data);

    // si scrivono solo le celle che cambiano: il resto della riga (anche eventuali formule) non si tocca
    const blocco = r.v.slice();
    const metti = function (col, valore) {
      if (String(blocco[col - 1]) === String(valore)) return;
      blocco[col - 1] = valore;
      sh.getRange(r.riga, col).setValue(valore);
    };
    if (req.a !== undefined) metti(PR_COL_ALLEN, prTesto(String(req.a)));
    const cambi = req.cambi || {};
    lay.atleti.forEach(function (a) {
      if (Object.prototype.hasOwnProperty.call(cambi, a.nome)) metti(a.col, prTesto(String(cambi[a.nome])));
    });
    if (req.n !== undefined) metti(lay.note, String(req.n));

    let s = '';
    lay.atleti.forEach(function (a) { s += prCodice(blocco[a.col - 1]); });
    return {
      ok: true, scheda: req.scheda, d: req.data,
      atleti: lay.atleti.map(function (a) { return a.nome; }),
      a: prCodice(blocco[PR_COL_ALLEN - 1]), s: s, n: String(blocco[lay.note - 1] || '')
    };
  } finally {
    lock.releaseLock();
  }
}
