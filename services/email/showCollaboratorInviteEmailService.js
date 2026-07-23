const { sendEmail } = require('./emailService');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildShowCollaboratorInviteEmail({
  collaboratorName,
  inviteEmail,
  inviterName,
  showName,
  roleLabel,
  inviteUrl,
  inviteMessage,
}) {
  const safeCollaboratorName = String(collaboratorName || inviteEmail || 'there').trim() || 'there';
  const safeInviterName = String(inviterName || 'A VicPods creator').trim() || 'A VicPods creator';
  const safeShowName = String(showName || 'this show').trim() || 'this show';
  const safeRoleLabel = String(roleLabel || 'collaborator').trim() || 'collaborator';
  const safeInviteUrl = String(inviteUrl || '').trim();
  const safeInviteMessage = String(inviteMessage || '').trim();
  const subject = `${safeInviterName} invited you to join ${safeShowName} on VicPods`;

  const text = [
    `Hi ${safeCollaboratorName},`,
    '',
    `${safeInviterName} invited you to join "${safeShowName}" on VicPods as ${safeRoleLabel}.`,
    '',
    'Use this link to accept the invite and join the show workspace:',
    safeInviteUrl,
    '',
    safeInviteMessage ? `Message from ${safeInviterName}: ${safeInviteMessage}` : '',
    '',
    'Sign in or create your account with this email address to activate access.',
    '',
    'VicPods',
    'Your voice deserves structure.',
  ].filter(Boolean).join('\n');

  const html = [
    "<div style=\"font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif; max-width:640px; margin:0 auto; padding:28px; color:#0f172a;\">",
    '<p style="margin:0 0 10px; color:#64748b; font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:.08em;">VicPods collaboration</p>',
    `<h1 style="margin:0 0 16px; font-size:30px; line-height:1.15;">You were invited to join ${escapeHtml(safeShowName)}</h1>`,
    `<p style="margin:0 0 16px; color:#334155; line-height:1.7;">Hi ${escapeHtml(safeCollaboratorName)}, ${escapeHtml(safeInviterName)} invited you to join <strong>${escapeHtml(safeShowName)}</strong> on VicPods as <strong>${escapeHtml(safeRoleLabel)}</strong>.</p>`,
    safeInviteMessage
      ? `<div style="margin:0 0 20px; padding:16px; border:1px solid #dbe3f4; border-radius:16px; background:#f8fbff; color:#334155; line-height:1.6;"><strong style="display:block; margin-bottom:6px;">Message from ${escapeHtml(safeInviterName)}</strong>${escapeHtml(safeInviteMessage)}</div>`
      : '',
    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px;">',
    '<tr><td align="center" bgcolor="#5b5ff8" style="border-radius:14px;">',
    `<a href="${escapeHtml(safeInviteUrl)}" style="display:inline-block; padding:15px 24px; font-size:15px; line-height:1; font-weight:700; color:#ffffff; text-decoration:none; border-radius:14px;">Accept invite</a>`,
    '</td></tr></table>',
    '<p style="margin:0 0 12px; color:#475569; line-height:1.7;">Sign in or create your account with this email address to activate access safely.</p>',
    `<p style="margin:0; color:#64748b; line-height:1.7; word-break:break-all;">${escapeHtml(safeInviteUrl)}</p>`,
    '</div>',
  ].join('');

  return { subject, text, html };
}

async function sendShowCollaboratorInviteEmail({
  to,
  collaboratorName,
  inviterName,
  showName,
  roleLabel,
  inviteUrl,
  inviteMessage,
}) {
  const email = buildShowCollaboratorInviteEmail({
    collaboratorName,
    inviteEmail: to,
    inviterName,
    showName,
    roleLabel,
    inviteUrl,
    inviteMessage,
  });

  return sendEmail({
    to,
    ...email,
  });
}

module.exports = {
  buildShowCollaboratorInviteEmail,
  sendShowCollaboratorInviteEmail,
};
