const AudioAsset = require('../../models/AudioAsset');
const Episode = require('../../models/Episode');
const PodcastShow = require('../../models/PodcastShow');
const { getOrCreateSingleCollection } = require('../systemSeries/getOrCreateSingleCollection');
const { getNextGlobalEpisodeNumber, getNextThemeEpisodeNumber } = require('../themeService');
const {
  generateUniqueEpisodeSlug,
  generateUniqueShowSlug,
  normalizeDomainHostname,
  normalizeText,
  slugifySegment,
  syncPodcastShowStats,
} = require('./publishService');
const { AppError } = require('../../utils/errors');

const ALLOWED_FEED_UPLOAD_TYPES = new Set([
  'application/rss+xml',
  'application/xml',
  'text/xml',
  'text/plain',
]);

function stripCdata(value) {
  return String(value || '')
    .replace(/^<!\[CDATA\[/, '')
    .replace(/\]\]>$/, '')
    .trim();
}

function decodeXmlEntities(value) {
  return String(value || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, '\'')
    .replace(/&amp;/g, '&');
}

function cleanImportedText(value, maxLength = 8000) {
  return decodeXmlEntities(stripCdata(value))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanImportedRichText(value, maxLength = 30000) {
  return decodeXmlEntities(stripCdata(value))
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
    .slice(0, maxLength);
}

function firstTagValue(xml, tagNames, maxLength = 8000) {
  const names = Array.isArray(tagNames) ? tagNames : [tagNames];
  for (const tagName of names) {
    const match = String(xml || '').match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i'));
    if (match) {
      return cleanImportedRichText(match[1], maxLength);
    }
  }
  return '';
}

function firstAttributeValue(xml, tagName, attributeName) {
  const match = String(xml || '').match(new RegExp(`<${tagName}[^>]*\\s${attributeName}="([^"]+)"[^>]*\\/?>`, 'i'));
  return match ? cleanImportedText(match[1], 500) : '';
}

function collectTagValues(xml, tagName, maxItems = 10, maxLength = 500) {
  return Array.from(String(xml || '').matchAll(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'ig')))
    .map((match) => cleanImportedText(match[1], maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function parseEnclosure(itemXml) {
  const match = String(itemXml || '').match(/<enclosure\b([^>]+?)\/?>/i);
  if (!match) {
    return null;
  }

  const attributeBlock = match[1];
  const readAttribute = (name) => {
    const attributeMatch = attributeBlock.match(new RegExp(`${name}="([^"]+)"`, 'i'));
    return attributeMatch ? cleanImportedText(attributeMatch[1], 500) : '';
  };

  const url = readAttribute('url');
  if (!/^https?:\/\//i.test(url)) {
    return null;
  }

  const lengthValue = Number.parseInt(readAttribute('length'), 10);
  return {
    url,
    mimeType: readAttribute('type') || 'audio/mpeg',
    byteSize: Number.isInteger(lengthValue) && lengthValue > 0 ? lengthValue : 0,
  };
}

function parseDurationSeconds(value) {
  const normalized = cleanImportedText(value, 40);
  if (!normalized) {
    return null;
  }

  if (/^\d+$/.test(normalized)) {
    const directSeconds = Number.parseInt(normalized, 10);
    return directSeconds > 0 ? directSeconds : null;
  }

  const parts = normalized.split(':').map((part) => part.trim());
  if (parts.length < 2 || parts.length > 3) {
    return null;
  }

  const padded = parts.length === 2 ? ['0', ...parts] : parts;
  const [hoursPart, minutesPart, secondsPart] = padded;
  const hours = Number.parseInt(hoursPart, 10);
  const minutes = Number.parseInt(minutesPart, 10);
  const seconds = Number.parseInt(secondsPart, 10);

  if (![hours, minutes, seconds].every(Number.isInteger)) {
    return null;
  }

  return (hours * 3600) + (minutes * 60) + seconds;
}

function parseImportedDate(value) {
  const normalized = cleanImportedText(value, 120);
  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveFeedUploadPayload({ rssXml = '', rssDataUrl = '' } = {}) {
  if (cleanImportedText(rssXml, 400000)) {
    return cleanImportedRichText(rssXml, 400000);
  }

  const match = String(rssDataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new AppError('Paste RSS XML or upload a feed file.', 400);
  }

  const mimeType = String(match[1] || '').toLowerCase();
  if (!ALLOWED_FEED_UPLOAD_TYPES.has(mimeType)) {
    throw new AppError('Invalid feed file. Use XML or RSS export text.', 400);
  }

  return Buffer.from(match[2], 'base64').toString('utf8');
}

function parsePodcastFeedXml(xml) {
  const rssXml = cleanImportedRichText(xml, 400000);
  if (!/<rss\b|<channel\b/i.test(rssXml)) {
    throw new AppError('RSS XML is invalid or incomplete.', 400);
  }

  const channelMatch = rssXml.match(/<channel[^>]*>([\s\S]*?)<\/channel>/i);
  if (!channelMatch) {
    throw new AppError('RSS channel data is missing.', 400);
  }

  const channelXml = channelMatch[1];
  const itemBlocks = Array.from(channelXml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/ig)).map((match) => match[1]);

  return {
    channel: {
      title: firstTagValue(channelXml, 'title', 120),
      description: firstTagValue(channelXml, ['description', 'itunes:summary'], 4000),
      authorName: firstTagValue(channelXml, ['itunes:author', 'managingEditor'], 120),
      ownerEmail: firstTagValue(channelXml, ['itunes:email', 'webMaster'], 200).toLowerCase(),
      language: firstTagValue(channelXml, 'language', 20).toLowerCase(),
      categoryPrimary: firstAttributeValue(channelXml, 'itunes:category', 'text'),
      coverImageUrl: firstAttributeValue(channelXml, 'itunes:image', 'href') || firstTagValue(channelXml, 'url', 500),
      websiteUrl: firstTagValue(channelXml, 'link', 500),
      copyright: firstTagValue(channelXml, 'copyright', 240),
      explicit: /^yes$/i.test(firstTagValue(channelXml, 'itunes:explicit', 20)),
      categories: collectTagValues(channelXml, 'category', 6, 120),
    },
    items: itemBlocks.map((itemXml) => ({
      title: firstTagValue(itemXml, 'title', 160),
      summary: firstTagValue(itemXml, ['description', 'itunes:summary'], 3000),
      guid: firstTagValue(itemXml, 'guid', 200),
      link: firstTagValue(itemXml, 'link', 500),
      publicDate: parseImportedDate(firstTagValue(itemXml, 'pubDate', 120)),
      durationSeconds: parseDurationSeconds(firstTagValue(itemXml, 'itunes:duration', 20)),
      explicit: /^yes$/i.test(firstTagValue(itemXml, 'itunes:explicit', 20)),
      enclosure: parseEnclosure(itemXml),
    })),
  };
}

function normalizeImportedLanguage(value) {
  const normalized = cleanImportedText(value, 20).toLowerCase();
  return normalized || 'en-us';
}

function normalizeImportSourceUrl(value) {
  const normalized = cleanImportedText(value, 500);
  return /^https?:\/\//i.test(normalized) ? normalized : '';
}

async function fetchRemoteFeedXml(sourceUrl, { fetchImpl = globalThis.fetch } = {}) {
  const normalizedSourceUrl = normalizeImportSourceUrl(sourceUrl);
  if (!normalizedSourceUrl) {
    throw new AppError('Enter a valid source feed URL.', 400);
  }

  if (typeof fetchImpl !== 'function') {
    throw new AppError('Remote feed import is unavailable right now.', 503);
  }

  let response;
  try {
    response = await fetchImpl(normalizedSourceUrl, {
      headers: {
        accept: 'application/rss+xml, application/xml, text/xml, text/plain;q=0.9, */*;q=0.1',
      },
      redirect: 'follow',
    });
  } catch (error) {
    throw new AppError('Could not fetch the source feed right now.', 502);
  }

  if (!response || !response.ok) {
    throw new AppError(`Could not fetch the source feed${response ? ` (${response.status})` : ''}.`, 502);
  }

  const rssXml = cleanImportedRichText(await response.text(), 400000);
  if (!rssXml) {
    throw new AppError('The fetched feed was empty.', 400);
  }

  return {
    rssXml,
    sourceUrl: normalizeImportSourceUrl(response.url || normalizedSourceUrl) || normalizedSourceUrl,
    contentType: String(response.headers?.get?.('content-type') || '').toLowerCase(),
  };
}

async function resolveFeedImportPayload({ rssXml = '', rssDataUrl = '', sourceUrl = '', fetchImpl } = {}) {
  if (cleanImportedText(rssXml, 400000)) {
    return {
      rssXml: cleanImportedRichText(rssXml, 400000),
      sourceUrl: normalizeImportSourceUrl(sourceUrl),
      sourceType: 'pasted_xml',
    };
  }

  if (String(rssDataUrl || '').trim()) {
    return {
      rssXml: resolveFeedUploadPayload({ rssDataUrl }),
      sourceUrl: normalizeImportSourceUrl(sourceUrl),
      sourceType: 'uploaded_file',
    };
  }

  if (normalizeImportSourceUrl(sourceUrl)) {
    const fetched = await fetchRemoteFeedXml(sourceUrl, { fetchImpl });
    return {
      rssXml: fetched.rssXml,
      sourceUrl: fetched.sourceUrl,
      sourceType: 'remote_fetch',
    };
  }

  throw new AppError('Paste RSS XML, upload a feed file, or enter a source feed URL.', 400);
}

function buildImportedItemGuid(item, fallbackValue = '') {
  const baseValue = cleanImportedText(
    item?.guid
      || item?.link
      || item?.enclosure?.url
      || fallbackValue,
    200
  );

  return baseValue || `import:${slugifySegment(item?.title || 'episode', 'episode')}:${cleanImportedText(fallbackValue, 40) || 'item'}`;
}

async function createImportedAudioAsset({ userId, episodeId, enclosure, durationSeconds }) {
  if (!enclosure?.url) {
    return null;
  }

  return AudioAsset.create({
    userId,
    episodeId,
    storageProvider: 'remote_url',
    storageKey: enclosure.url,
    originalFilename: slugifySegment(enclosure.url.split('/').pop() || 'remote-audio', 'remote-audio') + '.mp3',
    mimeType: enclosure.mimeType || 'audio/mpeg',
    byteSize: enclosure.byteSize || 0,
    metadataStatus: 'ready',
    durationSeconds: durationSeconds || null,
    bitrateKbps: null,
    status: 'ready',
    processedAt: new Date(),
  });
}

async function findExistingImportedShow({ userId, normalizedSourceUrl = '' }) {
  if (!normalizedSourceUrl) {
    return null;
  }

  return PodcastShow.findOne({
    userId,
    'importSource.origin': 'rss_import',
    'importSource.sourceUrl': normalizedSourceUrl,
  });
}

async function findImportedEpisode({ userId, showId, rssGuid }) {
  if (!rssGuid) {
    return null;
  }

  return Episode.findOne({
    userId,
    showId,
    rssGuid,
  }).populate('audioAssetId');
}

async function syncImportedAudioAsset({ userId, episode, enclosure, durationSeconds }) {
  if (!enclosure?.url) {
    return null;
  }

  const existingAsset = episode.audioAssetId
    ? await AudioAsset.findOne({
        _id: episode.audioAssetId._id || episode.audioAssetId,
        userId,
        episodeId: episode._id,
      })
    : null;

  if (existingAsset && existingAsset.storageProvider !== 'remote_url') {
    return existingAsset;
  }

  if (existingAsset) {
    existingAsset.storageKey = enclosure.url;
    existingAsset.originalFilename = slugifySegment(enclosure.url.split('/').pop() || 'remote-audio', 'remote-audio') + '.mp3';
    existingAsset.mimeType = enclosure.mimeType || 'audio/mpeg';
    existingAsset.byteSize = enclosure.byteSize || 0;
    existingAsset.metadataStatus = 'ready';
    existingAsset.durationSeconds = durationSeconds || existingAsset.durationSeconds;
    existingAsset.processedAt = new Date();
    await existingAsset.save();
    return existingAsset;
  }

  return createImportedAudioAsset({
    userId,
    episodeId: episode._id,
    enclosure,
    durationSeconds,
  });
}

async function importPodcastFeed({ userId, rssXml = '', rssDataUrl = '', sourceUrl = '', fetchImpl } = {}) {
  const resolvedPayload = await resolveFeedImportPayload({
    rssXml,
    rssDataUrl,
    sourceUrl,
    fetchImpl,
  });
  const parsed = parsePodcastFeedXml(resolvedPayload.rssXml);

  if (!parsed.channel.title) {
    throw new AppError('The RSS feed needs a channel title before it can be imported.', 400);
  }

  const { series, theme } = await getOrCreateSingleCollection(userId);
  const normalizedSourceUrl = normalizeImportSourceUrl(resolvedPayload.sourceUrl || parsed.channel.websiteUrl);
  let show = await findExistingImportedShow({ userId, normalizedSourceUrl });
  let createdShow = false;

  if (show) {
    show.name = parsed.channel.title || show.name;
    show.description = parsed.channel.description || show.description;
    show.authorName = parsed.channel.authorName || show.authorName;
    show.ownerEmail = parsed.channel.ownerEmail || show.ownerEmail;
    show.language = normalizeImportedLanguage(parsed.channel.language || show.language);
    show.categoryPrimary = parsed.channel.categoryPrimary || parsed.channel.categories[0] || show.categoryPrimary;
    show.categorySecondary = parsed.channel.categories[1] || show.categorySecondary;
    show.coverImageUrl = parsed.channel.coverImageUrl || show.coverImageUrl;
    show.websiteUrl = parsed.channel.websiteUrl || show.websiteUrl;
    show.copyright = parsed.channel.copyright || show.copyright;
    show.explicit = parsed.channel.explicit;
    show.importSource = {
      ...(show.importSource?.toObject ? show.importSource.toObject() : show.importSource || {}),
      origin: 'rss_import',
      sourceUrl: normalizedSourceUrl,
      importedAt: new Date(),
      itemCount: parsed.items.length,
    };
    await show.save();
  } else {
    const showSlug = await generateUniqueShowSlug(parsed.channel.title);
    show = await PodcastShow.create({
      userId,
      name: parsed.channel.title,
      slug: showSlug,
      description: parsed.channel.description,
      authorName: parsed.channel.authorName,
      ownerEmail: parsed.channel.ownerEmail,
      language: normalizeImportedLanguage(parsed.channel.language),
      categoryPrimary: parsed.channel.categoryPrimary || parsed.channel.categories[0] || '',
      categorySecondary: parsed.channel.categories[1] || '',
      coverImageUrl: parsed.channel.coverImageUrl,
      websiteUrl: parsed.channel.websiteUrl,
      copyright: parsed.channel.copyright,
      explicit: parsed.channel.explicit,
      siteSettings: {
        heroLabel: 'Imported podcast',
        heroTagline: '',
        featuredLabel: '',
        featuredText: '',
        primaryCtaLabel: '',
        primaryCtaUrl: '',
        hostIntro: '',
        footerNote: '',
        themeVariant: 'studio',
      },
      importSource: {
        origin: 'rss_import',
        sourceUrl: normalizedSourceUrl,
        importedAt: new Date(),
        itemCount: parsed.items.length,
      },
    });
    createdShow = true;
  }

  let nextThemeEpisodeNumber = await getNextThemeEpisodeNumber({
    userId,
    seriesId: series._id,
    themeId: theme._id,
  });
  let nextGlobalEpisodeNumber = await getNextGlobalEpisodeNumber({
    userId,
    seriesId: series._id,
  });

  const importedEpisodes = [];
  let createdEpisodes = 0;
  let updatedEpisodes = 0;
  for (const item of parsed.items.slice(0, 100)) {
    const publishStatus = item.enclosure?.url ? 'published' : 'draft';
    const stableGuid = buildImportedItemGuid(item, `${show._id}:${nextThemeEpisodeNumber}`);
    let episode = await findImportedEpisode({
      userId,
      showId: show._id,
      rssGuid: stableGuid,
    });

    if (episode) {
      episode.title = item.title || episode.title;
      episode.summary = item.summary || episode.summary;
      episode.status = publishStatus === 'published' ? 'Served' : episode.status;
      episode.publishStatus = publishStatus;
      episode.publishedAt = publishStatus === 'published'
        ? (item.publicDate || episode.publishedAt || new Date())
        : episode.publishedAt;
      episode.publicPageEnabled = publishStatus === 'published';
      episode.durationSeconds = item.durationSeconds || episode.durationSeconds;
      episode.explicit = item.explicit;
      episode.launchPack = {
        ...(episode.launchPack?.toObject ? episode.launchPack.toObject() : episode.launchPack || {}),
        description: item.summary || episode.launchPack?.description || '',
        showNotes: item.summary || episode.launchPack?.showNotes || '',
      };
      if (!episode.publicSlug) {
        episode.publicSlug = await generateUniqueEpisodeSlug({
          showId: show._id,
          episodeId: episode._id,
          title: item.title || item.guid || `imported-episode-${episode.globalEpisodeNumber || nextGlobalEpisodeNumber}`,
          fallbackNumber: episode.globalEpisodeNumber || nextGlobalEpisodeNumber,
        });
      }
      await episode.save();
      updatedEpisodes += 1;
    } else {
      episode = await Episode.create({
        userId,
        seriesId: series._id,
        themeId: theme._id,
        episodeNumberWithinTheme: nextThemeEpisodeNumber,
        episodeNumber: nextGlobalEpisodeNumber,
        globalEpisodeNumber: nextGlobalEpisodeNumber,
        title: item.title || `Imported episode ${nextGlobalEpisodeNumber}`,
        summary: item.summary,
        status: publishStatus === 'published' ? 'Served' : 'Draft',
        showId: show._id,
        publicSlug: await generateUniqueEpisodeSlug({
          showId: show._id,
          title: item.title || item.guid || `imported-episode-${nextGlobalEpisodeNumber}`,
          fallbackNumber: nextGlobalEpisodeNumber,
        }),
        publishStatus,
        publishedAt: publishStatus === 'published' ? (item.publicDate || new Date()) : null,
        publicPageEnabled: publishStatus === 'published',
        durationSeconds: item.durationSeconds,
        explicit: item.explicit,
        rssGuid: stableGuid,
        launchPack: {
          description: item.summary,
          showNotes: item.summary,
        },
      });

      nextThemeEpisodeNumber += 1;
      nextGlobalEpisodeNumber += 1;
      createdEpisodes += 1;
    }

    const importedAsset = await syncImportedAudioAsset({
      userId,
      episode,
      enclosure: item.enclosure,
      durationSeconds: item.durationSeconds,
    });

    if (importedAsset) {
      episode.audioAssetId = importedAsset._id;
      await episode.save();
    }

    importedEpisodes.push(episode);
  }

  await syncPodcastShowStats(show._id);

  return {
    show,
    createdShow,
    importedCount: importedEpisodes.length,
    createdEpisodes,
    updatedEpisodes,
    importedPublishedCount: importedEpisodes.filter((episode) => episode.publishStatus === 'published').length,
  };
}

module.exports = {
  ALLOWED_FEED_UPLOAD_TYPES,
  buildImportedItemGuid,
  fetchRemoteFeedXml,
  importPodcastFeed,
  parseDurationSeconds,
  parsePodcastFeedXml,
  resolveFeedImportPayload,
  resolveFeedUploadPayload,
};
