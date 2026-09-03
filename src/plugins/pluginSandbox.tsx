import React from "react";

function buildSandboxAttribute(sandbox) {
  const tokens = Array.isArray(sandbox) ? sandbox.filter(Boolean) : [];
  return tokens.length ? tokens.join(" ") : "allow-scripts";
}

function buildFallbackSrcDoc(title, description) {
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
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${safeTitle}</h1>
      <p>${safeDescription}</p>
    </div>
  </body>
</html>`;
}

export default function SandboxedPluginFrame({
  title,
  description,
  src,
  srcDoc,
  sandbox,
  height = 220,
}) {
  const iframeSrcDoc = srcDoc || buildFallbackSrcDoc(title, description);
  const iframeSandbox = buildSandboxAttribute(sandbox);

  return (
    <iframe
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
      }}
    />
  );
}
