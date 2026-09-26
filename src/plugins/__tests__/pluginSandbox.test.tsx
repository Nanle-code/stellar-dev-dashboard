import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import SandboxedPluginFrame, {
  buildSandboxAttribute,
  buildFallbackSrcDoc,
} from "../pluginSandbox";
import {
  PluginCapabilityController,
  createSandboxedDashboardApi,
} from "../capabilitySandbox";

describe("pluginSandbox component and utilities", () => {
  const pluginId = "community.test-widget";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("buildSandboxAttribute constructs correct tokens", () => {
    expect(buildSandboxAttribute()).toBe("allow-scripts");
    expect(buildSandboxAttribute([])).toBe("allow-scripts");
    expect(buildSandboxAttribute(["allow-scripts", "allow-forms"])).toBe("allow-scripts allow-forms");
  });

  it("buildFallbackSrcDoc escapes HTML and generates card layout", () => {
    const srcDoc = buildFallbackSrcDoc("<script>alert(1)</script>", "<b>bold desc</b>");
    expect(srcDoc).not.toContain("<script>alert(1)</script>");
    expect(srcDoc).toContain("&lt;script>alert(1)&lt;/script>");
    expect(srcDoc).toContain("Sandbox: Capability-Guarded");
  });

  it("renders iframe with sandbox attributes and fallback srcDoc", () => {
    const { container } = render(
      <SandboxedPluginFrame
        title="Custom Plugin Title"
        description="Demo description"
        height={300}
      />
    );

    const iframe = container.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute("sandbox")).toBe("allow-scripts");
    expect(iframe?.getAttribute("title")).toBe("Custom Plugin Title");
    expect(iframe?.getAttribute("srcdoc")).toContain("Custom Plugin Title");
  });

  it("renders iframe with custom src url when provided", () => {
    const { container } = render(
      <SandboxedPluginFrame
        title="External Widget"
        src="https://plugins.stellar.org/widget.html"
      />
    );

    const iframe = container.querySelector("iframe");
    expect(iframe?.getAttribute("src")).toBe("https://plugins.stellar.org/widget.html");
    expect(iframe?.getAttribute("srcdoc")).toBeNull();
  });

  it("attaches message bridge and notifies iframe on capability revocation", () => {
    const controller = new PluginCapabilityController(pluginId, ["dashboard:read", "storage:read"]);
    const store = {
      getState: () => ({ network: "testnet" }),
      subscribe: () => () => {},
    };
    const api = createSandboxedDashboardApi({ pluginId, controller, store });
    const onRevokedMock = vi.fn();

    const { container } = render(
      <SandboxedPluginFrame
        pluginId={pluginId}
        controller={controller}
        api={api}
        enableBridge={true}
        onCapabilityRevoked={onRevokedMock}
      />
    );

    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    expect(iframe).not.toBeNull();

    // Mock iframe.contentWindow postMessage
    const postMessageSpy = vi.fn();
    Object.defineProperty(iframe, "contentWindow", {
      value: { postMessage: postMessageSpy },
      configurable: true,
    });

    // Revoke capability
    controller.revoke("dashboard:read");

    // Verify postMessage was called with PLUGIN_CAPABILITY_REVOKED
    expect(postMessageSpy).toHaveBeenCalledWith(
      {
        type: "PLUGIN_CAPABILITY_REVOKED",
        pluginId,
        capability: "dashboard:read",
      },
      "*"
    );
    expect(onRevokedMock).toHaveBeenCalledWith("dashboard:read");
  });
});
