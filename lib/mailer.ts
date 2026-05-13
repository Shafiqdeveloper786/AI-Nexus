import { createTransport } from "nodemailer";

const transporter = createTransport({
  service: "gmail",
  auth: {
    user: process.env.NODEMAILER_EMAIL,
    pass: process.env.NODEMAILER_PASSWORD,
  },
});

/* ── AI Nexus branded OTP email ─────────────────────────────────────────────
   Dark-themed, glassmorphic HTML template that matches the dashboard UI.    */
export async function sendOtpEmail(
  email: string,
  otp: string,
  name?: string
) {
  const displayName = name?.trim() || "there";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>AI Nexus — Verification Code</title>
</head>
<body style="margin:0;padding:0;background-color:#030b1a;font-family:'Segoe UI',system-ui,sans-serif;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#030b1a;padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- Card -->
        <table width="100%" cellpadding="0" cellspacing="0"
          style="max-width:480px;background:linear-gradient(160deg,rgba(8,22,46,0.97) 0%,rgba(3,11,26,0.99) 100%);border:1px solid rgba(0,212,255,0.22);border-radius:20px;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,0.7),0 0 60px rgba(0,212,255,0.06);">

          <!-- Top neon accent bar -->
          <tr>
            <td style="height:3px;background:linear-gradient(90deg,transparent,#00d4ff,#a855f7,transparent);"></td>
          </tr>

          <!-- Header -->
          <tr>
            <td align="center" style="padding:36px 40px 24px;">

              <!-- Logo mark -->
              <div style="display:inline-block;width:56px;height:56px;background:linear-gradient(135deg,rgba(0,212,255,0.15),rgba(168,85,247,0.22));border:1px solid rgba(0,212,255,0.35);border-radius:14px;line-height:56px;text-align:center;margin-bottom:20px;">
                <span style="font-size:24px;line-height:56px;">⚡</span>
              </div>

              <!-- Brand name -->
              <h1 style="margin:0 0 6px;font-size:28px;font-weight:900;letter-spacing:6px;background:linear-gradient(90deg,#00d4ff,#a855f7,#f0abfc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">
                AI NEXUS
              </h1>
              <p style="margin:0;color:rgba(0,212,255,0.6);font-size:10px;letter-spacing:3px;font-weight:600;text-transform:uppercase;">
                Quantum Knowledge Core · v4.0.2
              </p>

            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(0,212,255,0.2),transparent);"></div>
            </td>
          </tr>

          <!-- Body text -->
          <tr>
            <td style="padding:28px 40px 0;">
              <p style="margin:0 0 8px;color:#94a3b8;font-size:15px;">
                Hello, <strong style="color:#e2e8f0;">${displayName}</strong> 👋
              </p>
              <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.7;">
                Your portal to the future is ready.<br/>
                Use the code below to verify your identity and access the AI Nexus dashboard.
              </p>
            </td>
          </tr>

          <!-- OTP Code Box -->
          <tr>
            <td style="padding:0 40px 28px;">
              <div style="background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.3);border-radius:14px;padding:28px 24px;text-align:center;box-shadow:0 0 30px rgba(0,212,255,0.08);">

                <p style="margin:0 0 12px;color:rgba(148,163,184,0.6);font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:600;">
                  Your Secure Access Code
                </p>

                <!-- OTP digits -->
                <div style="letter-spacing:14px;font-size:46px;font-weight:900;color:#00d4ff;font-family:'Courier New',monospace;text-shadow:0 0 20px rgba(0,212,255,0.5);">
                  ${otp}
                </div>

                <!-- Expiry warning -->
                <p style="margin:16px 0 0;color:rgba(168,85,247,0.7);font-size:12px;font-weight:600;">
                  ⏱ Expires in <strong style="color:#a855f7;">10 minutes</strong>
                </p>

              </div>
            </td>
          </tr>

          <!-- Security notice -->
          <tr>
            <td style="padding:0 40px 24px;">
              <div style="background:rgba(168,85,247,0.05);border:1px solid rgba(168,85,247,0.15);border-radius:10px;padding:14px 18px;">
                <p style="margin:0;color:rgba(148,163,184,0.55);font-size:12px;line-height:1.6;">
                  🔒 <strong style="color:rgba(148,163,184,0.75);">Security notice:</strong>
                  AI Nexus will never ask for this code via phone or chat.
                  If you did not request this code, you can safely ignore this email.
                </p>
              </div>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.05),transparent);"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 32px;text-align:center;">
              <p style="margin:0 0 6px;color:#1e293b;font-size:11px;letter-spacing:2px;font-weight:700;text-transform:uppercase;">
                AI NEXUS · QUANTUM CORE v4.0.2
              </p>
              <p style="margin:0;color:#0f172a;font-size:10px;">
                This is an automated message — please do not reply.
              </p>
            </td>
          </tr>

          <!-- Bottom neon accent bar -->
          <tr>
            <td style="height:2px;background:linear-gradient(90deg,transparent,rgba(168,85,247,0.4),rgba(0,212,255,0.2),transparent);"></td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>

</body>
</html>`;

  await transporter.sendMail({
    from: `"AI Nexus" <${process.env.NODEMAILER_EMAIL}>`,
    to: email,
    subject: `[AI Nexus] Your Secure Access Code: ${otp}`,
    text: `Hello ${displayName},\n\nYour AI Nexus verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, please ignore this email.\n\n— AI Nexus Team`,
    html,
  });
}
