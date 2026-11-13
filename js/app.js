(function () {
  'use strict';

  var state = {
    dataset: null,
    selected: [],
    mode: 'combined',
    normalize: true,
    fileList: [],
    chartHasPlot: false,
    axisKeys: [],
    analysis: null
  };

  var el = {};

  var GEAR_COLORS = {
    P: '#5b647a',
    R: '#ef476f',
    D: '#06d6a0',
    N: '#ffd166',
    M: '#c77dff'
  };

  var PLOT_CONFIG = {
    responsive: true,
    displaylogo: false,
    displayModeBar: 'hover',
    scrollZoom: true,
    doubleClick: 'reset',
    modeBarButtonsToRemove: [
      'select2d', 'lasso2d', 'autoScale2d', 'hoverClosestCartesian',
      'hoverCompareCartesian', 'toggleSpikelines'
    ],
    toImageButtonOptions: { format: 'png', filename: 'engine-log', scale: 1 }
  };

  function $(id) { return document.getElementById(id); }

  function init() {
    el.fileMeta = $('fileMeta');
    el.fileSelect = $('fileSelect');
    el.fileInput = $('fileInput');
    el.openBtn = $('openBtn');
    el.emptyOpenBtn = $('emptyOpenBtn');
    el.emptyState = $('emptyState');
    el.workspace = $('workspace');
    el.search = $('searchInput');
    el.presets = $('presets');
    el.channelList = $('channelList');
    el.selCount = $('selCount');
    el.clearBtn = $('clearBtn');
    el.modeSwitch = $('modeSwitch');
    el.normalizeWrap = $('normalizeWrap');
    el.normalizeToggle = $('normalizeToggle');
    el.resetZoomBtn = $('resetZoomBtn');
    el.exportPngBtn = $('exportPngBtn');
    el.exportCsvBtn = $('exportCsvBtn');
    el.analyzeBtn = $('analyzeBtn');
    el.analysisPanel = $('analysisPanel');
    el.analysisMeta = $('analysisMeta');
    el.analysisSummary = $('analysisSummary');
    el.analysisResults = $('analysisResults');
    el.analysisPdfBtn = $('analysisPdfBtn');
    el.analysisCloseBtn = $('analysisCloseBtn');
    el.gearStripWrap = $('gearStripWrap');
    el.gearStrip = $('gearStrip');
    el.gearLegend = $('gearLegend');
    el.stats = $('stats');
    el.chart = $('chart');
    el.dropOverlay = $('dropOverlay');
    el.chartHint = document.querySelector('.chart-hint');

    bindEvents();
    renderPresets();
    loadFileList();
  }

  function bindEvents() {
    el.openBtn.addEventListener('click', function () { el.fileInput.click(); });
    el.emptyOpenBtn.addEventListener('click', function () { el.fileInput.click(); });

    el.fileInput.addEventListener('change', function () {
      var file = el.fileInput.files && el.fileInput.files[0];
      if (file) loadFromFile(file);
      el.fileInput.value = '';
    });

    el.fileSelect.addEventListener('change', function () {
      var name = el.fileSelect.value;
      if (name) loadFromUrl('api/data?name=' + encodeURIComponent(name), name);
    });

    el.search.addEventListener('input', applySearch);

    el.clearBtn.addEventListener('click', function () {
      state.selected = [];
      render();
    });

    el.modeSwitch.addEventListener('click', function (event) {
      var btn = event.target.closest('button[data-mode]');
      if (!btn) return;
      state.mode = btn.getAttribute('data-mode');
      updateToolbar();
      render();
    });

    el.normalizeToggle.addEventListener('change', function () {
      state.normalize = el.normalizeToggle.checked;
      render();
    });

    el.resetZoomBtn.addEventListener('click', resetZoom);
    el.exportPngBtn.addEventListener('click', exportPng);
    el.exportCsvBtn.addEventListener('click', exportCsv);
    el.analyzeBtn.addEventListener('click', runAnalysis);
    el.analysisPdfBtn.addEventListener('click', exportAnalysisPdf);
    el.analysisCloseBtn.addEventListener('click', hideAnalysis);

    var dragDepth = 0;
    function isFileDrag(event) {
      var types = event.dataTransfer && event.dataTransfer.types;
      return types && Array.prototype.indexOf.call(types, 'Files') !== -1;
    }
    window.addEventListener('dragenter', function (event) {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      dragDepth++;
      el.dropOverlay.classList.add('show');
    });
    window.addEventListener('dragover', function (event) {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    });
    window.addEventListener('dragleave', function (event) {
      if (!isFileDrag(event)) return;
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) el.dropOverlay.classList.remove('show');
    });
    window.addEventListener('drop', function (event) {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      dragDepth = 0;
      el.dropOverlay.classList.remove('show');
      var file = event.dataTransfer.files && event.dataTransfer.files[0];
      if (file) loadFromFile(file);
    });
  }

  function loadFileList() {
    if (location.protocol === 'file:') return;
    fetch('api/files', { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('no api');
        return response.json();
      })
      .then(function (list) {
        if (!Array.isArray(list) || !list.length) return;
        state.fileList = list;
        populateFileSelect(list);
      })
      .catch(function () { /* файл можно выбрать вручную */ });
  }

  function populateFileSelect(list) {
    el.fileSelect.innerHTML = '';
    list.forEach(function (file) {
      var option = document.createElement('option');
      option.value = file.name;
      option.textContent = file.name;
      el.fileSelect.appendChild(option);
    });
    el.fileSelect.hidden = list.length < 2;
  }

  function loadFromUrl(url, name) {
    el.fileMeta.textContent = 'Загрузка ' + name + '…';
    fetch(url, { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('Не удалось загрузить файл (' + response.status + ')');
        return response.text();
      })
      .then(function (text) { applyText(text, name); })
      .catch(function (error) {
        toast(error.message, 'error');
        if (state.dataset) updateHeaderMeta();
        else el.fileMeta.textContent = 'Не удалось загрузить файл';
      });
  }

  function loadFromFile(file) {
    if (!/\.(csv|txt)$/i.test(file.name)) {
      toast('Выберите файл с расширением .csv или .txt', 'error');
      return;
    }
    file.text()
      .then(function (text) { applyText(text, file.name); })
      .catch(function (error) { toast('Не удалось прочитать файл: ' + error.message, 'error'); });
  }

  function applyText(text, name) {
    var dataset;
    try {
      dataset = CSVLog.parseLog(text, name);
    } catch (error) {
      toast('Ошибка разбора файла: ' + error.message, 'error');
      if (state.dataset) updateHeaderMeta();
      else el.fileMeta.textContent = 'Не удалось разобрать файл';
      return;
    }
    setDataset(dataset);
    toast('Открыт файл ' + name + ' — ' + dataset.rows.length + ' строк', 'ok');
  }

  function setDataset(dataset) {
    state.dataset = dataset;
    clearAnalysis();

    var availableDefaults = ChannelInfo.defaultSelection.filter(function (name) {
      return dataset.channelsByName[name];
    });
    if (!availableDefaults.length) {
      availableDefaults = dataset.channels.slice(0, Math.min(3, dataset.channels.length))
        .map(function (ch) { return ch.name; });
    }
    state.selected = availableDefaults;

    el.search.value = '';
    el.search.disabled = false;
    var knownFile = Array.prototype.some.call(el.fileSelect.options, function (option) {
      return option.value === dataset.fileName;
    });
    if (knownFile) el.fileSelect.value = dataset.fileName;

    buildChannelList();
    renderPresets();
    updateHeaderMeta();

    el.emptyState.hidden = true;
    el.workspace.hidden = false;
    updateToolbar();
    render();
  }

  function updateHeaderMeta() {
    var dataset = state.dataset;
    if (!dataset) return;
    var parts = [dataset.fileName];
    parts.push(formatInt(dataset.rows.length) + ' строк');
    if (dataset.xMode === 'date') {
      parts.push(CSVLog.formatDate(dataset.startMs) + ', ' +
        CSVLog.formatClock(dataset.startMs) + '–' + CSVLog.formatClock(dataset.endMs));
    }
    parts.push(CSVLog.formatDuration(dataset.durationMs));
    parts.push('шаг ' + formatStep(dataset.stepMs));
    el.fileMeta.textContent = parts.join(' · ');
    el.fileMeta.title = parts.join(' · ');
    document.title = dataset.fileName + ' — анализ логов двигателя';
  }

  function formatStep(ms) {
    if (ms < 1000) return (ms / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' с';
    if (ms < 60000) return (ms / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' с';
    return CSVLog.formatDuration(ms);
  }

  var ANALYSIS_LABELS = {
    ok: 'Норма',
    warn: 'Внимание',
    bad: 'Проблема',
    info: 'Информация',
    skip: 'Нет данных'
  };

  function runAnalysis() {
    if (!state.dataset) {
      toast('Сначала откройте файл с логом', 'error');
      return;
    }
    if (!window.AutoAnalysis) {
      toast('Модуль автоматического анализа не подключён', 'error');
      return;
    }
    var report;
    try {
      report = window.AutoAnalysis.analyze(state.dataset);
    } catch (error) {
      toast('Не удалось выполнить анализ: ' + error.message, 'error');
      return;
    }
    state.analysis = report;
    renderAnalysis(report);
    el.analysisPanel.hidden = false;
    if (el.analysisPanel.scrollIntoView) {
      el.analysisPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    toast(
      'Анализ готов: ' + report.counts.warn + ' внимание, ' + report.counts.bad + ' проблем',
      report.counts.bad ? 'error' : 'ok'
    );
  }

  function hideAnalysis() {
    el.analysisPanel.hidden = true;
  }

  function clearAnalysis() {
    state.analysis = null;
    if (!el.analysisPanel) return;
    el.analysisPanel.hidden = true;
    el.analysisMeta.textContent = '';
    el.analysisSummary.innerHTML = '';
    el.analysisResults.innerHTML = '';
  }

  function renderAnalysis(report) {
    var meta = [report.kind === 'at' ? 'Лог АКПП' : 'Лог двигателя', formatInt(report.results.length) + ' проверок'];
    if (state.dataset && state.dataset.xMode === 'date') {
      meta.push(CSVLog.formatDate(state.dataset.startMs) + ', ' +
        CSVLog.formatClock(state.dataset.startMs) + '–' + CSVLog.formatClock(state.dataset.endMs));
    }
    el.analysisMeta.textContent = meta.join(' · ');

    el.analysisSummary.innerHTML = '';
    var overall = document.createElement('span');
    overall.className = 'analysis-overall status-' + report.status;
    overall.textContent = (ANALYSIS_LABELS[report.status] || report.status) + ' · ' + report.results.length + ' проверок';
    el.analysisSummary.appendChild(overall);

    ['bad', 'warn', 'info', 'ok', 'skip'].forEach(function (status) {
      var count = report.counts[status] || 0;
      if (!count) return;
      var chip = document.createElement('span');
      chip.className = 'analysis-chip status-' + status;
      chip.textContent = ANALYSIS_LABELS[status] + ': ' + count;
      el.analysisSummary.appendChild(chip);
    });

    el.analysisResults.innerHTML = '';
    report.results.forEach(function (item) {
      var card = document.createElement('article');
      card.className = 'analysis-card status-' + item.status;

      var head = document.createElement('div');
      head.className = 'analysis-card-head';

      var dot = document.createElement('span');
      dot.className = 'analysis-dot';

      var title = document.createElement('div');
      title.className = 'analysis-card-title';
      title.textContent = item.title;

      var badge = document.createElement('span');
      badge.className = 'analysis-badge';
      badge.textContent = ANALYSIS_LABELS[item.status] || item.status;

      head.appendChild(dot);
      head.appendChild(title);
      head.appendChild(badge);

      var summary = document.createElement('p');
      summary.className = 'analysis-card-summary';
      summary.textContent = item.summary;

      var details = document.createElement('dl');
      details.className = 'analysis-details';
      item.details.forEach(function (row) {
        var line = document.createElement('div');
        line.className = 'analysis-detail';
        var label = document.createElement('dt');
        label.textContent = row.label;
        var value = document.createElement('dd');
        value.textContent = row.value;
        line.appendChild(label);
        line.appendChild(value);
        details.appendChild(line);
      });

      card.appendChild(head);
      card.appendChild(summary);
      card.appendChild(details);

      if (item.channels && item.channels.length) {
        var channels = document.createElement('div');
        channels.className = 'analysis-channels';
        channels.textContent = 'Каналы: ' + item.channels.join(', ');
        card.appendChild(channels);
      }

      el.analysisResults.appendChild(card);
    });
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function analysisReportHtml(report) {
    var dataset = state.dataset;
    var statusLabels = ANALYSIS_LABELS;
    var meta = ['Файл: ' + dataset.fileName];
    if (dataset.xMode === 'date') {
      meta.push('Период: ' + CSVLog.formatDate(dataset.startMs) + ', ' +
        CSVLog.formatClock(dataset.startMs) + '–' + CSVLog.formatClock(dataset.endMs) +
        ' · ' + CSVLog.formatDuration(dataset.durationMs));
    }
    meta.push('Строк: ' + formatInt(dataset.rows.length) + ' · Шаг: ' + formatStep(dataset.stepMs));
    meta.push('Сформировано: ' + new Date().toLocaleString('ru-RU'));

    var summary = [
      '<span class="summary-item status-' + report.status + '">' +
        escapeHtml((statusLabels[report.status] || report.status) + ' · ' + report.results.length + ' проверок') +
      '</span>'
    ];
    ['bad', 'warn', 'info', 'ok', 'skip'].forEach(function (status) {
      var count = report.counts[status] || 0;
      if (!count) return;
      summary.push('<span class="summary-item status-' + status + '">' +
        escapeHtml((statusLabels[status] || status) + ': ' + count) + '</span>');
    });

    var cards = report.results.map(function (item) {
      var details = item.details.map(function (row) {
        return '<div class="detail"><span class="detail-label">' + escapeHtml(row.label) +
          '</span><span class="detail-value">' + escapeHtml(row.value) + '</span></div>';
      }).join('');
      var channels = item.channels && item.channels.length
        ? '<div class="channels">Каналы: ' + escapeHtml(item.channels.join(', ')) + '</div>'
        : '';
      return '<article class="card status-' + item.status + '">' +
        '<div class="card-head"><div class="card-title">' + escapeHtml(item.title) + '</div>' +
        '<span class="status-badge status-' + item.status + '">' +
          escapeHtml(statusLabels[item.status] || item.status) + '</span></div>' +
        '<p class="card-summary">' + escapeHtml(item.summary) + '</p>' +
        '<div class="details">' + details + '</div>' + channels +
      '</article>';
    }).join('');

    var title = dataset.fileName.replace(/\.[^.]+$/, '') + '_анализ';
    return '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">' +
      '<title>' + escapeHtml(title) + '</title><style>' +
      '*{box-sizing:border-box}' +
      '@page{size:A4 portrait;margin:14mm 12mm}' +
      'html,body{margin:0;padding:0;background:#fff;color:#101318;' +
        'font-family:"Segoe UI",system-ui,-apple-system,Roboto,Arial,sans-serif;' +
        'font-size:10.5pt;line-height:1.35;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      '.status-ok{--c:#0a7c5c;--bg:#e9f8f2;--bd:#b8e5d5}' +
      '.status-warn{--c:#8f5f00;--bg:#fff6df;--bd:#f0d49b}' +
      '.status-bad{--c:#b32645;--bg:#fdebf0;--bd:#f2b9c7}' +
      '.status-info{--c:#166b8a;--bg:#e9f6fb;--bd:#b8dfed}' +
      '.status-skip{--c:#5f6878;--bg:#f1f3f6;--bd:#d4d9e1}' +
      '.report-head{padding-bottom:10px;border-bottom:2px solid #1b2430;margin-bottom:12px}' +
      '.kicker{font-size:8pt;letter-spacing:1.4px;text-transform:uppercase;color:#5d6878;margin-bottom:4px}' +
      'h1{margin:0 0 7px;font-size:18pt;line-height:1.15}' +
      '.meta{font-size:9pt;color:#4f5a6a;margin:2px 0}' +
      '.summary{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 14px}' +
      '.summary-item{display:inline-block;padding:3px 8px;border:1px solid var(--bd);' +
        'border-radius:999px;background:var(--bg);color:var(--c);font-size:9pt;font-weight:700}' +
      '.card{border:1px solid #d6dbe3;border-left:4px solid var(--c);border-radius:4px;' +
        'padding:8px 10px 9px;margin:0 0 9px;break-inside:avoid;page-break-inside:avoid;background:#fff}' +
      '.card-head{display:flex;align-items:baseline;gap:8px;margin-bottom:4px}' +
      '.card-title{flex:1;font-size:11pt;font-weight:700}' +
      '.status-badge{display:inline-block;padding:2px 7px;border:1px solid var(--bd);' +
        'border-radius:999px;background:var(--bg);color:var(--c);font-size:8pt;font-weight:700;white-space:nowrap}' +
      '.card-summary{margin:0 0 6px;font-size:9.5pt;color:#333d4a}' +
      '.details{display:flex;flex-direction:column;gap:2px}' +
      '.detail{display:flex;align-items:baseline;justify-content:space-between;gap:12px;font-size:9pt}' +
      '.detail-label{color:#5b6676;min-width:0}' +
      '.detail-value{text-align:right;white-space:normal;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}' +
      '.channels{margin-top:6px;padding-top:5px;border-top:1px solid #e6e9ef;' +
        'font-size:7.5pt;color:#6d7787;overflow-wrap:anywhere}' +
      '.foot{margin-top:14px;padding-top:8px;border-top:1px solid #d6dbe3;font-size:8pt;color:#5b6676}' +
      '</style></head><body>' +
      '<header class="report-head"><div class="kicker">' +
        (report.kind === 'at' ? 'Peugeot 408 · анализ логов АКПП' : 'Peugeot 408 · анализ логов двигателя') +
      '</div>' +
        '<h1>Автоматический анализ</h1>' +
        meta.map(function (line) { return '<div class="meta">' + escapeHtml(line) + '</div>'; }).join('') +
      '</header>' +
      '<section class="summary">' + summary.join('') + '</section>' +
      '<section class="cards">' + cards + '</section>' +
      '<footer class="foot">Корреляции считаются по Спирмену на очищенных данных. Артефакты и пропуски исключаются. ' +
        'Результат носит диагностический характер и требует проверки по возможности.</footer>' +
      '</body></html>';
  }

  function exportAnalysisPdf() {
    if (!state.analysis) {
      toast('Сначала выполните автоматический анализ', 'error');
      return;
    }
    if (!window.print) {
      toast('Браузер не поддерживает печать в PDF', 'error');
      return;
    }
    var oldFrame = document.getElementById('analysisPdfFrame');
    if (oldFrame) oldFrame.parentNode.removeChild(oldFrame);

    var frame = document.createElement('iframe');
    frame.id = 'analysisPdfFrame';
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;left:-12000px;top:0;width:900px;height:1200px;border:0;';
    frame.srcdoc = analysisReportHtml(state.analysis);

    var cleanup = function () {
      if (frame.parentNode) frame.parentNode.removeChild(frame);
    };

    frame.onload = function () {
      try {
        var win = frame.contentWindow;
        win.onafterprint = cleanup;
        setTimeout(function () {
          win.focus();
          win.print();
        }, 50);
      } catch (error) {
        cleanup();
        toast('Не удалось открыть печать отчёта', 'error');
        return;
      }
      setTimeout(cleanup, 5 * 60 * 1000);
    };

    document.body.appendChild(frame);
    toast('В диалоге печати выберите «Сохранить как PDF»', 'ok');
  }

  function buildChannelList() {
    var dataset = state.dataset;
    el.channelList.innerHTML = '';
    var added = {};
    var groups = [];

    ChannelInfo.groups.forEach(function (group) {
      var channels = group.channels.filter(function (name) {
        if (dataset.channelsByName[name] && !added[name]) {
          added[name] = true;
          return true;
        }
        return false;
      });
      if (channels.length) groups.push({ title: group.title, channels: channels });
    });

    var extra = dataset.channels.filter(function (ch) { return !added[ch.name]; })
      .map(function (ch) { return ch.name; });
    if (extra.length) groups.push({ title: 'Другие параметры', channels: extra });

    groups.forEach(function (group) {
      var details = document.createElement('details');
      details.className = 'group';
      details.open = group.channels.some(function (name) {
        return state.selected.indexOf(name) !== -1;
      });

      var summary = document.createElement('summary');
      var title = document.createElement('span');
      title.className = 'group-title';
      title.textContent = group.title;
      var count = document.createElement('span');
      count.className = 'group-count';
      count.textContent = group.channels.length;
      summary.appendChild(title);
      summary.appendChild(count);
      details.appendChild(summary);

      group.channels.forEach(function (name) {
        var info = ChannelInfo.meta[name] || { label: name, unit: '' };
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'channel';
        button.setAttribute('role', 'checkbox');
        button.setAttribute('aria-checked', 'false');
        button.dataset.name = name;
        button.dataset.search = (info.label + ' ' + name + ' ' + group.title).toLowerCase();

        var dot = document.createElement('span');
        dot.className = 'ch-dot';

        var text = document.createElement('span');
        text.className = 'ch-text';
        var label = document.createElement('span');
        label.className = 'ch-label';
        label.textContent = info.label;
        text.appendChild(label);
        if (info.label !== name) {
          var orig = document.createElement('span');
          orig.className = 'ch-name';
          orig.textContent = name;
          text.appendChild(orig);
        }

        var unit = document.createElement('span');
        unit.className = 'ch-unit';
        unit.textContent = info.unit || '';

        button.appendChild(dot);
        button.appendChild(text);
        button.appendChild(unit);
        button.addEventListener('click', function () { toggleChannel(name); });

        details.appendChild(button);
      });

      el.channelList.appendChild(details);
    });

    if (!groups.length) {
      var empty = document.createElement('div');
      empty.className = 'sidebar-empty';
      empty.textContent = 'В файле не найдено числовых параметров.';
      el.channelList.appendChild(empty);
    }
  }

  function renderPresets() {
    el.presets.innerHTML = '';
    var dataset = state.dataset;
    ChannelInfo.presets.forEach(function (preset) {
      var available = dataset ? preset.channels.filter(function (name) {
        return dataset.channelsByName[name];
      }) : [];
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'preset-chip';
      button.textContent = preset.title;
      button.disabled = !available.length;
      button.title = available.length
        ? 'Выбрать: ' + available.map(ChannelInfo.labelOf).join(', ')
        : 'Нет подходящих параметров';
      button.addEventListener('click', function () {
        if (!available.length) return;
        state.selected = available.slice();
        render();
      });
      el.presets.appendChild(button);
    });
  }

  function applySearch() {
    var query = el.search.value.trim().toLowerCase();
    var groups = el.channelList.querySelectorAll('.group');
    groups.forEach(function (group) {
      var anyVisible = false;
      group.querySelectorAll('.channel').forEach(function (button) {
        var match = !query || button.dataset.search.indexOf(query) !== -1;
        button.hidden = !match;
        if (match) anyVisible = true;
      });
      group.hidden = !anyVisible;
      if (query && anyVisible) group.open = true;
    });
  }

  function toggleChannel(name) {
    var index = state.selected.indexOf(name);
    if (index !== -1) state.selected.splice(index, 1);
    else state.selected.push(name);
    render();
  }

  function colorFor(name) {
    var index = state.selected.indexOf(name);
    var colors = ChannelInfo.colors;
    return colors[(index < 0 ? 0 : index) % colors.length];
  }

  function gearColor(gear) {
    return GEAR_COLORS[gear] || ChannelInfo.colors[hashString(gear) % ChannelInfo.colors.length];
  }

  function hashString(value) {
    var hash = 0;
    for (var i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
    return Math.abs(hash);
  }

  function render() {
    updateChannelRows();
    renderPresets();
    renderGearStrip();
    renderStats();
    renderChart();
  }

  function updateToolbar() {
    el.modeSwitch.querySelectorAll('button[data-mode]').forEach(function (button) {
      var active = button.getAttribute('data-mode') === state.mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    el.normalizeWrap.hidden = state.mode !== 'combined';
  }

  function updateChannelRows() {
    var list = el.channelList.querySelectorAll('.channel');
    list.forEach(function (button) {
      var name = button.dataset.name;
      var selected = state.selected.indexOf(name) !== -1;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-checked', selected ? 'true' : 'false');
      if (selected) {
        button.style.setProperty('--dot-color', colorFor(name));
      } else {
        button.style.removeProperty('--dot-color');
      }
    });
    el.selCount.textContent = state.selected.length;
  }

  function renderGearStrip() {
    var dataset = state.dataset;
    var runs = dataset && dataset.gearRuns;
    if (!runs || !runs.length || dataset.durationMs <= 0) {
      el.gearStripWrap.hidden = true;
      return;
    }
    el.gearStripWrap.hidden = false;
    el.gearStrip.innerHTML = '';
    el.gearLegend.innerHTML = '';

    var seen = [];
    runs.forEach(function (run) {
      if (seen.indexOf(run.gear) === -1) seen.push(run.gear);
    });
    seen.forEach(function (gear) {
      var item = document.createElement('span');
      var swatch = document.createElement('i');
      swatch.style.background = gearColor(gear);
      item.appendChild(swatch);
      item.appendChild(document.createTextNode(gearLabel(gear)));
      el.gearLegend.appendChild(item);
    });

    var total = dataset.endMs - dataset.startMs || 1;
    runs.forEach(function (run) {
      var left = ((run.start - dataset.startMs) / total) * 100;
      var width = ((run.end - run.start) / total) * 100;
      if (width <= 0) width = 0.15;
      var segment = document.createElement('button');
      segment.type = 'button';
      segment.className = 'gear-seg';
      segment.style.left = left + '%';
      segment.style.width = Math.max(width, 0.15) + '%';
      segment.style.background = gearColor(run.gear);
      segment.textContent = width > 3.5 ? run.gear : '';
      segment.title = gearLabel(run.gear) + ' · ' + CSVLog.formatClock(run.start) +
        '–' + CSVLog.formatClock(run.end) + ' (' + CSVLog.formatDuration(run.end - run.start) + ')';
      segment.setAttribute('aria-label', segment.title);
      segment.addEventListener('click', function () {
        zoomToRange(run.start, run.end);
      });
      el.gearStrip.appendChild(segment);
    });
  }

  function gearLabel(gear) {
    var map = { P: 'P — парковка', R: 'R — задний ход', D: 'D — движение', N: 'N — нейтраль' };
    return map[gear] || gear;
  }

  function renderStats() {
    var dataset = state.dataset;
    el.stats.innerHTML = '';
    if (!dataset) return;

    state.selected.forEach(function (name) {
      var channel = dataset.channelsByName[name];
      if (!channel) return;
      var info = ChannelInfo.meta[name] || { label: name, unit: '' };
      var color = colorFor(name);

      var card = document.createElement('div');
      card.className = 'stat-card';
      card.style.setProperty('--stat-color', color);

      var head = document.createElement('div');
      head.className = 'stat-head';
      var dot = document.createElement('span');
      dot.className = 'ch-dot';
      var label = document.createElement('span');
      label.className = 'stat-label';
      label.textContent = info.label;
      label.title = name;
      var unit = document.createElement('span');
      unit.className = 'stat-unit';
      unit.textContent = info.unit || '';
      head.appendChild(dot);
      head.appendChild(label);
      head.appendChild(unit);

      var values = document.createElement('div');
      values.className = 'stat-values';
      values.appendChild(statValue('мин', formatValue(channel.min)));
      values.appendChild(statValue('сред', formatValue(channel.mean)));
      values.appendChild(statValue('макс', formatValue(channel.max)));

      card.appendChild(head);
      card.appendChild(values);
      el.stats.appendChild(card);
    });
  }

  function statValue(caption, value) {
    var block = document.createElement('div');
    var captionEl = document.createElement('span');
    captionEl.textContent = caption;
    var valueEl = document.createElement('b');
    valueEl.textContent = value;
    block.appendChild(captionEl);
    block.appendChild(valueEl);
    return block;
  }

  function renderChart() {
    var dataset = state.dataset;
    if (!dataset) return;

    if (!state.selected.length) {
      Plotly.purge(el.chart);
      state.chartHasPlot = false;
      state.axisKeys = [];
      el.chart.style.height = '320px';
      el.chart.innerHTML = '<div class="chart-empty">Выберите один или несколько параметров в списке слева</div>';
      return;
    }

    if (!state.chartHasPlot || el.chart.querySelector('.chart-empty')) {
      el.chart.innerHTML = '';
      state.chartHasPlot = false;
    }

    var result = state.mode === 'combined' ? buildCombined() : buildSeparate();
    el.chart.style.height = result.height + 'px';
    state.axisKeys = result.axisKeys;

    Plotly.react(el.chart, result.traces, result.layout, PLOT_CONFIG);
    state.chartHasPlot = true;
  }

  function xValues(dataset) {
    return dataset.x;
  }

  function buildCombined() {
    var dataset = state.dataset;
    var traces = state.selected.map(function (name) {
      var channel = dataset.channelsByName[name];
      if (!channel) return null;
      var info = ChannelInfo.meta[name] || { label: name, unit: '' };
      var color = colorFor(name);
      var range = channel.max - channel.min;
      var y = new Array(channel.values.length);
      var customdata = new Array(channel.values.length);

      for (var i = 0; i < channel.values.length; i++) {
        var value = channel.values[i];
        customdata[i] = value === null ? '' : formatValue(value);
        if (state.normalize) {
          y[i] = value === null ? null : (range > 0 ? ((value - channel.min) / range) * 100 : 50);
        } else {
          y[i] = value;
        }
      }

      var unitSuffix = info.unit ? ' ' + info.unit : '';
      return {
        x: xValues(dataset),
        y: y,
        type: 'scatter',
        mode: 'lines',
        name: info.label + (info.unit ? ', ' + info.unit : ''),
        line: { color: color, width: 1.8 },
        customdata: customdata,
        connectgaps: false,
        hovertemplate: info.label + ': <b>%{customdata}</b>' + unitSuffix + '<extra></extra>'
      };
    }).filter(Boolean);

    var legendRows = Math.ceil(traces.length / 3);
    var height = Math.max(500, Math.min(720, window.innerHeight - 300));
    var layout = {
      height: height,
      margin: { l: 72, r: 28, t: 30 + legendRows * 20, b: 50 },
      paper_bgcolor: '#131821',
      plot_bgcolor: '#131821',
      font: { family: '"Inter", "Segoe UI", system-ui, sans-serif', size: 11.5, color: '#aab4c8' },
      hovermode: 'x unified',
      hoverlabel: {
        bgcolor: '#1b2230',
        bordercolor: '#2c3648',
        font: { color: '#e6eaf2', size: 12 }
      },
      legend: {
        orientation: 'h',
        x: 0,
        y: 1.005,
        xanchor: 'left',
        yanchor: 'bottom',
        font: { size: 10.5, color: '#aab4c8' },
        bgcolor: 'rgba(0,0,0,0)',
        entrywidthmode: 'fraction',
        entrywidth: 0.33
      },
      xaxis: {
        type: 'date',
        hoverformat: '%H:%M:%S',
        tickformat: tickFormat(),
        gridcolor: '#222a37',
        zeroline: false,
        showline: true,
        linecolor: '#2b3444',
        ticks: 'outside',
        tickcolor: '#2b3444',
        tickfont: { size: 10.5 },
        automargin: true
      },
      yaxis: {
        title: {
          text: state.normalize ? 'Нормированное значение, %' : 'Значение',
          font: { size: 11, color: '#8b95a9' },
          standoff: 10
        },
        gridcolor: '#222a37',
        zeroline: false,
        rangemode: state.normalize ? 'normal' : 'tozero',
        ticksuffix: state.normalize ? ' %' : '',
        range: state.normalize ? [-4, 104] : undefined,
        automargin: true
      },
      uirevision: dataset.fileName + '|combined|' + state.normalize
    };

    return { traces: traces, layout: layout, height: height, axisKeys: ['xaxis', 'yaxis'] };
  }

  function buildSeparate() {
    var dataset = state.dataset;
    var selected = state.selected.filter(function (name) { return dataset.channelsByName[name]; });
    var n = selected.length;
    var height = Math.max(500, n * 175 + 90);

    var gap = 0.055;
    var each = (1 - gap * (n - 1)) / n;
    var layout = {
      height: height,
      margin: { l: 78, r: 26, t: 22, b: 52 },
      paper_bgcolor: '#131821',
      plot_bgcolor: '#131821',
      font: { family: '"Inter", "Segoe UI", system-ui, sans-serif', size: 11, color: '#aab4c8' },
      showlegend: false,
      hovermode: 'x',
      hoverlabel: {
        bgcolor: '#1b2230',
        bordercolor: '#2c3648',
        font: { color: '#e6eaf2', size: 12 }
      },
      uirevision: dataset.fileName + '|separate|' + n
    };
    var axisKeys = [];

    for (var i = 0; i < n; i++) {
      var top = 1 - i * (each + gap);
      var bottom = top - each;
      var xId = i === 0 ? 'x' : 'x' + (i + 1);
      var yId = i === 0 ? 'y' : 'y' + (i + 1);
      var xKey = i === 0 ? 'xaxis' : 'xaxis' + (i + 1);
      var yKey = i === 0 ? 'yaxis' : 'yaxis' + (i + 1);
      axisKeys.push(xKey, yKey);
      var isLast = i === n - 1;

      layout[xKey] = {
        domain: [0, 1],
        anchor: yId,
        matches: i === 0 ? undefined : 'x',
        showticklabels: isLast,
        hoverformat: '%H:%M:%S',
        tickformat: tickFormat(),
        gridcolor: '#222a37',
        zeroline: false,
        showline: false,
        ticks: isLast ? 'outside' : '',
        tickcolor: '#2b3444',
        tickfont: { size: 10 },
        title: isLast ? {
          text: 'Время',
          font: { size: 11, color: '#8b95a9' },
          standoff: 10
        } : undefined
      };

      layout[yKey] = {
        domain: [bottom, top],
        anchor: xId,
        gridcolor: '#222a37',
        zeroline: false,
        showline: true,
        linecolor: '#2b3444',
        tickfont: { size: 10 },
        automargin: true,
        title: {
          text: ChannelInfo.labelOf(selected[i]) + (ChannelInfo.unitOf(selected[i]) ? ', ' + ChannelInfo.unitOf(selected[i]) : ''),
          font: { size: 10.5, color: colorFor(selected[i]) },
          standoff: 8
        }
      };
    }

    var traces = selected.map(function (name, index) {
      var channel = dataset.channelsByName[name];
      var info = ChannelInfo.meta[name] || { label: name, unit: '' };
      var color = colorFor(name);
      var i = index;
      var customdata = new Array(channel.values.length);
      for (var j = 0; j < channel.values.length; j++) {
        customdata[j] = channel.values[j] === null ? '' : formatValue(channel.values[j]);
      }
      var unitSuffix = info.unit ? ' ' + info.unit : '';
      return {
        x: xValues(dataset),
        y: channel.values,
        type: 'scatter',
        mode: 'lines',
        name: info.label,
        line: { color: color, width: 1.7 },
        xaxis: i === 0 ? 'x' : 'x' + (i + 1),
        yaxis: i === 0 ? 'y' : 'y' + (i + 1),
        customdata: customdata,
        connectgaps: false,
        hovertemplate: '<span style="color:#8b95a9">%{x|%H:%M:%S}</span><br>' +
          info.label + ': <b>%{customdata}</b>' + unitSuffix + '<extra></extra>'
      };
    });

    return { traces: traces, layout: layout, height: height, axisKeys: axisKeys };
  }

  function tickFormat() {
    var duration = state.dataset ? state.dataset.durationMs : 0;
    return duration > 2 * 24 * 3600 * 1000 ? '%d.%m %H:%M' : '%H:%M';
  }

  function resetZoom() {
    if (!state.chartHasPlot) return;
    var update = {};
    state.axisKeys.forEach(function (key) {
      update[key + '.autorange'] = true;
    });
    Plotly.relayout(el.chart, update);
  }

  function zoomToRange(start, end) {
    if (!state.chartHasPlot) return;
    var pad = Math.max(1000, (end - start) * 0.02);
    Plotly.relayout(el.chart, {
      'xaxis.range': [new Date(start - pad).toISOString(), new Date(end + pad).toISOString()]
    });
  }

  function exportPng() {
    if (!state.chartHasPlot) {
      toast('Сначала выберите параметры для построения графика', 'error');
      return;
    }
    var name = (state.dataset ? state.dataset.fileName.replace(/\.[^.]+$/, '') : 'engine-log') + '_plot';
    Plotly.downloadImage(el.chart, {
      format: 'png',
      filename: name,
      width: 1600,
      height: Math.max(700, Math.round(el.chart.getBoundingClientRect().height)),
      scale: 1
    }).then(function () {
      toast('Изображение сохранено', 'ok');
    }).catch(function () {
      toast('Не удалось сохранить изображение', 'error');
    });
  }

  function exportCsv() {
    var dataset = state.dataset;
    if (!dataset || !state.selected.length) {
      toast('Нет выбранных параметров для экспорта', 'error');
      return;
    }
    var lines = [];
    var header = ['Date', 'Time'].concat(state.selected);
    lines.push(header.join(';'));
    for (var i = 0; i < dataset.rows.length; i++) {
      var row = [
        CSVLog.formatDate(dataset.x[i].getTime()),
        CSVLog.formatClockMs(dataset.x[i].getTime())
      ];
      state.selected.forEach(function (name) {
        var channel = dataset.channelsByName[name];
        var value = channel ? channel.values[i] : null;
        row.push(value === null || value === undefined ? '' : value);
      });
      lines.push(row.join(';'));
    }
    var blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = dataset.fileName.replace(/\.[^.]+$/, '') + '_selected.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('CSV сохранён', 'ok');
  }

  function formatValue(value) {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    var abs = Math.abs(value);
    var digits;
    if (abs >= 1000) digits = 0;
    else if (abs >= 100) digits = 1;
    else if (abs >= 1) digits = 2;
    else digits = 3;
    return value.toLocaleString('ru-RU', { maximumFractionDigits: digits });
  }

  function formatInt(value) {
    return value.toLocaleString('ru-RU');
  }

  function toast(message, type) {
    var container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    var item = document.createElement('div');
    item.className = 'toast' + (type ? ' toast-' + type : '');
    item.textContent = message;
    container.appendChild(item);
    setTimeout(function () {
      item.classList.add('toast-out');
      setTimeout(function () {
        if (item.parentNode) item.parentNode.removeChild(item);
      }, 220);
    }, 3200);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
