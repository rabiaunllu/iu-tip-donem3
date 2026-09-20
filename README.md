# 🩺 İÜ İstanbul Tıp Fakültesi (Çapa) — Dönem 3 Akıllı Ders Programı

İstanbul Üniversitesi İstanbul Tıp Fakültesi 3. sınıf öğrencileri için geliştirilmiş, **%100 doğrulanmış, amfi eşleştirmeli, öğretim üyesi rotasyonlu ve çevrimdışı (offline) çalışan** akıllı ders programı web uygulaması.

---

## ✨ Temel Özellikler

- 🏛️ **Akıllı Amfi Eşleştirici:** Fakülte programındaki *"Amfi programına bakınız"* belirsizliğini ortadan kaldırır. Haftalık amfi çizelgesiyle ders saatlerini otomatik eşleştirerek dersin hangi amfide (İç Hastalıkları, Kemal Atay, Aziz Sancar vb.) olduğunu gösterir.
- 🔬 **Öğretim Üyesi Uygulama Rotasyonları (8 Dilim):** Hem **3A** hem de **3B** için 8 alt grubun (A1-A8 ve B1-B8) tüm dönem boyunca hangi gün hangi anabilim dalında (Fizik Tedavi, Ortopedi, Romatoloji, Hematoloji, Geriatri, Çocuk Sağlığı vb.) olduğunu otomatik gösterir.
- 🧫 **Tıbbi Patoloji & Mikrobiyoloji Pratikleri:** Saat 14:30 - 16:20 arasındaki laboratuvar günlerini ve alt grup dağılımlarını gösterir.
- 🖨️ **Şık PDF İndir & Yazdır (A4 Landscape):** Tek tıkla haftalık programı A4 yatay formatta tam oturan, yüksek çözünürlüklü şık bir PDF olarak indirebilir veya yazdırabilirsiniz.
- 📱 **Çevrimdışı Çalışma (PWA Desteği):** iPhone ve Android cihazlarda *"Ana Ekrana Ekle"* yapıldığında gerçek bir mobil uygulama gibi simgesiyle açılır. Hastanenin eksi katlarında internet çekmese bile **0 milisaniyede** açılır ve kesintisiz çalışır.
- 🎯 **Akıllı Yerel Profil (Şifresiz Giriş):** İlk girişte grubunuzu (`3A - A3` veya `3B - B5` vb.) seçersiniz, telefonunuz hatırlar. Şifre, e-posta veya üyelik gerekmez.
- 🔗 **Doğrudan Grup Paylaşım Linki:** WhatsApp gruplarında `site.com/#3A-A4` linki paylaşıldığında, linke tıklayan öğrenci doğrudan kendi grubunun programıyla karşılaşır.
- 💬 **WhatsApp Formatında Kopyalama:** Temsilciler için haftalık ders listesini tek tıkla emojili WhatsApp duyurusu formatında kopyalar.
- 🔍 **Ders & Hoca Arama:** Hoca adı veya konu yazarak dersin gün ve saatini anında bulma.

---

## 🚀 GitHub Actions ile GitHub Pages'e Dağıtım Rehberi

Projeyi GitHub'a yükleyip ücretsiz olarak tüm sınıfın erişebileceği bir web sitesine dönüştürmek için aşağıdaki adımları izleyin:

### 1. Git Başlatma ve Commit
Terminalde (PowerShell) proje klasöründe şu komutları çalıştırın:
```bash
git init
git add .
git commit -m "feat: İÜ Tıp Dönem 3 Akıllı Ders Programı ilk sürüm"
```

### 2. GitHub Deposu ile Eşleştirme
1. [GitHub](https://github.com/new) üzerinde yeni bir boş repository oluşturun (örn: `iu-tip-donem3`).
2. Terminalden yerel deponuzu bağlayın:
```bash
git branch -M main
git remote add origin https://github.com/KULLANICI_ADINIZ/iu-tip-donem3.git
git push -u origin main
```

### 3. GitHub Pages Ayarını Açma
1. GitHub deponuzun sayfasına gidin.
2. **Settings** -> **Pages** sekmesine tıklayın.
3. **Build and deployment** başlığı altındaki **Source** seçeneğini **GitHub Actions** olarak seçin.
4. `.github/workflows/deploy.yml` dosyamız otomatik olarak devreye girecek ve sitenizi birkaç dakika içinde `https://KULLANICI_ADINIZ.github.io/iu-tip-donem3/` adresinde yayına alacaktır.

---

## 🛠️ Veritabanını Güncelleme (Geliştirici)

Fakültenin Google E-Tablolarında bir değişiklik olduğunda veritabanını yerel olarak güncellemek için:
```bash
py scripts/build_data.py
```
Bu komut tüm teorik dersleri, PDF ve Excel rotasyonlarını işleyerek `data/schedule_2026_2027.json` dosyasını otomatik günceller.
GitHub Actions her Pazar akşamı bu işlemi sunucuda otomatik olarak da çalıştırmaktadır.
