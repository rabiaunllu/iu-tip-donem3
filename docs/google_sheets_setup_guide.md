# 📋 Google E-Tablo & Apps Script Kurulum Rehberi (5 Dakika)

Bu rehber, **İÜ Tıp Fakültesi Dönem 3 Akıllı Ders Programı** geri bildirim kutusunu kendi Google Drive hesabınıza bağlamanız için adım adım hazırlanmıştır. Tamamen **ücretsizdir** ve kredi kartı gerektirmez.

---

## 1. Adım: Yeni Google E-Tablo Açın

1. [Google Drive](https://drive.google.com)'a girin ve **Yeni ➔ Google E-Tablolar (Google Sheets)** seçeneğine tıklayın.
2. Tablonun adını **`İÜ Tıp D3 — Geri Bildirim Havuzu`** yapın.
3. İlk satıra (1. Satır - Başlıklar) sırasıyla şu sütun isimlerini yazın:

| A1 | B1 | C1 | D1 | E1 | F1 | G1 |
|---|---|---|---|---|---|---|
| **Tarih & Saat** | **Kategori** | **Öğrenci Grubu** | **Mesaj** | **İletişim** | **İşlem Durumu** | **Yönetici Notu** |

*(İsteğe bağlı: 1. satırı kalın yapıp arkaplanını açık mavi veya gri yaparak daha okunaklı hale getirebilirsiniz.)*

---

## 2. Adım: Google Apps Script Kodunu Ekleyin

1. E-Tablonun üst menüsünden **Uzantılar (Extensions) ➔ Apps Script** seçeneğine tıklayın.
2. Açılan kod editöründeki mevcut tüm kodu silin ve yerine aşağıdaki kodu yapıştırın:

```javascript
/**
 * İÜ Tıp Fakültesi Dönem 3 — Geri Bildirim Webhook Servisi
 */
function doPost(e) {
  try {
    var lock = LockService.getScriptLock();
    // Eşzamanlı yazma çakışmalarını önlemek için 10 sn bekle
    lock.waitLock(10000);

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Gelen JSON verisini ayrıştır
    var rawData = e.postData.contents;
    var data = JSON.parse(rawData);

    // 🛡️ Savunmacı Mühendislik: Honeypot bot kapanı kontrolü
    if (data.botCheck && data.botCheck.trim() !== '') {
      return ContentService.createTextOutput(JSON.stringify({ status: 'ignored' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Zaman Damgası (İstanbul Saati)
    var now = new Date();
    var timeZone = Session.getScriptTimeZone() || "GMT+3";
    var formattedDate = Utilities.formatDate(now, timeZone, "dd.MM.yyyy HH:mm");

    // Satırı Google E-Tablo'ya ekle
    sheet.appendRow([
      formattedDate,
      data.category || 'Genel',
      data.groupInfo || 'Belirtilmedi',
      data.message || '',
      data.contact || 'Belirtilmedi',
      'Beklemede ⏳',
      ''
    ]);

    lock.releaseLock();

    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

3. Üstteki **Kaydet** simgesine (💾) tıklayın.

---

## 3. Adım: Web App Olarak Dağıtın (Deploy)

1. Sağ üstteki mavi **Dağıt (Deploy) ➔ Yeni dağıtım (New deployment)** butonuna tıklayın.
2. Sol taraftaki dişli çark simgesinden tür olarak **Web uygulaması (Web app)** seçin.
3. Ayarları şu şekilde yapın:
   - **Açıklama:** `İÜ Tıp Geri Bildirim Webhook v1`
   - **Farklı yürüt (Execute as):** `Ben (E-posta adresiniz)` *(Varsayılan)*
   - **Erişimi olanlar (Who has access):** **`Herkes (Anyone)`** *(Önemli: Tıp öğrencilerinin şifresiz form gönderebilmesi için 'Herkes' seçilmelidir).*
4. **Dağıt (Deploy)** butonuna basın.
5. Google hesabınızla yetkilendirme (Authorize access) isteyebilir. İzin verin.
6. Size bir **Web uygulaması URL'si (Web app URL)** verecektir. Şuna benzer:
   `https://script.google.com/macros/s/AKfycbx.../exec`
7. Bu URL'yi **Kopyalayın**.

---

## 4. Adım: Web Uygulamasına Bağlayın

Bu URL'yi bağlamak için iki yönteminiz var:

- **Yöntem A (Arayüzden - En Kolayı):** Sitedeki üst menüden **Ayarlar (⚙️)** butonuna tıklayın, *"Geri Bildirim Webhook Linki"* alanına kopyaladığınız URL'yi yapıştırıp *"Kaydet"*e basın.
- **Yöntem B (Koddan):** `js/config.js` dosyasını açıp `DEFAULT_FEEDBACK_WEBHOOK_URL` değişkeninin tırnakları arasına yapıştırın.

Artık öğrenciler siteden geri bildirim gönderdiğinde saniyeler içinde kendi Google E-Tablonuzda belirecektir! 🎉
