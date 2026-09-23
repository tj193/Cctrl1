"""Prepare the offline registration catalogue from checked-in reference data."""
import json
import re
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]

def write_js(path, name, value):
    (ROOT / path).write_text(f'window.{name} = ' + json.dumps(value, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')

rows = [
    ('baghdad', 'Baghdad', 'بغداد', 'الكرادة|المنصور|الأعظمية|الكاظمية|زيونة|الغدير|بغداد الجديدة|مدينة الصدر|الشعب|البنوك|الدورة|السيدية|البياع|الجادرية|الحارثية|اليرموك|العامرية|الخضراء|الجامعة|العدل|الزعفرانية|البلديات|الحسينية|التاجي|أبو غريب|المحمودية|المدائن'),
    ('basra', 'Basra', 'البصرة', 'العشار|المعقل|الجزائر|البراضعية|الجبيلة|القبلة|الحكيمية|الطويسة|الحيانية|الجمعيات|الزبير|أبو الخصيب|شط العرب|القرنة|المدينة|الهارثة|سفوان|أم قصر|الفاو'),
    ('nineveh', 'Nineveh', 'نينوى', 'الموصل|المجموعة الثقافية|حي الجامعة|الزهور|المثنى|النور|الحدباء|العربي|المنصور|الدواسة|تلعفر|الحمدانية|بعشيقة|برطلة|سنجار|تلكيف|القيارة|مخمور'),
    ('erbil', 'Erbil', 'أربيل', 'عنكاوا|عينكاوة الجديدة|بختياري|شورش|إسكان|زانياري|نازناز|كسنزان|بحركة|شقلاوة|سوران|كويسنجق|خبات|رواندوز|جومان|ميركسور'),
    ('sulaymaniyah', 'Sulaymaniyah', 'السليمانية', 'بختياري|سالم|سرجنار|رابرين|توي ملك|كانى كوردە|بكرجو|شورش|رانية|دوكان|دربندخان|كلار|كفري|جمجمال|بنجوين|قلعة دزة'),
    ('duhok', 'Duhok', 'دهوك', 'مركز دهوك|مالطا|ماسيكي|شندوخا|بروشكي|نزاركي|زاخو|سميل|العمادية|عقرة|بردرش|شيخان'),
    ('halabja', 'Halabja', 'حلبجة', 'مركز حلبجة|خورمال|سيروان|بيارة|طويلة'),
    ('kirkuk', 'Kirkuk', 'كركوك', 'رحيم آوه|شورجة|الواسطي|القادسية|المصلى|العروبة|دوميز|الإسكان|تسعين|الحويجة|داقوق|الدبس|التون كوبري'),
    ('diyala', 'Diyala', 'ديالى', 'بعقوبة|بعقوبة الجديدة|التحرير|المفرق|المقدادية|الخالص|خانقين|بلدروز|جلولاء|السعدية|بني سعد|مندلي|قزانية'),
    ('saladin', 'Salah al-Din', 'صلاح الدين', 'تكريت|القادسية|العلم|سامراء|بلد|الدجيل|بيجي|الشرقاط|الدور|طوزخورماتو|الإسحاقي|يثرب'),
    ('anbar', 'Anbar', 'الأنبار', 'الرمادي|التأميم|الملعب|الورار|الفلوجة|الكرمة|الحبانية|الخالدية|هيت|حديثة|عانة|راوة|القائم|الرطبة|البغدادي'),
    ('babil', 'Babil', 'بابل', 'الحلة|الجمعية|الإسكان|الكرامة|نادر|الهاشمية|القاسم|المحاويل|المسيب|الإسكندرية|سدة الهندية|الكفل|المدحتية|أبو غرق'),
    ('karbala', 'Karbala', 'كربلاء', 'مركز كربلاء|حي الحسين|حي الحر|العباسية|الإسكان|حي المعلمين|الجدول الغربي|الهندية|عين التمر|الحسينية|الخيرات'),
    ('najaf', 'Najaf', 'النجف', 'مركز النجف|حي الأمير|حي الجامعة|الحنانة|الغدير|النداء|المكرمة|الجمعية|الكوفة|المناذرة|المشخاب|الحيرة|العباسية'),
    ('qadisiyah', 'Qadisiyah', 'القادسية', 'الديوانية|حي الجامعة|العروبة|الجمهوري|الإسكان|الشامية|عفك|الحمزة|الدغارة|السنية|غماس|الشنافية|البدير'),
    ('wasit', 'Wasit', 'واسط', 'الكوت|الهورة|الداموك|حي الجهاد|حي المعلمين|العزيزية|الحي|الصويرة|النعمانية|بدرة|جصان|الزبيدية|الأحرار'),
    ('maysan', 'Maysan', 'ميسان', 'العمارة|حي الحسين|حي المعلمين|المجر الكبير|الكحلاء|علي الغربي|قلعة صالح|الميمونة|السلام|العدل|كميت|علي الشرقي'),
    ('dhiqar', 'Dhi Qar', 'ذي قار', 'الناصرية|الشموخ|أور|سومر|الإسكان|الشطرة|الرفاعي|سوق الشيوخ|الجبايش|قلعة سكر|الغراف|الدواية|الفهود|النصر|الإصلاح'),
    ('muthanna', 'Muthanna', 'المثنى', 'السماوة|الشرقي|الغربي|حي الحسين|حي المعلمين|الرميثة|الخضر|السلمان|الوركاء|المجد|النجمي|الدراجي|السوير'),
]
governorates = [dict(id=i, name=n, arabic=a, areas=areas.split('|')) for i,n,a,areas in rows]
source_catalogue = json.loads((ROOT/'reference-data/universities-source.json').read_text(encoding='utf-8'))
universities = source_catalogue['universities']
write_js('js/data/iraq-catalogue.js','IraqCatalogue',dict(
    governorates=governorates,
    universities=universities,
    reviewed=source_catalogue['reviewed'],
))

tree = ET.parse(ROOT/'assets/maps/iraq-source.svg')
svg=tree.getroot()
ET.register_namespace('', 'http://www.w3.org/2000/svg')
for parent in list(svg.iter()):
    for child in list(parent):
        if child.tag.split('}')[-1] not in ['path','g','text','tspan']:
            parent.remove(child)
    for key in list(parent.attrib):
        if key.startswith('{') or key in ['id','width','height','version']:
            parent.attrib.pop(key)
svg.set('class','iraq-map')
svg.set('aria-label','Iraq governorates. Select a governorate on the map or use the list.')
labels = ['nineveh','anbar','duhok','erbil','sulaymaniyah','diyala','kirkuk','saladin','babil','karbala','najaf','muthanna','qadisiyah','dhiqar','wasit','maysan','basra','baghdad','halabja']
for el,gov in zip(svg.findall('{http://www.w3.org/2000/svg}text'),labels):
    el.set('data-governorate',gov)
    el.set('class','map-label')
    el.set('role','button')
    el.set('tabindex','0')
    el.set('aria-pressed','false')
    el.set('aria-label',next(n for i,n,a,areas in rows if i==gov))
    el.set('style','font: 32px Arial, sans-serif; fill: #183352; cursor: pointer;')
    for span in el:
        span.set('style','font: 32px Arial, sans-serif;')
region_ids = iter(['nineveh','sulaymaniyah','halabja','muthanna','saladin','anbar','karbala','babil','qadisiyah','dhiqar','maysan','basra','najaf','baghdad','wasit','diyala','kirkuk','duhok','erbil'])
for p in svg.iter('{http://www.w3.org/2000/svg}path'):
    style=p.get('style','')
    fill=re.search(r'(?:^|;)fill:([^;]+)',style)
    if fill and fill[1] not in ['none','#c6ecff']:
        p.set('class','map-region')
        p.set('data-governorate',next(region_ids))
        p.set('style','fill:#dce9f3;stroke:#fff;stroke-width:3;stroke-linejoin:round;')
    else:
        p.set('style','fill:none;stroke:#b9d1e4;stroke-width:1;pointer-events:none;')
write_js('js/data/iraq-map.js','IraqMapMarkup',ET.tostring(svg,encoding='unicode'))
print(f'{len(governorates)} governorates; {len(universities)} university records')
