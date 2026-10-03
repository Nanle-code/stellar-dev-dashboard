export {
  PluginManager,
  pluginManager,
  registerActivePlugins,
  PLUGIN_STATUSES,
  PluginCapabilityController,
  CapabilityError,
  CAPABILITY_ERROR_CODES,
  CAPABILITY_SCOPES,
  isCapabilityScope,
  validateCapabilityScope,
} from "./PluginManager";

export {
  default as SandboxedPluginFrame,
  buildSandboxAttribute,
  buildFallbackSrcDoc,
  handlePluginRpcMessage,
  createSandboxClient,
} from "./pluginSandbox";

export {
  createSandboxedDashboardApi,
  pickSafeState,
} from "./capabilitySandbox";

export {
  fetchMarketplacePlugins,
  fetchMarketplacePluginById,
  getMarketplacePluginIndex,
  listMarketplacePluginSummaries,
  MARKETPLACE_PLUGINS,
} from "./pluginCatalog";

export {
  loadInstalledPlugins,
  loadPermissionGrants,
  getPluginIsolatedStorage,
  setPluginIsolatedItem,
  getPluginIsolatedItem,
  removePluginIsolatedItem,
  clearPluginIsolatedStorage,
} from "./pluginStorage";
