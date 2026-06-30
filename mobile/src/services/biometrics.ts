import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics'
import AsyncStorage from '@react-native-async-storage/async-storage'

const BIOMETRICS_ENABLED_KEY = 'biometrics_enabled'
const BIOMETRICS_PUBLIC_KEY_KEY = 'biometrics_public_key'

const rnBiometrics = new ReactNativeBiometrics({
  allowDeviceCredentials: true,
})

export type BiometryType = 'FaceID' | 'TouchID' | 'Biometrics' | 'None'

export async function isBiometricsAvailable(): Promise<{
  available: boolean
  biometryType: BiometryType
}> {
  try {
    const { available, biometryType } = await rnBiometrics.isSensorAvailable()

    let type: BiometryType = 'None'
    if (biometryType === BiometryTypes.FaceID) type = 'FaceID'
    else if (biometryType === BiometryTypes.TouchID) type = 'TouchID'
    else if (biometryType === BiometryTypes.Biometrics) type = 'Biometrics'

    return { available, biometryType: type }
  } catch {
    return { available: false, biometryType: 'None' }
  }
}

export async function createBiometricKeys(): Promise<string | null> {
  try {
    const { publicKey } = await rnBiometrics.createKeys()
    if (publicKey) {
      await AsyncStorage.setItem(BIOMETRICS_PUBLIC_KEY_KEY, publicKey)
    }
    return publicKey
  } catch {
    return null
  }
}

export async function deleteBiometricKeys(): Promise<boolean> {
  try {
    const { keysDeleted } = await rnBiometrics.deleteKeys()
    if (keysDeleted) {
      await AsyncStorage.removeItem(BIOMETRICS_PUBLIC_KEY_KEY)
    }
    return keysDeleted
  } catch {
    return false
  }
}

export async function biometricKeysExist(): Promise<boolean> {
  try {
    const { keysExist } = await rnBiometrics.biometricKeysExist()
    return keysExist
  } catch {
    return false
  }
}

export async function authenticateWithBiometrics(
  promptMessage = 'Authenticate to access Stellar Dashboard',
): Promise<boolean> {
  try {
    const { success } = await rnBiometrics.simplePrompt({
      promptMessage,
      cancelButtonText: 'Cancel',
    })
    return success
  } catch {
    return false
  }
}

export async function isBiometricsEnabled(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(BIOMETRICS_ENABLED_KEY)
    return value === 'true'
  } catch {
    return false
  }
}

export async function setBiometricsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(BIOMETRICS_ENABLED_KEY, enabled ? 'true' : 'false')
}

export async function getBiometricType(): Promise<BiometryType> {
  const { available, biometryType } = await isBiometricsAvailable()
  if (!available) return 'None'
  return biometryType
}
