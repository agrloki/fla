(function (global) {
  'use strict';

  var LIMITS = {
    AirFlow: [0, 1000],
    AirFlowInstr: [0, 1000],
    AirCPress: [-100, 3000],
    AirManifold: [-100, 3000],
    AtmosphPress: [500, 1100],
    Coolant: [-40, 150],
    OilTemp: [-40, 150],
    ECUtemp: [-40, 150],
    AlternatorTemp: [-40, 200],
    ExternalTemp: [-50, 60],
    Revs: [0, 9000],
    Speed: [0, 350],
    Battery: [0, 20],
    AlternatorCharge: [0, 100],
    AlternatorCurrent: [0, 200],
    OilPress: [0, 10000],
    OilPressInstr: [0, 10000],
    OilPumpValve: [0, 100],
    UpO2Volt: [0, 5000],
    DownO2Volt: [0, 5000],
    UpO2Heat: [0, 100],
    DownO2Heat: [0, 100],
    ValveLiftInstr: [0, 20],
    ValveLift: [0, 20],
    ValveMotor: [0, 100],
    InCamDephaser: [-50, 360],
    InCamDephaserInstr: [-50, 360],
    ExCamDephaser: [-50, 360],
    ExCamDephaserInstr: [-50, 360],
    InCamDephaserValve: [0, 100],
    ExCamDephaserValve: [0, 100],
    'Cyl.1Adv': [-30, 80],
    'Cyl.2Adv': [-30, 80],
    'Cyl.3Adv': [-30, 80],
    'Cyl.4Adv': [-30, 80],
    'Cyl.1AdvCorr': [-30, 30],
    'Cyl.2AdvCorr': [-30, 30],
    'Cyl.3AdvCorr': [-30, 30],
    'Cyl.4AdvCorr': [-30, 30],
    TorqAirFlow: [-10, 150],
    TorqAirFlowInstr: [-10, 150],
    TorqIgnAdv: [-10, 150],
    TorqIgnAdvInstr: [-10, 150],
    TorqLost: [0, 100],
    KnockSensor: [0, 10000],
    KnockSensorThr: [0, 10000],
    AccelPedalPos: [0, 100],
    InputSpeed: [0, 9000],
    GearOil: [-40, 200],
    EngTorque: [-1000, 2000],
    SPORT: [0, 1],
    SNOW: [0, 1],
    GEAR_OIL: [0, 1],
    CanisterValve: [0, 100],
    UpMixCorr: [-50, 50],
    DownMixCorr: [-50, 50]
  };

  var STATUS_RANK = { skip: 0, ok: 1, info: 2, warn: 3, bad: 4 };

  function sanitize(name, value) {
    if (value === null || value === undefined || !Number.isFinite(value)) return null;
    var limit = LIMITS[name];
    if (limit && (value < limit[0] || value > limit[1])) return null;
    return value;
  }

  function makeContext(dataset) {
    return {
      dataset: dataset,
      n: dataset.rows.length,
      cache: {},
      ts: dataset.x ? dataset.x.map(function (date) { return date ? date.getTime() : null; }) : []
    };
  }

  function series(ctx, name) {
    if (Object.prototype.hasOwnProperty.call(ctx.cache, name)) return ctx.cache[name];
    var channel = ctx.dataset.channelsByName && ctx.dataset.channelsByName[name];
    var values = channel ? channel.values.map(function (value) { return sanitize(name, value); }) : null;
    ctx.cache[name] = values;
    return values;
  }

  function textSeries(ctx, name) {
    var index = ctx.dataset.headers ? ctx.dataset.headers.indexOf(name) : -1;
    if (index === -1) return null;
    return ctx.dataset.rows.map(function (row) {
      var value = row[index];
      return value === null || value === undefined ? '' : String(value).trim();
    });
  }

  function pair(ctx, first, second, filter) {
    var a = series(ctx, first);
    var b = series(ctx, second);
    var result = { x: [], y: [], idx: [], ts: [] };
    if (!a || !b) return result;
    for (var i = 0; i < ctx.n; i++) {
      if (a[i] === null || b[i] === null) continue;
      if (filter && !filter(i)) continue;
      result.x.push(a[i]);
      result.y.push(b[i]);
      result.idx.push(i);
      result.ts.push(ctx.ts[i]);
    }
    return result;
  }

  function filteredValues(ctx, name, filter) {
    var values = series(ctx, name);
    var result = [];
    if (!values) return result;
    for (var i = 0; i < ctx.n; i++) {
      if (values[i] === null) continue;
      if (filter && !filter(i)) continue;
      result.push(values[i]);
    }
    return result;
  }

  function finiteValues(values) {
    var result = [];
    if (!values) return result;
    for (var i = 0; i < values.length; i++) {
      if (values[i] !== null && values[i] !== undefined && Number.isFinite(values[i])) result.push(values[i]);
    }
    return result;
  }

  function minOf(values) {
    var result = null;
    for (var i = 0; i < values.length; i++) {
      if (result === null || values[i] < result) result = values[i];
    }
    return result;
  }

  function maxOf(values) {
    var result = null;
    for (var i = 0; i < values.length; i++) {
      if (result === null || values[i] > result) result = values[i];
    }
    return result;
  }

  function sumOf(values) {
    var sum = 0;
    for (var i = 0; i < values.length; i++) sum += values[i];
    return sum;
  }

  function mean(values) {
    return values.length ? sumOf(values) / values.length : null;
  }

  function median(values) {
    if (!values.length) return null;
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function quantile(values, probability) {
    if (!values.length) return null;
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var position = (sorted.length - 1) * probability;
    var base = Math.floor(position);
    var rest = position - base;
    if (sorted[base + 1] === undefined) return sorted[base];
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }

  function stdev(values) {
    if (values.length < 2) return null;
    var average = mean(values);
    var sum = 0;
    for (var i = 0; i < values.length; i++) {
      var d = values[i] - average;
      sum += d * d;
    }
    return Math.sqrt(sum / values.length);
  }

  function ranks(values) {
    var order = [];
    var result = new Array(values.length);
    var i;
    for (i = 0; i < values.length; i++) order.push(i);
    order.sort(function (a, b) { return values[a] - values[b]; });
    i = 0;
    while (i < order.length) {
      var j = i;
      while (j + 1 < order.length && values[order[j + 1]] === values[order[i]]) j++;
      var rank = (i + j) / 2 + 1;
      for (var k = i; k <= j; k++) result[order[k]] = rank;
      i = j + 1;
    }
    return result;
  }

  function pearson(x, y) {
    var n = Math.min(x.length, y.length);
    if (n < 5) return null;
    var mx = 0;
    var my = 0;
    var i;
    for (i = 0; i < n; i++) { mx += x[i]; my += y[i]; }
    mx /= n;
    my /= n;
    var vx = 0;
    var vy = 0;
    var covariance = 0;
    for (i = 0; i < n; i++) {
      var dx = x[i] - mx;
      var dy = y[i] - my;
      vx += dx * dx;
      vy += dy * dy;
      covariance += dx * dy;
    }
    if (vx === 0 || vy === 0) return null;
    return covariance / Math.sqrt(vx * vy);
  }

  function spearman(x, y) {
    var n = Math.min(x.length, y.length);
    if (n < 5) return null;
    return pearson(ranks(x.slice(0, n)), ranks(y.slice(0, n)));
  }

  function corrPair(ctx, first, second, filter) {
    var data = pair(ctx, first, second, filter);
    if (data.x.length < 5) return null;
    return { rho: spearman(data.x, data.y), n: data.x.length };
  }

  function fmt(value, digits) {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    return value.toLocaleString('ru-RU', { maximumFractionDigits: digits === undefined ? 2 : digits });
  }

  function fmtRange(values, digits, unit) {
    if (!values.length) return '—';
    return fmt(minOf(values), digits) + '–' + fmt(maxOf(values), digits) + (unit ? ' ' + unit : '');
  }

  function fmtDuration(ms) {
    if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—';
    var total = Math.round(ms / 1000);
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    if (h > 0) return h + ' ч ' + m + ' мин';
    if (m > 0) return m + ' мин ' + s + ' с';
    return s + ' с';
  }

  function fmtBar(millibar) {
    if (millibar === null || millibar === undefined || !Number.isFinite(millibar)) return '—';
    return fmt(millibar / 1000, 2) + ' бар';
  }

  function fmtBarPlain(value) {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    return fmt(value, 2) + ' бар';
  }

  function fmtPercent(value) {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    return fmt(value, 1) + ' %';
  }

  function resultItem(id, title, status, summary, details, channels) {
    return {
      id: id,
      title: title,
      status: status,
      summary: summary,
      details: details || [],
      channels: channels || []
    };
  }

  function skipItem(id, title, channels) {
    return resultItem(
      id,
      title,
      'skip',
      'Нет необходимых каналов для этой проверки.',
      [{ label: 'Нужные каналы', value: channels.join(', ') }],
      channels
    );
  }

  function worstStatus(statuses) {
    var worst = 'skip';
    statuses.forEach(function (status) {
      if (STATUS_RANK[status] > STATUS_RANK[worst]) worst = status;
    });
    return worst;
  }

  function detail(label, value) {
    return { label: label, value: value };
  }

  function checkValveLift(ctx) {
    var demand = series(ctx, 'ValveLiftInstr');
    var actual = series(ctx, 'ValveLift');
    var airName = series(ctx, 'AirFlow') ? 'AirFlow' : (series(ctx, 'AirFlowInstr') ? 'AirFlowInstr' : null);
    if (!demand && !actual) return skipItem('valve-lift', 'Подъём клапанов', ['ValveLiftInstr', 'ValveLift']);

    var details = [];
    var status = 'ok';
    var notes = [];

    if (demand && actual) {
      var data = pair(ctx, 'ValveLiftInstr', 'ValveLift');
      if (data.x.length >= 20) {
        var errors = data.y.map(function (value, index) { return Math.abs(value - data.x[index]); });
        var medError = median(errors);
        var p95Error = quantile(errors, 0.95);
        var maxError = maxOf(errors);
        var actualValues = finiteValues(actual);
        var actualRange = (maxOf(actualValues) || 0) - (minOf(actualValues) || 0);
        var tolerance = Math.max(0.25, actualRange * 0.08);
        details.push(detail('Средняя |ошибка|', fmt(medError, 2) + ' мм'));
        details.push(detail('p95 |ошибка|', fmt(p95Error, 2) + ' мм'));
        details.push(detail('Макс. |ошибка|', fmt(maxError, 2) + ' мм'));
        details.push(detail('Диапазон подъёма', fmtRange(actualValues, 2, 'мм')));
        if (p95Error > tolerance * 3) {
          status = 'bad';
          notes.push('фактический подъём заметно отстаёт от задания');
        } else if (p95Error > tolerance) {
          status = 'warn';
          notes.push('есть отклонение фактического подъёма от задания');
        } else {
          notes.push('задание и фактический подъём согласованы');
        }
      } else {
        status = 'info';
        notes.push('слишком мало данных для оценки tracking error');
      }
    } else {
      status = 'info';
      notes.push('есть только один из каналов подъёма клапанов');
    }

    if (actual && airName) {
      var liftAir = corrPair(ctx, 'ValveLift', airName);
      if (liftAir) {
        details.push(detail('Связь подъём ↔ расход', fmt(liftAir.rho, 2) + ' (n=' + liftAir.n + ')'));
        if (liftAir.rho < 0.35 && status === 'ok') status = 'info';
        if (liftAir.rho < 0.35) notes.push('слабая связь подъёма с расходом воздуха');
      }
    }

    if (series(ctx, 'ValveMotor') && airName) {
      var motorAir = corrPair(ctx, 'ValveMotor', airName);
      if (motorAir) details.push(detail('Связь привод ↔ расход', fmt(motorAir.rho, 2) + ' (n=' + motorAir.n + ')'));
    }

    var summary;
    if (status === 'ok') summary = 'Контур подъёма клапанов отрабатывает задание, связь с наполнением есть.';
    else if (status === 'info') summary = 'Данных достаточно только для справочной оценки подъёма клапанов.';
    else summary = 'Есть расхождение в контуре управления подъёмом клапанов.';
    return resultItem('valve-lift', 'Подъём клапанов / Valvetronic', status, summary + ' ' + notes.join('; ') + '.', details, ['ValveLiftInstr', 'ValveLift', 'ValveMotor', airName].filter(Boolean));
  }

  function checkCamPhasers(ctx) {
    var specs = [
      { name: 'Впуск', demand: 'InCamDephaserInstr', actual: 'InCamDephaser' },
      { name: 'Выпуск', demand: 'ExCamDephaserInstr', actual: 'ExCamDephaser' }
    ];
    var details = [];
    var statuses = [];
    var used = [];
    var missing = [];

    specs.forEach(function (spec) {
      var demand = series(ctx, spec.demand);
      var actual = series(ctx, spec.actual);
      if (!demand || !actual) {
        missing.push(spec.demand + '/' + spec.actual);
        return;
      }
      used.push(spec.demand, spec.actual);
      var data = pair(ctx, spec.demand, spec.actual);
      if (data.x.length < 20) {
        statuses.push('info');
        details.push(detail(spec.name + ': данных', 'мало (n=' + data.x.length + ')'));
        return;
      }
      var errors = data.y.map(function (value, index) { return Math.abs(value - data.x[index]); });
      var p95Error = quantile(errors, 0.95);
      var maxError = maxOf(errors);
      var rho = spearman(data.x, data.y);
      var partStatus = p95Error <= 10 ? 'ok' : (p95Error <= 20 ? 'warn' : 'bad');
      if (rho !== null && rho < 0.5 && partStatus === 'ok') partStatus = 'warn';
      statuses.push(partStatus);
      details.push(detail(spec.name + ': p95 |ошибка|', fmt(p95Error, 1) + '°'));
      details.push(detail(spec.name + ': макс. |ошибка|', fmt(maxError, 1) + '°'));
      details.push(detail(spec.name + ': корреляция', rho === null ? '—' : fmt(rho, 2)));
    });

    if (!statuses.length) return skipItem('cam-phasers', 'Фазовращатели', ['InCamDephaserInstr', 'InCamDephaser', 'ExCamDephaserInstr', 'ExCamDephaser']);
    if (missing.length) details.push(detail('Нет каналов', missing.join(', ')));
    var status = worstStatus(statuses);
    var summary;
    if (status === 'bad') summary = 'Есть устойчивое расхождение заданных и фактических углов фазовращателей.';
    else if (status === 'warn') summary = 'Есть отклонения или запаздывание фазовращателей относительно задания.';
    else if (status === 'info') summary = 'Недостаточно данных для надёжной оценки фазовращателей.';
    else summary = 'Фазовращатели впуска и выпуска отслеживают задание.';
    return resultItem('cam-phasers', 'Фазовращатели', status, summary, details, used);
  }

  function checkTorqueModel(ctx) {
    var specs = [
      { name: 'Момент по расходу', demand: 'TorqAirFlowInstr', actual: 'TorqAirFlow' },
      { name: 'Момент по УОЗ', demand: 'TorqIgnAdvInstr', actual: 'TorqIgnAdv' }
    ];
    var details = [];
    var statuses = [];
    var used = [];

    specs.forEach(function (spec) {
      if (!series(ctx, spec.demand) || !series(ctx, spec.actual)) return;
      used.push(spec.demand, spec.actual);
      var data = pair(ctx, spec.demand, spec.actual);
      if (data.x.length < 20) {
        statuses.push('info');
        details.push(detail(spec.name + ': данных', 'мало (n=' + data.x.length + ')'));
        return;
      }
      var errors = data.y.map(function (value, index) { return Math.abs(value - data.x[index]); });
      var p95Error = quantile(errors, 0.95);
      var range = (maxOf(data.y) || 0) - (minOf(data.y) || 0);
      var tolerance = Math.max(3, range * 0.15);
      var rho = spearman(data.x, data.y);
      var partStatus = p95Error <= tolerance ? 'ok' : (p95Error <= tolerance * 2 ? 'warn' : 'bad');
      if (rho !== null && rho < 0.5 && partStatus === 'ok') partStatus = 'warn';
      statuses.push(partStatus);
      details.push(detail(spec.name + ': p95 |ошибка|', fmt(p95Error, 1)));
      details.push(detail(spec.name + ': корреляция', rho === null ? '—' : fmt(rho, 2)));
    });

    if (series(ctx, 'TorqLost')) {
      var lost = finiteValues(series(ctx, 'TorqLost'));
      if (lost.length) {
        details.push(detail('Потеря момента: медиана', fmt(median(lost), 1)));
        details.push(detail('Потеря момента: диапазон', fmtRange(lost, 1)));
      }
    }

    if (!statuses.length) return skipItem('torque-model', 'Модель крутящего момента', ['TorqAirFlowInstr', 'TorqAirFlow', 'TorqIgnAdvInstr', 'TorqIgnAdv']);
    var status = worstStatus(statuses);
    var summary = status === 'ok'
      ? 'Заданный и фактический момент по воздуху и УОЗ согласованы.'
      : (status === 'info' ? 'Недостаточно данных для полной оценки модели момента.' : 'Есть расхождение в модели крутящего момента.');
    return resultItem('torque-model', 'Модель крутящего момента', status, summary, details, used);
  }

  function checkAirCharge(ctx) {
    var airName = series(ctx, 'AirFlow') ? 'AirFlow' : (series(ctx, 'AirFlowInstr') ? 'AirFlowInstr' : null);
    if (!airName) return skipItem('air-charge', 'Наполнение воздухом', ['AirFlow', 'AirFlowInstr']);
    var speed = series(ctx, 'Speed');
    var revs = series(ctx, 'Revs');
    var driving = function (i) {
      return speed && revs && speed[i] !== null && revs[i] !== null && speed[i] > 5 && revs[i] > 900;
    };
    var specs = [
      { name: 'Расход ↔ обороты', other: 'Revs', primary: true },
      { name: 'Расход ↔ педаль', other: 'AccelPedalPos', primary: true },
      { name: 'Расход ↔ подъём клапанов', other: 'ValveLift', primary: true },
      { name: 'Расход ↔ давление во впуске', other: 'AirManifold', primary: false }
    ];
    var details = [];
    var primary = [];
    var used = [airName];

    specs.forEach(function (spec) {
      if (!series(ctx, spec.other)) return;
      used.push(spec.other);
      var data = pair(ctx, airName, spec.other, driving);
      if (data.x.length < 30) data = pair(ctx, airName, spec.other);
      if (data.x.length < 5) {
        details.push(detail(spec.name, 'мало данных'));
        return;
      }
      var rho = spearman(data.x, data.y);
      details.push(detail(spec.name, rho === null ? '—' : fmt(rho, 2) + ' (n=' + data.x.length + ')'));
      if (spec.primary && rho !== null) primary.push(rho);
    });

    if (!primary.length) {
      return resultItem('air-charge', 'Наполнение воздухом', 'info', 'Недостаточно каналов для оценки связей расхода воздуха.', details, used);
    }
    var minRho = Math.min.apply(null, primary);
    var status = minRho >= 0.4 ? 'ok' : (minRho >= 0.2 ? 'info' : 'warn');
    var summary;
    if (status === 'ok') summary = 'Расход воздуха согласован с оборотами, педалью и положением клапанов.';
    else if (status === 'info') summary = 'Связи расхода воздуха выражены слабее ожидаемого, но данных для вывода мало.';
    else summary = 'Слабая связь расхода воздуха с основными факторами наполнения.';
    details.push(detail('Минимальная основная корреляция', fmt(minRho, 2)));
    return resultItem('air-charge', 'Наполнение воздухом', status, summary, details, used);
  }

  function trimStats(ctx, name) {
    var values = finiteValues(series(ctx, name));
    if (!values.length) return null;
    var outside10 = 0;
    var outside15 = 0;
    values.forEach(function (value) {
      if (Math.abs(value) > 10) outside10++;
      if (Math.abs(value) > 15) outside15++;
    });
    return {
      n: values.length,
      median: median(values),
      p5: quantile(values, 0.05),
      p95: quantile(values, 0.95),
      outside10: outside10,
      outside15: outside15,
      outside10Share: outside10 / values.length * 100,
      outside15Share: outside15 / values.length * 100
    };
  }

  function checkInjection(ctx) {
    var injNames = ['Inj.1Time', 'Inj.2Time', 'Inj.3Time', 'Inj.4Time'].filter(function (name) { return series(ctx, name); });
    if (!injNames.length) return skipItem('injection', 'Впрыск и топливные коррекции', ['Inj.1Time', 'Inj.2Time', 'Inj.3Time', 'Inj.4Time']);
    var airName = series(ctx, 'AirFlow') ? 'AirFlow' : (series(ctx, 'AirFlowInstr') ? 'AirFlowInstr' : null);
    var speed = series(ctx, 'Speed');
    var revs = series(ctx, 'Revs');
    var driving = function (i) {
      return speed && revs && speed[i] !== null && revs[i] !== null && speed[i] > 5 && revs[i] > 900;
    };
    var details = [];
    var status = 'ok';
    var used = injNames.slice();

    if (airName) {
      used.push(airName);
      var data = pair(ctx, injNames[0], airName, driving);
      if (data.x.length < 30) data = pair(ctx, injNames[0], airName);
      var rho = data.x.length >= 5 ? spearman(data.x, data.y) : null;
      details.push(detail('Впрыск ↔ расход воздуха', rho === null ? '—' : fmt(rho, 2) + ' (n=' + data.x.length + ')'));
      if (rho !== null && rho < 0.35) status = 'warn';
    }

    var up = trimStats(ctx, 'UpMixCorr');
    var down = trimStats(ctx, 'DownMixCorr');
    if (up) {
      used.push('UpMixCorr');
      details.push(detail('Верхняя коррекция: медиана', fmtPercent(up.median)));
      details.push(detail('Верхняя коррекция: p5–p95', fmt(up.p5, 1) + '…' + fmt(up.p95, 1) + ' %'));
      details.push(detail('Вне ±10 % / ±15 %', fmt(up.outside10Share, 1) + ' % / ' + fmt(up.outside15Share, 1) + ' %'));
      if (up.outside15Share > 20) status = 'bad';
      else if (up.outside15Share > 5 || Math.abs(up.median) > 10) status = status === 'bad' ? 'bad' : 'warn';
    }
    if (down) {
      used.push('DownMixCorr');
      details.push(detail('Нижняя коррекция: медиана', fmtPercent(down.median)));
    }

    if (series(ctx, 'CanisterValve')) {
      used.push('CanisterValve');
      var canisterUp = corrPair(ctx, 'CanisterValve', 'UpMixCorr');
      var canisterDown = corrPair(ctx, 'CanisterValve', 'DownMixCorr');
      if (canisterUp) details.push(detail('Адсорбер ↔ верхняя коррекция', fmt(canisterUp.rho, 2)));
      if (canisterDown) details.push(detail('Адсорбер ↔ нижняя коррекция', fmt(canisterDown.rho, 2)));
    }

    if (injNames.length > 1) {
      var spreads = [];
      for (var i = 0; i < ctx.n; i++) {
        var values = [];
        injNames.forEach(function (name) {
          var value = series(ctx, name)[i];
          if (value !== null && value !== undefined) values.push(value);
        });
        if (values.length >= 2) spreads.push(maxOf(values) - minOf(values));
      }
      if (spreads.length) {
        var spreadP95 = quantile(spreads, 0.95);
        details.push(detail('Разброс впрыска по цилиндрам p95', fmt(spreadP95, 2) + ' мс'));
        if (spreadP95 > 0.5 && status === 'ok') status = 'warn';
      }
    }

    var summary;
    if (status === 'ok') summary = 'Впрыск и топливные коррекции согласованы с нагрузкой.';
    else if (status === 'info') summary = 'Недостаточно данных для полной оценки смеси.';
    else if (status === 'warn') summary = 'Есть отклонения впрыска или топливных коррекций.';
    else summary = 'Выраженное отклонение топливных коррекций, требуется проверка смеси.';
    return resultItem('injection', 'Впрыск и топливные коррекции', status, summary, details, used);
  }

  function checkOxygen(ctx) {
    var up = series(ctx, 'UpO2Volt');
    var down = series(ctx, 'DownO2Volt');
    if (!up || !down) return skipItem('oxygen', 'Лямбда-регулирование и катализатор', ['UpO2Volt', 'DownO2Volt']);
    var coolant = series(ctx, 'Coolant');
    var warm = function (i) {
      return !coolant || (coolant[i] !== null && coolant[i] > 60);
    };
    var data = pair(ctx, 'UpO2Volt', 'DownO2Volt', warm);
    if (data.x.length < 20) data = pair(ctx, 'UpO2Volt', 'DownO2Volt');
    if (data.x.length < 20) {
      return resultItem('oxygen', 'Лямбда-регулирование и катализатор', 'info', 'Мало данных O2 для оценки катализатора.', [], ['UpO2Volt', 'DownO2Volt']);
    }
    var upValues = data.x;
    var downValues = data.y;
    var upSd = stdev(upValues);
    var downSd = stdev(downValues);
    var ratio = upSd ? downSd / upSd : null;
    var details = [
      detail('Верхний O2: медиана', fmt(median(upValues), 0)),
      detail('Нижний O2: медиана', fmt(median(downValues), 0)),
      detail('Разброс верхний / нижний', fmt(upSd, 1) + ' / ' + fmt(downSd, 1)),
      detail('Отношение разброса нижний/верхний', ratio === null ? '—' : fmt(ratio, 2) + ' (n=' + data.x.length + ')')
    ];
    if (data.x.length >= 5) details.push(detail('Корреляция верхний ↔ нижний', fmt(spearman(data.x, data.y), 2)));

    var status = 'ok';
    if (ratio !== null && ratio >= 0.85) status = 'warn';
    else if (ratio !== null && ratio >= 0.65) status = 'info';
    if (upSd !== null && upSd < 30 && status === 'ok') status = 'info';

    var summary;
    if (status === 'ok') summary = 'Активность заднего датчика O2 ниже переднего, признаков деградации катализатора нет.';
    else if (status === 'info') summary = 'Повышенная активность заднего датчика O2; оценка ориентировочная без надёжного флага замкнутого контура.';
    else summary = 'Задний датчик O2 почти повторяет передний — стоит проверить катализатор и датчик.';
    return resultItem('oxygen', 'Лямбда-регулирование и катализатор', status, summary, details, ['UpO2Volt', 'DownO2Volt']);
  }

  function checkIgnition(ctx) {
    var corrNames = ['Cyl.1AdvCorr', 'Cyl.2AdvCorr', 'Cyl.3AdvCorr', 'Cyl.4AdvCorr'].filter(function (name) { return series(ctx, name); });
    var advNames = ['Cyl.1Adv', 'Cyl.2Adv', 'Cyl.3Adv', 'Cyl.4Adv'].filter(function (name) { return series(ctx, name); });
    if (!corrNames.length && !advNames.length) return skipItem('ignition', 'Зажигание и детонация', ['Cyl.*Adv', 'Cyl.*AdvCorr']);
    var details = [];
    var used = corrNames.concat(advNames);
    var status = 'ok';

    if (corrNames.length) {
      var allCorrections = [];
      var perCylinder = [];
      corrNames.forEach(function (name) {
        var values = finiteValues(series(ctx, name));
        allCorrections = allCorrections.concat(values);
        if (values.length) perCylinder.push(name.replace('Cyl.', '').replace('AdvCorr', '') + ': ' + fmt(minOf(values), 1) + '…' + fmt(maxOf(values), 1) + '°');
      });
      if (allCorrections.length) {
        var minCorrection = minOf(allCorrections);
        var below3 = allCorrections.filter(function (value) { return value < -3; }).length;
        var below3Share = below3 / allCorrections.length * 100;
        details.push(detail('Мин. коррекция УОЗ', fmt(minCorrection, 1) + '°'));
        details.push(detail('Доля коррекций < -3°', fmtPercent(below3Share)));
        details.push(detail('Диапазон по цилиндрам', perCylinder.join('; ')));
        if (minCorrection < -15 || below3Share > 10) status = 'bad';
        else if (minCorrection < -8 || below3Share > 3) status = 'warn';
        else if (minCorrection < -2) status = 'info';
      }
    }

    if (advNames.length > 1) {
      var spreads = [];
      for (var i = 0; i < ctx.n; i++) {
        var values = [];
        advNames.forEach(function (name) {
          var value = series(ctx, name)[i];
          if (value !== null && value !== undefined) values.push(value);
        });
        if (values.length >= 2) spreads.push(maxOf(values) - minOf(values));
      }
      if (spreads.length) {
        var spreadP95 = quantile(spreads, 0.95);
        details.push(detail('Разброс УОЗ по цилиндрам p95', fmt(spreadP95, 1) + '°'));
        if (spreadP95 > 8 && STATUS_RANK[status] < STATUS_RANK.warn) status = 'warn';
      }
    }

    if (series(ctx, 'KnockSensor') && series(ctx, 'KnockSensorThr')) {
      used.push('KnockSensor', 'KnockSensorThr');
      var knock = pair(ctx, 'KnockSensor', 'KnockSensorThr');
      var above = 0;
      for (var k = 0; k < knock.x.length; k++) if (knock.x[k] > knock.y[k]) above++;
      details.push(detail('Детонация: выше порога', above + ' из ' + knock.x.length));
      if (above > 0) details.push(detail('Доля выше порога', fmtPercent(above / knock.x.length * 100)));
    }

    var summary;
    if (status === 'ok') summary = 'Коррекции УОЗ в норме, заметного разброса по цилиндрам нет.';
    else if (status === 'info') summary = 'Есть кратковременные отрицательные коррекции УОЗ — вероятна реакция на детонацию или топливо.';
    else if (status === 'warn') summary = 'Есть заметные коррекции УОЗ или разброс по цилиндрам.';
    else summary = 'Сильные коррекции УОЗ, требуется проверить детонацию и цилиндры.';
    return resultItem('ignition', 'Зажигание и детонация', status, summary, details, used);
  }

  function checkOil(ctx) {
    var press = series(ctx, 'OilPress');
    var target = series(ctx, 'OilPressInstr');
    if (!press && !target) return skipItem('oil', 'Давление масла', ['OilPress', 'OilPressInstr', 'OilPumpValve', 'OilTemp']);
    var speed = series(ctx, 'Speed');
    var revs = series(ctx, 'Revs');
    var oilTemp = series(ctx, 'OilTemp');
    var coolant = series(ctx, 'Coolant');
    var details = [];
    var status = 'ok';
    var used = ['OilPress', 'OilPressInstr'].filter(function (name) { return series(ctx, name); });

    var warmIdle = function (i) {
      if (!speed || !revs || speed[i] === null || revs[i] === null || speed[i] >= 2 || revs[i] < 600 || revs[i] > 1000) return false;
      if (oilTemp) return oilTemp[i] !== null && oilTemp[i] >= 60;
      if (coolant) return coolant[i] !== null && coolant[i] >= 80;
      return true;
    };

    if (press && target) {
      var warm = pair(ctx, 'OilPressInstr', 'OilPress', warmIdle);
      if (warm.x.length >= 20) {
        var differences = warm.y.map(function (value, index) { return value - warm.x[index]; });
        var medDifference = median(differences);
        var p95Difference = quantile(differences.map(function (value) { return Math.abs(value); }), 0.95);
        details.push(detail('Прогретый ХХ: фактическое', fmtBar(median(warm.y))));
        details.push(detail('Прогретый ХХ: заданное', fmtBar(median(warm.x))));
        details.push(detail('Прогретый ХХ: разница', (medDifference >= 0 ? '+' : '') + fmtBar(medDifference)));
        details.push(detail('Прогретый ХХ: p95 |разница|', fmtBar(p95Difference)));
        if (Math.abs(medDifference) > 1000 || p95Difference > 2500) status = 'bad';
        else if (Math.abs(medDifference) > 500 || p95Difference > 1500) status = 'warn';
      } else {
        status = 'info';
        details.push(detail('Прогретый ХХ', 'мало данных (n=' + warm.x.length + ')'));
      }
    } else {
      status = 'info';
    }

    if (series(ctx, 'OilPumpValve')) {
      used.push('OilPumpValve');
      var warmValve = filteredValues(ctx, 'OilPumpValve', warmIdle);
      if (warmValve.length) details.push(detail('Клапан насоса на прогретом ХХ', fmtPercent(median(warmValve))));
    }

    var coldIdle = function (i) {
      if (!speed || !revs || speed[i] === null || revs[i] === null || speed[i] >= 2 || revs[i] < 600 || revs[i] > 1400) return false;
      if (oilTemp && oilTemp[i] !== null) return oilTemp[i] < 30;
      if (coolant && coolant[i] !== null) return coolant[i] < 40;
      return true;
    };
    if (press) {
      var coldPress = filteredValues(ctx, 'OilPress', coldIdle);
      if (coldPress.length >= 20) details.push(detail('Холодный ХХ: давление', fmtBar(minOf(coldPress)) + '…' + fmtBar(maxOf(coldPress))));
    }
    if (target) {
      var coldTarget = filteredValues(ctx, 'OilPressInstr', coldIdle);
      if (coldTarget.length >= 20) details.push(detail('Холодный ХХ: задание', fmtBar(minOf(coldTarget)) + '…' + fmtBar(maxOf(coldTarget))));
    }
    if (series(ctx, 'OilPumpValve')) {
      var coldValve = filteredValues(ctx, 'OilPumpValve', coldIdle);
      if (coldValve.length >= 20) details.push(detail('Клапан насоса на холодном ХХ', fmtPercent(median(coldValve))));
    }

    if (press) {
      if (series(ctx, 'Revs')) {
        var revCorr = corrPair(ctx, 'OilPress', 'Revs');
        if (revCorr) details.push(detail('Давление ↔ обороты', fmt(revCorr.rho, 2)));
      }
      if (series(ctx, 'OilTemp')) {
        used.push('OilTemp');
        var tempCorr = corrPair(ctx, 'OilPress', 'OilTemp');
        if (tempCorr) details.push(detail('Давление ↔ температура масла', fmt(tempCorr.rho, 2)));
      }
      if (series(ctx, 'OilPumpValve')) {
        var valveCorr = corrPair(ctx, 'OilPress', 'OilPumpValve');
        if (valveCorr) details.push(detail('Давление ↔ клапан насоса', fmt(valveCorr.rho, 2)));
      }
    }

    var summary;
    if (status === 'bad') summary = 'На прогретом ХХ фактическое давление масла существенно выше заданного — вероятен клапан/регулятор давления.';
    else if (status === 'warn') summary = 'Есть отклонение фактического давления масла от заданного.';
    else if (status === 'info') summary = 'Недостаточно данных для надёжной оценки давления масла.';
    else summary = 'Фактическое давление масла согласовано с заданием.';
    return resultItem('oil', 'Давление масла', status, summary, details, used);
  }

  function maxConsecutive(values, predicate) {
    var best = 0;
    var current = 0;
    for (var i = 0; i < values.length; i++) {
      if (predicate(values[i])) {
        current++;
        if (current > best) best = current;
      } else {
        current = 0;
      }
    }
    return best;
  }

  function checkCooling(ctx) {
    var coolant = series(ctx, 'Coolant');
    if (!coolant) return skipItem('cooling', 'Охлаждение', ['Coolant', 'ECUtemp', 'ExternalTemp']);
    var values = finiteValues(coolant);
    if (!values.length) return skipItem('cooling', 'Охлаждение', ['Coolant']);
    var maxCoolant = maxOf(values);
    var atLimit = values.filter(function (value) { return value >= 105; }).length;
    var sustained = maxConsecutive(coolant, function (value) { return value !== null && value >= 105; });
    var stepMs = ctx.dataset.stepMs || 500;
    var details = [
      detail('Максимум ОЖ', fmt(maxCoolant, 1) + ' °C'),
      detail('Отсчётов ≥ 105 °C', atLimit + ' (' + fmtDuration(sustained * stepMs) + ' подряд)')
    ];
    var status = 'ok';

    var start = -1;
    for (var i = 0; i < ctx.n; i++) {
      if (coolant[i] !== null && coolant[i] < 60) { start = i; break; }
    }
    if (start !== -1) {
      var finish = -1;
      for (var j = start + 1; j < ctx.n; j++) {
        if (coolant[j] !== null && coolant[j] >= 80) { finish = j; break; }
      }
      if (finish !== -1) {
        var warmupMs = ctx.ts[finish] - ctx.ts[start];
        details.push(detail('Прогрев до 80 °C', fmtDuration(warmupMs)));
        if (warmupMs > 25 * 60 * 1000) status = 'warn';
        else if (warmupMs > 15 * 60 * 1000) status = 'info';
      } else {
        details.push(detail('Прогрев до 80 °C', 'не достигнут'));
        if (status === 'ok') status = 'warn';
      }
    } else {
      details.push(detail('Холодный пуск', 'в логе нет'));
    }

    if (series(ctx, 'ECUtemp')) {
      var ecuCorr = corrPair(ctx, 'Coolant', 'ECUtemp');
      if (ecuCorr) details.push(detail('ОЖ ↔ температура ЭБУ', fmt(ecuCorr.rho, 2)));
    }
    if (series(ctx, 'ExternalTemp')) {
      var ambientCorr = corrPair(ctx, 'Coolant', 'ExternalTemp');
      if (ambientCorr) details.push(detail('ОЖ ↔ внешняя температура', fmt(ambientCorr.rho, 2)));
    }
    if (series(ctx, 'Revs')) {
      var revCorr = corrPair(ctx, 'Coolant', 'Revs');
      if (revCorr) details.push(detail('ОЖ ↔ обороты', fmt(revCorr.rho, 2)));
    }

    if (maxCoolant >= 115 || sustained * stepMs >= 30000) status = 'bad';
    else if (maxCoolant >= 105 && sustained * stepMs >= 5000) status = 'warn';

    var summary;
    if (status === 'bad') summary = 'Охлаждающая жидкость достигает опасной температуры или долго держится выше 105 °C.';
    else if (status === 'warn') summary = 'Есть заметный нагрев ОЖ или длительное удержание около 105 °C.';
    else if (status === 'info') summary = 'Температура ОЖ в норме, но прогрев медленный — стоит оценить термостат и нагрузку.';
    else summary = 'Температура охлаждающей жидкости в рабочем диапазоне.';
    return resultItem('cooling', 'Охлаждение', status, summary, details, ['Coolant', 'ECUtemp', 'ExternalTemp', 'Revs']);
  }

  function checkElectrical(ctx) {
    var battery = series(ctx, 'Battery');
    if (!battery) return skipItem('electrical', 'Электрика и заряд', ['Battery', 'AlternatorCharge', 'AlternatorCurrent', 'AlternatorTemp']);
    var revs = series(ctx, 'Revs');
    var running = function (i) {
      return !revs || (revs[i] !== null && revs[i] > 500);
    };
    var values = filteredValues(ctx, 'Battery', running);
    if (values.length < 20) values = finiteValues(battery);
    if (!values.length) return skipItem('electrical', 'Электрика и заряд', ['Battery']);
    var minBattery = minOf(values);
    var medianBattery = median(values);
    var maxBattery = maxOf(values);
    var below132 = values.filter(function (value) { return value < 13.2; }).length;
    var belowShare = below132 / values.length * 100;
    var details = [
      detail('Напряжение АКБ', fmt(minBattery, 2) + '–' + fmt(maxBattery, 2) + ' В'),
      detail('Медиана напряжения', fmt(medianBattery, 2) + ' В'),
      detail('Ниже 13,2 В', fmtPercent(belowShare))
    ];
    var status = 'ok';
    if (medianBattery < 12.5) status = 'bad';
    else if (medianBattery < 13.2 || belowShare > 10) status = 'warn';
    else if (belowShare > 0.5) status = 'info';

    if (series(ctx, 'AlternatorCharge')) {
      var charge = finiteValues(series(ctx, 'AlternatorCharge'));
      if (charge.length) details.push(detail('Заряд генератора', fmt(median(charge), 1) + ' % (медиана)'));
    }
    if (series(ctx, 'AlternatorCurrent')) {
      var current = finiteValues(series(ctx, 'AlternatorCurrent'));
      if (current.length) details.push(detail('Ток генератора', fmt(median(current), 1) + ' А (медиана)'));
    }
    if (series(ctx, 'AlternatorTemp')) {
      var altTemp = finiteValues(series(ctx, 'AlternatorTemp'));
      if (altTemp.length) details.push(detail('Температура генератора', fmtRange(altTemp, 1, '°C')));
    }
    if (series(ctx, 'AlternatorCharge')) {
      var chargeCorr = corrPair(ctx, 'Battery', 'AlternatorCharge');
      if (chargeCorr) details.push(detail('АКБ ↔ заряд', fmt(chargeCorr.rho, 2)));
    }
    if (revs) {
      var revCorr = corrPair(ctx, 'Battery', 'Revs');
      if (revCorr) details.push(detail('АКБ ↔ обороты', fmt(revCorr.rho, 2)));
    }

    var summary;
    if (status === 'bad') summary = 'Напряжение АКБ ниже рабочего диапазона — проверить генератор и цепь заряда.';
    else if (status === 'warn') summary = 'Есть признаки просадки напряжения или слабого заряда.';
    else if (status === 'info') summary = 'Кратковременные просадки напряжения, в целом заряд стабилен.';
    else summary = 'Напряжение АКБ и заряд генератора в норме.';
    return resultItem('electrical', 'Электрика и заряд', status, summary, details, ['Battery', 'AlternatorCharge', 'AlternatorCurrent', 'AlternatorTemp', 'Revs']);
  }

  function checkDriveline(ctx) {
    var speed = series(ctx, 'Speed');
    var revs = series(ctx, 'Revs');
    if (!speed || !revs) return skipItem('driveline', 'Трансмиссия и динамика', ['Speed', 'Revs', 'Gear']);
    var gearColumn = ctx.dataset.gearColumn;
    var byGear = {};
    for (var i = 0; i < ctx.n; i++) {
      if (speed[i] === null || revs[i] === null || speed[i] <= 20) continue;
      var gear = gearColumn ? gearColumn[i] : '—';
      if (!byGear[gear]) byGear[gear] = [];
      byGear[gear].push(revs[i] / speed[i]);
    }
    var details = [];
    var warnGears = [];
    var autoOnly = true;
    Object.keys(byGear).forEach(function (gear) {
      var values = byGear[gear];
      if (values.length < 20) return;
      var gearMedian = median(values);
      var low = quantile(values, 0.05);
      var high = quantile(values, 0.95);
      var outliers = values.filter(function (value) {
        return gearMedian && Math.abs(value - gearMedian) / gearMedian > 0.4;
      }).length;
      var outlierShare = outliers / values.length * 100;
      var manual = /^\d+$/.test(gear);
      if (manual) autoOnly = false;
      details.push(detail(
        'Передача ' + gear,
        'медиана ' + fmt(gearMedian, 1) + ', p5–p95 ' + fmt(low, 1) + '…' + fmt(high, 1) + ', выбросов ' + fmt(outlierShare, 1) + ' %'
      ));
      if (manual && values.length >= 50 && outlierShare > 10) warnGears.push(gear);
    });

    var accelSpecs = [
      { name: 'Ускорение ↔ момент по воздуху', other: 'TorqAirFlow' },
      { name: 'Ускорение ↔ момент по УОЗ', other: 'TorqIgnAdv' },
      { name: 'Ускорение ↔ педаль', other: 'AccelPedalPos' }
    ];
    var accelCorrelations = [];
    accelSpecs.forEach(function (spec) {
      var other = series(ctx, spec.other);
      if (!other) return;
      var xs = [];
      var ys = [];
      for (var k = 1; k < ctx.n - 1; k++) {
        if (speed[k - 1] === null || speed[k + 1] === null || other[k] === null) continue;
        if (ctx.ts[k - 1] === null || ctx.ts[k + 1] === null) continue;
        var dt = (ctx.ts[k + 1] - ctx.ts[k - 1]) / 1000;
        if (dt <= 0 || dt > 5) continue;
        xs.push((speed[k + 1] - speed[k - 1]) / dt);
        ys.push(other[k]);
      }
      var rho = xs.length >= 5 ? spearman(xs, ys) : null;
      if (rho !== null) {
        accelCorrelations.push(rho);
        details.push(detail(spec.name, fmt(rho, 2) + ' (n=' + xs.length + ')'));
      }
    });

    var channels = ['Speed', 'Revs', 'Gear', 'TorqAirFlow', 'TorqIgnAdv', 'AccelPedalPos'];
    var brake = series(ctx, 'BR');
    if (brake) {
      channels.push('BR');
      var brakeAccel = [];
      var freeAccel = [];
      for (var b = 1; b < ctx.n - 1; b++) {
        if (speed[b - 1] === null || speed[b + 1] === null || brake[b] === null) continue;
        if (ctx.ts[b - 1] === null || ctx.ts[b + 1] === null) continue;
        var brakeDt = (ctx.ts[b + 1] - ctx.ts[b - 1]) / 1000;
        if (brakeDt <= 0 || brakeDt > 5) continue;
        var brakeValue = (speed[b + 1] - speed[b - 1]) / brakeDt;
        if (brake[b] > 0) brakeAccel.push(brakeValue);
        else freeAccel.push(brakeValue);
      }
      if (brakeAccel.length >= 5) details.push(detail('При тормозе: среднее ускорение', fmt(mean(brakeAccel), 1) + ' км/ч/с'));
      if (freeAccel.length >= 5) details.push(detail('Без тормоза: среднее ускорение', fmt(mean(freeAccel), 1) + ' км/ч/с'));
    }

    var status = 'ok';
    if (warnGears.length) status = 'warn';
    else if (autoOnly) status = 'info';
    else if (accelCorrelations.length && Math.max.apply(null, accelCorrelations) < 0.2) status = 'info';

    var summary;
    if (status === 'warn') summary = 'Есть выбросы отношения обороты/скорость на передачах ' + warnGears.join(', ') + ' — проверить задержку сигнала передачи или сцепление.';
    else if (status === 'info') summary = autoOnly
      ? 'АКПП: отношение оборотов к скорости зависит от гидротрансформатора, выбросы по передачам не оценивались.'
      : 'Динамика и передаточные отношения без явных аномалий, но связь с моментом слабая.';
    else summary = 'Передаточные отношения и динамика согласованы с моментом и педалью.';
    return resultItem('driveline', 'Трансмиссия и динамика', status, summary, details, channels);
  }

  function isAutomaticTransmission(ctx) {
    var headers = ctx.dataset.headers || [];
    var present = function (name) { return headers.indexOf(name) !== -1; };
    var score = ['GearLever', 'InputSpeed', 'GearOil', 'OilPressInstr', 'OilPress', 'ChangingLaw', 'EngTorque']
      .filter(present).length;
    return present('GearLever') && score >= 5;
  }

  function checkAtPressure(ctx) {
    var actual = series(ctx, 'OilPress');
    var target = series(ctx, 'OilPressInstr');
    if (!actual || !target) return skipItem('at-pressure', 'Давление в АКПП', ['OilPress', 'OilPressInstr']);
    var data = pair(ctx, 'OilPressInstr', 'OilPress');
    if (data.x.length < 20) {
      return resultItem('at-pressure', 'Давление в АКПП', 'info', 'Недостаточно данных для оценки давления в АКПП.', [
        detail('Пар значений', String(data.x.length))
      ], ['OilPressInstr', 'OilPress']);
    }

    var errors = data.y.map(function (value, index) { return value - data.x[index]; });
    var absErrors = errors.map(function (value) { return Math.abs(value); });
    var medSigned = median(errors);
    var medAbs = median(absErrors);
    var p95Abs = quantile(absErrors, 0.95);
    var maxAbs = maxOf(absErrors);
    var under = errors.filter(function (value) { return value < -0.5; }).length;
    var underShare = under / errors.length * 100;
    var low = data.y.filter(function (value) { return value < 2.7; }).length;
    var lowShare = low / data.y.length * 100;
    var rho = spearman(data.x, data.y);

    var details = [
      detail('Заданное давление', fmtBarPlain(minOf(data.x)) + '…' + fmtBarPlain(maxOf(data.x))),
      detail('Фактическое давление', fmtBarPlain(minOf(data.y)) + '…' + fmtBarPlain(maxOf(data.y))),
      detail('Медиана разницы факт−задание', (medSigned >= 0 ? '+' : '') + fmtBarPlain(medSigned)),
      detail('Медиана |разницы|', fmtBarPlain(medAbs)),
      detail('p95 |разницы|', fmtBarPlain(p95Abs)),
      detail('Макс. |разница|', fmtBarPlain(maxAbs)),
      detail('Корреляция факт ↔ задание', rho === null ? '—' : fmt(rho, 2)),
      detail('Недодавление > 0,5 бар', under + ' (' + fmtPercent(underShare) + ')'),
      detail('Фактическое < 2,7 бар', low + ' (' + fmtPercent(lowShare) + ')')
    ];

    var status = 'ok';
    if (rho !== null && rho < 0.5) status = 'bad';
    else if (medAbs !== null && medAbs > 0.5) status = 'bad';
    else if (lowShare > 20) status = 'bad';
    else if (rho !== null && rho < 0.8) status = 'warn';
    else if (p95Abs !== null && p95Abs > 1.5) status = 'warn';
    else if (lowShare > 5) status = 'warn';

    var summary;
    if (status === 'bad') summary = 'Фактическое давление в АКПП плохо согласовано с заданием — проверить датчик, регулятор давления и уровень масла.';
    else if (status === 'warn') summary = 'Есть заметные отклонения или кратковременные просадки давления в АКПП.';
    else summary = 'Фактическое давление в АКПП отслеживает задание, явных аномалий нет.';
    return resultItem('at-pressure', 'Давление в АКПП', status, summary, details, ['OilPressInstr', 'OilPress', 'GearOil']);
  }

  function checkAtTemperature(ctx) {
    var oil = series(ctx, 'GearOil');
    if (!oil) return skipItem('at-temperature', 'Температура масла АКПП', ['GearOil']);
    var values = finiteValues(oil);
    if (!values.length) return skipItem('at-temperature', 'Температура масла АКПП', ['GearOil']);

    var maxOil = maxOf(values);
    var minOil = minOf(values);
    var medOil = median(values);
    var details = [
      detail('Диапазон температуры', fmtRange(values, 0, '°C')),
      detail('Медиана температуры', fmt(medOil, 0) + ' °C'),
      detail('Максимум температуры', fmt(maxOil, 0) + ' °C')
    ];

    var start = -1;
    for (var i = 0; i < ctx.n; i++) {
      if (oil[i] !== null && oil[i] < 60) { start = i; break; }
    }
    if (start !== -1) {
      var finish = -1;
      for (var j = start + 1; j < ctx.n; j++) {
        if (oil[j] !== null && oil[j] >= 80) { finish = j; break; }
      }
      if (finish !== -1) {
        details.push(detail('Прогрев до 80 °C', fmtDuration(ctx.ts[finish] - ctx.ts[start])));
      } else {
        details.push(detail('Прогрев до 80 °C', 'не достигнут'));
      }
    } else {
      details.push(detail('Холодный пуск', 'в логе нет'));
    }

    var status = 'ok';
    if (maxOil >= 115) status = 'bad';
    else if (maxOil >= 100) status = 'warn';
    else if (maxOil < 60) status = 'info';

    var summary;
    if (status === 'bad') summary = 'Масло АКПП перегрето — требуется проверка охлаждения и уровня.';
    else if (status === 'warn') summary = 'Температура масла АКПП повышена, стоит проверить теплообменник и нагрузку.';
    else if (status === 'info') summary = 'Масло АКПП не успело прогреться в этом логе.';
    else summary = 'Температура масла АКПП в рабочем диапазоне.';
    return resultItem('at-temperature', 'Температура масла АКПП', status, summary, details, ['GearOil']);
  }

  function checkAtConverter(ctx) {
    var revs = series(ctx, 'Revs');
    var input = series(ctx, 'InputSpeed');
    var speed = series(ctx, 'Speed');
    var pedal = series(ctx, 'AccelPedalPos');
    if (!revs || !input || !speed) return skipItem('at-converter', 'Гидротрансформатор и блокировка', ['Revs', 'InputSpeed', 'Speed']);

    var slips = [];
    var highLockSlips = [];
    var loadSlips = [];
    for (var i = 0; i < ctx.n; i++) {
      if (revs[i] === null || input[i] === null || speed[i] === null) continue;
      if (speed[i] <= 20 || input[i] <= 100) continue;
      var slip = revs[i] - input[i];
      slips.push(slip);
      if (speed[i] >= 40 && (!pedal || (pedal[i] !== null && pedal[i] < 12))) highLockSlips.push(Math.abs(slip));
      if (pedal && pedal[i] !== null && pedal[i] > 20) loadSlips.push(Math.abs(slip));
    }
    if (slips.length < 20) {
      return resultItem('at-converter', 'Гидротрансформатор и блокировка', 'info', 'Недостаточно данных для оценки проскальзывания гидротрансформатора.', [
        detail('Отсчётов', String(slips.length))
      ], ['Revs', 'InputSpeed', 'Speed', 'AccelPedalPos']);
    }

    var absSlips = slips.map(function (value) { return Math.abs(value); });
    var lockedHigh = highLockSlips.filter(function (value) { return value <= 64; }).length;
    var lockupShare = highLockSlips.length ? lockedHigh / highLockSlips.length * 100 : null;
    var positiveShare = slips.filter(function (value) { return value > 64; }).length / slips.length * 100;
    var medLoadSlip = loadSlips.length ? median(loadSlips) : null;

    var details = [
      detail('Медиана |проскальзывания|', fmt(median(absSlips), 0) + ' об/мин'),
      detail('Доля проскальзывания > 64', fmtPercent(positiveShare)),
      detail('Блокировка на 40+ км/ч без газа', lockupShare === null ? '—' : fmtPercent(lockupShare)),
      detail('|Проскальзывание| под нагрузкой', medLoadSlip === null ? '—' : fmt(medLoadSlip, 0) + ' об/мин')
    ];

    var status = 'ok';
    if (lockupShare !== null && lockupShare < 15) status = 'warn';
    else if (medLoadSlip !== null && medLoadSlip > 1200) status = 'warn';
    else if (lockupShare !== null && lockupShare < 30) status = 'info';
    else if (medLoadSlip === null) status = 'info';

    var summary;
    if (status === 'warn') summary = 'Гидротрансформатор долго не блокируется или сильно проскальзывает под нагрузкой.';
    else if (status === 'info') summary = 'Проскальзывание в норме, но режимов полной блокировки в логе мало.';
    else summary = 'Блокировка гидротрансформатора включается, проскальзывание под нагрузкой умеренное.';
    return resultItem('at-converter', 'Гидротрансформатор и блокировка', status, summary, details, ['Revs', 'InputSpeed', 'Speed', 'AccelPedalPos']);
  }

  function atRatioBand(ratio) {
    if (ratio === null || ratio <= 0) return null;
    if (ratio > 75) return '1';
    if (ratio > 50) return '2';
    return '3';
  }

  function checkAtShifts(ctx) {
    var speed = series(ctx, 'Speed');
    var input = series(ctx, 'InputSpeed');
    var lever = textSeries(ctx, 'GearLever');
    if (!speed || !input) return skipItem('at-shifts', 'Переключения и передаточные отношения', ['Speed', 'InputSpeed', 'GearLever']);

    var bands = { '1': [], '2': [], '3': [] };
    var ratios = [];
    var transitions = 0;
    var previousBand = null;
    for (var i = 0; i < ctx.n; i++) {
      if (speed[i] === null || input[i] === null) continue;
      if (speed[i] <= 8 || input[i] <= 200) continue;
      if (lever && lever[i] !== 'D') continue;
      var ratio = input[i] / speed[i];
      ratios.push(ratio);
      var band = atRatioBand(ratio);
      if (band) bands[band].push(ratio);
      if (band && previousBand !== null && band !== previousBand) transitions++;
      if (band) previousBand = band;
    }
    if (ratios.length < 20) {
      return resultItem('at-shifts', 'Переключения и передаточные отношения', 'info', 'Недостаточно данных для оценки переключений АКПП.', [
        detail('Отсчётов', String(ratios.length))
      ], ['Speed', 'InputSpeed', 'GearLever']);
    }

    var details = [
      detail('Передача 1: медиана', bands['1'].length ? fmt(median(bands['1']), 1) + ' (' + bands['1'].length + ' отсч.)' : '—'),
      detail('Передача 2: медиана', bands['2'].length ? fmt(median(bands['2']), 1) + ' (' + bands['2'].length + ' отсч.)' : '—'),
      detail('Передача 3: медиана', bands['3'].length ? fmt(median(bands['3']), 1) + ' (' + bands['3'].length + ' отсч.)' : '—'),
      detail('Смен диапазона', String(transitions)),
      detail('Диапазон отношений', fmt(minOf(ratios), 1) + '…' + fmt(maxOf(ratios), 1))
    ];

    var status = 'ok';
    var covered = ['1', '2', '3'].filter(function (band) { return bands[band].length >= 10; }).length;
    if (covered < 2) status = 'info';
    if (maxOf(ratios) > 180 || minOf(ratios) < 20) status = 'warn';

    var summary;
    if (status === 'warn') summary = 'Есть нетипичные отношения входного вала к скорости — проверить датчики и переключения.';
    else if (status === 'info') summary = 'В логе мало устойчивых диапазонов для оценки всех передач.';
    else summary = 'Передаточные отношения соответствуют нескольким передачам, явных аномалий нет.';
    return resultItem('at-shifts', 'Переключения и передаточные отношения', status, summary, details, ['Speed', 'InputSpeed', 'GearLever', 'EngTorque']);
  }

  function checkAtModes(ctx) {
    var law = textSeries(ctx, 'ChangingLaw');
    var sport = series(ctx, 'SPORT');
    var snow = series(ctx, 'SNOW');
    var gearOil = series(ctx, 'GEAR_OIL');
    var errors = series(ctx, 'Errors');
    if (!law && !sport && !snow && !gearOil && !errors) {
      return skipItem('at-modes', 'Режимы и ошибки АКПП', ['ChangingLaw', 'SPORT', 'SNOW', 'GEAR_OIL', 'Errors']);
    }

    var laws = [];
    if (law) {
      law.forEach(function (value) {
        if (value && laws.indexOf(value) === -1) laws.push(value);
      });
    }
    var sportCount = finiteValues(sport).filter(function (value) { return value > 0; }).length;
    var snowCount = finiteValues(snow).filter(function (value) { return value > 0; }).length;
    var gearOilCount = finiteValues(gearOil).filter(function (value) { return value > 0; }).length;
    var errorsCount = finiteValues(errors).filter(function (value) { return value > 0; }).length;

    var details = [
      detail('Закон переключения', laws.length ? laws.join(', ') : '—'),
      detail('Отсчётов SPORT', String(sportCount)),
      detail('Отсчётов SNOW', String(snowCount)),
      detail('Индикатор масла АКПП', String(gearOilCount)),
      detail('Отсчётов с ошибками', String(errorsCount))
    ];

    var status = 'ok';
    if (errorsCount > 0 || gearOilCount > 0) status = 'bad';
    else if (sportCount > 0 && snowCount > 0) status = 'info';

    var summary;
    if (status === 'bad') summary = 'АКПП сообщает об ошибке или индикаторе масла — требуется чтение кодов и проверка.';
    else if (status === 'info') summary = 'В логе одновременно встречаются режимы SPORT и SNOW — проверьте корректность переключения.';
    else summary = 'Режимы АКПП и флаги ошибок в норме.';
    return resultItem('at-modes', 'Режимы и ошибки АКПП', status, summary, details, ['ChangingLaw', 'SPORT', 'SNOW', 'GEAR_OIL', 'Errors']);
  }

  function checkAtSelector(ctx) {
    var lever = textSeries(ctx, 'GearLever');
    var speed = series(ctx, 'Speed');
    if (!lever || !speed) return skipItem('at-selector', 'Селектор АКПП', ['GearLever', 'Speed']);

    var counts = {};
    var maxSpeed = {};
    var pViolations = 0;
    var rViolations = 0;
    for (var i = 0; i < ctx.n; i++) {
      var position = lever[i] || '—';
      counts[position] = (counts[position] || 0) + 1;
      if (speed[i] === null) continue;
      if (maxSpeed[position] === undefined || speed[i] > maxSpeed[position]) maxSpeed[position] = speed[i];
      if (position === 'P' && speed[i] > 1) pViolations++;
      if (position === 'R' && speed[i] > 10) rViolations++;
    }

    var order = ['P', 'R', 'N', 'D', 'M', '—'];
    var lines = [];
    order.forEach(function (position) {
      if (!counts[position]) return;
      lines.push(position + ': ' + counts[position] + ' (макс. ' + fmt(maxSpeed[position], 0) + ' км/ч)');
    });
    var details = [
      detail('Позиции селектора', lines.join('; ')),
      detail('Скорость в P > 1 км/ч', String(pViolations)),
      detail('Скорость в R > 10 км/ч', String(rViolations))
    ];

    var status = 'ok';
    if (pViolations > 0 || rViolations > 0) status = 'warn';
    if ((maxSpeed.P || 0) > 5 || (maxSpeed.R || 0) > 25) status = 'bad';

    var summary;
    if (status === 'bad') summary = 'Селектор АКПП находится в P или R при заметной скорости — проверить датчик селектора.';
    else if (status === 'warn') summary = 'Есть кратковременное движение в P или R, стоит проверить датчик селектора.';
    else summary = 'Положение селектора согласовано со скоростью автомобиля.';
    return resultItem('at-selector', 'Селектор АКПП', status, summary, details, ['GearLever', 'Speed']);
  }

  function checkWarmupIdle(ctx) {
    var speed = series(ctx, 'Speed');
    var revs = series(ctx, 'Revs');
    var coolant = series(ctx, 'Coolant');
    if (!speed || !revs) return skipItem('warmup-idle', 'Холостой ход и прогрев', ['Speed', 'Revs', 'Coolant']);
    var idleFilter = function (i) {
      return speed[i] !== null && revs[i] !== null && speed[i] < 2 && revs[i] >= 600 && revs[i] <= 1000;
    };
    var idleValues = filteredValues(ctx, 'Revs', idleFilter);
    var details = [];
    var status = 'ok';
    if (idleValues.length >= 20) {
      var idleMedian = median(idleValues);
      var idleSd = stdev(idleValues);
      details.push(detail('Холостой ход: медиана', fmt(idleMedian, 0) + ' об/мин'));
      details.push(detail('Холостой ход: разброс', fmt(idleSd, 0) + ' об/мин'));
      if (idleMedian < 550 || idleMedian > 1000 || (idleSd !== null && idleSd > 120)) status = 'warn';
    } else {
      details.push(detail('Холостой ход', 'мало данных (n=' + idleValues.length + ')'));
      status = 'info';
    }

    if (coolant) {
      var start = -1;
      for (var i = 0; i < ctx.n; i++) {
        if (coolant[i] !== null && coolant[i] < 60) { start = i; break; }
      }
      if (start !== -1) {
        var finish = -1;
        for (var j = start + 1; j < ctx.n; j++) {
          if (coolant[j] !== null && coolant[j] >= 80) { finish = j; break; }
        }
        if (finish !== -1) {
          var warmupMs = ctx.ts[finish] - ctx.ts[start];
          details.push(detail('Прогрев до 80 °C', fmtDuration(warmupMs)));
          if (warmupMs > 25 * 60 * 1000) status = 'warn';
          else if (warmupMs > 15 * 60 * 1000 && status === 'ok') status = 'info';
        } else {
          details.push(detail('Прогрев до 80 °C', 'не достигнут'));
          if (status === 'ok') status = 'warn';
        }
      } else {
        details.push(detail('Холодный пуск', 'в логе нет'));
      }
    }

    var summary;
    if (status === 'warn') summary = 'Обороты холостого хода или прогрев выходят за ожидаемые границы.';
    else if (status === 'info') summary = 'Холостой ход стабилен, но данных для полной оценки прогрева мало.';
    else summary = 'Холостой ход и прогрев в ожидаемых пределах.';
    return resultItem('warmup-idle', 'Холостой ход и прогрев', status, summary, details, ['Speed', 'Revs', 'Coolant']);
  }

  function analyze(dataset) {
    if (!dataset || !dataset.channelsByName) throw new Error('Нет данных для анализа.');
    var ctx = makeContext(dataset);
    var automatic = isAutomaticTransmission(ctx);
    var results = automatic ? [
      checkAtPressure(ctx),
      checkAtTemperature(ctx),
      checkAtConverter(ctx),
      checkAtShifts(ctx),
      checkAtModes(ctx),
      checkAtSelector(ctx)
    ] : [
      checkValveLift(ctx),
      checkCamPhasers(ctx),
      checkTorqueModel(ctx),
      checkAirCharge(ctx),
      checkInjection(ctx),
      checkOxygen(ctx),
      checkIgnition(ctx),
      checkOil(ctx),
      checkCooling(ctx),
      checkElectrical(ctx),
      checkDriveline(ctx),
      checkWarmupIdle(ctx)
    ];
    var counts = { ok: 0, warn: 0, bad: 0, info: 0, skip: 0 };
    results.forEach(function (item) { counts[item.status]++; });
    var status = 'skip';
    if (counts.bad) status = 'bad';
    else if (counts.warn) status = 'warn';
    else if (counts.ok) status = 'ok';
    else if (counts.info) status = 'info';
    return {
      fileName: dataset.fileName,
      generatedAt: Date.now(),
      kind: automatic ? 'at' : 'engine',
      results: results,
      counts: counts,
      status: status
    };
  }

  var api = {
    analyze: analyze,
    limits: LIMITS
  };

  global.AutoAnalysis = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
