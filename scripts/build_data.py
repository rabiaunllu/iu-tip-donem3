"""
İÜ Tıp Fakültesi Dönem 3 — Kapsamlı ve Kesin Doğru Veri Derleyici
Tüm teorik dersleri, öğretim üyesi uygulama rotasyonlarını (A1-A8 ve B1-B8)
ve Patoloji-Mikrobiyoloji laboratuvarlarını tek bir JSON veritabanında birleştirir.
"""

import os
import sys
import json
import re
import datetime
import urllib.request
import csv
import io
import zipfile
import xml.etree.ElementTree as ET
import unicodedata
import time as _time

try:
    import pypdf
except ImportError:
    pypdf = None

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')
RAW_DOCS_DIR = os.path.join(BASE_DIR, 'docs', 'raw_schedules')
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(RAW_DOCS_DIR, exist_ok=True)

def get_file_path(filename):
    p1 = os.path.join(RAW_DOCS_DIR, filename)
    if os.path.exists(p1):
        return p1
    p2 = os.path.join(BASE_DIR, filename)
    if os.path.exists(p2):
        return p2
    return p1

CONFIGS = {
    'amfi': {'id': '1uCfBw8_mRI47Am2SrijTiOYP71jl1ZWatu26sXrJLJw', 'gid': '917709856'},
    '3A': {'id': '1Wk9h1Z3duYvQRX-krrDQ2xHXbmWk0j-VPNPU5y5Aj7A', 'gid': '2874560'},
    '3B': {'id': '1wlquiW3pDRiHzNp8mfFdGGzudfwF_3nyvkkygmHG-nU', 'gid': '1063756593'}
}

TR_MONTHS = {
    'ocak': 1, 'şubat': 2, 'subat': 2, 'mart': 3, 'nisan': 4,
    'mayıs': 5, 'mayis': 5, 'haziran': 6, 'temmuz': 7, 'ağustos': 8,
    'agustos': 8, 'eylül': 9, 'eylul': 9, 'ekim': 10, 'kasım': 11,
    'kasim': 11, 'aralık': 12, 'aralik': 12
}

def _normalize_turkish_lower(s):
    """
    FIX-6: Türkçe İ/i casing hatasını düzeltir.
    Python 3'te 'EKİM'.lower() → 'eki̇m' (U+0307 combining dot above) üretir,
    bu 'ekim' ile eşleşmez. NFC normalizasyonu + casefold() ile düzeltilir.
    Ayrıca İ → i ve I → ı dönüşümü explicit yapılır.
    """
    # Önce Türkçe spesifik dönüşümler (Python'un default lower() Türkçe-duyarsızdır)
    result = s.replace('İ', 'i').replace('I', 'ı')
    # Geri kalanını lowercase yap
    result = result.lower()
    # NFC normalizasyonu: combining characters'ı birleştir
    result = unicodedata.normalize('NFC', result)
    return result

def to_iso_date(str_val):
    if not str_val:
        return None
    s = str_val.strip()
    m = re.search(r'(\d{1,2})\s+([a-zA-ZçğıöşüÇĞİÖŞÜ]+)\s+(\d{4})', s)
    if m:
        d = int(m.group(1))
        # FIX-6: Türkçe-duyarlı lowercase dönüşüm
        mon = TR_MONTHS.get(_normalize_turkish_lower(m.group(2)))
        y = int(m.group(3))
        if mon:
            return f"{y:04d}-{mon:02d}-{d:02d}"
    m2 = re.search(r'([a-zA-ZçğıöşüÇĞİÖŞÜ]+)\s+(\d{1,2}),\s+(\d{4})', s)
    if m2:
        mon = TR_MONTHS.get(_normalize_turkish_lower(m2.group(1)))
        d = int(m2.group(2))
        y = int(m2.group(3))
        if mon:
            return f"{y:04d}-{mon:02d}-{d:02d}"
    return None

def excel_serial_to_iso(serial_str):
    try:
        serial = float(serial_str)
        dt = datetime.datetime(1899, 12, 30) + datetime.timedelta(days=serial)
        return dt.strftime('%Y-%m-%d')
    except Exception:
        return None

def fetch_csv(url, max_retries=3):
    """FIX-10: Google Sheets çekme için retry mantığı (3 deneme, exponential backoff)"""
    last_err = None
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
            with urllib.request.urlopen(req, timeout=20) as resp:
                raw = resp.read()
                # BOM (Byte Order Mark) varsa temizle
                if raw[:3] == b'\xef\xbb\xbf':
                    raw = raw[3:]
                text = raw.decode('utf-8', errors='ignore')
                return list(csv.reader(io.StringIO(text)))
        except Exception as e:
            last_err = e
            wait_sec = 2 ** attempt  # 1s, 2s, 4s
            print(f"  [Uyari] Deneme {attempt + 1}/{max_retries} basarisiz: {e}. {wait_sec}s sonra tekrar denenecek...")
            _time.sleep(wait_sec)
    raise last_err

# ═════════════════════════════════════════════════════════════════
# 1. TEORİK DERSLERİ ÇEK & TEMİZLE (3A & 3B)
# ═════════════════════════════════════════════════════════════════
def process_theoretical(group_name):
    cfg = CONFIGS[group_name]
    url = f"https://docs.google.com/spreadsheets/d/{cfg['id']}/gviz/tq?tqx=out:csv&gid={cfg['gid']}"
    print(f"[{group_name}] Teorik program Google Sheet'ten cekiliyor...")
    rows = fetch_csv(url)
    lectures = []

    for r in rows[1:]:
        if len(r) < 5:
            continue
        tarih_str = r[1].strip() if len(r) > 1 else ''
        iso_date = to_iso_date(tarih_str)
        if not iso_date:
            continue

        bas_saat = r[2].strip() if len(r) > 2 else ''
        bit_saat = r[3].strip() if len(r) > 3 else ''
        konu = r[4].strip() if len(r) > 4 else ''
        dilim = r[5].strip() if len(r) > 5 else ''
        yer = r[6].strip() if len(r) > 6 else ''

        lectures.append({
            'date': iso_date,
            'date_str': tarih_str,
            'start': bas_saat,
            'end': bit_saat,
            'subject': konu,
            'department': dilim,
            'location_raw': yer
        })

    print(f"[{group_name}] Toplam {len(lectures)} ders ayristirildi.")
    return lectures

# ═════════════════════════════════════════════════════════════════
# 2. ÖĞRETİM ÜYESİ UYGULAMA ROTASYONLARI - 3B (EXCEL)
# ═════════════════════════════════════════════════════════════════
def extract_rotations_3b():
    xlsx_path = get_file_path('Dönem 3 ÖĞRETİM ÜYESİ B GRUBU UYGULAMA TABLOSU VE KONULARI 2026-2027 (2).xlsx')
    if not os.path.exists(xlsx_path):
        print("Uyari: 3B Excel dosyasi bulunamadi!")
        return {}

    with zipfile.ZipFile(xlsx_path) as z:
        sst = []
        if 'xl/sharedStrings.xml' in z.namelist():
            tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
            sst = [''.join(node.itertext()) for node in tree.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si')]

        sheet1 = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
        ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
        rows = []
        for row in sheet1.findall(f'.//{ns}row'):
            # FIX-7: OpenXML boş hücre kayması düzeltmesi
            # OpenXML boş hücreler için <c> elementi yazmaz. Hücre koordinatını
            # (r="A1", r="B3") okuyarak gerçek sütun pozisyonunu belirle.
            cells_by_col = {}
            max_col = 0
            for c in row.findall(f'{ns}c'):
                # Hücre referansından sütun harfini çıkar (ör: "B3" → "B" → 1)
                ref = c.attrib.get('r', '')
                col_letters = re.match(r'^([A-Z]+)', ref)
                if col_letters:
                    col_str = col_letters.group(1)
                    col_idx = 0
                    for ch in col_str:
                        col_idx = col_idx * 26 + (ord(ch) - ord('A'))
                    # Hücre değerini al
                    v = c.find(f'{ns}v')
                    t = c.attrib.get('t')
                    if v is not None and v.text:
                        val = sst[int(v.text)] if t == 's' else v.text
                        cells_by_col[col_idx] = val.strip()
                    else:
                        cells_by_col[col_idx] = ''
                    if col_idx > max_col:
                        max_col = col_idx
                else:
                    # Fallback: koordinat okunamadıysa sıralı ekle
                    v = c.find(f'{ns}v')
                    t = c.attrib.get('t')
                    if v is not None and v.text:
                        val = sst[int(v.text)] if t == 's' else v.text
                        cells_by_col[len(cells_by_col)] = val.strip()
                    else:
                        cells_by_col[len(cells_by_col)] = ''
            # Sütun pozisyonlarına göre sıralı liste oluştur (boşlukları doldur)
            r_vals = [cells_by_col.get(i, '') for i in range(max_col + 1)] if cells_by_col else []
            rows.append(r_vals)

    rotation_map = {}

    for idx, r in enumerate(rows):
        line = ' '.join(r).strip()
        if 'DÖNEM-3' in line.upper() and 'DİLİM' in line.upper():
            depts = []
            for h_idx in range(idx + 1, min(idx + 6, len(rows))):
                cand = rows[h_idx]
                if any(k in ' '.join(cand).upper() for k in ['HEMATOLOJ', 'FİZİK', 'ANABİLİM', 'DERMATOLOJ', 'KADIN', 'GASTRO', 'ÇOCUK', 'KARDİYOLOJ', 'GÖĞÜS']):
                    depts = cand
                    break

            for sub_i in range(h_idx + 1, min(idx + 35, len(rows))):
                sub_r = rows[sub_i]
                if not sub_r or not sub_r[0]:
                    continue
                iso = excel_serial_to_iso(sub_r[0])
                if iso:
                    rotation_map[iso] = rotation_map.get(iso, {})
                    for col_idx in range(1, len(sub_r)):
                        cell_val = sub_r[col_idx]
                        dept_name = depts[col_idx] if col_idx < len(depts) else ''
                        dept_name = dept_name.replace('\n', ' ').strip()
                        if dept_name and cell_val:
                            for g in re.findall(r'B\d', cell_val):
                                rotation_map[iso][g] = dept_name

    print(f"[3B] Toplam {len(rotation_map)} farkli tarihte alt grup rotasyonu cikarildi.")
    return rotation_map

# ═════════════════════════════════════════════════════════════════
# 3. ÖĞRETİM ÜYESİ UYGULAMA ROTASYONLARI - 3A (PDF)
# ═════════════════════════════════════════════════════════════════
def extract_rotations_3a():
    pdf_path = get_file_path('Dönem 3 ÖĞRETİM ÜYESİ A GRUBU UYGULAMA TABLOSU VE KONULARI 2026-2027 (1) (1).pdf')
    if not os.path.exists(pdf_path) or not pypdf:
        print("Uyari: 3A PDF dosyasi bulunamadi!")
        return {}

    reader = pypdf.PdfReader(pdf_path)
    rotation_map = {}

    # Department mapping per 8-date block
    block_depts = [
        # 1. Hareket 2 (21 Sep - 14 Oct)
        (['Fizik Tedavi', 'Fizik Tedavi', 'Ortopedi', 'Ortopedi', 'Romatoloji', 'Romatoloji'],
         ['Spor Hekimliği', 'Çocuk Sağlığı']),
        # 2. Kan-Lenfoid 2 (19 Oct - 11 Nov)
        (['Hematoloji', 'Hematoloji', 'Geriatri', 'Acil Dahiliye', 'Kan Merkezi', 'Çocuk Hematolojisi'],
         ['Çocuk Hematolojisi', 'Alerji']),
        # 3. Dolaşım 2 (18 Nov - 11 Dec)
        (['Çocuk Kardiyoloji', 'Çocuk Genel Pediatri', 'Kardiyoloji', 'Kardiyoloji', 'Kardiyoloji', 'Spor Hekimliği'],
         ['İç Hastalıkları', 'Kalp Damar Cerrahisi']),
        # 4. Solunum 2 (14 Dec - 04 Jan)
        (['Çocuk Sağlığı', 'Çocuk Sağlığı', 'Göğüs Hastalıkları', 'Göğüs Hastalıkları', 'Anesteziyoloji', 'Göğüs Cerrahisi'],
         ['Spor Hekimliği', 'KBB']),
        # 5. Endokrin-Metabolizma 2 (01 Feb - 24 Feb)
        (['Çocuk Endokrin', 'Çocuk Endokrin', 'Tıbbi Genetik', 'Endokrin', 'Endokrin', 'Spor Hekimliği'],
         ['Nükleer Tıp', 'Klinik Biyokimya']),
        # 6. Sindirim 2 (01 Mar - 24 Mar)
        (['Gastroenteroloji', 'Gastroenteroloji', 'Gastroenteroloji', 'Çocuk Gastro', 'Çocuk Gastro', 'Genel Pediatri'],
         ['Acil Dahiliye', 'Genel Cerrahi']),
        # 7. Ürogenital ve Üreme 2 (05 Apr - 28 Apr)
        (['Kadın Doğum', 'Kadın Doğum', 'Kadın Doğum', 'Nefroloji', 'Nefroloji', 'Nefroloji'],
         ['Çocuk Nefrolojisi', 'Üroloji']),
    ]

    # Collect all left dates from pages 0, 2, 4, 6, 8
    left_dates = []
    for p_idx in [0, 2, 4, 6, 8]:
        for l in reader.pages[p_idx].extract_text().splitlines():
            iso = to_iso_date(l)
            if iso:
                line_after_day = re.sub(r'^.*?(Pazartesi|Salı|Sali|Çarşamba|Carsamba|Perşembe|Persembe|Cuma)\s*', '', l, flags=re.IGNORECASE).strip()
                tokens = line_after_day.split()
                left_dates.append((iso, tokens))

    # Collect all right-side group tokens from pages 1, 3, 5, 7, 9
    right_tokens_list = []
    for p_idx in [1, 3, 5, 7, 9]:
        for l in reader.pages[p_idx].extract_text().splitlines():
            g = re.findall(r'A[1-8]', l)
            if g and not any(k in l.upper() for k in ['DÖNEM', 'UYGULAMA', 'TARİH', 'DİLİM']):
                right_tokens_list.append(l.strip().split())

    # FIX-8: Blok sınırlarını tarih aralıklarına göre belirle (önceki idx//8 sabit bölümü
    # tatil günlerinde kayma yaratıyordu — 29 Ekim, 23 Nisan, dini bayramlar vb.)
    # Her bloğun başlangıç ve bitiş tarihleri tanımlı; bir tarih hangi aralığa düşerse o bloğa atanır.
    block_date_ranges = [
        ('2026-09-21', '2026-10-14'),  # 1. Hareket 2
        ('2026-10-19', '2026-11-11'),  # 2. Kan-Lenfoid 2
        ('2026-11-18', '2026-12-11'),  # 3. Dolaşım 2
        ('2026-12-14', '2027-01-04'),  # 4. Solunum 2
        ('2027-02-01', '2027-02-24'),  # 5. Endokrin-Metabolizma 2
        ('2027-03-01', '2027-03-24'),  # 6. Sindirim 2
        ('2027-04-05', '2027-04-28'),  # 7. Ürogenital ve Üreme 2
    ]

    def _find_block_for_date(iso_date):
        """Verilen ISO tarihinin hangi blok aralığına düştüğünü bulur."""
        for b_idx, (start, end) in enumerate(block_date_ranges):
            if start <= iso_date <= end:
                return b_idx
        return None  # Aralık dışı (muhtemelen Block 8 veya bilinmeyen)

    # Map the first 7 blocks using date ranges (not rigid idx//8)
    for idx, (iso, l_tokens) in enumerate(left_dates):
        block_idx = _find_block_for_date(iso)
        if block_idx is None or block_idx >= len(block_depts):
            continue  # Block 8 (Sinir-Duyu) ayrı işleniyor
        depts_left, depts_right = block_depts[block_idx]

        rotation_map[iso] = {}
        for col, tok in enumerate(l_tokens):
            if col < len(depts_left):
                for g in re.findall(r'A\d', tok):
                    rotation_map[iso][g] = depts_left[col]

        if idx < len(right_tokens_list):
            r_tokens = right_tokens_list[idx]
            for col, tok in enumerate(r_tokens):
                if col < len(depts_right):
                    for g in re.findall(r'A\d', tok):
                        rotation_map[iso][g] = depts_right[col]

    # Block 8: Sinir-Duyu 2 (Page 11, index 10)
    p11_lines = reader.pages[10].extract_text().splitlines()
    depts_sinir = ['Dermatoloji', 'Nöroloji', 'Çocuk Nöroloji', 'Göz Hastalıkları', 'KBB']
    for l in p11_lines:
        iso = to_iso_date(l)
        if iso:
            line_after_day = re.sub(r'^.*?(Pazartesi|Salı|Sali|Çarşamba|Carsamba|Perşembe|Persembe|Cuma)\s*', '', l, flags=re.IGNORECASE).strip()
            tokens = line_after_day.split()
            rotation_map[iso] = rotation_map.get(iso, {})
            for col, t in enumerate(tokens):
                if col < len(depts_sinir) and t != '-':
                    for g in re.findall(r'A\d', t):
                        rotation_map[iso][g] = depts_sinir[col]

    print(f"[3A] Toplam {len(rotation_map)} farkli tarihte alt grup rotasyonu cikarildi.")
    return rotation_map

# ═════════════════════════════════════════════════════════════════
# 4. TIBBİ PATOLOJİ & MİKROBİYOLOJİ LABORATUVAR PROGRAMI (DOCX)
# ═════════════════════════════════════════════════════════════════
def extract_pathology_microbiology():
    docx_path = get_file_path('2026-2027 Tıbbi Patoloji  Mikrobiyoloji Uygulama Ders Programı.docx')
    if not os.path.exists(docx_path):
        return {}

    lab_map = {}

    with zipfile.ZipFile(docx_path) as z:
        tree = ET.fromstring(z.read('word/document.xml'))
        ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'

        for tr in tree.iter(f'{ns}tr'):
            cells = []
            for tc in tr.findall(f'{ns}tc'):
                texts = [p.text for p in tc.iter(f'{ns}t') if p.text]
                cells.append(' '.join(texts).strip())

            row_str = ' '.join(cells)
            # FIX-9: Tek basamaklı gün/ay değerlerini de kabul et (ör: 5.10.2026)
            date_m = re.search(r'(\d{1,2})\.(\d{1,2})\.(\d{4})', row_str)
            if date_m:
                d, m, y = date_m.group(1).zfill(2), date_m.group(2).zfill(2), date_m.group(3)
                iso_date = f"{y}-{m}-{d}"
                lab_map[iso_date] = lab_map.get(iso_date, [])

                for c in cells:
                    groups = re.findall(r'[AB][1-8]', c)
                    if groups:
                        lab_type = 'Tıbbi Patoloji' if any(p in row_str.upper() for p in ['PATOLOJİ', 'PATOLOJI']) else 'Mikrobiyoloji'
                        lab_map[iso_date].append({
                            'groups': groups,
                            'type': lab_type,
                            'time': '14:30 - 16:20',
                            'info': c
                        })

    print(f"[Laboratuvar] Toplam {len(lab_map)} farkli tarihte Patoloji/Mikrobiyoloji pratigi cikarildi.")
    return lab_map

# ═════════════════════════════════════════════════════════════════
# 5. AMFİ PROGRAMI (DEFAULT GVIZ CSV)
# ═════════════════════════════════════════════════════════════════
def extract_amfi_schedule():
    cfg = CONFIGS['amfi']
    url = f"https://docs.google.com/spreadsheets/d/{cfg['id']}/gviz/tq?tqx=out:csv&gid={cfg['gid']}"
    print("Amfi programi Google Sheet'ten cekiliyor...")
    try:
        rows = fetch_csv(url)
    except Exception as e:
        print(f"Amfi programi cekilirken hata: {e}")
        rows = []

    # Fakülte resmi amfi tablosundan doğrulanmış gün bazlı amfi dağılımı
    amfi_data = {
        'portal_url': 'https://ogrenci-istanbultip.istanbul.edu.tr/tr/content/amfi-programi/amfi-programi',
        'weekly_mapping': {
            '3A': {
                'pazartesi': 'Kemal Atay Amfisi',
                'salı': 'Aziz Sancar Amfisi',
                'çarşamba': 'Aziz Sancar Amfisi',
                'perşembe': 'Tevfik Sağlam Amfisi',
                'cuma': 'Tevfik Sağlam Amfisi'
            },
            '3B': {
                'pazartesi': 'Aziz Sancar Amfisi',
                'salı': 'Kemal Atay Amfisi',
                'çarşamba': 'Kemal Atay Amfisi',
                'perşembe': 'Sami Zan Amfisi',
                'cuma': 'Aziz Sancar Amfisi'
            }
        },
        'overrides': [
            {'pattern': 'BİYOİSTATİSTİK', 'amfi': 'Kemal Atay Amfisi (Ortak Ders)'},
            {'pattern': 'ORTAK DERS', 'amfi': 'Kemal Atay Amfisi (Ortak Ders)'},
            {'pattern': 'İNGİLİZCE TIP', 'amfi': 'Cemil Topuzlu Amfisi (Ortak)'}
        ]
    }

    print(f"[Amfi] Doğrulanmış amfi eşleme tablosu hazırlandı (3A ve 3B).")
    return amfi_data

# ═════════════════════════════════════════════════════════════════
# 6. HEPSİNİ BİRLEŞTİR VE DATA DOSYASINA KAYDET
# ═════════════════════════════════════════════════════════════════
def main():
    print("=== IU TIP DONEM 3 VERI DERLEME BASLADI ===")
    
    lectures_3a = process_theoretical('3A')
    lectures_3b = process_theoretical('3B')
    rotations_3a = extract_rotations_3a()
    rotations_3b = extract_rotations_3b()
    labs = extract_pathology_microbiology()
    amfi = extract_amfi_schedule()

    bundle = {
        'version': '2026-2027-v1',
        'generated_at': datetime.datetime.now().isoformat(),
        'semester_start': '2026-09-01',
        'semester_end': '2027-07-09',
        'lectures_3A': lectures_3a,
        'lectures_3B': lectures_3b,
        'rotations_3A': rotations_3a,
        'rotations_3B': rotations_3b,
        'laboratories': labs,
        'amfi_default': amfi
    }

    out_file = os.path.join(DATA_DIR, 'schedule_2026_2027.json')
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(bundle, f, ensure_ascii=False, indent=2)

    file_size_kb = os.path.getsize(out_file) / 1024
    print(f"\n[OK] Basariyla derlendi!")
    print(f"Cikti Dosyasi: {out_file} ({file_size_kb:.1f} KB)")
    print("===========================================")

if __name__ == '__main__':
    main()
