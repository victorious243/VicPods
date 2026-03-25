function cleanLine(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function buildIntro(episode) {
  const firstPoint = (episode.talkingPoints || []).find((item) => cleanLine(item));
  if (firstPoint) {
    return `Welcome back. Today we focus on ${cleanLine(firstPoint).toLowerCase()}.`;
  }

  return 'Welcome back. Today we move this series forward with a focused conversation.';
}

function buildDefaultOutro(episode) {
  if (episode.isSingle) {
    return 'Takeaway: apply one practical step from this episode and close the loop.';
  }

  return 'Takeaway: keep your process simple. Teaser: next episode deepens this arc with a stronger challenge.';
}

function buildSections({ series, theme, episode }) {
  const outline = (episode.outline || []).map(cleanLine).filter(Boolean);
  const talkingPoints = (episode.talkingPoints || []).map(cleanLine).filter(Boolean);
  const hostQuestions = (episode.hostQuestions || []).map(cleanLine).filter(Boolean);

  const segmentCount = Math.max(outline.length, Math.min(talkingPoints.length, 6), 1);

  const segments = Array.from({ length: segmentCount }).map((_, index) => {
    const outlinePoint = outline[index] || `Segment ${index + 1}`;
    const talkingPoint = talkingPoints[index] || talkingPoints[0] || 'Expand the key insight with one practical example.';

    return {
      heading: `Segment ${index + 1}: ${outlinePoint}`,
      body: talkingPoint,
    };
  });

  return {
    title: cleanLine(episode.title || `Episode ${episode.episodeNumberWithinTheme}`),
    meta: {
      seriesName: cleanLine(series.name),
      themeName: cleanLine(theme.name),
      episodeNumberWithinTheme: episode.episodeNumberWithinTheme,
      globalEpisodeNumber: episode.globalEpisodeNumber,
      status: cleanLine(episode.status || 'Draft'),
    },
    showNotes: {
      summary: cleanLine(episode.showNotesPack?.summary || ''),
      description: cleanLine(episode.showNotesPack?.description || ''),
      keyTakeaways: (episode.showNotesPack?.keyTakeaways || []).map(cleanLine).filter(Boolean),
      listenerCTA: cleanLine(episode.showNotesPack?.listenerCTA || ''),
    },
    hook: cleanLine(episode.hook || 'Hook unavailable.'),
    intro: buildIntro(episode),
    segments,
    hostQuestions,
    funSegment: episode.includeFunSegment === false
      ? ''
      : cleanLine(episode.funSegment || 'Quick game: pick one bold move and defend it in 30 seconds.'),
    outro: cleanLine(episode.ending || buildDefaultOutro(episode)),
  };
}

function buildTranscript({ series, theme, episode }) {
  const sections = buildSections({ series, theme, episode });

  const lines = [
    'VICPODS EPISODE BRIEF',
    `${sections.meta.seriesName} - ${sections.meta.themeName}`,
    `Theme Episode ${sections.meta.episodeNumberWithinTheme}${sections.meta.globalEpisodeNumber ? ` (Global ${sections.meta.globalEpisodeNumber})` : ''} - ${sections.meta.status}`,
    '',
    `TITLE: ${sections.title}`,
    '',
  ];

  if (sections.showNotes.summary) {
    lines.push('SUMMARY');
    lines.push(sections.showNotes.summary);
    lines.push('');
  }

  if (sections.showNotes.description) {
    lines.push('DESCRIPTION');
    lines.push(sections.showNotes.description);
    lines.push('');
  }

  if (sections.showNotes.keyTakeaways.length) {
    lines.push('KEY TAKEAWAYS');
    sections.showNotes.keyTakeaways.forEach((takeaway, index) => {
      lines.push(`${index + 1}. ${takeaway}`);
    });
    lines.push('');
  }

  if (sections.showNotes.listenerCTA) {
    lines.push('LISTENER CTA');
    lines.push(sections.showNotes.listenerCTA);
    lines.push('');
  }

  lines.push(
    'HOOK',
    sections.hook,
    '',
    'INTRO',
    sections.intro,
    '',
    'MAIN SEGMENTS',
  );

  sections.segments.forEach((segment) => {
    lines.push(segment.heading);
    lines.push(segment.body);
    lines.push('');
  });

  lines.push('HOST QUESTIONS');
  if (sections.hostQuestions.length) {
    sections.hostQuestions.forEach((question, index) => {
      lines.push(`${index + 1}. ${question}`);
    });
  } else {
    lines.push('1. What is one practical move listeners can try immediately?');
  }

  lines.push('');
  if (sections.funSegment) {
    lines.push('FUN SEGMENT');
    lines.push(sections.funSegment);
    lines.push('');
  }
  lines.push('OUTRO');
  lines.push(sections.outro);

  return lines.join('\n');
}

module.exports = {
  buildTranscript,
  buildSections,
};
