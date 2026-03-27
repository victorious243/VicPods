const { sendEmail } = require('./emailService');
const { normalizeAppUrl } = require('../marketing/referralService');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanText(value, maxLength = 600) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanList(value, maxItems = 10, maxLength = 200) {
  return (Array.isArray(value) ? value : [])
    .map((item) => cleanText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function buildEpisodePreviewEmail(payload, appUrl) {
  const title = cleanText(payload?.title, 160) || 'Podcast episode preview';
  const hook = cleanText(payload?.hook, 500);
  const outline = cleanList(payload?.outline, 6, 180);
  const cta = cleanText(payload?.cta, 320);
  const launchPackTitles = cleanList(payload?.launchPackTitles, 3, 160);
  const launchPackDescription = cleanText(payload?.launchPackDescription, 800);
  const createAccountUrl = `${normalizeAppUrl(appUrl)}/auth/register`;
  const generatorUrl = `${normalizeAppUrl(appUrl)}/#idea-to-episode-generator`;
  const subject = 'Your VicPods episode preview';
  const text = [
    'Your VicPods episode preview is ready.',
    '',
    `Title: ${title}`,
    hook ? `Hook: ${hook}` : '',
    outline.length ? `Outline:\n${outline.map((item, index) => `${index + 1}. ${item}`).join('\n')}` : '',
    cta ? `CTA: ${cta}` : '',
    launchPackTitles.length ? `Launch Pack titles:\n${launchPackTitles.map((item, index) => `${index + 1}. ${item}`).join('\n')}` : '',
    launchPackDescription ? `Launch Pack description: ${launchPackDescription}` : '',
    '',
    `Keep building: ${createAccountUrl}`,
    `Open generator again: ${generatorUrl}`,
    '',
    'Created with VicPods',
  ].filter(Boolean).join('\n\n');

  const html = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; background:#f4f6fb; margin:0; padding:0;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px; background:#ffffff; border:1px solid #e2e8f0; border-radius:24px;">
            <tr>
              <td style="padding:32px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; color:#0f172a;">
                <div style="display:inline-block; padding:7px 12px; border-radius:999px; background:#f5f3ff; color:#6d28d9; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; margin-bottom:18px;">
                  Saved preview
                </div>
                <h1 style="margin:0 0 12px; font-size:30px; line-height:1.15;">Your VicPods episode preview</h1>
                <p style="margin:0 0 24px; font-size:16px; line-height:1.7; color:#475569;">
                  Keep this episode direction handy, then turn it into a full workflow whenever you are ready.
                </p>
                <div style="padding:22px; border-radius:20px; background:#0f172a; color:#f8fafc; margin:0 0 20px;">
                  <div style="font-size:13px; text-transform:uppercase; letter-spacing:0.08em; color:#a5b4fc; margin:0 0 10px;">Title</div>
                  <div style="font-size:28px; line-height:1.2; font-weight:700;">${escapeHtml(title)}</div>
                </div>
                ${hook ? `<p style="margin:0 0 18px; font-size:15px; line-height:1.7; color:#334155;"><strong>Hook:</strong> ${escapeHtml(hook)}</p>` : ''}
                ${outline.length ? `
                <div style="margin:0 0 18px;">
                  <p style="margin:0 0 10px; font-size:13px; text-transform:uppercase; letter-spacing:0.08em; color:#6d28d9; font-weight:700;">Outline</p>
                  <ol style="margin:0; padding-left:18px; color:#334155; font-size:15px; line-height:1.7;">
                    ${outline.map((item) => `<li style="margin:0 0 8px;">${escapeHtml(item)}</li>`).join('')}
                  </ol>
                </div>
                ` : ''}
                ${cta ? `<p style="margin:0 0 18px; font-size:15px; line-height:1.7; color:#334155;"><strong>Listener CTA:</strong> ${escapeHtml(cta)}</p>` : ''}
                ${(launchPackTitles.length || launchPackDescription) ? `
                <div style="margin:0 0 24px; padding:20px; border-radius:18px; border:1px solid #e2e8f0; background:#f8fafc;">
                  <p style="margin:0 0 10px; font-size:13px; text-transform:uppercase; letter-spacing:0.08em; color:#6d28d9; font-weight:700;">Launch preview</p>
                  ${launchPackTitles.length ? `<p style="margin:0 0 10px; font-size:15px; line-height:1.7; color:#0f172a;"><strong>Titles:</strong> ${escapeHtml(launchPackTitles.join(' · '))}</p>` : ''}
                  ${launchPackDescription ? `<p style="margin:0; font-size:15px; line-height:1.7; color:#334155;">${escapeHtml(launchPackDescription)}</p>` : ''}
                </div>
                ` : ''}
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 16px;">
                  <tr>
                    <td bgcolor="#5b5ff8" style="border-radius:14px;">
                      <a href="${escapeHtml(createAccountUrl)}" style="display:inline-block; padding:15px 24px; color:#ffffff; text-decoration:none; font-weight:700; border-radius:14px;">Create account</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0; font-size:14px; line-height:1.7; color:#64748b;">
                  Want another angle? <a href="${escapeHtml(generatorUrl)}" style="color:#5b5ff8; text-decoration:none; font-weight:600;">Open the generator again</a>.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  return { subject, text, html };
}

function buildPodcastIdeasEmail(payload, appUrl) {
  const niche = cleanText(payload?.niche, 120);
  const ideas = cleanList(
    (Array.isArray(payload?.ideas) ? payload.ideas : []).map((idea) => {
      const title = cleanText(idea?.title, 140);
      const hookAngle = cleanText(idea?.hookAngle, 220);
      return title && hookAngle ? `${title} — ${hookAngle}` : title || hookAngle;
    }),
    10,
    400
  );
  const createAccountUrl = `${normalizeAppUrl(appUrl)}/auth/register`;
  const ideasToolUrl = `${normalizeAppUrl(appUrl)}/podcast-idea-generator${niche ? `?niche=${encodeURIComponent(niche)}` : ''}`;
  const subject = 'Your VicPods podcast ideas';
  const text = [
    'Your VicPods podcast ideas are ready.',
    niche ? `Niche: ${niche}` : '',
    '',
    ideas.map((idea, index) => `${index + 1}. ${idea}`).join('\n'),
    '',
    `Turn ideas into episodes: ${createAccountUrl}`,
    `Generate more ideas: ${ideasToolUrl}`,
    '',
    'Created with VicPods',
  ].filter(Boolean).join('\n');

  const html = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; background:#f4f6fb; margin:0; padding:0;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px; background:#ffffff; border:1px solid #e2e8f0; border-radius:24px;">
            <tr>
              <td style="padding:32px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; color:#0f172a;">
                <div style="display:inline-block; padding:7px 12px; border-radius:999px; background:#eff6ff; color:#4338ca; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; margin-bottom:18px;">
                  Saved ideas
                </div>
                <h1 style="margin:0 0 12px; font-size:30px; line-height:1.15;">Your VicPods podcast ideas</h1>
                <p style="margin:0 0 20px; font-size:16px; line-height:1.7; color:#475569;">
                  Keep these ideas close, then turn the strongest one into a full episode workflow when you are ready.
                </p>
                ${niche ? `<p style="margin:0 0 16px; font-size:14px; line-height:1.7; color:#334155;"><strong>Niche:</strong> ${escapeHtml(niche)}</p>` : ''}
                <div style="padding:22px; border-radius:20px; background:#f8fafc; border:1px solid #e2e8f0; margin:0 0 22px;">
                  ${ideas.map((idea) => `<p style="margin:0 0 12px; font-size:15px; line-height:1.7; color:#334155;">${escapeHtml(idea)}</p>`).join('')}
                </div>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 16px;">
                  <tr>
                    <td bgcolor="#5b5ff8" style="border-radius:14px;">
                      <a href="${escapeHtml(createAccountUrl)}" style="display:inline-block; padding:15px 24px; color:#ffffff; text-decoration:none; font-weight:700; border-radius:14px;">Turn ideas into episodes</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0; font-size:14px; line-height:1.7; color:#64748b;">
                  Need another batch? <a href="${escapeHtml(ideasToolUrl)}" style="color:#5b5ff8; text-decoration:none; font-weight:600;">Open the idea generator</a>.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  return { subject, text, html };
}

async function sendSavedPublicPreviewEmail({ email, source, payload }) {
  const appUrl = normalizeAppUrl(process.env.APP_URL || 'http://localhost:3000');
  const message = source === 'podcast_ideas'
    ? buildPodcastIdeasEmail(payload, appUrl)
    : buildEpisodePreviewEmail(payload, appUrl);

  return sendEmail({
    to: email,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}

module.exports = {
  sendSavedPublicPreviewEmail,
};
