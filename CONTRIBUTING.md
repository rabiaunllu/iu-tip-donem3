# 🛠️ Katkıda Bulunma & Branch Yönetim Rehberi

Bu proje, modern yazılım mühendisliği prensipleri ve **GitHub Flow** branch stratejisi benimsenerek geliştirilmektedir. Mülakatlarda ve ekip çalışmalarında sergilenebilecek standart bir iş akışı uygulanır.

---

## 🌿 Branch Stratejisi

Doğrudan `main` branch üzerine commit atmak yerine, her yeni özellik veya hata düzeltmesi için ayrı bir branch açılır:

- `main`: Her zaman canlıya çıkmaya hazır, kararlı (stable) üretim ortamı.
- `feat/ozellik-adi`: Yeni bir özellik eklerken (örn: `feat/dark-mode`, `feat/calendar-export`).
- `fix/hata-adi`: Bir hatayı düzeltirken (örn: `fix/amfi-parser-regex`).
- `docs/dokuman-adi`: Dokümantasyon geliştirmelerinde (örn: `docs/architecture-update`).

### Örnek Branch ile Geliştirme Adımları:
```bash
# 1. Main branch'in güncel olduğundan emin olun
git checkout main
git pull origin main

# 2. Yeni bir feature branch açın
git checkout -b feat/takvim-aktarimi

# 3. Değişikliklerinizi yapın ve commit atın
git add .
git commit -m "feat: iCal takvim dışa aktarma (.ics) özelliği eklendi"

# 4. Branch'inizi GitHub'a gönderin
git push -u origin feat/takvim-aktarimi

# 5. GitHub arayüzünden 'Pull Request (PR)' oluşturun
```

---

## 📋 Pull Request (PR) Kuralları

1. **Açıklayıcı Başlık & Açıklama:** Ne yapıldığını ve neden yapıldığını belirtin.
2. **Yerel Test:** Kodun çalıştığından ve veri derleyicisinin (`py scripts/build_data.py`) sorunsuz tamamlandığından emin olun.
3. **PWA ve Offline Uyumluluğu:** Yeni varlıklar eklenirse `sw.js` önbellek listesine dahil edildiğini kontrol edin.
