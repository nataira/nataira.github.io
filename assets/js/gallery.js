/* Автоматична галерея: читає вміст папки з GitHub і показує файли на сторінці.
   Додала файл у папку -> він з'явиться на сайті (через ~1 хв після завантаження). */
(function () {
  var OWNER = 'nataira';
  var REPO = 'nataira.github.io';
  var IMG = /\.(jpe?g|png|webp|gif|avif)$/i;
  var VID = /\.(mp4|webm|mov|m4v)$/i;

  function pretty(name) {
    var base = name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
    // службові назви типу "art 1", "ai 2", "1" не показуємо як підпис
    if (/^(art|ai|3d|img|image|video)?\s*\d+$/i.test(base)) return '';
    return base;
  }

  function natural(a, b) {
    return a.localeCompare(b, 'uk', { numeric: true, sensitivity: 'base' });
  }

  function listFolder(folder) {
    var key = 'nataira:' + folder;
    try {
      var c = JSON.parse(sessionStorage.getItem(key) || 'null');
      if (c && Date.now() - c.t < 120000) return Promise.resolve(c.files);
    } catch (e) {}
    var url = 'https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/' + folder;
    return fetch(url, { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (r) {
        if (r.status === 404) return [];
        if (!r.ok) throw new Error('api ' + r.status);
        return r.json();
      })
      .then(function (items) {
        var files = items.filter(function (i) { return i.type === 'file'; })
          .map(function (i) { return i.name; })
          .sort(natural);
        try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), files: files })); } catch (e) {}
        return files;
      });
  }

  // captions.txt у папці: кожен рядок "назва-файлу | підпис"
  function loadCaptions(folder) {
    return fetch(folder + '/captions.txt?v=' + Date.now())
      .then(function (r) { return r.ok ? r.text() : ''; })
      .catch(function () { return ''; })
      .then(function (txt) {
        var map = {};
        txt.replace(/^\uFEFF/, '').split(/\r?\n/).forEach(function (line) {
          line = line.trim();
          if (!line || line.charAt(0) === '#') return;
          var i = line.indexOf('|');
          if (i < 1) return;
          var key = line.slice(0, i).trim().toLowerCase();
          var val = line.slice(i + 1).trim();
          if (!val) return;
          map[key] = val;
          map[key.replace(/\.[^.]+$/, '')] = val;
        });
        return map;
      });
  }

  function captionFor(map, name) {
    var k = name.toLowerCase();
    return map[k] || map[k.replace(/\.[^.]+$/, '')] || pretty(name);
  }

  function esc(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function src(folder, name) {
    return folder + '/' + encodeURIComponent(name);
  }

  function renderImages(box, folder, files, caps) {
    var list = files.filter(function (n) { return IMG.test(n); });
    box.innerHTML = list.map(function (n) {
      var cap = captionFor(caps, n);
      var alt = cap || 'Робота';
      return '<a href="' + src(folder, n) + '" target="_blank" rel="noopener"><figure>' +
        '<img src="' + src(folder, n) + '" alt="' + esc(alt) + '" loading="lazy">' +
        (cap ? '<figcaption>' + esc(cap) + '</figcaption>' : '') +
        '</figure></a>';
    }).join('');
    return list.length;
  }

  function renderVideos(box, folder, files, caps) {
    var list = files.filter(function (n) { return VID.test(n); });
    box.innerHTML = list.map(function (n) {
      var cap = captionFor(caps, n);
      return '<figure class="video-card"><div class="video-frame">' +
        '<video controls playsinline preload="metadata" src="' + src(folder, n) + '#t=0.1"></video></div>' +
        (cap ? '<figcaption>' + esc(cap) + '</figcaption>' : '') + '</figure>';
    }).join('');
    var vids = box.querySelectorAll('video');
    vids.forEach(function (v) {
      v.addEventListener('play', function () {
        document.querySelectorAll('video').forEach(function (o) { if (o !== v) o.pause(); });
      });
    });
    return list.length;
  }

  document.querySelectorAll('[data-folder]').forEach(function (box) {
    var folder = box.getAttribute('data-folder');
    var type = box.getAttribute('data-type') || 'image';
    var section = box.closest('section');
    Promise.all([listFolder(folder), loadCaptions(folder)]).then(function (res) {
      var files = res[0], caps = res[1];
      var n = type === 'video' ? renderVideos(box, folder, files, caps) : renderImages(box, folder, files, caps);
      if (!n) {
        var empty = box.getAttribute('data-empty');
        if (empty === 'hide' && section) section.style.display = 'none';
        else box.innerHTML = '<p class="gallery-empty">Тут скоро з\'являться роботи.</p>';
      }
    }).catch(function () {
      box.innerHTML = '<p class="gallery-empty">Не вдалося завантажити галерею. Оновіть сторінку трохи пізніше.</p>';
    });
  });
})();
