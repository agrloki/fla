(function (global) {
  'use strict';

  function detectDelimiter(text) {
    var firstLine = text.split(/\r?\n/, 1)[0] || '';
    var candidates = [';', ',', '\t', '|'];
    var best = ';';
    var bestCount = -1;
    candidates.forEach(function (d) {
      var count = 0;
      var inQuotes = false;
      for (var i = 0; i < firstLine.length; i++) {
        var c = firstLine[i];
        if (c === '"') inQuotes = !inQuotes;
        else if (c === d && !inQuotes) count++;
      }
      if (count > bestCount) { bestCount = count; best = d; }
    });
    return bestCount > 0 ? best : ';';
  }

  // Разбор CSV с поддержкой кавычек, переводов строк внутри полей и любых разделителей.
  function parseDelimited(text, delimiter) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;
    var i = 0;
    var n = text.length;

    function pushField() { row.push(field); field = ''; }
    function pushRow() {
      pushField();
      var hasData = row.some(function (v) { return v.trim() !== ''; });
      if (hasData) rows.push(row);
      row = [];
    }

    while (i < n) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"' && field === '') { inQuotes = true; i++; continue; }
      if (c === delimiter) { pushField(); i++; continue; }
      if (c === '\n') { pushRow(); i++; continue; }
      if (c === '\r') { i++; continue; }
      field += c;
      i++;
    }
    if (field !== '' || row.length) pushRow();
    return rows;
  }

  function toNumber(value) {
    if (value === null || value === undefined) return null;
    var s = String(value).trim();
    if (s === '') return null;
    s = s.replace(/\s+/g, '');
    if (s === '-' || s === '--' || s.toLowerCase() === 'nan' || s.toLowerCase() === 'null') return null;
    if (s.indexOf(',') !== -1 && s.indexOf('.') !== -1) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    } else {
      s = s.replace(',', '.');
    }
    if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return null;
    var num = Number(s);
    return Number.isFinite(num) ? num : null;
  }

  function parseDateToken(value) {
    if (value === null || value === undefined) return null;
    var s = String(value).trim();
    if (!s) return null;
    var m = s.match(/^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/);
    if (m) return { y: +m[1], mo: +m[2], d: +m[3] };
    m = s.match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})/);
    if (m) return { y: +m[3], mo: +m[2], d: +m[1] };
    return null;
  }

  function parseTimeToken(value) {
    if (value === null || value === undefined) return null;
    var s = String(value).trim();
    if (!s) return null;
    var m = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}(?:[.,]\d+)?))?/);
    if (!m) return null;
    var sec = m[3] ? Number(m[3].replace(',', '.')) : 0;
    return { h: +m[1], mi: +m[2], s: sec };
  }

  function parseFullDateTime(value) {
    if (value === null || value === undefined) return null;
    var s = String(value).trim();
    if (!s) return null;
    var datePart = parseDateToken(s);
    if (!datePart) return null;
    var rest = s.replace(/^\s*\d{4}[.\-\/]\d{1,2}[.\-\/]\d{1,2}/, '');
    rest = rest.replace(/^\s*\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{4}/, '');
    var timePart = parseTimeToken(rest);
    if (!timePart) timePart = { h: 0, mi: 0, s: 0 };
    return makeDate(datePart, timePart);
  }

  function makeDate(datePart, timePart) {
    var midnight = new Date(datePart.y, datePart.mo - 1, datePart.d, 0, 0, 0, 0).getTime();
    var offset = (timePart.h * 3600 + timePart.mi * 60 + timePart.s) * 1000;
    return new Date(midnight + offset);
  }

  function median(values) {
    if (!values.length) return 0;
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function findHeader(headers, names) {
    for (var i = 0; i < headers.length; i++) {
      var h = headers[i].trim().toLowerCase();
      for (var j = 0; j < names.length; j++) {
        if (h === names[j]) return i;
      }
    }
    return -1;
  }

  function isRepeatedHeader(row, headers) {
    var checked = 0;
    var matched = 0;
    for (var i = 0; i < headers.length; i++) {
      var header = headers[i].trim();
      if (!header) continue;
      checked++;
      if (String(row[i] || '').trim().toLowerCase() === header.toLowerCase()) matched++;
    }
    return checked > 1 && matched / checked >= 0.8;
  }

  function detectDateColumn(rows, headers, exclude) {
    var best = -1;
    var bestRatio = 0;
    for (var c = 0; c < headers.length; c++) {
      if (exclude.indexOf(c) !== -1) continue;
      var ok = 0;
      var total = Math.min(rows.length, 50);
      for (var r = 0; r < total; r++) {
        if (parseDateToken(rows[r][c])) ok++;
      }
      var ratio = total ? ok / total : 0;
      if (ratio > bestRatio) { bestRatio = ratio; best = c; }
    }
    return bestRatio >= 0.6 ? best : -1;
  }

  function detectTimeColumn(rows, headers, exclude) {
    var best = -1;
    var bestRatio = 0;
    for (var c = 0; c < headers.length; c++) {
      if (exclude.indexOf(c) !== -1) continue;
      var ok = 0;
      var total = Math.min(rows.length, 50);
      for (var r = 0; r < total; r++) {
        if (parseTimeToken(rows[r][c])) ok++;
      }
      var ratio = total ? ok / total : 0;
      if (ratio > bestRatio) { bestRatio = ratio; best = c; }
    }
    return bestRatio >= 0.6 ? best : -1;
  }

  function parseLog(text, fileName) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    var delimiter = detectDelimiter(text);
    var table = parseDelimited(text, delimiter);
    if (!table.length) throw new Error('Файл пуст или не содержит данных.');
    if (table.length === 1) throw new Error('В файле только строка заголовка.');

    var headers = table[0].map(function (h) { return h.trim(); });
    var rows = table.slice(1);

    // Выравниваем ширину строк.
    rows = rows.map(function (row) {
      if (row.length < headers.length) {
        var copy = row.slice();
        while (copy.length < headers.length) copy.push('');
        return copy;
      }
      return row;
    });

    rows = rows.filter(function (row) { return !isRepeatedHeader(row, headers); });

    var dateIdx = findHeader(headers, ['date', 'дата', 'day']);
    var timeIdx = findHeader(headers, ['time', 'время', 'zeit']);
    var stampIdx = findHeader(headers, ['timestamp', 'datetime', 'date time', 'дата время']);

    if (stampIdx === -1) {
      var excluded = [];
      if (dateIdx !== -1) excluded.push(dateIdx);
      if (timeIdx !== -1) excluded.push(timeIdx);
      if (dateIdx === -1) dateIdx = detectDateColumn(rows, headers, excluded);
      if (timeIdx === -1) timeIdx = detectTimeColumn(rows, headers, excluded);
    }

    var x = [];
    var xMode = 'index';
    var validCount = 0;

    if (stampIdx !== -1) {
      x = rows.map(function (row) { return parseFullDateTime(row[stampIdx]); });
      validCount = x.filter(Boolean).length;
      if (validCount) xMode = 'date';
    } else if (dateIdx !== -1 || timeIdx !== -1) {
      x = rows.map(function (row) {
        var d = dateIdx !== -1 ? parseDateToken(row[dateIdx]) : null;
        var t = timeIdx !== -1 ? parseTimeToken(row[timeIdx]) : null;
        if (!d && !t) return null;
        return makeDate(d || { y: 2000, mo: 1, d: 1 }, t || { h: 0, mi: 0, s: 0 });
      });
      validCount = x.filter(Boolean).length;
      if (validCount) xMode = 'date';
    }

    var step = 500;
    if (xMode === 'date') {
      var diffs = [];
      var prev = null;
      for (var i = 0; i < x.length; i++) {
        if (!x[i]) continue;
        if (prev) {
          var d = x[i].getTime() - prev.getTime();
          if (d > 0) diffs.push(d);
        }
        prev = x[i];
      }
      if (diffs.length) step = median(diffs);
      // Заполняем пропуски времени.
      var firstValid = -1;
      for (i = 0; i < x.length; i++) { if (x[i]) { firstValid = i; break; } }
      if (firstValid !== -1) {
        for (i = firstValid - 1; i >= 0; i--) {
          x[i] = new Date(x[i + 1].getTime() - step);
        }
        for (i = firstValid + 1; i < x.length; i++) {
          if (!x[i]) x[i] = new Date(x[i - 1].getTime() + step);
        }
      } else {
        xMode = 'index';
      }
    }

    if (xMode === 'index') {
      var start = Date.now();
      x = rows.map(function (row, idx) { return new Date(start + idx * 1000); });
      step = 1000;
    }

    var excludedCols = [dateIdx, timeIdx, stampIdx];
    var channels = [];
    var gearColumn = null;

    for (var c = 0; c < headers.length; c++) {
      var name = headers[c];
      if (!name) continue;
      if (excludedCols.indexOf(c) !== -1) continue;

      var isGear = /^(gear|gearlever|selector|передача|передача\.?)$/i.test(name);
      if (isGear) {
        gearColumn = rows.map(function (row) {
          var v = (row[c] || '').trim();
          return v || '—';
        });
        continue;
      }

      var nonEmpty = 0;
      var numericCount = 0;
      var values = new Array(rows.length);
      var min = Infinity;
      var max = -Infinity;
      var sum = 0;

      for (var r = 0; r < rows.length; r++) {
        var raw = rows[r][c];
        if (raw !== null && String(raw).trim() !== '') nonEmpty++;
        var num = toNumber(raw);
        values[r] = num;
        if (num !== null) {
          numericCount++;
          if (num < min) min = num;
          if (num > max) max = num;
          sum += num;
        }
      }

      if (numericCount === 0) continue;
      if (nonEmpty > 0 && numericCount / nonEmpty < 0.5) continue;

      channels.push({
        name: name,
        index: c,
        values: values,
        min: min,
        max: max,
        mean: numericCount ? sum / numericCount : null,
        count: numericCount,
        nullCount: rows.length - numericCount
      });
    }

    var channelsByName = {};
    channels.forEach(function (ch) { channelsByName[ch.name] = ch; });

    var gearRuns = [];
    if (gearColumn) {
      var runStart = 0;
      for (i = 1; i <= rows.length; i++) {
        if (i === rows.length || gearColumn[i] !== gearColumn[runStart]) {
          gearRuns.push({
            gear: gearColumn[runStart],
            start: x[runStart].getTime(),
            end: x[Math.min(i, rows.length - 1)].getTime()
          });
          runStart = i;
        }
      }
    }

    var startMs = x.length ? x[0].getTime() : 0;
    var endMs = x.length ? x[x.length - 1].getTime() : 0;

    return {
      fileName: fileName || 'log.csv',
      headers: headers,
      rows: rows,
      x: x,
      xMode: xMode,
      stepMs: step,
      startMs: startMs,
      endMs: endMs,
      durationMs: Math.max(0, endMs - startMs),
      channels: channels,
      channelsByName: channelsByName,
      gearColumn: gearColumn,
      gearRuns: gearRuns,
      delimiter: delimiter
    };
  }

  function pad2(v) { return v < 10 ? '0' + v : String(v); }

  function formatClock(ms) {
    var d = new Date(ms);
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }

  function formatClockMs(ms) {
    var d = new Date(ms);
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()) +
      '.' + String(d.getMilliseconds()).padStart(3, '0');
  }

  function formatDate(ms) {
    var d = new Date(ms);
    return pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '.' + d.getFullYear();
  }

  function formatDuration(ms) {
    var total = Math.round(ms / 1000);
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    if (h > 0) return h + ' ч ' + m + ' мин';
    if (m > 0) return m + ' мин ' + s + ' с';
    return s + ' с';
  }

  var api = {
    detectDelimiter: detectDelimiter,
    parseDelimited: parseDelimited,
    parseLog: parseLog,
    toNumber: toNumber,
    parseDateToken: parseDateToken,
    parseTimeToken: parseTimeToken,
    formatClock: formatClock,
    formatClockMs: formatClockMs,
    formatDate: formatDate,
    formatDuration: formatDuration
  };

  global.CSVLog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
