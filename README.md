# FitnessPlus Yönetim Paneli

FitnessPlus, spor salonları ve kişisel antrenörler (koçlar) için tasarlanmış modern bir üye ve program yönetimi platformudur. Bu proje, Vite, React, TypeScript ve Firebase kullanılarak geliştirilmiştir.

## 🚀 Projenin Amacı

Bu platform, iki ana kullanıcı rolü üzerine odaklanmıştır: **Admin** ve **Koç**.

* **Admin Paneli:**
    * Sisteme kayıtlı tüm koçları yönetebilir (ekleme, düzenleme).
    * Koçlara atanan üyeleri görüntüleyebilir.
    * Koçlar tarafından eklenen yeni üye paketleri için "Onay Merkezi"ni yönetir.
    * Platformun genel istatistiklerini (toplam gelir, üye sayısı, aktif koçlar) takip edebilir.
    * Genel uygulama ayarlarını yönetir.

* **Koç Paneli:**
    * Sadece kendi üyelerini listeleyebilir ve yönetebilir.
    * Kendi üyeleri için yeni paketler oluşturabilir (bu paketler admin onayına düşer).
    * Kendi haftalık ders programını (takvimini) yönetebilir.
    * Kendine ait istatistikleri (aktif üyeler, toplam kazanç, onay bekleyenler) görebilir.

## 🛠️ Kullanılan Teknolojiler

* **Frontend:** React (Vite ile)
* **Dil:** TypeScript
* **Styling:** CSS Modülleri (Örn: `Dashboard.module.css`)
* **Routing:** React Router DOM
* **Backend & Veritabanı:** Firebase (Firestore)
* **Kimlik Doğrulama:** Firebase Authentication
* **İkonlar:** Lucide React

## 📂 Proje Yapısı (Özet)

Proje, roller ve özellikler bazında modüler bir yapıyı takip eder:

src/ ├── components/ # (Navbar, Form vb. gibi) Paylaşılan bileşenler ├── context/ # (AuthContext gibi) Global state yönetimi ├── firebase/ # Firebase config ve servis fonksiyonları ├── pages/ │ ├── Admin/ # Admin'e özel sayfalar (Dashboard, CoachManagement, Approvals) │ └── Coach/ # Koç'a özel sayfalar (CoachDashboard, CoachMembers, CoachSchedule) ├── App.tsx # Ana yönlendirici (router) mantığı └── main.tsx # React uygulamasının başlangıç noktası


## 🏁 Başlangıç (Yerel Geliştirme)

1.  **Projeyi klonlayın:**
    git clone [https://github.com/Brostagma/fitnessplusapp.git](https://github.com/Brostagma/fitnessplusapp.git)
    cd fitnessplusapp


2.  **Bağımlılıkları yükleyin:**
    npm install
    # veya
    yarn install

3.  **Firebase Kurulumu:**
    * Bir Firebase projesi oluşturun.
    * `src/firebase/` dizininde `firebaseConfig.ts` dosyasını (veya ayarlarınız neredeyse) kendi Firebase proje ayarlarınızla güncelleyin.
    * Firestore veritabanını ve Authentication'ı etkinleştirin.

4.  **Uygulamayı çalıştırın:**
    npm run dev

## 🚀 Deployment (Hosting)

Bu proje, statik bir site üreten Vite tabanlı bir React uygulamasıdır. Cloudflare Pages vey