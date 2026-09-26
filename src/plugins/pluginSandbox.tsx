import React, { useEffect, useRef } from "react";
import {
  PluginCapabilityController,
  createSandboxedDashboardApi,
  handlePluginRpcMessage,
  createSandboxClient,
  CapabilityError,
  CAPABILITY_ERROR_CODES,
  CAPABILITY_SCOPES,
} from "./capabilitySandbox";

export function buildSandboxAttribute(sandbox?: string[] | readonly string[]): string {
  const tokens = Array.isArray(sandbox) ? sandbox.filter(Boolean) : [];
  return tokens.length ? tokens.join(" ") : "allow-scripts";
}

export function buildFallbackSrcDoc(title?: string, description?: string): string {
  const safeTitle = String(title || "Plugin").replace(/</g, "&lt;");
  const safeDescription = String(description || "Sandboxed extension").replace(/</g, "&lt;");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body {
        margin: 0;
        min-height: 100%;
        background: #0c111b;
        color: #e8edf7;
        font-family: Inter, system-ui, sans-serif;
      }
      body {
        display: grid;
        place-items: center;
        padding: 16px;
      }
      .card {
        max-width: 420px;
        width: 100%;
        box-sizing: border-box;
        border-radius: 18px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(7, 11, 20, 0.9);
        padding: 16px;
      }
      h1 {
        margin: 0;
        font-size: 18px;
      }
      p {
        margin: 8px 0 0;
        font-size: 12px;
        line-height: 1.5;
        color: #b6c0d4;
      }
      .capabilities-badge {
        display: inline-block;
        margin-top: 10px;
        font-size: 11px;
        color: #38bdf8;
        background: rgba(56, 189, 248, 0.1);
        padding: 2px 8px;
        border-radius: 999px;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${safeTitle}</h1>
      <p>${safeDescription}</p>
      <div class="capabilities-badge">Sandbox: Capability-Guarded</div>
    </div>
  </body>
</html>`;
}

export interface SandboxedPluginFrameProps {
  title?: string;
  description?: string;
  src?: string;
  srcDoc?: string;
  sandbox?: string[];
  height?: number | string;
  pluginId?: string;
  controller?: PluginCapabilityController;
  api?: ReturnType<typeof createSandboxedDashboardApi>;
  enableBridge?: boolean;
  onCapabilityRevoked?: (_capability: string) => void;
  style?: React.CSSProperties;
}

export default function SandboxedPluginFrame({
  title,
  description,
  src,
  srcDoc,
  sandbox,
  height = 220,
  pluginId,
  controller,
  api,
  enableBridge = true,
  onCapabilityRevoked,
  style,
}: SandboxedPluginFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const activeSubscriptionsRef = useRef<Map<string, () => void>>(new Map());

  const iframeSrcDoc = srcDoc || buildFallbackSrcDoc(title, description);
  const iframeSandbox = buildSandboxAttribute(sandbox);

  useEffect(() => {
    if (!enableBridge || !pluginId || !controller || !api) {
      return;
    }

    if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
      return;
    }

    const targetIframe = iframeRef.current;
    const activeSubs = activeSubscriptionsRef.current;

    const handleMessage = (event: MessageEvent) => {
      // Validate event source: must come from this iframe
      if (targetIframe && event.source !== targetIframe.contentWindow) {
        return;
      }

      handlePluginRpcMessage(event.data, event.source, {
        pluginId,
        controller,
        api,
        targetWindow: targetIframe?.contentWindow || undefined,
        postMessage: (msg) => {
          try {
            targetIframe?.contentWindow?.postMessage(msg, "*");
          } catch {
            // Target window inaccessible or unmounted
          }
        },
        activeSubscriptions: activeSubs,
      });
    };

    window.addEventListener("message", handleMessage);

    // Subscribe to capability changes to notify iframe upon revocation
    const unsubscribeController = controller.onCapabilitiesChanged((ctrl) => {
      const revokedList = ctrl.getRevokedCapabilities();
      revokedList.forEach((cap) => {
        try {
          targetIframe?.contentWindow?.postMessage(
            {
              type: "PLUGIN_CAPABILITY_REVOKED",
              pluginId,
              capability: cap,
            },
            "*"
          );
        } catch {
          // Iframe unmounted
        }
        if (typeof onCapabilityRevoked === "function") {
          onCapabilityRevoked(cap);
        }
      });
    });

    return () => {
      window.removeEventListener("message", handleMessage);
      unsubscribeController();
      activeSubs.forEach((unsub) => {
        try {
          unsub();
        } catch {
          // Safe disposal
        }
      });
      activeSubs.clear();
    };
  }, [enableBridge, pluginId, controller, api, onCapabilityRevoked]);

  return (
    <iframe
      ref={iframeRef}
      title={title || "Sandboxed plugin"}
      src={src || undefined}
      srcDoc={src ? undefined : iframeSrcDoc}
      sandbox={iframeSandbox}
      loading="lazy"
      style={{
        width: "100%",
        minHeight: height,
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--bg-base)",
        ...style,
      }}
    />
  );
}

export {
  handlePluginRpcMessage,
  createSandboxClient,
  CapabilityError,
  CAPABILITY_ERROR_CODES,
  CAPABILITY_SCOPES,
};
