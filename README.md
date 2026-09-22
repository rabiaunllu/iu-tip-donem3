# 🩺 İstanbul Üniversitesi İstanbul Tıp Fakültesi (Çapa) — Dönem 3 Akıllı Ders Programı

[![Deploy to GitHub Pages](https://github.com/rabiaunllu/iu-tip-donem3/actions/workflows/deploy.yml/badge.svg)](https://github.com/rabiaunllu/iu-tip-donem3/actions/workflows/deploy.yml)
[![Canlı Uygulama](https://img.shields.io/badge/Canl%C4%B1%20Site-rabiaunllu.github.io%2Fiu--tip--donem3-brightgreen.svg?style=flat&logo=googlechrome)](https://rabiaunllu.github.io/iu-tip-donem3/)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-success.svg?style=flat&logo=pwa)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
[![Python 3.11](https://img.shields.io/badge/Python-3.11-3776AB.svg?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v3-38B2AC.svg?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

İstanbul Üniversitesi İstanbul Tıp Fakültesi (Çapa) 3. sınıf öğrencileri için geliştirilmiş; **%100 doğrulanmış, amfi eşleştirmeli, 8 dilim klinik staj rotasyonlu, laboratuvar entegrasyonlu ve çevrimdışı (offline) çalışabilen** modern bir sağlık teknolojisi (HealthTech / EdTech) projesidir.

---

## 💡 Neden Geliştirildi? (Problem & Mühendislik Çözümü)

Tıp fakültesinde ders programı takibi öğrenciler için günlük bir stres kaynağıdır:
1. **Amfi Belirsizliği:** Fakültenin resmi çizelgesinde ders yeri olarak sıklıkla *"Amfi programına bakınız"* yazar. Öğrenci her gün amfi tablosunu aramak zorunda kalır.
2. **Alt Grup Rotasyon Karmaşası:** Dönem 3A ve 3B; 8'er alt gruba (A1-A8 ve B1-B8) ayrılır. Öğleden sonra Fizik Tedavi, Ortopedi, Romatoloji, Hematoloji, Geriatri, Çocuk Sağlığı vb. anabilim dallarına dönüşümlü gidilir. Bu rotasyonlar ayrı PDF/Excel dosyalarında tutulur.
3. **Zayıf İnternet / Çekmeyen Amfiler:** Hastanenin eksi katlarındaki amfi ve laboratuvarlarda mobil internet genellikle çekmez.

**Mühendislik Çözümümüz:**
Tüm kaynakları (teorik e-tablolar, PDF rotasyonları, Excel tabloları ve Word laboratuvar planları) tek bir veri modelinde birleştiren; **0 milisaniyede açılan, çevrimdışı çalışan ve A4 yatay PDF çıktısı verebilen Local-First bir PWA** mimarisi geliştirildi.

---

## ✨ Temel Özellikler

- 🏛️ **Akıllı Amfi Eşleştirici:** Haftalık amfi çizelgesi ile teorik ders saatlerini arka planda akıllıca eşleştirerek dersin amfisini (*İç Hastalıkları Amfisi*, *Kemal Atay*, *Aziz Sancar* vb.) doğrudan kartta gösterir.
- 🔬 **Öğretim Üyesi Rotasyonları (8 Dilim):** Tüm dönem boyunca (Hareket, Kan-Lenfoid, Dolaşım, Solunum, Sindirim, Endokrin, Ürogenital, Sinir-Duyu) A1-A8 ve B1-B8 alt gruplarının hangi gün hangi klinikte olduğunu tek tıkla listeler.
- 🧫 **Tıbbi Patoloji & Mikrobiyoloji Entegrasyonu:** Saat 14:30 - 16:20 arasındaki laboratuvar pratiklerini alt gruplarla eşleştirir.
- 🖨️ **Şık PDF İndir & Yazdır (A4 Landscape):** `@media print` vektörel optimizasyonu ile haftalık programı A4 yatay formatta tek tıkla kusursuz bir PDF olarak kaydetme veya yazdırma.
- 📱 **Çevrimdışı Çalışma (PWA - Progressive Web App):** Service Worker (`sw.js`) ve Web App Manifest ile iPhone ve Android cihazlarda *"Ana Ekrana Ekle"* yapıldığında internet olmasa bile **0ms açılış süresi** ile kesintisiz çalışır.
- 🎯 **Akıllı Yerel Profil (Şifresiz):** Viziteye koşturan öğrenciye şifre engeli koymaz. `localStorage` üzerinde tek tıkla grup seçimi hatırlanır.
- 🔗 **Derin Bağlantı (Deep Linking):** `#3A-A4` gibi doğrudan grup URL'leri sayesinde WhatsApp gruplarından tek tıkla ilgili grubun programı açılır.
- 💬 **WhatsApp Formatında Paylaşım:** Dönem temsilcileri için haftalık ders listesini hazır emojili duyuru formatında panoya kopyalar.
- 🔍 **Ders & Hoca Arama:** Aranılan konunun veya öğretim üyesinin hangi gün ve saatte olduğunu anında filtreleme.

---

## 📐 Sistem Mimarisi ve Teknoloji Yığını

| Katman | Teknoloji / Yaklaşım | Açıklama |
|---|---|---|
| **Arayüz (Frontend)** | HTML5, Tailwind CSS, Lucide Icons | Hızlı, reaktif ve modern mobil öncelikli arayüz |
| **İstemci Mimarisi** | PWA (Service Worker + Manifest) | %100 çevrimdışı çalışma, yerel uygulama benzeri deneyim |
| **Veri Boru Hattı (ETL)** | Python 3.11 (`pypdf`, `xml.etree`) | Google Sheets, PDF, Excel ve DOCX dosyalarını ayrıştırıp JSON üretir |
| **CI / CD Dağıtım** | GitHub Actions & GitHub Pages | Her commit'te otomatik test, derleme ve sıfır kesintili dağıtım |
| **Durum Yönetimi** | `localStorage` & URL Hash Navigation | Sunucusuz, sıfır maliyetli ve tam gizlilik odaklı profil yönetimi |

> Detaylı teknik kararlar ve trade-off analizleri için [docs/architecture.md](docs/architecture.md) dosyasını inceleyebilirsiniz.

---

## 📂 Dizin Yapısı (Clean Architecture)

```
.
├── .github/
│   └── workflows/
│       └── deploy.yml            # CI/CD: Otomatik derleme ve GitHub Pages dağıtımı
├── css/
│   └── style.css                 # Özel stiller ve @media print A4 landscape optimizasyonu
├── js/
│   ├── app.js                    # Ana uygulama başlatıcı ve event listener'lar
│   ├── config.js                 # Global sabitler ve yapılandırma
│   ├── data.js                   # Veri yükleme, normalizasyon ve filtreleme motoru
│   ├── render.js                 # Kartlar, tablolar ve modal UI render motoru
│   ├── state.js                  # LocalStorage ve URL hash tabanlı durum yönetimi
│   └── utils.js                  # Tarih, saat ve metin biçimlendirme yardımcıları
├── data/
│   └── schedule_2026_2027.json   # 2.500+ ders, 64 rotasyon ve lab içeren birleşik veritabanı
├── docs/
│   ├── architecture.md           # Sistem mimarisi ve teknik tasarım kararları
│   ├── feedback_system.md        # Geri bildirim altyapısı dokümantasyonu
│   ├── google_sheets_setup_guide.md # Google Apps Script kurulum rehberi
│   └── raw_schedules/            # Fakülteden alınan resmi PDF ve Excel belgeleri
├── scripts/
│   ├── build_data.py             # ETL veri derleme ve normalizasyon motoru
│   └── verify_integrity.js       # CI/CD otomatik veri bütünlüğü doğrulama paketi
├── index.html                    # PWA uyumlu, Tailwind CSS tabanlı reaktif tek sayfa arayüz
├── manifest.json                 # PWA Web App Manifest
├── sw.js                         # Service Worker önbellekleme mekanizması
├── icon.svg                      # Vektörel tıbbi uygulama simgesi
├── LICENSE                       # MIT Açık Kaynak Lisansı
└── README.md                     # Vitrin ve dokümantasyon ana sayfası
```

---

## 📄 Lisans

Bu proje [MIT Lisansı](LICENSE) altında açık kaynak olarak sunulmaktadır.
Eğitim ve kamu yararı amacıyla tıp fakültesi öğrencilerinin kullanımına açıktır.
