const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const AudioAsset = require('../models/AudioAsset');
const PodcastShow = require('../models/PodcastShow');
const { buildPublicAudioUrl } = require('../services/publish/audioStorageService');
const {
  buildPodcastFeedUrl,
  buildPodcastShowUrl,
  buildPublishedEpisodeUrl,
} = require('../services/publish/publishService');
const {
  buildImportedItemGuid,
  fetchRemoteFeedXml,
  parsePodcastFeedXml,
  parseDurationSeconds,
  resolveFeedImportPayload,
} = require('../services/publish/podcastImportService');

test('Phase 2A parses RSS feed data for migration', () => {
  const parsed = parsePodcastFeedXml([
    '<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">',
    '<channel>',
    '<title>Imported Growth Show</title>',
    '<description><![CDATA[A show about building a better podcast system.]]></description>',
    '<itunes:author>VicPods Host</itunes:author>',
    '<itunes:owner><itunes:name>VicPods Host</itunes:name><itunes:email>host@example.com</itunes:email></itunes:owner>',
    '<language>en-us</language>',
    '<itunes:image href="https://cdn.example.com/cover.png" />',
    '<link>https://imported.example.com</link>',
    '<itunes:category text="Business" />',
    '<item>',
    '<title>Episode One</title>',
    '<description><![CDATA[The first imported episode.]]></description>',
    '<guid>ep-1</guid>',
    '<pubDate>Wed, 15 Jul 2026 12:00:00 GMT</pubDate>',
    '<itunes:duration>12:34</itunes:duration>',
    '<enclosure url="https://cdn.example.com/audio/ep1.mp3" length="1234567" type="audio/mpeg" />',
    '</item>',
    '</channel>',
    '</rss>',
  ].join(''));

  assert.equal(parsed.channel.title, 'Imported Growth Show');
  assert.equal(parsed.channel.authorName, 'VicPods Host');
  assert.equal(parsed.channel.categoryPrimary, 'Business');
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].title, 'Episode One');
  assert.equal(parsed.items[0].durationSeconds, 754);
  assert.equal(parsed.items[0].enclosure.url, 'https://cdn.example.com/audio/ep1.mp3');
  assert.equal(parsed.items[0].enclosure.byteSize, 1234567);
});

test('Phase 2A custom domain URLs prefer the active host', () => {
  const show = {
    slug: 'imported-growth-show',
    customDomain: {
      hostname: 'podcast.example.com',
      status: 'active',
    },
  };
  const episode = { publicSlug: 'episode-one' };

  assert.equal(
    buildPodcastShowUrl(show, 'https://app.vicpods.com'),
    'https://podcast.example.com/podcasts/imported-growth-show'
  );
  assert.equal(
    buildPodcastFeedUrl(show, 'https://app.vicpods.com'),
    'https://podcast.example.com/podcasts/imported-growth-show/feed.xml'
  );
  assert.equal(
    buildPublishedEpisodeUrl(show, episode, 'https://app.vicpods.com'),
    'https://podcast.example.com/podcasts/imported-growth-show/episode-one'
  );
});

test('Phase 2A remote imported audio assets expose their original URL', () => {
  assert.equal(
    buildPublicAudioUrl('https://cdn.example.com/audio/ep1.mp3', 'https://app.vicpods.com'),
    'https://cdn.example.com/audio/ep1.mp3'
  );
});

test('Phase 2A can resolve import payloads from a live feed URL', async () => {
  const fetched = await fetchRemoteFeedXml('https://feeds.example.com/show.xml', {
    fetchImpl: async (url) => ({
      ok: true,
      status: 200,
      url,
      headers: {
        get(name) {
          return name === 'content-type' ? 'application/rss+xml' : '';
        },
      },
      async text() {
        return '<rss><channel><title>Remote Show</title></channel></rss>';
      },
    }),
  });

  assert.equal(fetched.sourceUrl, 'https://feeds.example.com/show.xml');
  assert.ok(fetched.rssXml.includes('<title>Remote Show</title>'));

  const resolved = await resolveFeedImportPayload({
    sourceUrl: 'https://feeds.example.com/show.xml',
    fetchImpl: async (url) => ({
      ok: true,
      status: 200,
      url: 'https://cdn.example.com/final-feed.xml',
      headers: { get() { return 'application/rss+xml'; } },
      async text() {
        return '<rss><channel><title>Resolved Remote Show</title></channel></rss>';
      },
    }),
  });

  assert.equal(resolved.sourceType, 'remote_fetch');
  assert.equal(resolved.sourceUrl, 'https://cdn.example.com/final-feed.xml');
  assert.ok(resolved.rssXml.includes('Resolved Remote Show'));
});

test('Phase 2A imported item identity stays stable for duplicate detection', () => {
  assert.equal(
    buildImportedItemGuid({ guid: 'episode-guid-1', title: 'Episode 1' }, 'fallback'),
    'episode-guid-1'
  );
  assert.equal(
    buildImportedItemGuid({ link: 'https://show.example.com/episodes/1', title: 'Episode 1' }, 'fallback'),
    'https://show.example.com/episodes/1'
  );
  assert.equal(
    buildImportedItemGuid({ enclosure: { url: 'https://cdn.example.com/audio/ep1.mp3' }, title: 'Episode 1' }, 'fallback'),
    'https://cdn.example.com/audio/ep1.mp3'
  );
});

test('Phase 2A helpers expose migration and website ownership fields', () => {
  assert.equal(parseDurationSeconds('1:02:03'), 3723);
  assert.ok(PodcastShow.schema.paths['siteSettings.heroTagline']);
  assert.ok(PodcastShow.schema.paths['customDomain.hostname']);
  assert.ok(PodcastShow.schema.paths['importSource.origin']);
  assert.ok(AudioAsset.schema.paths.storageProvider.enumValues.includes('remote_url'));
});

test.after(async () => {
  await mongoose.disconnect().catch(() => {});
});
