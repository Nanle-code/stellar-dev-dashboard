export type RootStackParamList = {
  BiometricAuth: undefined
  MainTabs:
    | undefined
    | {
        screen?: keyof MainTabParamList
        params?: Partial<MainTabParamList>
      }
}

export type MainTabParamList = {
  Overview: undefined
  Account: { accountId?: string }
  Transactions: { transactionHash?: string }
  Network: undefined
  DEX: undefined
  Assets: undefined
  Settings: undefined
}

export type DrawerParamList = {
  MainTabs: undefined
  Connect: undefined
  Contracts: undefined
  Faucet: undefined
  Portfolio: undefined
  Multisig: undefined
}

export type ConnectStackParamList = {
  ConnectScreen: undefined
}
