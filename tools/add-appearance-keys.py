#!/usr/bin/env python3
# Ajoute les clés d'apparence (jour/nuit) aux 13 locales existantes.
import json, glob

ADD = {
    'en': {
        'appearanceAuto': 'Automatic', 'appearanceDay': 'Day', 'appearanceNight': 'Night',
        'appearanceScheduled': 'Scheduled night', 'palette': 'Palette',
        'paletteDay': 'Day palette', 'paletteNight': 'Night palette', 'paletteNeon': 'Neon palette',
        'nightStart': 'From', 'nightEnd': 'To',
    },
    'fr': {
        'appearanceAuto': 'Automatique', 'appearanceDay': 'Jour', 'appearanceNight': 'Nuit',
        'appearanceScheduled': 'Nuit programmée', 'palette': 'Palette',
        'paletteDay': 'Palette jour', 'paletteNight': 'Palette nuit', 'paletteNeon': 'Palette néon',
        'nightStart': 'De', 'nightEnd': 'À',
    },
    'es': {
        'appearanceAuto': 'Automático', 'appearanceDay': 'Día', 'appearanceNight': 'Noche',
        'appearanceScheduled': 'Noche programada', 'palette': 'Paleta',
        'paletteDay': 'Paleta de día', 'paletteNight': 'Paleta de noche', 'paletteNeon': 'Paleta neón',
        'nightStart': 'Desde', 'nightEnd': 'Hasta',
    },
    'pt-BR': {
        'appearanceAuto': 'Automático', 'appearanceDay': 'Dia', 'appearanceNight': 'Noite',
        'appearanceScheduled': 'Noite programada', 'palette': 'Paleta',
        'paletteDay': 'Paleta de dia', 'paletteNight': 'Paleta de noite', 'paletteNeon': 'Paleta neon',
        'nightStart': 'Das', 'nightEnd': 'Até',
    },
    'de': {
        'appearanceAuto': 'Automatisch', 'appearanceDay': 'Tag', 'appearanceNight': 'Nacht',
        'appearanceScheduled': 'Geplante Nacht', 'palette': 'Palette',
        'paletteDay': 'Tag-Palette', 'paletteNight': 'Nacht-Palette', 'paletteNeon': 'Neon-Palette',
        'nightStart': 'Ab', 'nightEnd': 'Bis',
    },
    'it': {
        'appearanceAuto': 'Automatico', 'appearanceDay': 'Giorno', 'appearanceNight': 'Notte',
        'appearanceScheduled': 'Notte programmata', 'palette': 'Paletta',
        'paletteDay': 'Paletta giorno', 'paletteNight': 'Paletta notte', 'paletteNeon': 'Paletta neon',
        'nightStart': 'Da', 'nightEnd': 'A',
    },
    'ru': {
        'appearanceAuto': 'Автоматически', 'appearanceDay': 'День', 'appearanceNight': 'Ночь',
        'appearanceScheduled': 'Ночь по расписанию', 'palette': 'Палитра',
        'paletteDay': 'Дневная палитра', 'paletteNight': 'Ночная палитра', 'paletteNeon': 'Неоновая палитра',
        'nightStart': 'С', 'nightEnd': 'До',
    },
    'tr': {
        'appearanceAuto': 'Otomatik', 'appearanceDay': 'Gün', 'appearanceNight': 'Gece',
        'appearanceScheduled': 'Planlı gece', 'palette': 'Palet',
        'paletteDay': 'Gün palleti', 'paletteNight': 'Gece palleti', 'paletteNeon': 'Neon paleti',
        'nightStart': 'Başlangıç', 'nightEnd': 'Bitiş',
    },
    'ar': {
        'appearanceAuto': 'تلقائي', 'appearanceDay': 'نهار', 'appearanceNight': 'ليل',
        'appearanceScheduled': 'ليل مبرمج', 'palette': 'لوحة الألوان',
        'paletteDay': 'لوحة نهار', 'paletteNight': 'لوحة ليل', 'paletteNeon': 'لوحة نيون',
        'nightStart': 'من', 'nightEnd': 'إلى',
    },
    'id': {
        'appearanceAuto': 'Otomatis', 'appearanceDay': 'Siang', 'appearanceNight': 'Malam',
        'appearanceScheduled': 'Malam terjadwal', 'palette': 'Palet',
        'paletteDay': 'Palet siang', 'paletteNight': 'Palet malam', 'paletteNeon': 'Palet neon',
        'nightStart': 'Dari', 'nightEnd': 'Ke',
    },
    'ja': {
        'appearanceAuto': '自動', 'appearanceDay': '昼', 'appearanceNight': '夜',
        'appearanceScheduled': 'スケジュール夜', 'palette': 'パレット',
        'paletteDay': '昼パレット', 'paletteNight': '夜パレット', 'paletteNeon': 'ネオンパレット',
        'nightStart': 'から', 'nightEnd': 'まで',
    },
    'ko': {
        'appearanceAuto': '자동', 'appearanceDay': '낮', 'appearanceNight': '밤',
        'appearanceScheduled': '예정夜间', 'palette': '팔레트',
        'paletteDay': '낮 팔레트', 'paletteNight': '밤 팔레트', 'paletteNeon': '네온 팔레트',
        'nightStart': '부터', 'nightEnd': '까지',
    },
    'zh-Hans': {
        'appearanceAuto': '自动', 'appearanceDay': '白天', 'appearanceNight': '夜间',
        'appearanceScheduled': '定时夜间', 'palette': '调色板',
        'paletteDay': '白天调色板', 'paletteNight': '夜间调色板', 'paletteNeon': '霓虹调色板',
        'nightStart': '从', 'nightEnd': '到',
    },
}

for path in sorted(glob.glob('src/i18n/locales/*.json')):
    lang = path.split('/')[-1][:-5]
    if lang not in ADD:
        print('SKIP', lang); continue
    d = json.load(open(path, encoding='utf8'))
    d.update(ADD[lang])
    json.dump(d, open(path, 'w', encoding='utf8'), ensure_ascii=False, indent=2)
    print('OK', lang)
print('done')
