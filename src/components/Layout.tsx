import {
  BarChart3,
  BookOpen,
  LayoutDashboard,
  Settings,
  Timer,
  UserRound,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { mockUsers } from '../lib/mockData'
import { useSessionStore } from '../store/sessionStore'

const currentUser = mockUsers[0]

const navigation: { label: string; to: string; icon: LucideIcon }[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Study', to: '/study-blocks', icon: BookOpen },
  { label: 'Fokus', to: '/focus', icon: Timer },
  { label: 'Co-focus', to: '/cofocus', icon: UsersRound },
  { label: 'Laporan', to: '/reports', icon: BarChart3 },
]

function NavigationItems({ mobile = false }: { mobile?: boolean }) {
  const activeBlock = useSessionStore((state) => state.activeBlock)
  const focusStatus = useSessionStore((state) => state.status)
  const hasActiveSession = Boolean(activeBlock && focusStatus !== 'idle')

  return (
    <nav
      aria-label="Navigasi utama"
      className={mobile ? 'flex h-16 items-center justify-around px-2' : 'space-y-1.5'}
    >
      {navigation.map(({ label, to, icon: Icon }) => {
        const isFocus = to === '/focus'

        return (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            className={({ isActive }) => [
              'group relative flex items-center transition-colors duration-150',
              mobile
                ? 'min-h-12 min-w-[56px] flex-col justify-center gap-0.5 rounded-xl px-1 text-[11px] font-semibold'
                : 'gap-3 rounded-xl px-3 py-3 text-sm font-semibold',
              isActive
                ? 'text-[#1D3668]'
                : 'text-[#56638A] hover:bg-[#F6F7FC] hover:text-[#1D3668]',
              isActive && mobile ? 'bg-[#E1EAF8]' : '',
              isActive && !mobile ? 'bg-[#E1EAF8]' : '',
            ].join(' ')}
          >
            {({ isActive }) => (
              <>
                <span className="relative grid place-items-center">
                  <Icon size={mobile ? 21 : 19} strokeWidth={isActive ? 2.2 : 1.8} />
                  {isFocus && hasActiveSession && (
                    <span className="absolute -right-1 -top-0.5 flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#BE2257] opacity-70" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full border-2 border-white bg-[#BE2257]" />
                    </span>
                  )}
                </span>
                <span className={mobile ? 'max-w-full truncate' : 'flex-1'}>{label}</span>
                {isFocus && hasActiveSession && !mobile && (
                  <span className="rounded-full bg-[#D6F0DE] px-2 py-0.5 text-[10px] font-bold text-[#17623A]">
                    LIVE
                  </span>
                )}
              </>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[#1D3668] text-sm font-extrabold text-white">
        S
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-bold leading-4 tracking-tight text-[#1D3668]">Smart Focus</span>
        <span className="mt-0.5 text-[10px] font-bold uppercase leading-3 tracking-[0.08em] text-[#56638A]">
          Akademik
        </span>
      </span>
    </div>
  )
}

export default function Layout() {
  const initials = currentUser.name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')

  return (
    <div className="min-h-screen bg-[#F3F4FA] font-[Montserrat] text-[#1F2C4F]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#DFE4F1]/70 bg-white/90 pt-[env(safe-area-inset-top)] shadow-[0_1px_8px_rgba(29,54,104,0.04)] backdrop-blur-xl lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Brand />
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Pengaturan"
              className="grid h-11 w-11 place-items-center rounded-full text-[#44464F] transition hover:bg-[#F6F7FC] hover:text-[#1D3668]"
            >
              <Settings size={20} strokeWidth={1.8} />
            </button>
            <span
              aria-label={`Profil ${currentUser.name}`}
              title={currentUser.name}
              className="grid h-8 w-8 place-items-center rounded-full bg-[#1D3668] text-[10px] font-bold text-white"
            >
              {initials}
            </span>
          </div>
        </div>
      </header>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-[#DFE4F1] bg-white px-5 py-7 lg:flex">
        <div className="mb-10 px-1"><Brand /></div>
        <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[#757780]">
          Menu mahasiswa
        </p>
        <NavigationItems />
        <div className="mt-auto rounded-2xl border border-[#DFE4F1] bg-[#F6F7FC] p-4">
          <div className="mb-3 grid h-9 w-9 place-items-center rounded-xl bg-[#E1EAF8] text-[#1D3668]">
            <UserRound size={18} />
          </div>
          <p className="text-sm font-bold text-[#1F2C4F]">{currentUser.name}</p>
          <p className="mt-1 text-xs text-[#56638A]">{currentUser.program_studi}</p>
          <p className="mt-3 text-[10px] font-semibold text-[#757780]">Mahasiswa · Smart Focus</p>
        </div>
      </aside>

      <main className="min-h-screen bg-[#F3F4FA] pb-[calc(5rem+env(safe-area-inset-bottom))] pt-[calc(3.5rem+env(safe-area-inset-top))] lg:ml-[248px] lg:pb-8 lg:pt-0">
        <div className="mx-auto w-full max-w-[1120px] px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[#DFE4F1] bg-white/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgba(29,54,104,0.05)] backdrop-blur-xl lg:hidden">
        <NavigationItems mobile />
      </div>
    </div>
  )
}
