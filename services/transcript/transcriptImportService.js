const { AppError } = require('../../utils/errors');

const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/srt',
  'application/x-subrip',
  'text/vtt',
]);

function cleanText(value, maxLength = 120000) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
    .slice(0, maxLength);
}

function clampTitle(value, maxLength = 180) {
  return cleanText(value, maxLength).replace(/\s+/g, ' ');
}

function parseTimeToSeconds(value) {
  const normalized = String(value || '').trim().replace(',', '.');
  const parts = normalized.split(':').map((part) => part.trim());

  if (parts.length < 2 || parts.length > 3) {
    return null;
  }

  const padded = parts.length === 2 ? ['0', ...parts] : parts;
  const [hoursPart, minutesPart, secondsPart] = padded;
  const hours = Number.parseInt(hoursPart, 10);
  const minutes = Number.parseInt(minutesPart, 10);
  const seconds = Number.parseFloat(secondsPart);

  if (![hours, minutes, seconds].every(Number.isFinite)) {
    return null;
  }

  return Math.max(0, Math.round((hours * 3600) + (minutes * 60) + seconds));
}

function buildChapterTitle(text) {
  const compact = cleanText(text, 220).replace(/\s+/g, ' ');
  if (!compact) {
    return '';
  }

  return compact
    .replace(/^[-\d.\s]+/, '')
    .split(/(?<=[.!?])\s+/)[0]
    .split(/\s+/)
    .slice(0, 10)
    .join(' ')
    .slice(0, 180);
}

function parseTimestampedTranscript(rawTranscript) {
  const transcript = cleanText(rawTranscript, 180000);

  if (!transcript) {
    return {
      sourceFormat: 'plain',
      plainText: '',
      cues: [],
    };
  }

  const lines = transcript.split('\n');
  const cues = [];
  let currentCue = null;

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      if (currentCue && currentCue.textLines.length) {
        cues.push(currentCue);
      }
      currentCue = null;
      return;
    }

    if (/^WEBVTT/i.test(trimmed)) {
      return;
    }

    if (/^\d+$/.test(trimmed) && !currentCue) {
      return;
    }

    const timeMatch = trimmed.match(/^(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}|\d{1,2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}|\d{1,2}:\d{2}[,.]\d{1,3})/);
    if (timeMatch) {
      if (currentCue && currentCue.textLines.length) {
        cues.push(currentCue);
      }

      currentCue = {
        startSeconds: parseTimeToSeconds(timeMatch[1]),
        endSeconds: parseTimeToSeconds(timeMatch[2]),
        textLines: [],
      };
      return;
    }

    if (!currentCue) {
      currentCue = {
        startSeconds: null,
        endSeconds: null,
        textLines: [],
      };
    }

    currentCue.textLines.push(trimmed);
  });

  if (currentCue && currentCue.textLines.length) {
    cues.push(currentCue);
  }

  const normalizedCues = cues
    .map((cue) => ({
      startSeconds: cue.startSeconds,
      endSeconds: cue.endSeconds,
      text: cleanText(cue.textLines.join(' '), 600),
    }))
    .filter((cue) => cue.text);

  if (!normalizedCues.some((cue) => Number.isFinite(cue.startSeconds))) {
    return {
      sourceFormat: 'plain',
      plainText: cleanText(transcript, 120000),
      cues: [],
    };
  }

  return {
    sourceFormat: transcript.includes('-->') && /^WEBVTT/i.test(transcript) ? 'vtt' : 'srt',
    plainText: cleanText(normalizedCues.map((cue) => cue.text).join('\n\n'), 120000),
    cues: normalizedCues,
  };
}

function buildOutlineChaptersFromDuration(outline, durationSeconds) {
  if (!Array.isArray(outline) || !outline.length || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return [];
  }

  const safeOutline = outline.map((item) => clampTitle(item, 180)).filter(Boolean).slice(0, 12);
  if (!safeOutline.length) {
    return [];
  }

  const segmentLength = Math.max(1, Math.floor(durationSeconds / safeOutline.length));
  return safeOutline.map((title, index) => {
    const startSeconds = index * segmentLength;
    const endSeconds = index === safeOutline.length - 1
      ? durationSeconds
      : Math.min(durationSeconds, (index + 1) * segmentLength);

    return {
      title,
      startSeconds,
      endSeconds,
      source: 'outline',
    };
  });
}

function buildOutlineChaptersFromCues(outline, cues) {
  if (!Array.isArray(outline) || !outline.length || !Array.isArray(cues) || !cues.length) {
    return [];
  }

  const safeOutline = outline.map((item) => clampTitle(item, 180)).filter(Boolean).slice(0, 12);
  if (!safeOutline.length) {
    return [];
  }

  return safeOutline.map((title, index) => {
    const cueIndex = Math.min(cues.length - 1, Math.floor((index * cues.length) / safeOutline.length));
    const currentCue = cues[cueIndex];
    const nextCue = cues[Math.min(cues.length - 1, cueIndex + 1)];

    return {
      title,
      startSeconds: Number.isFinite(currentCue?.startSeconds) ? currentCue.startSeconds : null,
      endSeconds: Number.isFinite(nextCue?.startSeconds) && nextCue.startSeconds > (currentCue?.startSeconds || 0)
        ? nextCue.startSeconds
        : currentCue?.endSeconds || null,
      source: 'outline',
    };
  });
}

function buildTranscriptChaptersFromCues(cues) {
  if (!Array.isArray(cues) || !cues.length) {
    return [];
  }

  const chapters = [];
  let lastStart = null;

  cues.forEach((cue) => {
    if (!Number.isFinite(cue.startSeconds)) {
      return;
    }

    if (lastStart !== null && cue.startSeconds - lastStart < 90) {
      return;
    }

    const title = buildChapterTitle(cue.text);
    if (!title) {
      return;
    }

    chapters.push({
      title,
      startSeconds: cue.startSeconds,
      endSeconds: cue.endSeconds || null,
      source: 'transcript',
    });
    lastStart = cue.startSeconds;
  });

  return chapters.slice(0, 10).map((chapter, index, list) => ({
    ...chapter,
    endSeconds: Number.isFinite(chapter.endSeconds)
      ? chapter.endSeconds
      : (Number.isFinite(list[index + 1]?.startSeconds) ? list[index + 1].startSeconds : null),
  }));
}

function deriveEpisodeChapters({ episode, cues = [] }) {
  const outline = Array.isArray(episode?.outline) ? episode.outline : [];
  const durationSeconds = Number(episode?.durationSeconds || episode?.audioAssetId?.durationSeconds || 0);

  if (outline.length && cues.length) {
    return buildOutlineChaptersFromCues(outline, cues);
  }

  if (outline.length && durationSeconds > 0) {
    return buildOutlineChaptersFromDuration(outline, durationSeconds);
  }

  return buildTranscriptChaptersFromCues(cues);
}

function parseTranscriptDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);

  if (!match) {
    throw new AppError('Invalid transcript upload payload.', 400);
  }

  const mimeType = String(match[1] || '').toLowerCase();
  if (!ALLOWED_UPLOAD_MIME_TYPES.has(mimeType)) {
    throw new AppError('Invalid transcript format. Use txt, srt, or vtt.', 400);
  }

  const decoded = Buffer.from(match[2], 'base64').toString('utf8');
  return {
    mimeType,
    text: decoded,
  };
}

function resolveTranscriptImportPayload({ transcriptText = '', transcriptDataUrl = '' } = {}) {
  if (cleanText(transcriptDataUrl, 500000)) {
    return parseTranscriptDataUrl(transcriptDataUrl);
  }

  const text = cleanText(transcriptText, 120000);
  if (!text) {
    throw new AppError('Transcript text is required.', 400);
  }

  return {
    mimeType: 'text/plain',
    text,
  };
}

function importTranscriptToEpisode(episode, payload = {}) {
  const sourcePayload = resolveTranscriptImportPayload(payload);
  const parsedTranscript = parseTimestampedTranscript(sourcePayload.text);
  const plainTranscript = cleanText(parsedTranscript.plainText, 120000);

  if (!plainTranscript) {
    throw new AppError('Transcript text is required.', 400);
  }

  const chapters = deriveEpisodeChapters({
    episode,
    cues: parsedTranscript.cues,
  });

  episode.transcript = plainTranscript;
  episode.transcriptUpdatedAt = new Date();
  episode.chapters = chapters;
  episode.recordingWorkflow = {
    ...(episode.recordingWorkflow?.toObject ? episode.recordingWorkflow.toObject() : episode.recordingWorkflow || {}),
    status: 'transcript_imported',
    postRecordStatus: 'transcript_imported',
    transcriptImportedAt: new Date(),
  };

  return {
    transcript: plainTranscript,
    sourceFormat: parsedTranscript.sourceFormat,
    chapters,
  };
}

module.exports = {
  ALLOWED_UPLOAD_MIME_TYPES,
  buildChapterTitle,
  deriveEpisodeChapters,
  importTranscriptToEpisode,
  parseTimeToSeconds,
  parseTimestampedTranscript,
  resolveTranscriptImportPayload,
};
