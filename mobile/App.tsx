import { useEffect, useState } from 'react'
import {
  AppState,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import FocusEnforcement, { type HeldNotification } from './modules/focus-enforcement/src'
import {
  mockChatMessages,
  mockEvaluationData,
  mockFocusApps,
  mockGroupMembers,
  mockStudyBlocks,
} from '../src/data/mockData'

type Tab = 'Fokus' | 'Jadwal' | 'Kelompok' | 'Evaluasi'

const tabs: Tab[] = ['Fokus', 'Jadwal', 'Kelompok', 'Evaluasi']
const androidPackageByAppId: Record<string, string> = {
  instagram: 'com.instagram.android',
  tiktok: 'com.zhiliaoapp.musically',
  whatsapp: 'com.whatsapp',
}
const palette = {
  background: '#080D18',
  panel: '#101827',
  panelSoft: '#151F30',
  border: '#253247',
  text: '#F8FAFC',
  muted: '#93A1B5',
  indigo: '#A5B4FC',
  green: '#86EFAC',
  amber: '#FCD34D',
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('Fokus')
  const [nativeAvailable, setNativeAvailable] = useState(() => FocusEnforcement.isNativeAvailable())
  const [focusActive, setFocusActive] = useState(() =>
    FocusEnforcement.isNativeAvailable() ? FocusEnforcement.isFocusEnabled() : false
  )
  const [blockedPackages, setBlockedPackages] = useState([
    'com.instagram.android',
    'com.zhiliaoapp.musically',
    'com.whatsapp',
  ])
  const [accessibilityEnabled, setAccessibilityEnabled] = useState(() =>
    FocusEnforcement.isNativeAvailable() ? FocusEnforcement.isAccessibilityEnabled() : false
  )
  const [notificationAccessEnabled, setNotificationAccessEnabled] = useState(() =>
    FocusEnforcement.isNativeAvailable() ? FocusEnforcement.isNotificationAccessEnabled() : false
  )
  const [heldNotifications, setHeldNotifications] = useState<HeldNotification[]>(() =>
    FocusEnforcement.isNativeAvailable() ? FocusEnforcement.getHeldNotifications() : []
  )
  const [heldNotificationCount, setHeldNotificationCount] = useState(() =>
    FocusEnforcement.isNativeAvailable() ? FocusEnforcement.getHeldNotifications().length : 0
  )
  const [message, setMessage] = useState('')
  const [chat, setChat] = useState(mockChatMessages)

  function refreshNativeAccess() {
    const available = FocusEnforcement.isNativeAvailable()
    setNativeAvailable(available)
    if (!available) {
      setAccessibilityEnabled(false)
      setNotificationAccessEnabled(false)
      setHeldNotifications([])
      setHeldNotificationCount(0)
      return
    }
    setAccessibilityEnabled(FocusEnforcement.isAccessibilityEnabled())
    setNotificationAccessEnabled(FocusEnforcement.isNotificationAccessEnabled())
    const held = FocusEnforcement.getHeldNotifications()
    setHeldNotifications(held)
    setHeldNotificationCount(held.length)
    setFocusActive(FocusEnforcement.isFocusEnabled())
  }

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshNativeAccess()
    })
    return () => subscription.remove()
  }, [])

  function toggleFocus() {
    const next = !focusActive
    setFocusActive(next)
    FocusEnforcement.setFocusEnabled(next, blockedPackages)
    setHeldNotificationCount(FocusEnforcement.getHeldNotifications().length)
  }

  function toggleBlockedApp(id: string) {
    const packageName = androidPackageByAppId[id]
    if (!packageName) return
    setBlockedPackages((current) => {
      const next = current.includes(packageName)
        ? current.filter((item) => item !== packageName)
        : [...current, packageName]
      FocusEnforcement.setFocusEnabled(focusActive, next)
      return next
    })
  }

  function sendMessage() {
    const text = message.trim()
    if (!text) return
    setChat((current) => [
      ...current,
      {
        id: `mobile-${Date.now()}`,
        senderId: 'current-user',
        senderName: 'Anda',
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        kind: 'text' as const,
        text,
      },
    ])
    setMessage('')
  }

  return (
    <View style={styles.app}>
      <StatusBar barStyle="light-content" backgroundColor={palette.background} />
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>SMART FOCUS</Text>
          <Text style={styles.headerTitle}>{activeTab}</Text>
        </View>
        <View style={styles.livePill}>
          <View style={[styles.liveDot, focusActive && styles.liveDotActive]} />
          <Text style={styles.liveText}>{focusActive ? 'FOKUS AKTIF' : 'SIAP BELAJAR'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {activeTab === 'Fokus' && (
          <>
            <View style={styles.timerCard}>
              <Text style={styles.eyebrow}>SESI FOKUS</Text>
              <Text style={styles.timer}>45:00</Text>
              <Text style={styles.bodyMuted}>Tetap fokus pada satu hal dalam satu waktu.</Text>
              <Pressable style={styles.primaryButton} onPress={toggleFocus}>
                <Text style={styles.primaryButtonText}>{focusActive ? 'Akhiri Sesi' : 'Mulai Sesi Fokus'}</Text>
              </Pressable>
              <Text style={styles.note}>
                {nativeAvailable
                  ? 'Pemblokiran dan penahanan notifikasi berjalan setelah layanan Android diaktifkan.'
                  : 'Mode localhost memakai mock data. Penguncian aplikasi dan notifikasi memerlukan APK native.'}
              </Text>
            </View>
            <View style={styles.permissionCard}>
              <Text style={styles.cardTitle}>Izin Android untuk mode fokus</Text>
              <Text style={[styles.smallMuted, styles.permissionCopy]}>
                {nativeAvailable
                  ? 'Layanan aksesibilitas membatasi aplikasi pilihan. Notifikasi dari aplikasi tersebut disimpan lokal selama sesi fokus.'
                  : 'Expo Go hanya menjalankan UI dan data mock. Pengaturan layanan Android tersedia di build native.'}
              </Text>
              <Pressable disabled={!nativeAvailable} style={[styles.secondaryButton, !nativeAvailable && styles.disabledButton]} onPress={() => FocusEnforcement.openAccessibilitySettings()}>
                <Text style={styles.secondaryButtonText}>{accessibilityEnabled ? 'Aksesibilitas aktif · Kelola' : 'Aktifkan App Lock'}</Text>
              </Pressable>
              <Pressable disabled={!nativeAvailable} style={[styles.secondaryButton, !nativeAvailable && styles.disabledButton]} onPress={() => FocusEnforcement.openNotificationSettings()}>
                <Text style={styles.secondaryButtonText}>{notificationAccessEnabled ? `Akses notifikasi aktif · ${heldNotificationCount} ditahan` : 'Aktifkan penahanan notifikasi'}</Text>
              </Pressable>
            </View>
            <SectionTitle title="Aplikasi fokus" detail="Daftar mock lokal" />
            <View style={styles.appGrid}>
              {mockFocusApps.map((item) => (
                <Pressable key={item.id} onPress={() => toggleBlockedApp(item.id)} style={[styles.appTile, blockedPackages.includes(androidPackageByAppId[item.id] ?? '') && styles.blockedTile]}>
                  <Text style={styles.appGlyph}>{item.kind === 'allowed' ? '✦' : '◌'}</Text>
                  <View style={styles.flexOne}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <Text style={styles.smallMuted}>
                      {blockedPackages.includes(androidPackageByAppId[item.id] ?? '') ? 'Dipilih untuk diblokir' : item.description}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {activeTab === 'Jadwal' && (
          <>
            <SectionTitle title="Study Block" detail="Jadwal demo tersimpan di perangkat" />
            {mockStudyBlocks.map((block) => (
              <View key={block.id} style={styles.card}>
                <Text style={styles.eyebrow}>{block.type.toUpperCase()}</Text>
                <Text style={[styles.cardTitle, styles.spaced]}>{block.title}</Text>
                <Text style={styles.bodyMuted}>{block.description}</Text>
                <Text style={[styles.timeText, styles.spaced]}>{block.date}  ·  {block.start_time}–{block.end_time}</Text>
              </View>
            ))}
          </>
        )}

        {activeTab === 'Kelompok' && (
          <>
            <SectionTitle title="Kelompok Inovasi" detail="Ruang belajar · Jam 07:00" />
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Anggota kelompok</Text>
              {mockGroupMembers.map((member) => (
                <View key={member.id} style={styles.memberRow}>
                  <View style={styles.avatar}><Text style={styles.avatarText}>{member.avatar}</Text></View>
                  <View style={styles.flexOne}>
                    <Text style={styles.cardTitle}>{member.name}</Text>
                    <Text style={styles.smallMuted}>{member.course}</Text>
                  </View>
                  <Text style={[styles.status, member.status === 'fokus' ? styles.statusFocus : styles.statusRest]}>
                    {member.status === 'fokus' ? 'Fokus' : 'Istirahat'}
                  </Text>
                </View>
              ))}
            </View>
            <SectionTitle title="Obrolan" detail="Pesan mock lokal" />
            {chat.map((item) => {
              const own = item.senderId === 'current-user'
              return (
                <View key={item.id} style={[styles.chatBubble, own ? styles.chatOwn : styles.chatFriend]}>
                  <Text style={styles.smallMuted}>{item.senderName} · {item.time}</Text>
                  {item.text ? <Text style={[styles.chatText, styles.spacedSmall]}>{item.text}</Text> : null}
                  {item.kind === 'image' && <View style={styles.imageMock}><Text style={styles.bodyMuted}>{item.imageLabel || 'Pratinjau gambar'}</Text></View>}
                  {item.kind === 'document' && <View style={styles.documentMock}><Text style={styles.documentGlyph}>PDF</Text><View style={styles.flexOne}><Text style={styles.cardTitle}>{item.fileName || 'Tugas_Inovasi.pdf'}</Text><Text style={styles.smallMuted}>2MB · Unduh ↓</Text></View></View>}
                </View>
              )
            })}
            <View style={styles.messageForm}>
              <Pressable style={styles.attachButton} accessibilityLabel="Lampirkan mock file" onPress={() => setChat((current) => [...current, {
                id: `attachment-${Date.now()}`,
                senderId: 'current-user',
                senderName: 'Anda',
                time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                kind: 'document' as const,
                fileName: 'Tugas_Inovasi.pdf',
                fileType: 'PDF' as const,
                text: 'Lampiran mock',
              }])}>
                <Text style={styles.attachGlyph}>＋</Text>
              </Pressable>
              <TextInput value={message} onChangeText={setMessage} placeholder="Tulis pesan..." placeholderTextColor="#718096" style={styles.messageInput} />
              <Pressable style={styles.sendButton} onPress={sendMessage}><Text style={styles.sendGlyph}>↑</Text></Pressable>
            </View>
          </>
        )}

        {activeTab === 'Evaluasi' && (
          <>
            <SectionTitle title="Evaluasi Sesi" detail="Ringkasan dari data demo" />
            <View style={styles.metricRow}>
              <Metric label="Target" value={`${mockEvaluationData.targetMinutes} m`} />
              <Metric label="Aktual" value={`${mockEvaluationData.actualMinutes} m`} />
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Aplikasi yang digunakan</Text>
              <View style={styles.chips}>
                {mockEvaluationData.appsUsed.map((app) => <Text key={app} style={styles.chip}>{app}</Text>)}
              </View>
            </View>
            <View style={styles.card}>
              <View style={styles.notificationHeader}>
                <Text style={styles.cardTitle}>Notifikasi yang ditahan</Text>
                {heldNotifications.length > 0 && (
                  <Pressable onPress={() => {
                    FocusEnforcement.clearHeldNotifications()
                    setHeldNotifications([])
                    setHeldNotificationCount(0)
                  }}>
                    <Text style={styles.clearText}>Hapus</Text>
                  </Pressable>
                )}
              </View>
              {heldNotifications.length ? heldNotifications.map((item) => (
                <View key={item.id} style={styles.heldNotification}>
                  <Text style={styles.cardTitle}>{item.title || item.appName || 'Notifikasi'}</Text>
                  <Text style={styles.smallMuted}>{item.text || 'Tidak ada isi teks'}</Text>
                </View>
              )) : <Text style={[styles.smallMuted, styles.spaced]}>Belum ada notifikasi sesi yang ditahan.</Text>}
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <Pressable key={tab} onPress={() => setActiveTab(tab)} style={styles.tabButton}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

function SectionTitle({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.smallMuted}>{detail}</Text>
    </View>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={[styles.card, styles.metricCard]}>
      <Text style={styles.smallMuted}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: palette.background },
  header: { paddingHorizontal: 20, paddingTop: 58, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: palette.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: palette.indigo, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  headerTitle: { color: palette.text, fontSize: 22, fontWeight: '700', marginTop: 5 },
  livePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#172536', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 8 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.indigo, marginRight: 7 },
  liveDotActive: { backgroundColor: palette.green },
  liveText: { color: '#C8D2E1', fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
  content: { padding: 18, paddingBottom: 28 },
  timerCard: { padding: 24, borderRadius: 26, backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.border, alignItems: 'center', marginBottom: 26 },
  eyebrow: { color: palette.indigo, fontSize: 10, letterSpacing: 1.4, fontWeight: '800' },
  timer: { color: palette.text, fontSize: 72, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: -4, marginTop: 8 },
  bodyMuted: { color: palette.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  primaryButton: { height: 48, alignSelf: 'stretch', borderRadius: 14, backgroundColor: '#A5B4FC', alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  primaryButtonText: { color: '#111827', fontSize: 14, fontWeight: '800' },
  note: { color: '#8290A5', fontSize: 10, textAlign: 'center', marginTop: 12 },
  permissionCard: { backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.border, borderRadius: 18, padding: 16, marginBottom: 26 },
  permissionCopy: { lineHeight: 17, marginTop: 8, marginBottom: 13 },
  secondaryButton: { minHeight: 42, justifyContent: 'center', borderRadius: 12, backgroundColor: palette.panelSoft, paddingHorizontal: 12, marginTop: 8 },
  disabledButton: { opacity: 0.45 },
  secondaryButtonText: { color: '#DDE2FF', fontSize: 12, fontWeight: '700' },
  sectionHeading: { marginTop: 8, marginBottom: 13 },
  sectionTitle: { color: palette.text, fontSize: 18, fontWeight: '700' },
  appGrid: { gap: 10 },
  appTile: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 17, backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.border },
  blockedTile: { opacity: 0.55 },
  appGlyph: { width: 40, height: 40, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', borderRadius: 13, backgroundColor: '#202B3C', color: palette.indigo, fontSize: 20 },
  flexOne: { flex: 1 },
  card: { backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.border, borderRadius: 18, padding: 16, marginBottom: 10 },
  cardTitle: { color: palette.text, fontSize: 14, fontWeight: '700' },
  smallMuted: { color: palette.muted, fontSize: 11, marginTop: 3 },
  spaced: { marginTop: 12 },
  spacedSmall: { marginTop: 7 },
  timeText: { color: palette.indigo, fontSize: 12, fontWeight: '700' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 15 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#29334A' },
  avatarText: { color: '#D7DEFF', fontSize: 11, fontWeight: '800' },
  status: { overflow: 'hidden', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 5, fontSize: 9, fontWeight: '700' },
  statusFocus: { color: palette.green, backgroundColor: '#16332B' },
  statusRest: { color: palette.amber, backgroundColor: '#3A3020' },
  chatBubble: { maxWidth: '90%', borderWidth: 1, padding: 13, borderRadius: 18, marginBottom: 10 },
  chatOwn: { alignSelf: 'flex-end', backgroundColor: '#252849', borderColor: '#454878', borderBottomRightRadius: 5 },
  chatFriend: { alignSelf: 'flex-start', backgroundColor: palette.panelSoft, borderColor: palette.border, borderBottomLeftRadius: 5 },
  chatText: { color: palette.text, fontSize: 13, lineHeight: 19 },
  imageMock: { height: 120, minWidth: 200, borderRadius: 12, backgroundColor: '#363A60', alignItems: 'center', justifyContent: 'center', marginTop: 8, padding: 12 },
  documentMock: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 220, marginTop: 8, padding: 10, borderRadius: 12, backgroundColor: '#101827' },
  documentGlyph: { color: '#FCA5A5', fontWeight: '900', fontSize: 12, padding: 10, borderRadius: 9, backgroundColor: '#3A2732' },
  messageForm: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  attachButton: { width: 44, height: 44, borderRadius: 13, backgroundColor: palette.panelSoft, alignItems: 'center', justifyContent: 'center' },
  attachGlyph: { color: palette.text, fontSize: 25, lineHeight: 27 },
  messageInput: { height: 44, flex: 1, borderRadius: 13, paddingHorizontal: 12, backgroundColor: palette.panel, color: palette.text, fontSize: 13 },
  sendButton: { width: 44, height: 44, borderRadius: 13, backgroundColor: palette.indigo, alignItems: 'center', justifyContent: 'center' },
  sendGlyph: { color: '#111827', fontSize: 21, fontWeight: '900' },
  metricRow: { flexDirection: 'row', gap: 10 },
  metricCard: { flex: 1 },
  metricValue: { color: palette.text, fontSize: 27, fontWeight: '800', marginTop: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  notificationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clearText: { color: palette.indigo, fontSize: 12, fontWeight: '700' },
  heldNotification: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: palette.border },
  chip: { color: '#DDE2FF', backgroundColor: '#252849', borderRadius: 99, paddingHorizontal: 11, paddingVertical: 8, fontSize: 11, fontWeight: '700' },
  tabBar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 12, paddingBottom: 22, backgroundColor: '#0B1220' },
  tabButton: { flex: 1, alignItems: 'center', paddingVertical: 7 },
  tabText: { color: '#8794A8', fontSize: 10, fontWeight: '600' },
  tabTextActive: { color: '#C7D2FE', fontWeight: '800' },
})
