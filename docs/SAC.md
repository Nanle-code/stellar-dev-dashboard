# Stellar Asset Contract inspector

Asset cards now derive the deterministic SAC contract ID for the selected
network and inspect its on-chain instance through Soroban RPC. When the SAC is
deployed, the inspector displays the contract status and available built-in
metadata (`name`, `symbol`, `decimals`, and `admin`). The derived ID is the
same address that explorers and contract tools use, so it can be copied or
opened independently.

For an undeployed asset, a connected Freighter wallet can submit the standard
`createStellarAssetContract` operation on testnet or futurenet. Mainnet always
requires a separate confirmation because deployment is an irreversible network
transaction. The issuer account must still satisfy the network’s authorization
rules; a successful submission does not bypass issuer controls.
