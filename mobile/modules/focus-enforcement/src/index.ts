import { requireOptionalNativeModule } from 'expo'
import { Platform } from 'react-native'

export type HeldNotification = {
  id: string
  packageName: string
  appName: string
  title: string
  text: string
  receivedAt: number
}

type FocusEnforcementModule = {
  isNativeAvailable(): boolean
  setFocusEnabled(enabled: boolean, blockedPackages: string[]): void
  isFocusEnabled(): boolean
  isAccessibilityEnabled(): boolean
  isNotificationAccessEnabled(): boolean
  openAccessibilitySettings(): void
  openNotificationSettings(): void
  getHeldNotifications(): HeldNotification[]
  clearHeldNotifications(): void
}

function getNativeModule(): Omit<FocusEnforcementModule, 'isNativeAvailable'> | null {
  if (Platform.OS !== 'android') {
    return null
  }
  try {
    return requireOptionalNativeModule<Omit<FocusEnforcementModule, 'isNativeAvailable'>>('FocusEnforcement')
  } catch {
    return null
  }
}

const nativeModule = getNativeModule()

const FocusEnforcement: FocusEnforcementModule = {
  isNativeAvailable: () => nativeModule !== null,
  setFocusEnabled: (enabled, blockedPackages) => nativeModule?.setFocusEnabled(enabled, blockedPackages),
  isFocusEnabled: () => nativeModule?.isFocusEnabled() ?? false,
  isAccessibilityEnabled: () => nativeModule?.isAccessibilityEnabled() ?? false,
  isNotificationAccessEnabled: () => nativeModule?.isNotificationAccessEnabled() ?? false,
  openAccessibilitySettings: () => nativeModule?.openAccessibilitySettings(),
  openNotificationSettings: () => nativeModule?.openNotificationSettings(),
  getHeldNotifications: () => nativeModule?.getHeldNotifications() ?? [],
  clearHeldNotifications: () => nativeModule?.clearHeldNotifications(),
}

export default FocusEnforcement
