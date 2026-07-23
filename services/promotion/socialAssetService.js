function compactText(value, maxLength = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function splitSentences(value) {
  return compactText(value, 12000)
    .split(/(?<=[.!?])\s+/)
    .map((part) => compactText(part, 220))
    .filter((part) => part.length >= 36);
}

function pickQuoteCandidates(episode) {
  const transcriptSentences = splitSentences(episode.transcript || '');
  const candidates = [
    compactText(episode.hook, 220),
    compactText(episode.summary, 220),
    ...transcriptSentences,
    ...(episode.advancedMedia?.clipSuggestions || []).map((clip) => compactText(clip.hook || clip.title, 220)),
  ]
    .filter((value) => value.length >= 24)
    .filter((value, index, items) => items.indexOf(value) === index);

  if (candidates.length) {
    return candidates.slice(0, 6);
  }

  return [compactText(episode.title || 'A podcast moment worth sharing.', 220)];
}

function buildPlatformFrame(platform) {
  if (platform === 'linkedin') {
    return { width: 1200, height: 1200, label: 'LinkedIn card' };
  }

  if (platform === 'x') {
    return { width: 1600, height: 900, label: 'X card' };
  }

  return { width: 1080, height: 1350, label: 'Instagram card' };
}

function buildAccent(accentKey) {
  if (accentKey === 'lagoon') {
    return {
      gradientA: '#38bdf8',
      gradientB: '#34d399',
      highlight: '#b8fff1',
    };
  }

  if (accentKey === 'midnight') {
    return {
      gradientA: '#818cf8',
      gradientB: '#0f172a',
      highlight: '#c7d2fe',
    };
  }

  return {
    gradientA: '#f59e0b',
    gradientB: '#ec4899',
    highlight: '#fde68a',
  };
}

function buildWaveformBars(width, height) {
  const barCount = 18;
  const startX = width * 0.08;
  const gap = width * 0.032;
  const baseline = height * 0.84;

  return Array.from({ length: barCount }).map((_, index) => {
    const barHeight = [24, 40, 62, 30, 76, 46, 28, 64, 90, 52, 38, 84, 44, 26, 68, 48, 34, 58][index];
    const x = startX + index * gap;
    const y = baseline - barHeight;
    return `<rect x="${x}" y="${y}" width="${gap * 0.48}" height="${barHeight}" rx="${gap * 0.24}" fill="rgba(255,255,255,0.18)" />`;
  }).join('');
}

function buildQuoteCardSvg({ quoteText, title, showName, platform, accentKey, index }) {
  const frame = buildPlatformFrame(platform);
  const accent = buildAccent(accentKey);
  const quoteY = platform === 'x' ? frame.height * 0.34 : frame.height * 0.32;
  const footerY = platform === 'x' ? frame.height * 0.77 : frame.height * 0.81;
  const quoteFontSize = platform === 'x' ? 56 : 64;
  const safeQuote = escapeXml(quoteText);
  const safeTitle = escapeXml(title);
  const safeShowName = escapeXml(showName);
  const quoteLines = wrapSvgText(safeQuote, platform === 'x' ? 34 : 24).map((line, lineIndex) => (
    `<tspan x="${frame.width * 0.09}" dy="${lineIndex === 0 ? 0 : quoteFontSize * 1.1}">${line}</tspan>`
  )).join('');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}" viewBox="0 0 ${frame.width} ${frame.height}" fill="none">`,
    '<defs>',
    `<linearGradient id="cardGradient-${index}" x1="0" y1="0" x2="1" y2="1">`,
    `<stop offset="0%" stop-color="${accent.gradientA}" />`,
    `<stop offset="100%" stop-color="${accent.gradientB}" />`,
    '</linearGradient>',
    `<radialGradient id="glow-${index}" cx="0.82" cy="0.15" r="0.65">`,
    `<stop offset="0%" stop-color="${accent.highlight}" stop-opacity="0.42" />`,
    '<stop offset="100%" stop-color="#0b1020" stop-opacity="0" />',
    '</radialGradient>',
    '</defs>',
    `<rect width="${frame.width}" height="${frame.height}" rx="44" fill="#0f172a" />`,
    `<rect x="20" y="20" width="${frame.width - 40}" height="${frame.height - 40}" rx="34" fill="url(#cardGradient-${index})" opacity="0.9" />`,
    `<rect x="20" y="20" width="${frame.width - 40}" height="${frame.height - 40}" rx="34" fill="url(#glow-${index})" />`,
    `<rect x="48" y="48" width="${frame.width - 96}" height="${frame.height - 96}" rx="28" fill="rgba(7, 12, 24, 0.82)" stroke="rgba(255,255,255,0.08)" />`,
    `<text x="${frame.width * 0.09}" y="${frame.height * 0.12}" fill="white" font-family="Inter, Arial, sans-serif" font-size="${platform === 'x' ? 30 : 28}" font-weight="700" letter-spacing="1.6">${escapeXml(platform.toUpperCase())}</text>`,
    `<text x="${frame.width * 0.09}" y="${frame.height * 0.2}" fill="rgba(255,255,255,0.72)" font-family="Inter, Arial, sans-serif" font-size="${platform === 'x' ? 26 : 24}" font-weight="500">${safeShowName}</text>`,
    `<text x="${frame.width * 0.09}" y="${quoteY}" fill="white" font-family="Inter, Arial, sans-serif" font-size="${quoteFontSize}" font-weight="700">${quoteLines}</text>`,
    `<text x="${frame.width * 0.09}" y="${footerY}" fill="rgba(255,255,255,0.84)" font-family="Inter, Arial, sans-serif" font-size="${platform === 'x' ? 26 : 24}" font-weight="600">${safeTitle}</text>`,
    `<text x="${frame.width * 0.09}" y="${footerY + 42}" fill="rgba(255,255,255,0.48)" font-family="Inter, Arial, sans-serif" font-size="${platform === 'x' ? 20 : 18}" font-weight="500">${escapeXml(frame.label)}</text>`,
    buildWaveformBars(frame.width, frame.height),
    '</svg>',
  ].join('');
}

function wrapSvgText(text, wordsPerLine) {
  const words = compactText(text, 600).split(' ').filter(Boolean);
  const lines = [];

  for (let index = 0; index < words.length; index += wordsPerLine) {
    lines.push(words.slice(index, index + wordsPerLine).join(' '));
  }

  return lines.slice(0, 4);
}

function buildQuoteCardAssets(episode, { show = null } = {}) {
  const quoteCandidates = pickQuoteCandidates(episode);
  const title = compactText(episode.title, 160) || 'Podcast highlight';
  const showName = compactText(show?.name || 'VicPods', 120);
  const variants = [
    { platform: 'instagram', accentKey: 'sunrise' },
    { platform: 'linkedin', accentKey: 'lagoon' },
    { platform: 'x', accentKey: 'midnight' },
  ];

  return variants.map((variant, index) => {
    const quoteText = compactText(quoteCandidates[index] || quoteCandidates[0], 320);
    const svgMarkup = buildQuoteCardSvg({
      quoteText,
      title,
      showName,
      platform: variant.platform,
      accentKey: variant.accentKey,
      index: index + 1,
    });

    return {
      title,
      quoteText,
      platform: variant.platform,
      accentKey: variant.accentKey,
      svgMarkup,
      downloadUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`,
      updatedAt: new Date(),
    };
  });
}

module.exports = {
  buildQuoteCardAssets,
};
