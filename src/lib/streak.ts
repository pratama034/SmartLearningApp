/**
 * Helper modul kalkulasi & evaluasi Streak Belajar Mahasiswa
 * Memastikan streak dihitung harian, aktif jika berturut-turut,
 * dan di-reset ke 0 jika ada 1 hari yang terlewat (bolong).
 */

export type StreakStatus = 'active_today' | 'pending_today' | 'broken'

export interface StreakEvaluation {
  status: StreakStatus
  currentStreak: number
  lastStudyDate: string | null
  needsReset: boolean
  diffDays: number | null
  title: string
  message: string
}

/**
 * Mengembalikan tanggal hari ini dalam format YYYY-MM-DD sesuai zona waktu lokal.
 */
export function getTodayDateString(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Menghitung selisih hari antara dua tanggal bertipe string 'YYYY-MM-DD'.
 */
export function getDaysDifference(currentDateStr: string, previousDateStr: string): number {
  if (!currentDateStr || !previousDateStr) return 0
  const [y1, m1, d1] = currentDateStr.split('-').map(Number)
  const [y2, m2, d2] = previousDateStr.split('-').map(Number)
  const date1 = new Date(y1, m1 - 1, d1)
  const date2 = new Date(y2, m2 - 1, d2)
  const diffTime = date1.getTime() - date2.getTime()
  return Math.round(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Memformat tanggal terakhir belajar untuk tampilan yang ramah di antarmuka.
 */
export function formatLastStudyDateLabel(lastStudyDate?: string | null): string {
  if (!lastStudyDate) return 'Belum ada sesi'
  const todayStr = getTodayDateString()
  const diff = getDaysDifference(todayStr, lastStudyDate)

  if (diff === 0) return 'Hari ini'
  if (diff === 1) return 'Kemarin'
  if (diff > 1) return `${diff} hari yang lalu`

  try {
    const [y, m, d] = lastStudyDate.split('-').map(Number)
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(y, m - 1, d))
  } catch {
    return lastStudyDate
  }
}

/**
 * Mengevaluasi kondisi streak mahasiswa saat aplikasi dibuka / login:
 * - diff === 0: Sudah belajar hari ini (active_today)
 * - diff === 1: Kemarin belajar, hari ini belum (pending_today, pertahankan!)
 * - diff > 1: Melewatkan minimal 1 hari kemarin (broken, reset ke 0)
 * - Jika lastStudyDate belum ada tetapi streak di DB > 0: pertahankan nilai streak dari DB
 */
export function evaluateStreak(
  streak: number,
  lastStudyDate?: string | null
): StreakEvaluation {
  const todayStr = getTodayDateString()
  const safeStreak = Math.max(0, Number(streak) || 0)

  // Jika belum ada lastStudyDate tercatat di kolom DB
  if (!lastStudyDate) {
    if (safeStreak > 0) {
      return {
        status: 'active_today',
        currentStreak: safeStreak,
        lastStudyDate: todayStr,
        needsReset: false,
        diffDays: 0,
        title: `🔥 Streak ${safeStreak} Hari Aktif!`,
        message:
          'Pertahankan konsistensi belajarmu setiap hari untuk meningkatkan level pencapaian.',
      }
    }

    return {
      status: 'broken',
      currentStreak: 0,
      lastStudyDate: null,
      needsReset: false,
      diffDays: null,
      title: 'Mulai Nyalakan Api Streak!',
      message:
        'Selesaikan sesi fokus pertamamu hari ini untuk memulai rekor streak belajar.',
    }
  }

  const diff = getDaysDifference(todayStr, lastStudyDate)

  // Kasus A: Hari ini sudah belajar
  if (diff <= 0) {
    const validStreak = Math.max(1, safeStreak)
    return {
      status: 'active_today',
      currentStreak: validStreak,
      lastStudyDate,
      needsReset: false,
      diffDays: 0,
      title: `🔥 Streak ${validStreak} Hari Menyala!`,
      message:
        'Hebat! Kamu sudah menyelesaikan target sesi belajar hari ini. Pertahankan ritme belajarmu besok.',
    }
  }

  // Kasus B: Kemarin belajar, hari ini belum (Streak masih hidup, perlu belajar hari ini)
  if (diff === 1) {
    const validStreak = Math.max(1, safeStreak)
    return {
      status: 'pending_today',
      currentStreak: validStreak,
      lastStudyDate,
      needsReset: false,
      diffDays: 1,
      title: `⚡ Pertahankan Streak ${validStreak} Hari!`,
      message:
        'Selesaikan minimal 1 sesi fokus hari ini sebelum pukul 23:59 agar api streak tidak padam.',
    }
  }

  // Kasus C: Melewatkan kemarin (diff > 1), streak terputus / bolong
  return {
    status: 'broken',
    currentStreak: 0,
    lastStudyDate,
    needsReset: safeStreak > 0,
    diffDays: diff,
    title: '💔 Streak Belajar Terputus',
    message:
      'Kamu melewatkan aktivitas belajar kemarin sehingga streak kembali ke 0. Jangan patah semangat, mari mulai dari awal hari ini!',
  }
}

/**
 * Menghitung nilai streak baru ketika mahasiswa menyelesaikan/menghentikan sesi timer fokus (stopFocus).
 */
export function calculateNewStreakOnSessionComplete(
  currentStreak: number,
  lastStudyDate?: string | null
): { newStreak: number; isFirstToday: boolean; todayStr: string } {
  const todayStr = getTodayDateString()
  const safeCurrent = Math.max(0, Number(currentStreak) || 0)

  // 1. Jika hari ini sudah pernah menyelesaikan sesi dan streak sudah >= 1, pertahankan (atau minimal 1)
  if (lastStudyDate === todayStr && safeCurrent > 0) {
    return {
      newStreak: safeCurrent,
      isFirstToday: false,
      todayStr,
    }
  }

  // 2. Jika kemarin belajar (diff === 1), tambahkan streak + 1
  if (lastStudyDate) {
    const diff = getDaysDifference(todayStr, lastStudyDate)
    if (diff === 1) {
      return {
        newStreak: safeCurrent + 1,
        isFirstToday: true,
        todayStr,
      }
    }
    if (diff > 1) {
      return {
        newStreak: 1,
        isFirstToday: true,
        todayStr,
      }
    }
  }

  // 3. Jika belum ada lastStudyDate tetapi sudah punya streak di DB, tambahkan + 1
  return {
    newStreak: safeCurrent + 1,
    isFirstToday: true,
    todayStr,
  }
}

/**
 * Menghitung daftar badge pencapaian berdasarkan streak dan jumlah sesi fokus.
 * Menggunakan urutan pengecekan kondisional (if / else if / else)
 * dari tier tertinggi ke tier terendah agar tidak langsung melompat ke "Fokus Master".
 */
export function calculateAchievementBadges(streak: number, totalSessions = 0): string[] {
  const safeStreak = Math.max(0, Number(streak) || 0)
  const safeSessions = Math.max(0, Number(totalSessions) || 0)

  // Urutan pengecekan kondisional dari Tier Tertinggi ke Tier Terendah
  if (safeStreak >= 30 || safeSessions >= 50) {
    return ['Fokus Master', 'Pejuang Konsisten', 'Disiplin Tinggi', 'Fokus Terlatih', 'Awal yang Baik']
  } else if (safeStreak >= 14 || safeSessions >= 25) {
    return ['Pejuang Konsisten', 'Disiplin Tinggi', 'Fokus Terlatih', 'Awal yang Baik']
  } else if (safeStreak >= 7 || safeSessions >= 10) {
    return ['Disiplin Tinggi', 'Fokus Terlatih', 'Awal yang Baik']
  } else if (safeStreak >= 3 || safeSessions >= 3) {
    return ['Fokus Terlatih', 'Awal yang Baik']
  } else if (safeStreak >= 1 || safeSessions >= 1) {
    return ['Awal yang Baik']
  } else {
    return ['Pemula Fokus']
  }
}

