import { requireOptionalNativeModule } from 'expo'

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

const nativeModule = requireOptionalNativeModule<Omit<FocusEnforcementModule, 'isNativeAvailable'>>('FocusEnforcement')

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
