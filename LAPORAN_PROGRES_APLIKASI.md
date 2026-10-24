# Laporan Progres Smart Learning App

Tanggal pemeriksaan: 24 Oktober 2026  
Status umum: fondasi aplikasi dan demonstrasi alur fokus sudah tersedia. Aplikasi belum siap dipakai sebagai produk karena sebagian fitur masih berupa antarmuka atau data contoh dan belum terhubung dari frontend ke backend.

## Ringkasan aplikasi

Smart Learning App, yang pada antarmuka diberi nama **Smart Focus Akademik**, ditujukan untuk membantu mahasiswa mengatur blok belajar, memulai sesi fokus, melihat status teman dalam co-focus, dan menyaring notifikasi selama belajar.

Struktur proyek terbagi menjadi dua aplikasi:

| Bagian | Teknologi | Kondisi saat ini |
| --- | --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind, Zustand | Dashboard dan Mode Fokus sudah dapat dibangun. Data masih mock dan status sesi hanya disimpan di memori browser. |
| Backend | NestJS, TypeScript, Prisma, PostgreSQL | Skema database dan API CRUD untuk study block sudah tersedia. Belum ada modul autentikasi, sesi fokus, notifikasi, atau co-focus. |
| Database | PostgreSQL melalui Prisma | Model User, StudyBlock, FocusSession, dan NotificationEvent beserta migrasi awal sudah dibuat. |

## Yang sudah selesai

### 1. Dasar antarmuka frontend

Frontend telah memiliki layout responsif dengan sidebar desktop dan navigasi bawah pada perangkat mobile. Navigasi yang tersedia adalah Dashboard, Study, Fokus, Co-focus, dan Laporan.

Halaman Dashboard sudah menampilkan:

- sapaan dan tanggal berdasarkan zona waktu pengguna;
- ringkasan jumlah study block, notifikasi, serta status co-focus;
- daftar study block hari ini dengan status terjadwal, aktif, dijeda, atau selesai;
- kartu rekan yang sedang fokus;
- penjelasan prinsip Smart Focus.

Halaman Mode Fokus juga sudah menyediakan alur dasar untuk menjeda, melanjutkan, dan mengakhiri sesi fokus.

### 2. Simulasi alur sesi fokus

State lokal dengan Zustand sudah menangani satu sesi aktif dalam satu waktu. Pengguna dapat memulai sesi dari study block, menjeda atau melanjutkan sesi, kemudian mengakhirinya. Saat sesi berakhir, study block ditandai selesai pada state browser.

Ini sudah cukup untuk demonstrasi interaksi antarmuka, tetapi belum tersimpan ke server atau database. Status akan kembali ke data awal saat halaman dimuat ulang.

### 3. Backend untuk study block

Backend sudah memiliki modul `study-blocks` dengan endpoint berikut:

| Metode | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/study-blocks` | Membaca study block, dengan filter opsional `user_id` dan `date`. |
| POST | `/study-blocks` | Membuat study block. |
| PATCH | `/study-blocks/:id` | Mengubah study block. |
| DELETE | `/study-blocks/:id` | Menghapus study block. |

Validasi dasar telah diterapkan untuk UUID pengguna, jenis blok, format tanggal dan waktu, serta nilai boolean. Backend juga sudah mengaktifkan CORS dan validation pipe global.

### 4. Data model dan migrasi awal

Skema Prisma dan migrasi PostgreSQL mencakup entitas berikut:

- `User` untuk data mahasiswa dan tenant;
- `StudyBlock` untuk jadwal belajar;
- `FocusSession` untuk riwayat sesi fokus;
- `NotificationEvent` untuk catatan notifikasi selama sesi.

Relasi dan indeks dasar sudah dibuat. Ini merupakan fondasi yang tepat untuk melanjutkan fitur inti.

### 5. Pemeriksaan build

Build production frontend dan backend berhasil pada pemeriksaan ini:

- Frontend: `npm run build` berhasil; Vite menghasilkan bundle production.
- Backend: `npm run build` berhasil; NestJS berhasil mengompilasi aplikasi.

## Yang masih sebagian atau belum terhubung

| Area | Kondisi | Dampak |
| --- | --- | --- |
| Integrasi frontend ke API | Belum ada pemanggilan API pada frontend; data berasal dari `mockData.ts`. | Perubahan di dashboard tidak tersimpan di database. |
| Halaman Study Block | Tautan navigasi tersedia, tetapi rute/halaman belum dibuat. | Pengguna belum dapat melihat, membuat, atau mengubah jadwal melalui UI. |
| Co-focus | Dashboard hanya menampilkan data contoh. Tombol sapaan belum menjalankan aksi. | Tidak ada data kehadiran atau komunikasi antar pengguna secara nyata. |
| Laporan | Menu tersedia, tetapi rute/halaman belum dibuat. | Belum ada statistik atau riwayat belajar. |
| Notifikasi | Model database dan data mock tersedia, tetapi belum ada service penyaringan atau integrasi sumber notifikasi. | Fitur utama penyaringan notifikasi belum berjalan. |
| Sesi fokus di backend | Tabel database sudah ada, tetapi endpoint dan service belum dibuat. | Sesi tidak dapat dipertahankan atau direkap lintas perangkat. |
| Autentikasi dan otorisasi | Belum ada login, token, password hashing, atau pembatasan akses. | Pengguna masih diambil tetap dari data mock. |
| Pengujian | Hanya ada pengujian default endpoint root. | Endpoint study block dan alur fokus belum tervalidasi otomatis. |
| Konfigurasi operasional | README masih bawaan framework dan belum menjelaskan setup aplikasi atau environment database. | Onboarding pengembang dan deployment belum siap. |

## Catatan temuan teknis

1. Frontend mendefinisikan beberapa tipe seperti group dan notification, tetapi backend belum memiliki model atau API group/member yang sesuai.
2. Frontend memiliki menu menuju `/study-blocks`, `/cofocus`, dan `/reports`, sementara router saat ini hanya mendaftarkan Dashboard dan Mode Fokus. Rute lain akan diarahkan kembali ke Dashboard.
3. Data contoh study block memakai ID seperti `user-001`, sedangkan API backend memvalidasi `user_id` sebagai UUID. Data frontend saat ini tidak dapat langsung diposting ke API tanpa penyesuaian data atau strategi mapping.
4. Status sesi selesai pada frontend belum mencatat `ended_at` dan `ended_by`, padahal field tersebut tersedia pada skema database.

## Tahap pengembangan saat ini

Secara praktis, aplikasi berada pada tahap **prototype fungsional frontend dan fondasi backend**. Desain pengalaman pengguna untuk dashboard serta simulasi Mode Fokus sudah terlihat jelas. Backend telah melewati tahap inisialisasi dan memiliki fondasi database serta CRUD study block. Namun integrasi fitur inti belum dilakukan, sehingga aplikasi belum dapat disebut MVP yang siap diuji oleh pengguna nyata.

## Prioritas pengerjaan berikutnya

1. Hubungkan frontend ke API study block dan gantikan data mock secara bertahap.
2. Buat halaman Study Block untuk melihat, membuat, mengubah, dan menghapus jadwal.
3. Tambahkan API dan penyimpanan untuk memulai, menjeda, melanjutkan, serta mengakhiri FocusSession.
4. Implementasikan autentikasi pengguna dan pastikan seluruh query dibatasi berdasarkan pengguna yang login.
5. Bangun fitur notifikasi dan co-focus dari sisi backend, termasuk kebutuhan real-time bila diperlukan.
6. Tambahkan pengujian unit dan end-to-end untuk study block dan sesi fokus.
7. Lengkapi dokumentasi setup, environment database, serta cara menjalankan frontend dan backend.

## Kesimpulan

Proyek sudah mempunyai arah produk yang jelas dan komponen awal yang cukup baik: antarmuka dashboard, simulasi Mode Fokus, model data, migrasi, serta API study block. Pekerjaan terbesar berikutnya adalah menjadikan seluruh alur tersebut nyata melalui integrasi frontend-backend, autentikasi, penyimpanan sesi fokus, dan implementasi fitur yang saat ini masih berbentuk mock atau menu kosong.
