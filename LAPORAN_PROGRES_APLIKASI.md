# LAPORAN STATUS & ARSITEKTUR APLIKASI SMARTLEARNING
**Sistem Manajemen Fokus Belajar & Kolaborasi Akademik (Smart Focus Akademik)**  
*Dokumen Resmi: Status Progres, Spesifikasi Fitur, dan Logika Mock Data*  
*Tanggal: 30 Oktober 2026*  

---

## 1. Ringkasan Eksekutif & Status Terakhir

Aplikasi **SmartLearning** telah berhasil dibangun sebagai sistem terintegrasi yang menggabungkan:
1. **Web Application (Frontend Utama)**: Berbasis **React 19 + TypeScript + Vite 8 + Tailwind CSS** dengan tema akademik klasik (*Classic Clean Academic Theme*: `#1D3668` Deep Navy, `#BE2257` Crimson Rose, `#F3F4FA` Off-White).
2. **Mobile Android Application**: Berbasis **React Native / Expo SDK 58** di direktori `mobile/` yang dilengkapi dengan modul native Kotlin (*Accessibility Service* & *Notification Listener Service*) untuk penegakan blokir aplikasi dan penahanan notifikasi di perangkat Android fisik.

### Status Kesehatan Sistem & Build:
* **TypeScript & Bundler**: Lulus uji kompilasi 100% (`tsc -b && vite build`) dengan **0 error**.
* **Linter (Oxlint)**: Lulus tanpa error pada seluruh basis kode web.
* **Arsitektur State**: Menggunakan **Zustand** dengan arsitektur terpisah per domain (`authStore`, `studyStore`, `sessionStore`, `groupStore`) yang saling tersinkronisasi.
* **Mode Operasional**: Berjalan **100% fungsional dalam mode Mock Data Lokal** (tanpa ketergantungan koneksi Supabase Cloud) dengan persistensi browser (`localStorage`).

---

## 2. Rincian Fitur Aplikasi (User Journey & Fitur Unggulan)

### A. Autentikasi & Manajemen Profil Mahasiswa
* **Alur Masuk & Daftar (`/login` & `/register`)**:
  * Form login dan register interaktif dengan validasi format email & kata sandi.
  * Sistem *dual-mode*: Mencoba autentikasi Supabase terlebih dahulu; jika offline atau gagal, otomatis fallback ke autentikasi mock lokal sehingga aplikasi dapat selalu dicoba.
* **Pengaturan Profil Akademik (`/settings`)**:
  * **Header Profil Mahasiswa**: Menampilkan avatar bundar inisial (monogram), nama lengkap, email, NIM, dan status aktif.
  * **Formulir Edit Data**: Pengguna dapat mengubah Nama Lengkap, NIM (Nomor Induk Mahasiswa), Program Studi / Jurusan, dan Universitas / Kampus.
  * **Toast Feedback**: Notifikasi hijau otomatis muncul saat profil berhasil diperbarui.
  * **Zona Bahaya (Danger Zone)**: Tombol keluar aplikasi (*Logout*) yang mereset sesi, membersihkan penyimpanan lokal, dan mengarahkan kembali ke `/login`.

### B. Dashboard Mahasiswa (`/dashboard`)
* **Sapaan Kontekstual**: Waktu dinamis (*"Selamat Pagi / Siang / Sore / Malam"*), tanggal akademik real-time, dan indikator status fokus.
* **Metrik & Ringkasan Target**: Statistik sesi belajar tuntas, total jam fokus, skor konsistensi, dan daftar blok belajar hari ini.
* **Quick Actions**: Tombol akses cepat untuk memulai sesi fokus instan atau membuat blok jadwal baru.
* **Widget Rekan Fokus**: Pratinjau status rekan belajar yang sedang aktif atau istirahat.

### C. Manajemen Blok Belajar / Study Blocks (`/study-blocks`)
* **Perencanaan Terjadwal**: Pengguna dapat menyusun blok jadwal berdasarkan 4 kategori akademik: *Jadwal kuliah*, *Belajar mandiri*, *Kerja kelompok*, dan *Persiapan ujian*.
* **Parameter Fokus**:
  * Pilihan tanggal (otomatis dihitung relatif).
  * Jam mulai dan selesai.
  * Opsi *Auto Focus* (otomatis mengaktifkan penahan notifikasi saat jam blok tiba).
  * Opsi *Co-Focus* (menghubungkan blok dengan ruang belajar bersama).
* **Validasi Skema (Zod)**: Memastikan jam selesai selalu lebih besar dari jam mulai dan input teks tidak kosong.
* **Manajemen Status Blok**: Menandai blok sebagai *scheduled*, *active*, atau *completed*.

### D. Mode Fokus Mendalam / Deep Focus (`/focus`)
* **Timer Hitung Mundur Interaktif**: Durasi sesi fokus yang dapat disesuaikan (25 menit Pomodoro, 50 menit Deep Work, atau durasi kustom).
* **Kontrol Sesi**: Tombol Mulai (*Start*), Jeda (*Pause*), Lanjutkan (*Resume*), dan Akhiri Sesi (*Finish*).
* **Simulasi Penahan Notifikasi (Notification Hold)**:
  * Selama sesi berjalan, aplikasi menahan notifikasi masuk dari aplikasi media sosial (Instagram, WhatsApp, TikTok).
  * Pengguna dapat melihat daftar notifikasi yang ditahan di panel khusus tanpa terdistraksi suara atau popup.
* **Status "LIVE" di Navigasi**: Menu navigasi menampilkan indikator pulsa animasi merah menyala ketika sesi fokus sedang berjalan.

### E. Ringkasan Sesi / Session Summary (`/summary`)
* **Refleksi Akademik**: Tinjauan durasi belajar yang berhasil diselesaikan dan persentase kepatuhan fokus.
* **Bongkar Notifikasi Tertahan**: Pengguna dapat membaca seluruh notifikasi yang masuk selama sesi fokus berlangsung secara aman setelah sesi selesai.
* **Pencatatan Evaluasi**: Hasil sesi dicatat ke dalam histori evaluasi untuk grafis analitik.

### F. Co-Focus & Sistem Ruang Belajar Berbasis Join Code (`/cofocus`)
* **Berbagi Status Fokus (*Presence Sharing*)**:
  * Toggle *switch* untuk membagikan status fokus ke rekan kelompok.
  * Pesan balasan otomatis (*Auto-reply message*) yang dapat diedit oleh mahasiswa.
* **Sistem Join Code 6 Karakter (Kapasitas Maksimal 6 Orang)**:
  * **Tombol "Buat Ruang Belajar"**: Menghasilkan 6 karakter alfanumerik acak unik (misal: `INOV26`). Pengguna otomatis menjadi **Host** ruang belajar.
  * **Tombol "Gabung pakai Kode"**: Membuka modal input dengan validasi format 6 digit (auto-uppercase & filter karakter non-alfanumerik).
  * **Validasi Kapasitas Penuh**: Jika ruang belajar sudah mencapai 6 orang, sistem menolak dengan pesan *"Maaf, ruang belajar sudah penuh (Maks 6 orang)"*. Tersedia kode uji coba `PENUH6` untuk pengujian validasi.
  * **Visualisasi Slot 6 Anggota**: Grid kartu yang menampilkan kartu profil anggota aktif lengkap dengan badge status (*Sedang Fokus* / *Istirahat*), badge *Host Ruang*, serta kartu *dashed placeholder* untuk slot sisa yang masih kosong.
  * **Multi-Room Switcher**: Tab navigasi cepat di atas jika pengguna tergabung di lebih dari satu ruangan.

### G. Forum Diskusi & Berbagi Berkas Multi-Format (`/cofocus/room`)
* **Header Ruang Terpadu**: Nama ruangan aktif, kode unik ruangan dengan tombol *Copy*, dan rasio jumlah anggota (`x / 6 Anggota`).
* **Sidebar Anggota & Panduan Berkas**: Menampilkan daftar teman kelompok beserta status fokus real-time dan petunjuk format file.
* **Feed Obrolan Interaktif**:
  * Balon obrolan kontras (pesan pengguna lain abu-abu `#F6F7FC`, pesan sendiri biru navy `#1D3668`).
  * Stempel waktu otomatis (format jam lokal `id-ID`).
* **Fitur Kirim Berkas Multi-Format**:
  1. **Dokumen PDF (`.pdf`)**: Berwarna rose-crimson dengan rincian ukuran file dan tombol unduh.
  2. **Dokumen Word (`.docx`, `.doc`)**: Berwarna biru dengan rincian nama file dokumen tugas.
  3. **Gambar / Diagram (`.jpg`, `.jpeg`, `.png`)**: Penampil gambar dengan pratinjau thumbnail instan (`object-contain`), label, dan tautan unduh.
  4. **Pilihan Berkas Cepat (Template Sample)**: Pengguna dapat langsung menekan tombol draf berkas (PDF tugas, draf makalah Word, atau diagram sistem JPG) untuk simulasi instan tanpa perlu menyiapkan file di laptop.

### H. Laporan & Evaluasi Pembelajaran (`/reports`)
* **Tab Evaluasi Pribadi**:
  * Skor Indeks Fokus Mingguan.
  * Grafik Tren Jam Belajar Harian menggunakan **Recharts** (AreaChart / BarChart responsif).
  * Analisis jam produktif dan gangguan paling sering.
* **Tab Komparasi Kampus / Jurusan**:
  * Rata-rata jam fokus rekan se-jurusan.
  * Tolok ukur konsistensi akademik (*academic benchmark*).

---

## 3. Arsitektur & Logika Penggunaan Mock Data

Aplikasi dirancang menggunakan filosofi **"Offline-First / Zero Backend Blocker"**. Seluruh state bisnis tidak bergantung langsung pada API eksternal yang lambat, melainkan dikelola secara deterministik menggunakan **Zustand** dengan sinkronisasi ke **Browser LocalStorage**.

Berikut adalah rincian logika mock data di setiap lapisan:

```
┌─────────────────────────────────────────────────────────────┐
│                      KOMPONEN UI REACT                      │
│   Dashboard  |  StudyBlocks  |  FocusMode  |  CoFocus/Room  │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
       membaca state /                 memanggil action
     reaktif re-render                 (create/update/join)
               │                              │
┌──────────────▼──────────────────────────────▼───────────────┐
│                    ZUSTAND STATE STORES                     │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  authStore   │  │  studyStore  │  │    groupStore     │  │
│  │ (User Mock)  │  │(Blocks CRUD) │  │(Join Code & Limit)│  │
│  └──────┬───────┘  └──────┬───────┘  └─────────┬─────────┘  │
│         │                 │                    │            │
│  ┌──────┴─────────────────┴────────────────────┴─────────┐  │
│  │                     sessionStore                      │  │
│  │       (Timer, Status Fokus LIVE, Auto-Reply)          │  │
│  └────────────────────────┬──────────────────────────────┘  │
└───────────────────────────┼─────────────────────────────────┘
                            │
              persistensi otomatis JSON
                            │
┌───────────────────────────▼─────────────────────────────────┐
│             BROWSER STORAGE & MASTER MOCK DATA              │
│  - localStorage: 'smartlearning-user'                       │
│  - localStorage: 'smartlearning-study-blocks'               │
│  - localStorage: 'smartlearning-study-groups'               │
│  - Master Seed Data: src/data/mockData.ts                   │
└─────────────────────────────────────────────────────────────┘
```

---

### A. Logika Mock Autentikasi & Profil (`src/store/authStore.ts`)
* **Tipe Data**:
  ```ts
  export interface User {
    id: string
    name: string
    email: string
    nim: string
    major: string
    university: string
  }
  ```
* **Initial State Generator**:
  Saat pertama kali dibuka, store memeriksa `localStorage.getItem('smartlearning-user')`. Jika belum ada, sistem menginisialisasi mahasiswa dummy:
  * Nama: `Budi Santoso`
  * NIM: `2201082001`
  * Jurusan: `Teknik Informatika`
  * Kampus: `Universitas Indonesia`
  * Email: `budi.santoso@ui.ac.id`
* **Logika Perubahan Reaktif**:
  Ketika fungsi `updateProfile(data)` dipanggil di halaman Settings, store memperbarui objek `user` dan menulis ulang ke `localStorage`. Perubahan ini otomatis terbaca oleh `groupStore` sehingga saat pengguna membuat ruangan baru, nama dan inisial avatar host langsung menggunakan profil terbaru.

---

### B. Logika Mock Ruang Belajar & Kode Unik 6 Karakter (`src/store/groupStore.ts`)
* **Struktur Data Ruangan**:
  ```ts
  export interface StudyGroupItem {
    id: string
    name: string
    description?: string
    joinCode: string        // 6 Karakter Unik (A-Z, 0-9)
    maxMembers: number      // Nilai konstan = 6
    hostId: string
    members: GroupMemberItem[]
    createdAt: string
  }
  ```
* **Generator Kode Unik (`generateUniqueCode`)**:
  Menggunakan alfabet aman tanpa karakter ambigu (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`). Algoritma menjalankan *loop* pengecekan bentrok terhadap seluruh grup yang ada untuk memastikan kode selalu unik secara matematis.
* **Logika `createGroup(name)`**:
  1. Mengambil data user login terkini dari `authStore.getState().user`.
  2. Menghasilkan inisial avatar 2 huruf (misal: "Budi Santoso" $\rightarrow$ "BS").
  3. Membentuk objek anggota pertama bertanda `isHost: true`.
  4. Menetapkan `maxMembers: 6`.
  5. Menyimpan ke daftar grup, menetapkan ruangan tersebut sebagai `activeGroup`, dan menyimpan ke `localStorage`.
* **Logika `joinGroup(code)`**:
  1. Menghapus spasi dan mengubah input menjadi huruf kapital (*case-insensitive*).
  2. **Pencarian**: Mencari grup berdasarkan kecocokan `joinCode`. Jika tidak ditemukan $\rightarrow$ mengembalikan `{ success: false, error: 'Kode ruangan tidak valid' }`.
  3. **Pemeriksaan Batas Kuota (Maks 6 Orang)**:
     ```ts
     if (targetGroup.members.length >= 6) {
       return { success: false, error: 'Maaf, ruang belajar sudah penuh (Maks 6 orang)' }
     }
     ```
  4. **Pemeriksaan Duplikasi**: Jika pengguna sudah terdaftar di grup tersebut, sistem tidak menduplikasi data, melainkan langsung mengarahkan dan menetapkan grup tersebut sebagai grup aktif.
  5. **Penambahan Anggota**: Menambahkan anggota baru ke array `members` dan memperbarui `localStorage`.
* **Seed Data Uji Coba**:
  - `INOV26`: "Kelompok Inovasi" (4 anggota, tersisa 2 slot kosong untuk dicoba bergabung).
  - `PENUH6`: "Kelompok Algoritma & Struktur Data" (6 anggota lengkap, untuk menguji validasi kapasitas maksimum).

---

### C. Logika Mock Penjadwalan Dinamis (`src/store/studyStore.ts` & `src/data/mockData.ts`)
* **Kalkulasi Tanggal Relatif (`getStudyDate`)**:
  Alih-alih tanggal *hardcoded* statis yang cepat kedaluwarsa, fungsi `getStudyDate(offsetDays)` menghitung tanggal relatif terhadap hari ini dengan zona waktu `Asia/Jakarta`:
  - `offset = 0` $\rightarrow$ Hari ini (otomatis muncul di jadwal harian Dashboard).
  - `offset = 1` $\rightarrow$ Besok.
  - `offset = 2` $\rightarrow$ Lusa.
* **CRUD Lokal**: Operasi penambahan, pengubahan status (*completed*), dan penghapusan blok belajar langsung memperbarui state dan tersimpan di `localStorage`.

---

### D. Logika Sinkronisasi Status Fokus Real-Time (`src/store/sessionStore.ts`)
* **State Antar-Halaman**:
  - Ketika pengguna menekan tombol *Mulai Fokus* di `/focus`, `sessionStatus` berubah menjadi `'running'`.
  - Secara otomatis, komponen [CoFocus.tsx](file:///c:/LIFE/SmartLearningApp/src/pages/CoFocus.tsx) dan [StudyGroupRoom.tsx](file:///c:/LIFE/SmartLearningApp/src/components/group/StudyGroupRoom.tsx) mendeteksi status ini dan mengubah badge status diri sendiri dari `'Tersedia'` / `'Istirahat'` menjadi `'Sedang Fokus'` (`#FCDDE6`).
  - Fitur *Auto-reply* otomatis aktif memberikan balasan kepada rekan kelompok.
  - Saat sesi selesai di `/summary`, status kembali normal.

---

### E. Logika Mock Pengiriman File di Chat Forum (`StudyGroupRoom.tsx`)
* **Penanganan File Lokal**:
  Ketika pengguna memilih file fisik dari komputernya:
  1. Jenis file dideteksi dari ekstensi (`.pdf`, `.docx`/`.doc`, `.jpg`/`.png`).
  2. Ukuran file dikonversi menjadi satuan yang ramah dibaca (`formatFileSize`: B, KB, MB).
  3. Khusus gambar: dibuatkan *Blob URL* temporer via `URL.createObjectURL(file)` sehingga gambar dapat langsung ditampilkan di feed obrolan secara instan tanpa proses upload server.
  4. Ditambahkan ke dalam array pesan lokal dengan stempel waktu saat ini.

---

## 4. Struktur Direktori Proyek

```text
SmartLearningApp/
├── api/                             # Serverless backend functions (Vercel)
│   └── study-blocks.ts
├── mobile/                          # Aplikasi Mobile Android (React Native / Expo)
│   ├── modules/focus-enforcement/   # Custom Kotlin Android Module (Accessibility & Notif Listener)
│   ├── plugins/withFocusServices.js # Custom Expo Config Plugin untuk modifikasi AndroidManifest
│   ├── app.json                     # Konfigurasi Expo Android
│   ├── App.tsx                      # Entry point React Native dengan 4 Tab Akademik
│   └── package.json
├── src/                             # Sumber Kode Web Utama (React 19 + Vite)
│   ├── components/
│   │   ├── evaluation/              # Komponen analitik & grafik
│   │   ├── focus/                   # Komponen timer fokus & penahan notifikasi
│   │   ├── group/
│   │   │   └── StudyGroupRoom.tsx   # Halaman Forum Belajar & Multi-Format Attachment
│   │   ├── Layout.tsx               # Sidebar desktop & Bottom Nav mobile
│   │   └── ProtectedRoute.tsx       # Guard rute terproteksi
│   ├── data/
│   │   └── mockData.ts              # Master seed data (blok, member, chat, analitik)
│   ├── pages/
│   │   ├── CoFocus.tsx              # Halaman Co-Focus, Modal Join Code, 6-Slot Grid
│   │   ├── Dashboard.tsx            # Beranda mahasiswa & metrik
│   │   ├── FocusMode.tsx            # Mode fokus mendalam
│   │   ├── Login.tsx / Register.tsx # Autentikasi
│   │   ├── Reports.tsx              # Laporan analitik Recharts
│   │   ├── SessionSummary.tsx       # Evaluasi pasca-fokus
│   │   ├── Settings.tsx             # Pengaturan profil mahasiswa & Logout
│   │   └── StudyBlocks.tsx          # Manajemen blok belajar
│   ├── store/                       # Zustand Global Stores
│   │   ├── authStore.ts             # State user, NIM, profil, dan logout
│   │   ├── groupStore.ts            # State ruang belajar, kode 6 digit, batas 6 orang
│   │   ├── sessionStore.ts          # State timer fokus & simulasi notifikasi
│   │   └── studyStore.ts            # State CRUD blok belajar
│   ├── App.tsx                      # Routing & Protected Router
│   └── main.tsx                     # Entry point React DOM
├── eas.json                         # Konfigurasi EAS Cloud Build (Android APK)
├── tailwind.config.js               # Konfigurasi Tailwind & Palet Warna Akademik
└── package.json                     # Dependensi root web
```

---

## 5. Panduan Menjalankan & Menguji Aplikasi

### Menjalankan Web Application:
```bash
# 1. Jalankan development server
npm run dev

# 2. Buka di browser
# http://localhost:5173
```

### Menguji Skenario Mock Utama:
1. **Uji Ubah Profil**: Buka menu **Pengaturan** $\rightarrow$ ubah Nama / NIM / Jurusan $\rightarrow$ klik *Simpan Perubahan*. Periksa header dan nama pengguna di seluruh aplikasi.
2. **Uji Buat Ruang Belajar**: Buka menu **Co-Focus** $\rightarrow$ klik *Buat Ruang Belajar* $\rightarrow$ isi nama ruangan $\rightarrow$ sistem akan memberikan 6 digit kode unik dan membuka ruangan baru dengan Anda sebagai Host.
3. **Uji Gabung Ruang dengan Kode**:
   - Masukkan kode `INOV26` $\rightarrow$ Anda akan bergabung ke "Kelompok Inovasi".
   - Masukkan kode `PENUH6` $\rightarrow$ Sistem akan menampilkan pesan error validasi bahwa ruangan sudah penuh (maks 6 orang).
4. **Uji Kirim Berkas di Ruang Belajar**: Masuk ke ruang belajar $\rightarrow$ klik ikon klip kertas (📎) $\rightarrow$ pilih kirim PDF, Word, atau Gambar (atau gunakan tombol template draf).
5. **Uji Sesi Fokus**: Masuk ke menu **Mode Fokus** $\rightarrow$ mulai sesi $\rightarrow$ perhatikan indikator LIVE di sidebar dan perubahan status di Co-Focus menjadi "Sedang Fokus".

