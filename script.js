/*CORE*/
var SEP = '\u0001';

// Module 1: suffix array by prefix doubling, O(n log^2 n)
function buildSuffixArray(s) {
  var n = s.length;
  if (n === 0) return new Int32Array(0);
  var sa = new Array(n), rank = new Int32Array(n), tmp = new Int32Array(n), i;
  for (i = 0; i < n; i++) { sa[i] = i; rank[i] = s.charCodeAt(i); }
  for (var k = 1; ; k <<= 1) {
    var cmp = (function (step) {
      return function (a, b) {
        if (rank[a] !== rank[b]) return rank[a] - rank[b];
        var ra = a + step < n ? rank[a + step] : -1;
        var rb = b + step < n ? rank[b + step] : -1;
        return ra - rb;
      };
    })(k);
    sa.sort(cmp);
    tmp[sa[0]] = 0;
    for (i = 1; i < n; i++) tmp[sa[i]] = tmp[sa[i - 1]] + (cmp(sa[i - 1], sa[i]) < 0 ? 1 : 0);
    rank.set(tmp);
    if (rank[sa[n - 1]] === n - 1) break;
  }
  return Int32Array.from(sa);
}

// Module 2: Kasai's algorithm, O(n). lcp[i] = LCP(suffix sa[i-1], suffix sa[i])
function buildLcp(s, sa) {
  var n = s.length, rank = new Int32Array(n), lcp = new Int32Array(n), i, h = 0;
  for (i = 0; i < n; i++) rank[sa[i]] = i;
  for (i = 0; i < n; i++) {
    if (rank[i] > 0) {
      var j = sa[rank[i] - 1];
      while (i + h < n && j + h < n && s.charCodeAt(i + h) === s.charCodeAt(j + h)) h++;
      lcp[rank[i]] = h;
      if (h > 0) h--;
    } else h = 0;
  }
  return lcp;
}

// Module 3: binary search that resumes from min(lcpLeft, lcpRight)
function bound(s, sa, p, upper) {
  var lo = -1, hi = sa.length, lcpLo = 0, lcpHi = 0;
  while (hi - lo > 1) {
    var mid = (lo + hi) >>> 1, pos = sa[mid];
    var i = Math.min(lcpLo, lcpHi);
    while (i < p.length && pos + i < s.length && s.charCodeAt(pos + i) === p.charCodeAt(i)) i++;
    var goRight;
    if (i === p.length) goRight = upper;
    else if (pos + i === s.length) goRight = true;
    else goRight = s.charCodeAt(pos + i) < p.charCodeAt(i);
    if (goRight) { lo = mid; lcpLo = i; } else { hi = mid; lcpHi = i; }
  }
  return hi;
}
function lcpRange(s, sa, p) { return [bound(s, sa, p, false), bound(s, sa, p, true)]; }

// Module 4: the search engine (index + query processing + ranking)
function SearchEngine(docs) {
  var self = this, parts = [];
  this.docs = docs.map(function (d) { return d.replace(/\s+/g, ' ').trim(); });
  this.docStart = [];
  var off = 0;
  this.docs.forEach(function (d) { self.docStart.push(off); parts.push(d + SEP); off += d.length + 1; });
  this.text = parts.join('');
  var t0 = performance.now();
  this.sa = buildSuffixArray(this.text);
  var t1 = performance.now();
  this.lcp = buildLcp(this.text, this.sa);
  var t2 = performance.now();
  this.saMs = t1 - t0; this.lcpMs = t2 - t1;
}
SearchEngine.prototype.docOf = function (pos) {
  var a = 0, b = this.docStart.length - 1;
  while (a < b) { var m = (a + b + 1) >> 1; if (this.docStart[m] <= pos) a = m; else b = m - 1; }
  return a;
};
SearchEngine.prototype.search = function (query, type) {
  var p = query.trim().replace(/\s+/g, ' ');
  if (!p) return { results: [], total: 0 };
  var r = lcpRange(this.text, this.sa, p), text = this.text, map = {}, total = 0;
  for (var i = r[0]; i < r[1]; i++) {
    var pos = this.sa[i];
    if (type !== 'substring' && !(pos === 0 || !/[A-Za-z0-9]/.test(text.charAt(pos - 1)))) continue;
    var end = pos + p.length;
    if (type === 'phrase' && !(end >= text.length || !/[A-Za-z0-9]/.test(text.charAt(end)))) continue;
    var d = this.docOf(pos), rec = map[d] || (map[d] = { doc: d, score: 0, positions: [] });
    rec.score++; total++;
    rec.positions.push(pos - this.docStart[d]);
  }
  var results = Object.keys(map).map(function (k) { return map[k]; });
  results.forEach(function (r) { r.positions.sort(function (a, b) { return a - b; }); });
  results.sort(function (a, b) { return b.score - a.score || a.doc - b.doc; });
  return { results: results, total: total, pattern: p };
};

// Baseline: positional inverted index
function InvertedIndex(docs) {
  var t0 = performance.now();
  this.index = new Map();
  for (var d = 0; d < docs.length; d++) {
    var words = docs[d].match(/[A-Za-z0-9]+/g) || [];
    for (var w = 0; w < words.length; w++) {
      var e = this.index.get(words[w]);
      if (!e) { e = new Map(); this.index.set(words[w], e); }
      var l = e.get(d); if (!l) { l = []; e.set(d, l); }
      l.push(w);
    }
  }
  this.ms = performance.now() - t0;
}
InvertedIndex.prototype.search = function (query, type) {
  var tokens = query.match(/[A-Za-z0-9]+/g) || [], counts = new Map(), self = this;
  if (!tokens.length) return counts;
  function add(d, n) { counts.set(d, (counts.get(d) || 0) + n); }
  if (type === 'phrase') {
    var first = this.index.get(tokens[0]); if (!first) return counts;
    first.forEach(function (plist, d) {
      var c = 0;
      plist.forEach(function (p0) {
        for (var t = 1; t < tokens.length; t++) {
          var e = self.index.get(tokens[t]); var l = e && e.get(d);
          if (!l || l.indexOf(p0 + t) < 0) return;
        }
        c++;
      });
      if (c) add(d, c);
    });
  } else {
    var q = query.trim();
    this.index.forEach(function (docsMap, word) {
      var ok = type === 'prefix' ? word.indexOf(q) === 0 : word.indexOf(q) >= 0;
      if (ok) docsMap.forEach(function (l, d) { add(d, l.length); });
    });
  }
  return counts;
};
/*END CORE*/

/* ---------- user interface ---------- */
var SAMPLE = [
"Suffix arrays store the starting positions of all suffixes of a text in sorted order. A suffix array is a compact index for pattern matching.",
"An inverted index maps each term to the documents that contain it. It is very effective for term based search but substring queries are less direct.",
"The suffix tree represents all suffixes in a tree. It supports fast pattern matching but can require a lot of memory compared with a suffix array.",
"Kasai's algorithm builds the longest common prefix array in linear time. The LCP array helps a binary search avoid comparing the same characters again.",
"Binary search on the suffix array finds every occurrence of a pattern. Search results can be ranked so the document with the most matches comes first."
].join('\n---\n');

var $ = function (id) { return document.getElementById(id); };
var engine = null, inv = null;
function esc(s) { return s.replace(/[&<>"]/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function fmt(ms) { return ms < 1 ? ms.toFixed(3) + ' ms' : ms.toFixed(2) + ' ms'; }
function bytes(b) { return b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(2) + ' MB'; }
function stat(v, l) { return '<div class="stat"><b>' + v + '</b><span>' + l + '</span></div>'; }

function parseDocs() {
  return $('docs').value.split(/^\s*---\s*$/m).map(function (s) { return s.trim(); }).filter(Boolean);
}
$('docs').value = SAMPLE;
$('reset').onclick = function () { $('docs').value = SAMPLE; };
$('files').onchange = function (e) {
  var files = Array.prototype.slice.call(e.target.files), out = [];
  if (!files.length) return;
  Promise.all(files.map(function (f) { return f.text(); })).then(function (texts) {
    texts.forEach(function (t) { out.push(t.trim()); });
    $('docs').value = out.join('\n---\n');
  });
};

$('build').onclick = function () {
  var docs = parseDocs();
  if (!docs.length) { $('stats').innerHTML = '<p class="err">Add at least one document.</p>'; return; }
  $('build').disabled = true; $('stats').innerHTML = '<p class="msg">Building index…</p>';
  setTimeout(function () {
    engine = new SearchEngine(docs);
    inv = new InvertedIndex(engine.docs);
    var n = engine.text.length;
    $('stats').innerHTML =
      stat(docs.length, 'documents') + stat(n.toLocaleString(), 'characters indexed (n)') +
      stat(fmt(engine.saMs), 'suffix array build') + stat(fmt(engine.lcpMs), 'LCP array build (Kasai)') +
      stat(bytes(n * 8), 'suffix array + LCP size (4 bytes each per position)') +
      stat(fmt(inv.ms), 'inverted index build') + stat(inv.index.size.toLocaleString(), 'distinct words in inverted index');
    $('search').disabled = false; $('bench').disabled = false; $('build').disabled = false;
    $('results').innerHTML = ''; $('summary').textContent = ''; $('benchout').innerHTML = '';
  }, 20);
};

function isWordChar(c) { return /[A-Za-z0-9]/.test(c); }
// Highlights EVERY match in the document. For substring and prefix queries the
// whole word that contains the match is highlighted (the matched part is darker).
function highlight(doc, positions, len, type) {
  var spans = positions.map(function (p) {
    var ws = p, we = p + len;
    if (type !== 'phrase') {
      while (ws > 0 && isWordChar(doc.charAt(ws - 1))) ws--;
      while (we < doc.length && isWordChar(doc.charAt(we))) we++;
    }
    return { p: p, ws: ws, we: we };
  });
  var wins = [];
  spans.forEach(function (sp) {
    var a = Math.max(0, sp.ws - 60), b = Math.min(doc.length, sp.we + 80);
    if (wins.length && a <= wins[wins.length - 1][1]) wins[wins.length - 1][1] = Math.max(b, wins[wins.length - 1][1]);
    else wins.push([a, b]);
  });
  var out = wins.slice(0, 6).map(function (w) {
    var html = '', cur = w[0];
    spans.forEach(function (sp) {
      if (sp.ws < cur || sp.ws >= w[1]) return;
      html += esc(doc.slice(cur, sp.ws)) + '<mark>' + esc(doc.slice(sp.ws, sp.p)) +
              '<mark class="hit">' + esc(doc.slice(sp.p, sp.p + len)) + '</mark>' +
              esc(doc.slice(sp.p + len, sp.we)) + '</mark>';
      cur = sp.we;
    });
    html += esc(doc.slice(cur, w[1]));
    return (w[0] > 0 ? '… ' : '') + html + (w[1] < doc.length ? ' …' : '');
  });
  if (wins.length > 6) out.push('<i>+ ' + (wins.length - 6) + ' more passages</i>');
  return out.join('<br>');
}
function runSearch() {
  if (!engine) return;
  var q = $('query').value, type = $('qtype').value;
  if (!q.trim()) { $('summary').innerHTML = '<span class="err">Enter a query.</span>'; $('results').innerHTML = ''; return; }
  var t0 = performance.now(), res = engine.search(q, type), ms = performance.now() - t0;
  $('summary').textContent = res.total + ' occurrence' + (res.total === 1 ? '' : 's') + ' in ' + res.results.length +
    ' document' + (res.results.length === 1 ? '' : 's') + ' · ' + type + ' query · ' + fmt(ms);
  if (!res.results.length) { $('results').innerHTML = '<p class="msg">No matches.</p>'; return; }
  $('results').innerHTML = res.results.map(function (r, i) {
    return '<div class="result"><b>#' + (i + 1) + ' Document ' + (r.doc + 1) + '</b><span class="badge">' + r.score +
      ' match' + (r.score === 1 ? '' : 'es') + '</span><div class="snip">' + highlight(engine.docs[r.doc], r.positions, res.pattern.length, type) + '</div></div>';
  }).join('');
}
$('search').onclick = runSearch;
$('query').addEventListener('keydown', function (e) { if (e.key === 'Enter') runSearch(); });

$('bench').onclick = function () {
  var q = $('query').value, type = $('qtype').value, reps = Math.max(1, Math.min(100000, parseInt($('reps').value, 10) || 500));
  if (!q.trim()) { $('benchout').innerHTML = '<p class="err">Enter a query first.</p>'; return; }
  var t0 = performance.now(), i;
  for (i = 0; i < reps; i++) engine.search(q, type);
  var sa = (performance.now() - t0) / reps;
  t0 = performance.now();
  for (i = 0; i < reps; i++) inv.search(q, type);
  var iv = (performance.now() - t0) / reps;
  var a = engine.search(q, type), b = inv.search(q, type), invTotal = 0;
  b.forEach(function (v) { invTotal += v; });
  $('benchout').innerHTML = '<table><tr><th>Measure</th><th>Suffix array (LCP-accelerated)</th><th>Inverted index</th></tr>' +
    '<tr><td>Average query latency (' + reps + ' runs)</td><td>' + fmt(sa) + '</td><td>' + fmt(iv) + '</td></tr>' +
    '<tr><td>Index construction time</td><td>' + fmt(engine.saMs + engine.lcpMs) + '</td><td>' + fmt(inv.ms) + '</td></tr>' +
    '<tr><td>Occurrences found</td><td>' + a.total + '</td><td>' + invTotal + '</td></tr></table>' +
    '<p class="hint">The inverted index only sees whole words, so a substring or phrase pattern that crosses a word boundary can give a different count.</p>';
};
$('build').click();