import React, { useMemo, useState } from "react";
import {
  BarChart3,
  CalendarClock,
  Download,
  FileJson,
  FileText,
  Gauge,
  Mail,
  Save,
  Table2,
  Webhook,
} from "lucide-react";
import {
  buildDeliveryPlan,
  buildHorizonQuery,
  createPdfReportPayload,
  createReportSchedule,
  exportReportAsCsv,
  exportReportAsJson,
  getNextRunPreview,
  getReportTemplate,
  REPORT_COMPONENT_PALETTE,
  REPORT_TEMPLATES,
  transformReportData,
  type ReportComponentDefinition,
  type ReportResource,
} from "../../lib/customReports";

interface CustomReportsProps {
  analytics: any;
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "36px",
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  color: "var(--text-primary)",
  padding: "8px 10px",
  fontSize: "12px",
};

const buttonStyle: React.CSSProperties = {
  borderRadius: "var(--radius-md)",
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  color: "var(--text-primary)",
  padding: "8px 10px",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "12px",
  cursor: "pointer",
};

function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function componentIcon(type: ReportComponentDefinition["type"]) {
  if (type === "chart") return <BarChart3 size={14} />;
  if (type === "table") return <Table2 size={14} />;
  return <Gauge size={14} />;
}

export default function CustomReports({ analytics }: CustomReportsProps) {
  const [templateId, setTemplateId] = useState(REPORT_TEMPLATES[0].id);
  const [resource, setResource] = useState<ReportResource>("transactions");
  const [accountId, setAccountId] = useState("");
  const [limit, setLimit] = useState(50);
  const [cron, setCron] = useState("0 9 * * 1");
  const [email, setEmail] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [components, setComponents] = useState(REPORT_TEMPLATES[0].components);

  const template = getReportTemplate(templateId);
  const reportData = useMemo(() => transformReportData(template.id, analytics || {}), [analytics, template.id]);
  const query = useMemo(
    () =>
      buildHorizonQuery({
        resource,
        accountId: accountId || undefined,
        limit,
        filters: { include_failed: resource === "transactions" ? "true" : undefined },
      }),
    [accountId, limit, resource],
  );
  const schedule = useMemo(() => {
    try {
      return createReportSchedule({
        id: `${template.id}-weekly`,
        reportId: template.id,
        cron,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        enabled: true,
        channels: webhookUrl ? ["email", "webhook"] : ["email"],
        recipients: email ? [email] : [],
        webhookUrl: webhookUrl || undefined,
      });
    } catch {
      return null;
    }
  }, [cron, email, template.id, webhookUrl]);
  const deliveryPlan = schedule ? buildDeliveryPlan(schedule, template, reportData) : [];

  const handleTemplateChange = (nextTemplateId: string) => {
    const nextTemplate = getReportTemplate(nextTemplateId);
    setTemplateId(nextTemplate.id);
    setResource(nextTemplate.resource);
    setComponents(nextTemplate.components);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedId = event.dataTransfer.getData("application/report-component");
    const dropped = REPORT_COMPONENT_PALETTE.find((component) => component.id === droppedId);
    if (!dropped) return;
    setComponents((current) => [
      ...current,
      { ...dropped, id: `${dropped.id}-${Date.now()}`, label: `Custom ${dropped.label}` },
    ]);
  };

  const exportJson = () => {
    downloadText(`${template.id}.json`, exportReportAsJson(template, reportData), "application/json");
  };

  const exportCsv = () => {
    downloadText(`${template.id}.csv`, exportReportAsCsv(reportData), "text/csv");
  };

  const exportPdf = () => {
    const payload = createPdfReportPayload(template, reportData);
    downloadText(payload.filename, payload.html, payload.contentType);
  };

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "15px", fontWeight: 700 }}>
            Custom Reports
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "3px" }}>
            Build reusable Stellar analytics reports with exports and scheduled delivery.
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button type="button" style={buttonStyle} onClick={exportCsv} title="Export CSV">
            <Download size={14} /> CSV
          </button>
          <button type="button" style={buttonStyle} onClick={exportPdf} title="Export PDF-ready report">
            <FileText size={14} /> PDF
          </button>
          <button type="button" style={buttonStyle} onClick={exportJson} title="Export JSON">
            <FileJson size={14} /> JSON
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
            Template
            <select value={templateId} onChange={(event) => handleTemplateChange(event.target.value)} style={fieldStyle}>
              {REPORT_TEMPLATES.map((reportTemplate) => (
                <option key={reportTemplate.id} value={reportTemplate.id}>
                  {reportTemplate.name}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: "8px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
              Horizon resource
              <select value={resource} onChange={(event) => setResource(event.target.value as ReportResource)} style={fieldStyle}>
                <option value="accounts">Accounts</option>
                <option value="transactions">Transactions</option>
                <option value="operations">Operations</option>
                <option value="payments">Payments</option>
                <option value="ledgers">Ledgers</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
              Limit
              <input type="number" min={1} max={200} value={limit} onChange={(event) => setLimit(Number(event.target.value))} style={fieldStyle} />
            </label>
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
            Account filter
            <input value={accountId} onChange={(event) => setAccountId(event.target.value)} placeholder="G..." style={fieldStyle} />
          </label>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Component palette</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "8px" }}>
              {REPORT_COMPONENT_PALETTE.map((component) => (
                <button
                  key={component.id}
                  type="button"
                  draggable
                  onDragStart={(event) => event.dataTransfer.setData("application/report-component", component.id)}
                  onClick={() => setComponents((current) => [...current, { ...component, id: `${component.id}-${Date.now()}` }])}
                  style={buttonStyle}
                  title={`Add ${component.label}`}
                >
                  {componentIcon(component.type)}
                  {component.label}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "10px",
              background: "var(--bg-elevated)",
              color: "var(--text-muted)",
              fontSize: "11px",
              wordBreak: "break-all",
            }}
          >
            {query.url}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            style={{
              border: "1px dashed var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "12px",
              minHeight: "155px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "8px",
            }}
          >
            {components.map((component, index) => (
              <div
                key={component.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--bg-elevated)",
                  padding: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", fontSize: "12px" }}>
                  {componentIcon(component.type)}
                  {component.label}
                </span>
                <button
                  type="button"
                  onClick={() => setComponents((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  style={{ ...buttonStyle, padding: "5px 7px" }}
                  title={`Remove ${component.label}`}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "8px" }}>
            {reportData.metrics.map((metric) => (
              <div key={metric.label} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "10px" }}>
                <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>{metric.label}</div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, marginTop: "6px" }}>{metric.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
              Cron
              <input value={cron} onChange={(event) => setCron(event.target.value)} style={fieldStyle} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
              Email
              <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ops@example.com" style={fieldStyle} />
            </label>
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
            Webhook
            <input value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} placeholder="https://example.com/report-hook" style={fieldStyle} />
          </label>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", color: "var(--text-muted)", fontSize: "12px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <CalendarClock size={14} /> Next run: {schedule?.nextRunAt || getNextRunPreview("0 9 * * 1")}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Mail size={14} /> {deliveryPlan.find((item) => item.channel === "email")?.attachments.length || 3} attachments
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Webhook size={14} /> {webhookUrl ? "Webhook ready" : "Webhook optional"}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Save size={14} /> Cached report preview
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
