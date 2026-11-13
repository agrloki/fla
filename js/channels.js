(function (global) {
  'use strict';

  // Описание каналов: понятное название и единица измерения.
  // Ключи должны точно совпадать с заголовками CSV.
  var META = {
    UpMixCorr: { label: 'Коррекция смеси, верхняя', unit: '%' },
    DownMixCorr: { label: 'Коррекция смеси, нижняя', unit: '%' },
    CanisterValve: { label: 'Клапан адсорбера', unit: '%' },

    'Cyl.1Adv': { label: 'УОЗ цилиндра 1', unit: '°' },
    'Cyl.2Adv': { label: 'УОЗ цилиндра 2', unit: '°' },
    'Cyl.3Adv': { label: 'УОЗ цилиндра 3', unit: '°' },
    'Cyl.4Adv': { label: 'УОЗ цилиндра 4', unit: '°' },
    'Cyl.1AdvCorr': { label: 'Коррекция УОЗ цилиндра 1', unit: '°' },
    'Cyl.2AdvCorr': { label: 'Коррекция УОЗ цилиндра 2', unit: '°' },
    'Cyl.3AdvCorr': { label: 'Коррекция УОЗ цилиндра 3', unit: '°' },
    'Cyl.4AdvCorr': { label: 'Коррекция УОЗ цилиндра 4', unit: '°' },

    AlternatorTemp: { label: 'Температура генератора', unit: '°C' },
    AlternatorCurrent: { label: 'Ток генератора', unit: 'А' },
    ECUtemp: { label: 'Температура ЭБУ', unit: '°C' },
    FuelLevel: { label: 'Уровень топлива' },

    'Inj.1Time': { label: 'Время впрыска, цилиндр 1', unit: 'мс' },
    'Inj.2Time': { label: 'Время впрыска, цилиндр 2', unit: 'мс' },
    'Inj.3Time': { label: 'Время впрыска, цилиндр 3', unit: 'мс' },
    'Inj.4Time': { label: 'Время впрыска, цилиндр 4', unit: 'мс' },

    UpO2Volt: { label: 'Датчик кислорода, верхний' },
    DownO2Volt: { label: 'Датчик кислорода, нижний' },
    UpO2Heat: { label: 'Нагрев верхнего датчика O2', unit: '%' },
    DownO2Heat: { label: 'Нагрев нижнего датчика O2', unit: '%' },

    Battery: { label: 'Напряжение АКБ', unit: 'В' },
    Coolant: { label: 'Температура охлаждающей жидкости', unit: '°C' },
    AirCPress: { label: 'Давление воздуха (AirCPress)' },
    Speed: { label: 'Скорость', unit: 'км/ч' },
    OilTemp: { label: 'Температура масла', unit: '°C' },
    AtmosphPress: { label: 'Атмосферное давление', unit: 'гПа' },
    AirManifold: { label: 'Давление во впускном коллекторе' },
    ExternalTemp: { label: 'Внешняя температура' },
    Revs: { label: 'Обороты двигателя', unit: 'об/мин' },
    OilPressInstr: { label: 'Давление масла (прибор)' },
    OilPress: { label: 'Давление масла' },
    OilPumpValve: { label: 'Клапан масляного насоса', unit: '%' },
    AlternatorCharge: { label: 'Заряд генератора', unit: '%' },
    AccelPedalPos: { label: 'Положение педали акселератора', unit: '%' },

    InputSpeed: { label: 'Обороты входного вала АКПП', unit: 'об/мин' },
    GearOil: { label: 'Температура масла АКПП', unit: '°C' },
    EngTorque: { label: 'Крутящий момент двигателя', unit: 'Н·м' },
    ChangingLaw: { label: 'Закон переключения АКПП' },
    GearLever: { label: 'Селектор АКПП' },
    SPORT: { label: 'Режим SPORT' },
    SNOW: { label: 'Режим SNOW' },
    GEAR_OIL: { label: 'Индикатор масла АКПП' },

    AirFlowInstr: { label: 'Расход воздуха (прибор)' },
    AirFlow: { label: 'Расход воздуха' },
    ThrottleAngleInstr: { label: 'Угол дросселя (прибор)', unit: '%' },
    ThrottleAngle: { label: 'Угол дросселя', unit: '%' },

    InCamDephaserInstr: { label: 'Фазовращатель впуска (прибор)' },
    InCamDephaser: { label: 'Фазовращатель впуска', unit: '°' },
    InCamDephaserValve: { label: 'Клапан фазовращателя впуска', unit: '%' },
    ExCamDephaserInstr: { label: 'Фазовращатель выпуска (прибор)' },
    ExCamDephaser: { label: 'Фазовращатель выпуска', unit: '°' },
    ExCamDephaserValve: { label: 'Клапан фазовращателя выпуска', unit: '%' },

    TorqIgnAdvInstr: { label: 'Момент по УОЗ (прибор)', unit: '%' },
    TorqIgnAdv: { label: 'Момент по УОЗ', unit: '%' },
    TorqAirFlowInstr: { label: 'Момент по расходу воздуха (прибор)', unit: '%' },
    TorqAirFlow: { label: 'Момент по расходу воздуха', unit: '%' },
    TorqLost: { label: 'Потеря момента', unit: '%' },

    ValveMotor: { label: 'Привод Valvetronic', unit: '%' },
    ValveLiftInstr: { label: 'Подъём клапана (прибор)' },
    ValveLift: { label: 'Подъём клапана', unit: 'мм' },

    KnockSensor: { label: 'Датчик детонации' },
    KnockSensorThr: { label: 'Порог датчика детонации' },

    Errors: { label: 'Ошибки' },
    BR: { label: 'Тормоз (BR)' },
    CL: { label: 'Замкнутый контур (CL)' }
  };

  var GROUPS = [
    {
      id: 'engine', title: 'Двигатель',
      channels: ['Revs', 'Speed', 'Coolant', 'AirManifold', 'AirFlow', 'AirFlowInstr',
        'ThrottleAngle', 'ThrottleAngleInstr', 'AccelPedalPos', 'AtmosphPress', 'AirCPress', 'ExternalTemp']
    },
    {
      id: 'fuel', title: 'Впрыск и топливо',
      channels: ['Inj.1Time', 'Inj.2Time', 'Inj.3Time', 'Inj.4Time', 'UpMixCorr', 'DownMixCorr',
        'CanisterValve', 'FuelLevel']
    },
    {
      id: 'lambda', title: 'Лямбда-регулирование',
      channels: ['UpO2Volt', 'DownO2Volt', 'UpO2Heat', 'DownO2Heat']
    },
    {
      id: 'ignition', title: 'Зажигание',
      channels: ['Cyl.1Adv', 'Cyl.2Adv', 'Cyl.3Adv', 'Cyl.4Adv',
        'Cyl.1AdvCorr', 'Cyl.2AdvCorr', 'Cyl.3AdvCorr', 'Cyl.4AdvCorr',
        'KnockSensor', 'KnockSensorThr']
    },
    {
      id: 'timing', title: 'Газораспределение',
      channels: ['InCamDephaser', 'InCamDephaserInstr', 'InCamDephaserValve',
        'ExCamDephaser', 'ExCamDephaserInstr', 'ExCamDephaserValve',
        'ValveLift', 'ValveLiftInstr', 'ValveMotor']
    },
    {
      id: 'torque', title: 'Крутящий момент',
      channels: ['TorqIgnAdv', 'TorqIgnAdvInstr', 'TorqAirFlow', 'TorqAirFlowInstr', 'TorqLost']
    },
    {
      id: 'oil', title: 'Масло',
      channels: ['OilPress', 'OilPressInstr', 'OilTemp', 'OilPumpValve']
    },
    {
      id: 'gearbox', title: 'АКПП',
      channels: ['InputSpeed', 'GearOil', 'EngTorque', 'OilPress', 'OilPressInstr',
        'SPORT', 'SNOW', 'GEAR_OIL', 'ChangingLaw']
    },
    {
      id: 'electrical', title: 'Электрика',
      channels: ['Battery', 'AlternatorTemp', 'AlternatorCurrent', 'AlternatorCharge', 'ECUtemp']
    },
    {
      id: 'other', title: 'Прочее',
      channels: ['Errors', 'BR', 'CL']
    }
  ];

  var PRESETS = [
    { id: 'engine', title: 'Двигатель', channels: ['Revs', 'Speed', 'Coolant', 'ThrottleAngle', 'AccelPedalPos'] },
    { id: 'fuel', title: 'Смесь и впрыск', channels: ['UpMixCorr', 'DownMixCorr', 'Inj.1Time', 'Inj.2Time', 'Inj.3Time', 'Inj.4Time'] },
    { id: 'lambda', title: 'Лямбда', channels: ['UpO2Volt', 'DownO2Volt', 'UpO2Heat', 'DownO2Heat'] },
    { id: 'ignition', title: 'Зажигание', channels: ['Cyl.1Adv', 'Cyl.2Adv', 'Cyl.3Adv', 'Cyl.4Adv', 'KnockSensor'] },
    { id: 'air', title: 'Воздух', channels: ['AirFlow', 'AirManifold', 'ThrottleAngle', 'AccelPedalPos', 'Revs'] },
    { id: 'oil', title: 'Масло', channels: ['OilPress', 'OilPressInstr', 'OilTemp', 'OilPumpValve'] },
    { id: 'gearbox', title: 'АКПП', channels: ['InputSpeed', 'GearOil', 'EngTorque', 'OilPress', 'OilPressInstr'] },
    { id: 'timing', title: 'Фазы', channels: ['InCamDephaser', 'ExCamDephaser', 'InCamDephaserValve', 'ExCamDephaserValve', 'ValveLift'] },
    { id: 'electrical', title: 'Электрика', channels: ['Battery', 'AlternatorTemp', 'AlternatorCurrent', 'AlternatorCharge', 'ECUtemp'] },
    { id: 'torque', title: 'Момент', channels: ['TorqIgnAdv', 'TorqAirFlow', 'TorqLost', 'AirFlow', 'Revs'] }
  ];

  var COLORS = [
    '#4cc9f0', '#f72585', '#8bd450', '#ffd166', '#c77dff', '#ff8fab',
    '#06d6a0', '#f4a261', '#90e0ef', '#e76f51', '#b8c0ff', '#ffb4a2',
    '#7bdff2', '#f9c74f', '#b5179e', '#80ed99', '#ff9e00', '#48cae4',
    '#ef476f', '#caffbf', '#a3b18a', '#ffd6a5', '#9bf6ff', '#ffadad'
  ];

  var DEFAULT_SELECTION = ['Revs', 'Speed', 'Coolant', 'ThrottleAngle', 'AccelPedalPos'];

  global.ChannelInfo = {
    meta: META,
    groups: GROUPS,
    presets: PRESETS,
    colors: COLORS,
    defaultSelection: DEFAULT_SELECTION,
    labelOf: function (name) {
      return (META[name] && META[name].label) || name;
    },
    unitOf: function (name) {
      return (META[name] && META[name].unit) || '';
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
