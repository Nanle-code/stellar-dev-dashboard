import { PluginManager } from "./PluginManager";
import React from "react";

const pluginModules = import.meta.glob("./**/*Plugin.{js,jsx,ts,tsx}", {
  eager: false,
});

let registrationPromise = null;

function getPluginFactory(module) {
  return module?.default || module?.plugin || module?.createPlugin || null;
}

function pathToPluginId(prefix, path) {
  return `${prefix}.${path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}`;
}

function registerWithFallback(manager, plugin, path) {
  try {
    manager.register(plugin);
  } catch (error) {
    manager.register({
      id: pathToPluginId("conflict", path),
      name: `${path} registration conflict`,
      initialize: () => undefined,
      getWidgets: () => [
        {
          id: `${pathToPluginId("conflict", path)}.widget`,
          title: "Plugin registration conflict",
          placement: "settings",
          order: 1000,
          component: function PluginConflictWidget() {
            return React.createElement(
              "div",
              { style: { color: "var(--red)", fontSize: "12px" } },
              error?.message || String(error)
            );
          },
        },
      ],
      getDataSources: () => [],
    });
  }
}

export async function registerActivePlugins(manager = pluginManager) {
  if (registrationPromise) return registrationPromise;
  registrationPromise = Promise.all(
    Object.entries(pluginModules).map(async ([path, loadModule]) => {
      try {
        const module = await loadModule();
        const pluginFactory = getPluginFactory(module);
        if (!pluginFactory) {
          registerWithFallback(manager, {
            id: pathToPluginId("invalid", path),
            name: path,
            getWidgets: () => [],
            getDataSources: () => [],
          }, path);
          return;
        }
        registerWithFallback(manager, pluginFactory, path);
      } catch (error) {
        const id = pathToPluginId("failed", path);
        registerWithFallback(manager, {
          id,
          name: path,
          initialize: () => {
            throw error;
          },
          getWidgets: () => [],
          getDataSources: () => [],
        }, path);
      }
    })
  )
    .then(() => manager.initializeAll())
    .then(() => manager);
  return registrationPromise;
}
export const pluginManager = new PluginManager();
