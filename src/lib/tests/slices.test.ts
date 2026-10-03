import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../store'

describe('Store Slices', () => {
  beforeEach(() => {
    // Reset store before each test
    useStore.setState(useStore.getInitialState ? useStore.getInitialState() : {})
  })

  it('updates UiSlice and flat properties when toggleTheme is called', () => {
    const initialState = useStore.getState()
    const initialTheme = initialState.theme
    const expectedTheme = initialTheme === 'light' ? 'dark' : 'light'

    useStore.getState().toggleTheme()

    const newState = useStore.getState()
    
    // Check flat property
    expect(newState.theme).toBe(expectedTheme)
    
    // Check slice property
    expect(newState.ui.theme).toBe(expectedTheme)
  })

  it('updates PreferencesSlice and flat properties when search filters are updated', () => {
    useStore.getState().setSearchFilters({ minFee: '100' })

    const newState = useStore.getState()
    
    expect(newState.searchFilters.minFee).toBe('100')
    expect(newState.preferences.searchFilters.minFee).toBe('100')
  })

  it('updates AccountSlice and flat properties when account loading is set', () => {
    useStore.getState().setAccountLoading(true)

    const newState = useStore.getState()
    
    expect(newState.accountLoading).toBe(true)
    expect(newState.account.accountLoading).toBe(true)
  })

  it('updates SessionSlice and flat properties when wallet is connected', () => {
    useStore.getState().setWalletConnected(true, 'freighter', 'GABCD')

    const newState = useStore.getState()
    
    expect(newState.walletConnected).toBe(true)
    expect(newState.walletType).toBe('freighter')
    expect(newState.walletPublicKey).toBe('GABCD')
    
    expect(newState.session.walletConnected).toBe(true)
    expect(newState.session.walletType).toBe('freighter')
    expect(newState.session.walletPublicKey).toBe('GABCD')
  })
})
