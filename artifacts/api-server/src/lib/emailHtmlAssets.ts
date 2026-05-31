/**
 * Brand HTML assets for platform emails (operator-overridable; these are the
 * CODE DEFAULTS).
 *
 * Generated from the design HTML provided by the operator, with snake_case
 * author tokens normalized to the canonical camelCase variable names used by
 * the render pipeline (see @workspace/notification-variables) and the shell
 * slot tokens ({{body}}, {{logoHtml}}, {{footerHtml}}, {{headerBg}}, {{subject}}).
 *
 * MASTER_SHELL_* compose the editable branded shell that wraps standard emails.
 * MAGAZINE_WELCOME_HTML is a self-contained document used as the welcome
 * email body in full-custom-HTML mode (wrapInShell = false).
 */

/** The editable branded shell. Slots: {{logoHtml}} {{body}} {{footerHtml}}; vars: {{subject}} {{headerBg}} + standard tokens. */
export const MASTER_SHELL_HTML = `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>{{subject}}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    body, table, td, p, a, h1, h2, h3 { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; background: #F6F2E9; }
    img { border: 0; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; display: block; }
    a { color: inherit; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
    .ExternalClass { width: 100%; }
    .ExternalClass, .ExternalClass p, .ExternalClass span, .ExternalClass font, .ExternalClass td, .ExternalClass div { line-height: 100%; }
    @media only screen and (max-width: 740px) {
      .container { width: 100% !important; max-width: 100% !important; }
      .px-pad { padding-left: 28px !important; padding-right: 28px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#F6F2E9;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;color:#1A1815;">

  <!-- Preheader (hidden, shows in inbox preview pane — REPLACE per email) -->
  <div style="display:none;font-size:1px;color:#F6F2E9;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    {{preheaderText}}
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F6F2E9;">
    <tr>
      <td align="center" style="padding:0;">

        <!-- ════════════════════════════════════════════════════════════ -->
        <!--                                                              -->
        <!--   MASTER HEADER — paste at the top of every email            -->
        <!--                                                              -->
        <!--   Thin indigo accent strip + centered LP Studio wordmark     -->
        <!--   with a hairline divider below. Brand-anchored, neutral     -->
        <!--   enough for any email type (lifecycle, transactional,       -->
        <!--   marketing).                                                -->
        <!--                                                              -->
        <!-- ════════════════════════════════════════════════════════════ -->

        <!-- Indigo accent strip (4px) — pure brand identity moment -->
        <table role="presentation" class="container" cellpadding="0" cellspacing="0" border="0" width="720" style="max-width:720px;background:{{headerBg}};line-height:1px;font-size:1px;">
          <tr><td style="height:4px;line-height:1px;font-size:1px;">&nbsp;</td></tr>
        </table>

        <!-- Header bar — wordmark centered, hairline below -->
        <table role="presentation" class="container" cellpadding="0" cellspacing="0" border="0" width="720" style="max-width:720px;background:#F6F2E9;">
          <tr>
            <td class="px-pad" align="center" style="padding:32px 56px 28px 56px;border-bottom:1px solid rgba(26,24,21,0.10);">
              {{logoHtml}}
            </td>
          </tr>
        </table>

        <!-- ════════════════════════════════════════════════════════════ -->
        <!--                                                              -->
        <!--   ▼  EMAIL BODY GOES HERE  ▼                                 -->
        <!--                                                              -->
        <!--   Replace this section with the email's content. The body    -->
        <!--   sections should be 720px max-width tables matching the     -->
        <!--   .container class so they line up with the header + footer. -->
        <!--                                                              -->
        <!-- ════════════════════════════════════════════════════════════ -->

        <table role="presentation" class="container" cellpadding="0" cellspacing="0" border="0" width="720" style="max-width:720px;background:#F6F2E9;">
          <tr>
            <td class="px-pad" style="padding:64px 56px;">

              {{body}}

            </td>
          </tr>
        </table>

        <!-- ════════════════════════════════════════════════════════════ -->
        <!--                                                              -->
        <!--   ▲  END EMAIL BODY  ▲                                       -->
        <!--                                                              -->
        <!-- ════════════════════════════════════════════════════════════ -->


        <!-- ════════════════════════════════════════════════════════════ -->
        <!--                                                              -->
        <!--   MASTER FOOTER — paste at the bottom of every email         -->
        <!--                                                              -->
        <!--   Wordmark + tagline, hairline divider, links row,           -->
        <!--   compliance block (delivered-to + unsubscribe + address).   -->
        <!--   CAN-SPAM compliant when {{physicalAddress}} is filled in. -->
        <!--                                                              -->
        <!-- ════════════════════════════════════════════════════════════ -->

        {{footerHtml}}

      </td>
    </tr>
  </table>

</body>
</html>
`;

/** Header wordmark, injected into the shell's {{logoHtml}} slot. */
export const MASTER_SHELL_LOGO_HTML = `<a href="https://lpstudio.ai/" style="text-decoration:none;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                  <tr>
                    <td style="font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:28px;font-weight:800;letter-spacing:-0.05em;color:#4B47E5;line-height:1;vertical-align:bottom;padding:0;">LP</td>
                    <td style="vertical-align:bottom;padding:0 0 6px 4px;line-height:1;">
                      <div style="width:7px;height:7px;border-radius:50%;background:#E26B4F;"></div>
                    </td>
                    <td style="font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.20em;color:#1A1815;line-height:1;vertical-align:bottom;padding:0 0 4px 10px;text-transform:uppercase;">Studio</td>
                  </tr>
                </table>
              </a>`;

/** Footer block (wordmark + links + CAN-SPAM compliance), injected into {{footerHtml}}. */
export const MASTER_SHELL_FOOTER_HTML = `<table role="presentation" class="container" cellpadding="0" cellspacing="0" border="0" width="720" style="max-width:720px;background:#F6F2E9;">

          <!-- Top hairline divider -->
          <tr>
            <td class="px-pad" style="padding:48px 56px 0 56px;">
              <div style="height:1px;background:rgba(26,24,21,0.10);line-height:1px;font-size:1px;">&nbsp;</div>
            </td>
          </tr>

          <!-- Wordmark + tagline row -->
          <tr>
            <td class="px-pad" style="padding:32px 56px 0 56px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td valign="middle">
                    <a href="https://lpstudio.ai/" style="text-decoration:none;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:22px;font-weight:800;letter-spacing:-0.05em;color:#4B47E5;line-height:1;vertical-align:bottom;padding:0;">LP</td>
                          <td style="vertical-align:bottom;padding:0 0 4px 3px;line-height:1;">
                            <div style="width:5px;height:5px;border-radius:50%;background:#E26B4F;"></div>
                          </td>
                          <td style="font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.20em;color:#1A1815;line-height:1;vertical-align:bottom;padding:0 0 3px 7px;text-transform:uppercase;">Studio</td>
                        </tr>
                      </table>
                    </a>
                  </td>
                  <td align="right" valign="middle">
                    <span style="font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:10px;font-weight:500;letter-spacing:0.22em;text-transform:uppercase;color:#5C5853;">
                      The AI revenue workspace
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Links row -->
          <tr>
            <td class="px-pad" style="padding:20px 56px 0 56px;">
              <p style="margin:0;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#5C5853;">
                <a href="https://lpstudio.ai/" style="color:#5C5853;text-decoration:none;">lpstudio.ai</a>
                &nbsp;·&nbsp;
                <a href="mailto:hi@lpstudio.ai" style="color:#5C5853;text-decoration:none;">hi@lpstudio.ai</a>
                &nbsp;·&nbsp;
                <a href="{{workspaceUrl}}" style="color:#5C5853;text-decoration:none;">Sign in</a>
              </p>
            </td>
          </tr>

          <!-- Compliance block — required for marketing emails -->
          <tr>
            <td class="px-pad" style="padding:24px 56px 48px 56px;">
              <div style="height:1px;background:rgba(26,24,21,0.08);line-height:1px;font-size:1px;margin-bottom:20px;">&nbsp;</div>
              <p style="margin:0 0 8px 0;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:#8B857C;">
                Delivered to {{recipientEmail}}. You're getting this because you signed up at <a href="https://lpstudio.ai/" style="color:#5C5853;text-decoration:underline;">lpstudio.ai</a>.
              </p>
              <p style="margin:0 0 8px 0;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:#8B857C;">
                <a href="{{unsubscribeUrl}}" style="color:#5C5853;text-decoration:underline;">Unsubscribe</a>
                &nbsp;·&nbsp;
                <a href="{{workspaceUrl}}/settings/notifications" style="color:#5C5853;text-decoration:underline;">Email preferences</a>
              </p>
              <p style="margin:0;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:#B5AEA2;">
                LP Studio · {{physicalAddress}}<br>
                © {{currentYear}} LP Studio. All rights reserved.
              </p>
            </td>
          </tr>
        </table>`;

/** Accent strip color for the shell header ({{headerBg}}). */
export const MASTER_SHELL_HEADER_BG = "#4B47E5";

/** Self-contained welcome email (full custom HTML; rendered with wrapInShell=false). */
export const MAGAZINE_WELCOME_HTML = `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>LP Studio · Vol. 01</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800;9..40,900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    body, table, td, p, a, h1, h2, h3 { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; background: #F6F2E9; }
    img { border: 0; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; display: block; }
    a { color: inherit; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
    .ExternalClass { width: 100%; }
    .ExternalClass, .ExternalClass p, .ExternalClass span, .ExternalClass font, .ExternalClass td, .ExternalClass div { line-height: 100%; }
    .paper { background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E"); }
    @media only screen and (max-width: 740px) {
      .container { width: 100% !important; max-width: 100% !important; }
      .px-pad { padding-left: 28px !important; padding-right: 28px !important; }
      .px-pad-sm { padding-left: 20px !important; padding-right: 20px !important; }
      .cover-h1 { font-size: 64px !important; line-height: 0.92 !important; letter-spacing: -0.05em !important; }
      .display-l { font-size: 44px !important; line-height: 1.0 !important; }
      .display-m { font-size: 30px !important; line-height: 1.1 !important; }
      .quote-l { font-size: 30px !important; line-height: 1.2 !important; }
      .stack { display: block !important; width: 100% !important; padding: 0 !important; }
      .stack-pad { padding: 32px 28px !important; }
      .hide-mobile { display: none !important; }
      .full-img { width: 100% !important; height: auto !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#F6F2E9;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;color:#1A1815;">
  <div style="display:none;font-size:1px;color:#F6F2E9;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    Issue 01 of LP Studio. You're in. The AI workspace where pages, microsites, and outreach get built on-brand.
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F6F2E9;">
    <tr><td align="center" style="padding:0;">
      <!-- MASTHEAD -->
      <table role="presentation" class="container paper" cellpadding="0" cellspacing="0" border="0" width="720" style="max-width:720px;background:#F6F2E9;">
        <tr><td class="px-pad" style="padding:24px 56px;border-bottom:1px solid rgba(26,24,21,0.18);">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td valign="middle"><span style="font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:10px;font-weight:600;letter-spacing:0.28em;text-transform:uppercase;color:#1A1815;">Vol. 01</span></td>
            <td align="center" valign="middle">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>
                <td style="font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:22px;font-weight:800;letter-spacing:-0.05em;color:#4B47E5;line-height:1;vertical-align:bottom;padding:0;">LP</td>
                <td style="vertical-align:bottom;padding:0 0 4px 3px;line-height:1;"><div style="width:6px;height:6px;border-radius:50%;background:#E26B4F;"></div></td>
                <td style="font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.20em;color:#1A1815;line-height:1;vertical-align:bottom;padding:0 0 3px 7px;text-transform:uppercase;">Studio</td>
              </tr></table>
            </td>
            <td align="right" valign="middle"><span style="font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:10px;font-weight:600;letter-spacing:0.28em;text-transform:uppercase;color:#1A1815;">Member · {{tenantName}}</span></td>
          </tr></table>
        </td></tr>
      </table>

      <!-- COVER -->
      <table role="presentation" class="container paper" cellpadding="0" cellspacing="0" border="0" width="720" style="max-width:720px;background:#F6F2E9;background-image:radial-gradient(ellipse at 15% 0%, rgba(75,71,229,0.18) 0%, transparent 55%), radial-gradient(ellipse at 90% 30%, rgba(226,107,79,0.14) 0%, transparent 50%), radial-gradient(ellipse at 50% 100%, rgba(107,145,113,0.10) 0%, transparent 55%);">
        <tr><td class="px-pad" style="padding:80px 56px 0 56px;">
          <span style="display:inline-block;font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:11px;font-weight:600;letter-spacing:0.28em;text-transform:uppercase;color:#4B47E5;padding:6px 12px;background:rgba(75,71,229,0.12);border-radius:999px;">The welcome issue · {{recipientName}}</span>
        </td></tr>
        <tr><td class="px-pad" style="padding:40px 56px 0 56px;">
          <h1 class="cover-h1" style="margin:0;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:96px;line-height:0.9;font-weight:800;letter-spacing:-0.06em;color:#1A1815;">You're in<span style="color:#E26B4F;">.</span></h1>
          <p style="margin:32px 0 0 0;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:19px;line-height:1.5;font-weight:400;color:#2A2722;max-width:520px;">LP Studio is the AI workspace where pages, microsites, and outreach get built on-brand in minutes. <strong style="color:#1A1815;font-weight:600;">{{tenantName}}</strong> just got the keys.</p>
        </td></tr>
        <tr><td class="px-pad" style="padding:36px 56px 0 56px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="background:#1A1815;border-radius:6px;"><a href="{{workspaceUrl}}" style="display:inline-block;padding:16px 28px;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;letter-spacing:-0.005em;color:#F6F2E9;text-decoration:none;border-radius:6px;">Open your workspace →</a></td>
            <td style="padding-left:18px;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:#5C5853;">14-day trial · No card</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:80px 0 0 0;"></td></tr>
        <tr><td class="px-pad" style="padding:0 56px 0 56px;">
          <img class="full-img" src="https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?auto=format&fit=crop&w=1440&h=900&q=80" alt="LP Studio" width="608" style="display:block;width:100%;max-width:608px;height:auto;border-radius:2px;">
        </td></tr>
        <tr><td class="px-pad" style="padding:14px 56px 0 56px;">
          <p style="margin:0;font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:10px;font-weight:500;letter-spacing:0.20em;text-transform:uppercase;color:#8B857C;">Fig. 01 · The workspace</p>
        </td></tr>
        <tr><td style="padding:0 0 100px 0;"></td></tr>
      </table>

      <!-- IN THIS ISSUE -->
      <table role="presentation" class="container" cellpadding="0" cellspacing="0" border="0" width="720" style="max-width:720px;background:#EDE9F5;background-image:radial-gradient(ellipse at 90% 20%, rgba(75,71,229,0.20) 0%, transparent 60%);">
        <tr><td class="px-pad" style="padding:80px 56px 24px 56px;">
          <p style="margin:0;font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:11px;font-weight:600;letter-spacing:0.28em;text-transform:uppercase;color:#2E2A8C;">In this issue<span style="color:#E26B4F;">.</span></p>
          <h2 class="display-l" style="margin:18px 0 0 0;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:56px;line-height:0.95;font-weight:800;letter-spacing:-0.045em;color:#1A1815;">What to try<br>in your first 5 minutes.</h2>
        </td></tr>
        <tr><td class="px-pad" style="padding:48px 56px 80px 56px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr><td style="padding:20px 0;border-top:1px solid rgba(46,42,140,0.20);" valign="middle">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                <td width="50" valign="middle"><span style="font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:11px;font-weight:600;letter-spacing:0.18em;color:#4B47E5;">01</span></td>
                <td valign="middle">
                  <a href="{{workspaceUrl}}/settings/brand" style="font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;letter-spacing:-0.025em;color:#1A1815;text-decoration:none;">Paste your URL. Match your brand.</a>
                  <p style="margin:6px 0 0 0;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:400;color:#5C5853;">Logo, colors, voice, value props imported in 30 seconds.</p>
                </td>
                <td align="right" valign="middle" width="60"><a href="{{workspaceUrl}}/settings/brand" style="font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#4B47E5;text-decoration:none;">Go →</a></td>
              </tr></table>
            </td></tr>
            <tr><td style="padding:20px 0;border-top:1px solid rgba(46,42,140,0.20);" valign="middle">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                <td width="50" valign="middle"><span style="font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:11px;font-weight:600;letter-spacing:0.18em;color:#4B47E5;">02</span></td>
                <td valign="middle">
                  <a href="{{workspaceUrl}}/pages/new" style="font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;letter-spacing:-0.025em;color:#1A1815;text-decoration:none;">Type a prompt. Ship a page.</a>
                  <p style="margin:6px 0 0 0;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:400;color:#5C5853;">A full on-brand landing page assembled in under a minute.</p>
                </td>
                <td align="right" valign="middle" width="60"><a href="{{workspaceUrl}}/pages/new" style="font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#4B47E5;text-decoration:none;">Go →</a></td>
              </tr></table>
            </td></tr>
            <tr><td style="padding:20px 0;border-top:1px solid rgba(46,42,140,0.20);border-bottom:1px solid rgba(46,42,140,0.20);" valign="middle">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                <td width="50" valign="middle"><span style="font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:11px;font-weight:600;letter-spacing:0.18em;color:#4B47E5;">03</span></td>
                <td valign="middle">
                  <a href="{{workspaceUrl}}/sales" style="font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;letter-spacing:-0.025em;color:#1A1815;text-decoration:none;">Hand it to sales.</a>
                  <p style="margin:6px 0 0 0;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:400;color:#5C5853;">Per-account microsites, AI outreach, personalized links with tracking.</p>
                </td>
                <td align="right" valign="middle" width="60"><a href="{{workspaceUrl}}/sales" style="font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#4B47E5;text-decoration:none;">Go →</a></td>
              </tr></table>
            </td></tr>
          </table>
        </td></tr>
      </table>

      <!-- FEATURE -->
      <table role="presentation" class="container paper" cellpadding="0" cellspacing="0" border="0" width="720" style="max-width:720px;background:#EFE6D0;background-image:radial-gradient(ellipse at 10% 20%, rgba(200,146,61,0.20) 0%, transparent 60%), radial-gradient(ellipse at 90% 90%, rgba(226,107,79,0.18) 0%, transparent 55%);">
        <tr><td class="px-pad" style="padding:96px 56px 0 56px;">
          <p style="margin:0;font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:11px;font-weight:600;letter-spacing:0.28em;text-transform:uppercase;color:#8C5A1F;">Feature · The magic moment<span style="color:#E26B4F;">.</span></p>
          <h2 class="display-l" style="margin:18px 0 0 0;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:60px;line-height:0.92;font-weight:800;letter-spacing:-0.05em;color:#1A1815;max-width:500px;">Type what you want.<br>Watch it build<span style="color:#E26B4F;">.</span></h2>
        </td></tr>
        <tr><td class="px-pad" style="padding:48px 56px 0 56px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0B0A1F;border-radius:8px;">
            <tr><td style="padding:14px 18px;border-bottom:1px solid rgba(244,239,227,0.08);">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#E26B4F;margin-right:6px;vertical-align:middle;"></span>
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#C8923D;margin-right:6px;vertical-align:middle;"></span>
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#6B9171;vertical-align:middle;"></span>
            </td></tr>
            <tr><td style="padding:32px 28px;">
              <p style="margin:0;font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:15px;line-height:1.65;font-weight:500;color:#F4EFE3;"><span style="color:#8B857C;">$&nbsp;</span>Generate a pilot page for <span style="background:rgba(75,71,229,0.32);color:#A6A4F5;padding:2px 8px;border-radius:5px;">Acme Corp</span> highlighting our <span style="background:rgba(226,107,79,0.28);color:#F2A893;padding:2px 8px;border-radius:5px;">90-day pilot</span> with their <span style="background:rgba(199,231,56,0.22);color:#C7E738;padding:2px 8px;border-radius:5px;">RevOps team</span>.<span style="color:#C7E738;">|</span></p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td class="px-pad" style="padding:14px 56px 0 56px;">
          <p style="margin:0;font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:10px;font-weight:500;letter-spacing:0.20em;text-transform:uppercase;color:#8B857C;">Fig. 02 · The prompt → 47 seconds to a live page</p>
        </td></tr>
        <tr><td style="padding:0 0 96px 0;"></td></tr>
      </table>

      <!-- PHOTO ESSAY -->
      <table role="presentation" class="container paper" cellpadding="0" cellspacing="0" border="0" width="720" style="max-width:720px;background:#F6F2E9;">
        <tr><td class="px-pad" style="padding:96px 56px 0 56px;">
          <p style="margin:0;font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:11px;font-weight:600;letter-spacing:0.28em;text-transform:uppercase;color:#4B47E5;">Photo essay · In production<span style="color:#E26B4F;">.</span></p>
          <h2 class="display-l" style="margin:18px 0 0 0;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:56px;line-height:0.94;font-weight:800;letter-spacing:-0.045em;color:#1A1815;max-width:480px;">Real pages, shipped today.</h2>
        </td></tr>
        <tr><td style="padding:48px 0 0 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td valign="top" width="60%" class="stack" style="padding-right:6px;">
              <img class="full-img" src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=720&h=800&q=80" alt="Generated page 1" width="432" style="display:block;width:100%;max-width:432px;height:auto;">
              <p style="margin:10px 56px 0 56px;font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:10px;font-weight:600;letter-spacing:0.20em;text-transform:uppercase;color:#1A1815;">Acme Corp<span style="color:#E26B4F;">.</span></p>
              <p style="margin:2px 56px 0 56px;font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:10px;font-weight:400;letter-spacing:0.12em;color:#8B857C;">Enterprise pilot · 2h ago</p>
            </td>
            <td valign="top" width="40%" class="stack" style="padding-left:6px;">
              <img class="full-img" src="https://images.unsplash.com/photo-1559028012-481c04fa702d?auto=format&fit=crop&w=400&h=400&q=80" alt="Generated page 2" width="288" style="display:block;width:100%;max-width:288px;height:auto;">
              <p style="margin:10px 56px 0 0;font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:10px;font-weight:600;letter-spacing:0.20em;text-transform:uppercase;color:#1A1815;">Northstar<span style="color:#E26B4F;">.</span></p>
              <p style="margin:2px 56px 16px 0;font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:10px;font-weight:400;letter-spacing:0.12em;color:#8B857C;">DSO microsite · 6h ago</p>
              <img class="full-img" src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=400&h=400&q=80" alt="Generated page 3" width="288" style="display:block;width:100%;max-width:288px;height:auto;">
              <p style="margin:10px 56px 0 0;font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:10px;font-weight:600;letter-spacing:0.20em;text-transform:uppercase;color:#1A1815;">Veridian<span style="color:#E26B4F;">.</span></p>
              <p style="margin:2px 56px 0 0;font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:10px;font-weight:400;letter-spacing:0.12em;color:#8B857C;">Healthcare launch · 9h ago</p>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:96px 0 0 0;"></td></tr>
      </table>

      <!-- PULL QUOTE - SALES -->
      <table role="presentation" class="container paper" cellpadding="0" cellspacing="0" border="0" width="720" style="max-width:720px;background:#EDE9F5;background-image:radial-gradient(ellipse at 80% 30%, rgba(75,71,229,0.20) 0%, transparent 55%);">
        <tr><td class="px-pad" style="padding:96px 56px;">
          <p style="margin:0 0 28px 0;font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:11px;font-weight:600;letter-spacing:0.28em;text-transform:uppercase;color:#2E2A8C;">Dispatch · Sales<span style="color:#E26B4F;">.</span></p>
          <p class="quote-l" style="margin:0;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:40px;line-height:1.12;font-weight:700;letter-spacing:-0.035em;color:#1A1815;"><span style="color:#4B47E5;">"</span>I shipped a page in 10 minutes that helped me land a 16-location expansion deal. Marketing would've taken three weeks. I'm not going back.<span style="color:#4B47E5;">"</span></p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:36px;"><tr>
            <td valign="middle" width="56" style="padding-right:14px;"><img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=facearea&facepad=3&w=200&h=200&q=80" alt="AE" width="48" height="48" style="display:block;width:48px;height:48px;border-radius:50%;"></td>
            <td valign="middle">
              <p style="margin:0;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#1A1815;letter-spacing:-0.015em;">AE</p>
              <p style="margin:2px 0 0 0;font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:10px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#5C5853;">LP Studio superfan</p>
            </td>
          </tr></table>
        </td></tr>
      </table>

      <!-- PULL QUOTE - MARKETING -->
      <table role="presentation" class="container paper" cellpadding="0" cellspacing="0" border="0" width="720" style="max-width:720px;background:#E9EFE6;background-image:radial-gradient(ellipse at 20% 70%, rgba(107,145,113,0.22) 0%, transparent 60%);">
        <tr><td class="px-pad" style="padding:96px 56px;" align="right">
          <p style="margin:0 0 28px 0;font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:11px;font-weight:600;letter-spacing:0.28em;text-transform:uppercase;color:#3F5C44;text-align:right;">Dispatch · Marketing<span style="color:#E26B4F;">.</span></p>
          <p class="quote-l" style="margin:0;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:40px;line-height:1.12;font-weight:700;letter-spacing:-0.035em;color:#1A1815;text-align:right;"><span style="color:#6B9171;">"</span>Marketing locks the brand. Sales builds the pages. Nothing off-brand goes live. I haven't gotten a 'can you make me a page' Slack in two months.<span style="color:#6B9171;">"</span></p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:36px 0 0 auto;"><tr>
            <td valign="middle" align="right">
              <p style="margin:0;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#1A1815;letter-spacing:-0.015em;text-align:right;">Marketing Lead</p>
              <p style="margin:2px 0 0 0;font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:10px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#5C5853;text-align:right;">LP Studio convert</p>
            </td>
            <td valign="middle" width="56" style="padding-left:14px;"><img src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=facearea&facepad=3&w=200&h=200&q=80" alt="Marketing Lead" width="48" height="48" style="display:block;width:48px;height:48px;border-radius:50%;"></td>
          </tr></table>
        </td></tr>
      </table>

      <!-- LETTER FROM THE FOUNDER -->
      <table role="presentation" class="container paper" cellpadding="0" cellspacing="0" border="0" width="720" style="max-width:720px;background:#F4E8D8;background-image:radial-gradient(ellipse at 90% 0%, rgba(200,146,61,0.18) 0%, transparent 55%);">
        <tr><td class="px-pad" style="padding:96px 56px;">
          <p style="margin:0;font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:11px;font-weight:600;letter-spacing:0.28em;text-transform:uppercase;color:#8C5A1F;">Letter from the founder<span style="color:#E26B4F;">.</span></p>
          <h2 class="display-m" style="margin:24px 0 0 0;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:40px;line-height:1.0;font-weight:800;letter-spacing:-0.04em;color:#1A1815;max-width:480px;">Why this exists.</h2>
          <p style="margin:32px 0 0 0;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.7;color:#2A2722;max-width:520px;">I built LP Studio for ABM. Sales needs personalized pages for every account, and marketing's already at capacity on the rest of the funnel.</p>
          <p style="margin:16px 0 0 0;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.7;color:#2A2722;max-width:520px;">Now our whole team uses it — sales for per-account microsites at scale, marketing for our event pages and podcast hub at <a href="https://lp.meetdandy.com/margin-line" style="color:#4B47E5;text-decoration:underline;font-weight:500;">lp.meetdandy.com/margin-line</a>, and SMB for paid-ads landing pages right now.</p>
          <p style="margin:16px 0 0 0;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.7;color:#2A2722;max-width:520px;">If you want a 20-minute walkthrough where I open your workspace with you, just hit reply. Glad you're here.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:36px;"><tr>
            <td valign="middle" width="56" style="padding-right:14px;"><img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&facepad=3&w=200&h=200&q=80" alt="Charlotte" width="48" height="48" style="display:block;width:48px;height:48px;border-radius:50%;"></td>
            <td valign="middle">
              <p style="margin:0;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:17px;font-weight:700;color:#1A1815;letter-spacing:-0.015em;">Charlotte<span style="color:#E26B4F;">.</span></p>
              <p style="margin:2px 0 0 0;font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:10px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:#8C5A1F;">Founder, LP Studio</p>
            </td>
          </tr></table>
        </td></tr>
      </table>

      <!-- BACK COVER -->
      <table role="presentation" class="container" cellpadding="0" cellspacing="0" border="0" width="720" style="max-width:720px;background:#1B1840;background-image:radial-gradient(ellipse at 30% 20%, rgba(75,71,229,0.50) 0%, transparent 55%), radial-gradient(ellipse at 90% 90%, rgba(226,107,79,0.30) 0%, transparent 50%);">
        <tr><td class="px-pad" align="center" style="padding:140px 56px;">
          <p style="margin:0 0 24px 0;font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:11px;font-weight:600;letter-spacing:0.28em;text-transform:uppercase;color:#C7E738;text-align:center;">Your membership<span style="color:#E26B4F;">.</span></p>
          <h2 class="display-l" style="margin:0;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:64px;line-height:0.92;font-weight:800;letter-spacing:-0.05em;color:#F4EFE3;text-align:center;">14 days<span style="color:#C7E738;">.</span><br>Everything unlocked<span style="color:#E26B4F;">.</span></h2>
          <p style="margin:24px auto 0 auto;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:rgba(244,239,227,0.72);max-width:420px;text-align:center;">Full workspace. Unlimited pages. Sales Console. Brand-aware AI. No card. We'll nudge you before it ends so nothing surprises you.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:40px auto 0 auto;"><tr>
            <td style="background:#C7E738;border-radius:6px;"><a href="{{workspaceUrl}}" style="display:inline-block;padding:16px 30px;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:-0.005em;color:#1B1840;text-decoration:none;border-radius:6px;">Open your workspace</a></td>
          </tr></table>
          <p style="margin:18px 0 0 0;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:rgba(244,239,227,0.55);text-align:center;"><a href="{{ctaUrl}}" style="color:rgba(244,239,227,0.85);text-decoration:underline;">See pricing</a></p>
        </td></tr>
      </table>

      <!-- FOOTER -->
      <table role="presentation" class="container paper" cellpadding="0" cellspacing="0" border="0" width="720" style="max-width:720px;background:#F6F2E9;">
        <tr><td class="px-pad" style="padding:48px 56px 24px 56px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td valign="middle">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:22px;font-weight:800;letter-spacing:-0.05em;color:#4B47E5;line-height:1;vertical-align:bottom;padding:0;">LP</td>
                <td style="vertical-align:bottom;padding:0 0 4px 3px;line-height:1;"><div style="width:5px;height:5px;border-radius:50%;background:#E26B4F;"></div></td>
                <td style="font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.20em;color:#1A1815;line-height:1;vertical-align:bottom;padding:0 0 3px 7px;text-transform:uppercase;">Studio</td>
              </tr></table>
            </td>
            <td align="right" valign="middle"><p style="margin:0;font-family:'JetBrains Mono','SF Mono',Menlo,monospace;font-size:10px;font-weight:500;letter-spacing:0.20em;text-transform:uppercase;color:#5C5853;">Vol. 01 · Welcome Issue · 2026</p></td>
          </tr></table>
        </td></tr>
        <tr><td class="px-pad" style="padding:0 56px 48px 56px;">
          <div style="height:1px;background:rgba(26,24,21,0.15);line-height:1px;font-size:1px;margin-bottom:20px;">&nbsp;</div>
          <p style="margin:0;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.7;color:#8B857C;">Delivered to {{recipientEmail}}.<br><a href="{{unsubscribeUrl}}" style="color:#5C5853;text-decoration:underline;">Unsubscribe</a> · <a href="{{workspaceUrl}}/settings/notifications" style="color:#5C5853;text-decoration:underline;">Email preferences</a> · <a href="https://lpstudio.ai/" style="color:#5C5853;text-decoration:underline;">lpstudio.ai</a></p>
        </td></tr>
      </table>

    </td></tr>
  </table>
</body>
</html>
`;
