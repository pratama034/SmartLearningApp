# SmartLearning App

Satu proyek React/Vite yang siap di-deploy ke Vercel. API `Study Block` tersedia sebagai Vercel Function di `api/study-blocks.ts`; tidak ada lagi server NestJS terpisah.

## Menjalankan lokal

```bash
npm install
npm run dev
```

Untuk menjalankan frontend dan Vercel Function bersamaan di lokal, gunakan `npm run dev:vercel` setelah memasang dan login Vercel CLI.

## Deploy ke Vercel

1. Import repository ini di Vercel dengan Root Directory `.`.
2. Atur Build Command menjadi `npm run build` dan Output Directory menjadi `dist`.
3. Jalankan [supabase/schema.sql](./supabase/schema.sql) pada Supabase SQL Editor untuk membuat tabel `study_blocks`.
4. Tambahkan environment variables dari `.env.example` di Vercel Project Settings.
5. Deploy. Semua URL React, termasuk URL langsung seperti `/dashboard`, tetap diarahkan ke aplikasi melalui `vercel.json`.

`VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` aman dipakai di browser. `SUPABASE_SERVICE_ROLE_KEY` hanya dipakai oleh API server dan tidak boleh diawali `VITE_` atau dimasukkan ke Git.

Jika API belum dikonfigurasi, aplikasi tetap dapat digunakan dengan fallback localStorage untuk Study Block.
