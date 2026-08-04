# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y-gate.spec.ts >> Accessibility CI Gate >> settings: no WCAG 2.1 AA violations
- Location: tests\e2e\a11y-gate.spec.ts:27:5

# Error details

```
Error: A11y violations on /settings:
[critical] aria-required-children: Ensure elements with an ARIA role that require child roles contain them (1 nodes)
[serious] color-contrast: Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds (9 nodes)

expect(received).toEqual(expected) // deep equality

- Expected  -   1
+ Received  + 716

- Array []
+ Array [
+   Object {
+     "description": "Ensure elements with an ARIA role that require child roles contain them",
+     "help": "Certain ARIA roles must contain particular children",
+     "helpUrl": "https://dequeuniversity.com/rules/axe/4.12/aria-required-children?application=playwright",
+     "id": "aria-required-children",
+     "impact": "critical",
+     "nodes": Array [
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "messageKey": "unallowed",
+               "values": "button[aria-current], button[aria-label]",
+             },
+             "id": "aria-required-children",
+             "impact": "critical",
+             "message": "Element has children which are not allowed: button[aria-current], button[aria-label]",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-current=\"page\" aria-label=\"Overview\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-current=\"page\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Account\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Account\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Claimable\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Claimable\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Compare\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Compare\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Transactions\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Transactions\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Contracts\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Contracts\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Assets\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Assets\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Anchors\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Anchors\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Search\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Search\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Network Info\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Network Info\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Validator AI\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Validator AI\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Real-Time\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Real-Time\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Live Activity\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Live Activity\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Cache Stats\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Cache Stats\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Performance\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Performance\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Builder\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Builder\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Simulator\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Simulator\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Advanced Sim\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Advanced Sim\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Faucet\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Faucet\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"DEX\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"DEX\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Liquidity AI\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Liquidity AI\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Path Explorer\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Path Explorer\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Explorer Links\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Explorer Links\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Pay Channels\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Pay Channels\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Wallet\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Wallet\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Signer\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Signer\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Multisig\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Multisig\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"DID\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"DID\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Alerts\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Alerts\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Portfolio\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Portfolio\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Portfolio Analytics\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Portfolio Analytics\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Trading Agent\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Trading Agent\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Charts\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Charts\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Data Stories\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Data Stories\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Analytics\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Analytics\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Design System\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Design System\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Flags\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Flags\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Code Review\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Code Review\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"AI Patterns\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"AI Patterns\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Anomaly Viz\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Anomaly Viz\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Health\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Health\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Monitoring\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Monitoring\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Forecast\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Forecast\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Export\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Export\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Collaboration\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Collaboration\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Governance\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Governance\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Settings\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Settings\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Audit\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Audit\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"AI Personalization\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"AI Personalization\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Security\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Security\"]",
+                 ],
+               },
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-label=\"Dependencies\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-label=\"Dependencies\"]",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has children which are not allowed: button[aria-current], button[aria-label]",
+         "html": "<ul role=\"list\" style=\"list-style: none; margin: 0px; padding: 0px;\">",
+         "impact": "critical",
+         "none": Array [],
+         "target": Array [
+           "ul",
+         ],
+       },
+     ],
+     "tags": Array [
+       "cat.aria",
+       "wcag2a",
+       "wcag131",
+       "EN-301-549",
+       "EN-9.1.3.1",
+       "RGAAv4",
+       "RGAA-9.3.1",
+     ],
+   },
+   Object {
+     "description": "Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds",
+     "help": "Elements must meet minimum color contrast ratio thresholds",
+     "helpUrl": "https://dequeuniversity.com/rules/axe/4.12/color-contrast?application=playwright",
+     "id": "color-contrast",
+     "impact": "serious",
+     "nodes": Array [
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#0284c7",
+               "colorParse": undefined,
+               "contrastRatio": 4.09,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#ffffff",
+               "fontSize": "10.0pt (13.3333px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+               "shadowColor": undefined,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 4.09 (foreground color: #ffffff, background color: #0284c7, font size: 10.0pt (13.3333px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<button style=\"display: flex; align-items: center; gap: 8px; padding: 10px 20px; background: var(--cyan); border-width: medium; border-style: none; border-color: currentcolor; border-image: none; border-radius: 8px; color: rgb(255, 255, 255); font-weight: 600; cursor: pointer;\">",
+                 "target": Array [
+                   "div > div:nth-child(4) > button:nth-child(2)",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.09 (foreground color: #ffffff, background color: #0284c7, font size: 10.0pt (13.3333px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<button style=\"display: flex; align-items: center; gap: 8px; padding: 10px 20px; background: var(--cyan); border-width: medium; border-style: none; border-color: currentcolor; border-image: none; border-radius: 8px; color: rgb(255, 255, 255); font-weight: 600; cursor: pointer;\">",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div > div:nth-child(4) > button:nth-child(2)",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#ffffff",
+               "colorParse": undefined,
+               "contrastRatio": 4.09,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#0284c7",
+               "fontSize": "13.5pt (18px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+               "shadowColor": undefined,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 4.09 (foreground color: #0284c7, background color: #ffffff, font size: 13.5pt (18px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<aside aria-label=\"Main navigation\" id=\"sidebar\" style=\"width: var(--sidebar...\">",
+                 "target": Array [
+                   "#sidebar",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.09 (foreground color: #0284c7, background color: #ffffff, font size: 13.5pt (18px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<div role=\"img\" aria-label=\"Stellar Dev Dashboard\" style=\"font-family: var(--font-display); font-size: 18px; font-weight: 800; color: var(--cyan); letter-spacing: -0.5px; display: flex; align-items: center; gap: 8px;\">",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "div[role=\"img\"]",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#e2e8f0",
+               "colorParse": undefined,
+               "contrastRatio": 3.32,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#0284c7",
+               "fontSize": "8.3pt (11px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+               "shadowColor": undefined,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.32 (foreground color: #0284c7, background color: #e2e8f0, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<select id=\"network-select\" aria-label=\"Select Stellar netwo...\" style=\"width: 100%; padding...\">",
+                 "target": Array [
+                   "#network-select",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.32 (foreground color: #0284c7, background color: #e2e8f0, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<select id=\"network-select\" aria-label=\"Select Stellar netwo...\" style=\"width: 100%; padding...\">",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "#network-select",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#ffffff",
+               "colorParse": undefined,
+               "contrastRatio": 3.24,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#8390a2",
+               "fontSize": "6.8pt (9px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+               "shadowColor": undefined,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.24 (foreground color: #8390a2, background color: #ffffff, font size: 6.8pt (9px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<aside aria-label=\"Main navigation\" id=\"sidebar\" style=\"width: var(--sidebar...\">",
+                 "target": Array [
+                   "#sidebar",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.24 (foreground color: #8390a2, background color: #ffffff, font size: 6.8pt (9px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<div aria-hidden=\"true\" style=\"font-size: 9px; font-weight: 700; color: var(--text-muted); padding: 16px 16px 8px; letter-spacing: 1.2px; text-transform: uppercase; opacity: 0.8;\">ANALYTICS</div>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "li:nth-child(1) > div",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#d9edf7",
+               "colorParse": undefined,
+               "contrastRatio": 3.39,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#0284c7",
+               "fontSize": "9.8pt (13px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+               "shadowColor": undefined,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.39 (foreground color: #0284c7, background color: #d9edf7, font size: 9.8pt (13px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<button type=\"button\" class=\"touch-target\" aria-current=\"page\" aria-label=\"Overview\" style=\"display: flex; align...\">",
+                 "target": Array [
+                   "button[aria-current=\"page\"]",
+                 ],
+               },
+               Object {
+                 "html": "<aside aria-label=\"Main navigation\" id=\"sidebar\" style=\"width: var(--sidebar...\">",
+                 "target": Array [
+                   "#sidebar",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.39 (foreground color: #0284c7, background color: #d9edf7, font size: 9.8pt (13px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<button type=\"button\" class=\"touch-target\" aria-current=\"page\" aria-label=\"Overview\" style=\"display: flex; align...\">",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "button[aria-current=\"page\"]",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#ffffff",
+               "colorParse": undefined,
+               "contrastRatio": 3.24,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#8390a2",
+               "fontSize": "6.8pt (9px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+               "shadowColor": undefined,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.24 (foreground color: #8390a2, background color: #ffffff, font size: 6.8pt (9px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<aside aria-label=\"Main navigation\" id=\"sidebar\" style=\"width: var(--sidebar...\">",
+                 "target": Array [
+                   "#sidebar",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.24 (foreground color: #8390a2, background color: #ffffff, font size: 6.8pt (9px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<div aria-hidden=\"true\" style=\"font-size: 9px; font-weight: 700; color: var(--text-muted); padding: 16px 16px 8px; letter-spacing: 1.2px; text-transform: uppercase; opacity: 0.8;\">NETWORK</div>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "li:nth-child(11) > div",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#d8efe6",
+               "colorParse": undefined,
+               "contrastRatio": 1.88,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#22c55e",
+               "fontSize": "8.3pt (11px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+               "shadowColor": undefined,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 1.88 (foreground color: #22c55e, background color: #d8efe6, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<button class=\"expertise-badge-trig...\" aria-label=\"Expertise level: Nov...\" aria-expanded=\"false\" aria-haspopup=\"true\" style=\"display: inline-flex...\">",
+                 "target": Array [
+                   ".expertise-badge-trigger",
+                 ],
+               },
+               Object {
+                 "html": "<body>",
+                 "target": Array [
+                   "body",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 1.88 (foreground color: #22c55e, background color: #d8efe6, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<span>Novice</span>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".expertise-badge-trigger > span:nth-child(2)",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#f1f5f9",
+               "colorParse": undefined,
+               "contrastRatio": 4.34,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#64748b",
+               "fontSize": "9.0pt (12px)",
+               "fontWeight": "normal",
+               "messageKey": null,
+               "shadowColor": undefined,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 4.34 (foreground color: #64748b, background color: #f1f5f9, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<body>",
+                 "target": Array [
+                   "body",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 4.34 (foreground color: #64748b, background color: #f1f5f9, font size: 9.0pt (12px), font weight: normal). Expected contrast ratio of 4.5:1",
+         "html": "<div style=\"font-size: 12px; color: var(--text-muted); margin-top: 8px; padding: 0px;\">Enter a Stellar address: G... • M... • name*domain</div>",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "#main-content > div:nth-child(3) > div:nth-child(1) > div:nth-child(3)",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": Object {
+               "bgColor": "#0284c7",
+               "colorParse": undefined,
+               "contrastRatio": 3.73,
+               "expectedContrastRatio": "4.5:1",
+               "fgColor": "#f1f5f9",
+               "fontSize": "9.8pt (13px)",
+               "fontWeight": "bold",
+               "messageKey": null,
+               "shadowColor": undefined,
+             },
+             "id": "color-contrast",
+             "impact": "serious",
+             "message": "Element has insufficient color contrast of 3.73 (foreground color: #f1f5f9, background color: #0284c7, font size: 9.8pt (13px), font weight: bold). Expected contrast ratio of 4.5:1",
+             "relatedNodes": Array [
+               Object {
+                 "html": "<button type=\"button\" aria-label=\"Connect to Stellar a...\" style=\"padding: 9px 20px; b...\">",
+                 "target": Array [
+                   "button[aria-label=\"Connect to Stellar account\"]",
+                 ],
+               },
+             ],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element has insufficient color contrast of 3.73 (foreground color: #f1f5f9, background color: #0284c7, font size: 9.8pt (13px), font weight: bold). Expected contrast ratio of 4.5:1",
+         "html": "<button type=\"button\" aria-label=\"Connect to Stellar a...\" style=\"padding: 9px 20px; b...\">",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           "button[aria-label=\"Connect to Stellar account\"]",
+         ],
+       },
+     ],
+     "tags": Array [
+       "cat.color",
+       "wcag2aa",
+       "wcag143",
+       "TTv5",
+       "TT13.c",
+       "EN-301-549",
+       "EN-9.1.4.3",
+       "ACT",
+       "RGAAv4",
+       "RGAA-3.2.1",
+     ],
+   },
+ ]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import AxeBuilder from '@axe-core/playwright';
  3  | 
  4  | /**
  5  |  * Accessibility CI gate (D-024).
  6  |  * Fails on any WCAG 2.1 AA violation with critical, serious, or moderate impact.
  7  |  */
  8  | 
  9  | test.setTimeout(90_000);
  10 | 
  11 | const PAGES = [
  12 |   { name: 'connect', path: '/connect' },
  13 |   { name: 'overview', path: '/overview' },
  14 |   { name: 'settings', path: '/settings' },
  15 | ];
  16 | 
  17 | const IMPACT_LEVELS = new Set(['critical', 'serious', 'moderate']);
  18 | 
  19 | async function waitForPageReady(page) {
  20 |   await page.waitForLoadState('load');
  21 |   await expect(page.locator('main')).toBeVisible({ timeout: 30_000 });
  22 |   await page.waitForTimeout(200);
  23 | }
  24 | 
  25 | test.describe('Accessibility CI Gate', () => {
  26 |   for (const { name, path } of PAGES) {
  27 |     test(`${name}: no WCAG 2.1 AA violations`, async ({ page }) => {
  28 |       await page.goto(path);
  29 |       await waitForPageReady(page);
  30 | 
  31 |       const results = await new AxeBuilder({ page })
  32 |         .setLegacyMode(true)
  33 |         .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
  34 |         .analyze();
  35 | 
  36 |       const violations = results.violations.filter((v) => IMPACT_LEVELS.has(v.impact ?? ''));
  37 |       if (violations.length > 0) {
  38 |         const summary = violations
  39 |           .map((v) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} nodes)`)
  40 |           .join('\n');
> 41 |         expect(violations, `A11y violations on ${path}:\n${summary}`).toEqual([]);
     |                                                                       ^ Error: A11y violations on /settings:
  42 |       }
  43 |     });
  44 |   }
  45 | 
  46 |   test('keyboard focus is reachable on connect page', async ({ page }) => {
  47 |     await page.goto('/connect');
  48 |     await waitForPageReady(page);
  49 |     await page.keyboard.press('Tab');
  50 |     const tag = await page.evaluate(() => document.activeElement?.tagName);
  51 |     expect(tag).toBeTruthy();
  52 |   });
  53 | 
  54 |   test('page has a main landmark', async ({ page }) => {
  55 |     await page.goto('/connect');
  56 |     await waitForPageReady(page);
  57 |   });
  58 | });
  59 | 
```