import { useState, useCallback, useEffect } from 'react';
import { useStore } from '../lib/store';
import {
  isBiometricAvailable,
  registerBiometricCredential,
  authenticateWithBiometric,
  removeBiometricCredential,
  hasBiometricCredential,
  encryptDataWithBiometric,
  decryptDataWithBiometric,
  BiometricAuthError,
} from '../utils/biometric';

interface BiometricCacheOptions {
  userId: string;
  userName: string;
  autoLock?: boolean;
  lockTimeout?: number; // milliseconds
}

interface BiometricCacheState {
  isAvailable: boolean;
  isRegistered: boolean;
  isAuthenticated: boolean;
  isLocked: boolean;
  error: string | null;
}

export function useBiometricCache(options: BiometricCacheOptions) {
  const { userId, userName, autoLock = true, lockTimeout = 300000 } = options;
  const { connectedAddress, accountData } = useStore();

  const [state, setState] = useState<BiometricCacheState>({
    isAvailable: false,
    isRegistered: false,
    isAuthenticated: false,
    isLocked: true,
    error: null,
  });

  const [data, setData] = useState<Record<string, string>>({});

  // Check biometric availability on mount
  useEffect(() => {
    checkAvailability();
  }, []);

  // Check if credential is registered
  useEffect(() => {
    if (state.isAvailable) {
      setState((prev) => ({
        ...prev,
        isRegistered: hasBiometricCredential(userId),
      }));
    }
  }, [state.isAvailable, userId]);

  // Auto-lock after timeout
  useEffect(() => {
    if (!autoLock || !state.isAuthenticated) return;

    const timer = setTimeout(() => {
      setState((prev) => ({ ...prev, isLocked: true, isAuthenticated: false }));
    }, lockTimeout);

    return () => clearTimeout(timer);
  }, [state.isAuthenticated, autoLock, lockTimeout]);

  // Auto-cache account data when authenticated
  useEffect(() => {
    if (state.isAuthenticated && !state.isLocked && connectedAddress && accountData) {
      const cacheAccountData = async () => {
        try {
          const accountSnapshot = {
            address: connectedAddress,
            balance: accountData.balances,
            sequence: accountData.sequence,
            lastModified: Date.now(),
          };
          const encrypted = await encryptDataWithBiometric(JSON.stringify(accountSnapshot), userId);
          setData((prev) => ({ ...prev, account_snapshot: encrypted }));
        } catch (error) {
          console.error('Failed to cache account data:', error);
        }
      };
      cacheAccountData();
    }
  }, [state.isAuthenticated, state.isLocked, connectedAddress, accountData, userId]);

  const checkAvailability = useCallback(async () => {
    try {
      const available = await isBiometricAvailable();
      setState((prev) => ({ ...prev, isAvailable: available }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to check biometric availability',
      }));
    }
  }, []);

  const register = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, error: null }));
      await registerBiometricCredential(userId, userName);
      setState((prev) => ({
        ...prev,
        isRegistered: true,
        isAuthenticated: true,
        isLocked: false,
      }));
      return true;
    } catch (error) {
      const errorMessage = error instanceof BiometricAuthError ? error.message : 'Registration failed';
      setState((prev) => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [userId, userName]);

  const authenticate = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, error: null }));
      const success = await authenticateWithBiometric(userId);
      if (success) {
        setState((prev) => ({
          ...prev,
          isAuthenticated: true,
          isLocked: false,
        }));
      }
      return success;
    } catch (error) {
      const errorMessage = error instanceof BiometricAuthError ? error.message : 'Authentication failed';
      setState((prev) => ({ ...prev, error: errorMessage }));
      return false;
    }
  }, [userId]);

  const lock = useCallback(() => {
    setState((prev) => ({ ...prev, isLocked: true, isAuthenticated: false }));
  }, []);

  const unregister = useCallback(async () => {
    try {
      await removeBiometricCredential(userId);
      setState((prev) => ({
        ...prev,
        isRegistered: false,
        isAuthenticated: false,
        isLocked: true,
      }));
      setData({});
      return true;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unregistration failed',
      }));
      return false;
    }
  }, [userId]);

  const setCachedData = useCallback(
    async (key: string, value: string) => {
      if (!state.isAuthenticated || state.isLocked) {
        throw new Error('Must authenticate to set cached data');
      }

      try {
        const encrypted = await encryptDataWithBiometric(value, userId);
        setData((prev) => ({ ...prev, [key]: encrypted }));
        return true;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to encrypt data',
        }));
        return false;
      }
    },
    [state.isAuthenticated, state.isLocked, userId]
  );

  const getCachedData = useCallback(
    async (key: string): Promise<string | null> => {
      if (!state.isAuthenticated || state.isLocked) {
        throw new Error('Must authenticate to access cached data');
      }

      const encrypted = data[key];
      if (!encrypted) return null;

      try {
        const decrypted = await decryptDataWithBiometric(encrypted, userId);
        return decrypted;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to decrypt data',
        }));
        return null;
      }
    },
    [state.isAuthenticated, state.isLocked, data, userId]
  );

  const removeCachedData = useCallback((key: string) => {
    setData((prev) => {
      const newData = { ...prev };
      delete newData[key];
      return newData;
    });
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const cacheCurrentAccountData = useCallback(async () => {
    if (!state.isAuthenticated || state.isLocked) {
      throw new Error('Must authenticate to cache account data');
    }

    if (connectedAddress && accountData) {
      try {
        const accountSnapshot = {
          address: connectedAddress,
          balance: accountData.balances,
          sequence: accountData.sequence,
          lastModified: Date.now(),
        };
        const encrypted = await encryptDataWithBiometric(JSON.stringify(accountSnapshot), userId);
        setData((prev) => ({ ...prev, account_snapshot: encrypted }));
        return true;
      } catch (error) {
        console.error('Failed to cache account data:', error);
        return false;
      }
    }
    return false;
  }, [state.isAuthenticated, state.isLocked, connectedAddress, accountData, userId]);

  return {
    ...state,
    register,
    authenticate,
    lock,
    unregister,
    setCachedData,
    getCachedData,
    removeCachedData,
    clearError,
    cacheCurrentAccountData,
  };
}