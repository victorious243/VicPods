const DIRECTORY_PLATFORMS = [
  {
    key: 'spotify',
    name: 'Spotify for Creators',
    submissionUrl: 'https://creators.spotify.com/',
    note: 'Submit or claim the show, then verify feed ownership.',
  },
  {
    key: 'apple',
    name: 'Apple Podcasts Connect',
    submissionUrl: 'https://podcastsconnect.apple.com/',
    note: 'Apple requires a valid RSS feed, artwork, owner email, category, and at least one episode.',
  },
  {
    key: 'youtube',
    name: 'YouTube Podcasts',
    submissionUrl: 'https://studio.youtube.com/',
    note: 'Use YouTube Studio to connect or publish podcast episodes for YouTube discovery.',
  },
  {
    key: 'amazon',
    name: 'Amazon Music',
    submissionUrl: 'https://podcasters.amazon.com/',
    note: 'Submit the RSS feed through Amazon Music for Podcasters.',
  },
  {
    key: 'pocket-casts',
    name: 'Pocket Casts',
    submissionUrl: 'https://pocketcasts.com/submit/',
    note: 'Submit the feed after the first episode is live.',
  },
  {
    key: 'overcast',
    name: 'Overcast',
    submissionUrl: 'https://overcast.fm/add',
    note: 'Overcast can index valid public RSS feeds.',
  },
];

function buildDirectoryChecklist({ feedValidation, feedUrl }) {
  const ready = Boolean(feedValidation && feedValidation.passed);

  return DIRECTORY_PLATFORMS.map((platform) => ({
    ...platform,
    feedUrl,
    status: ready ? 'ready' : 'blocked',
    blocker: ready ? '' : 'Fix feed health issues before submitting.',
  }));
}

module.exports = {
  DIRECTORY_PLATFORMS,
  buildDirectoryChecklist,
};
