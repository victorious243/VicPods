const DATE_FORMATTER = new Intl.DateTimeFormat('en-IE', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'Europe/Dublin',
});

const WHAT_NEW_ENTRIES = [
  {
    slug: 'studio-workflow-and-collaboration',
    date: '2026-07-22',
    label: 'Product update',
    title: 'Studio workflow, approvals, and launch prep expanded',
    summary: 'VicPods now gives podcast teams a more complete studio workspace with collaborator roles, approval checkpoints, reusable show direction, and recording-readiness tools across the episode flow.',
    highlights: [
      'Collaborator roles, approval states, comments, and tasks across hosted shows.',
      'Episode structure, launch assets, and show-level brand direction in one workspace.',
      'Recording-readiness views with prep notes, questions, and checklists.',
    ],
  },
  {
    slug: 'advanced-media-and-integrations',
    date: '2026-07-20',
    label: 'Advanced media',
    title: 'Integrations and advanced media controls landed',
    summary: 'VicPods now models integration connections, webhook events, clip suggestions, caption drafts, and export packs for external recording and editing workflows.',
    highlights: [
      'Integrations dashboard for connection management.',
      'Webhook payload modeling for product events.',
      'Clip suggestion, caption draft, and Descript/Riverside handoff support.',
    ],
  },
  {
    slug: 'teams-and-approvals',
    date: '2026-07-19',
    label: 'Team workflow',
    title: 'Teams, approvals, and brand kit workflows were added',
    summary: 'Shows can now model collaborators, roles, comments, tasks, approval states, and reusable brand guidance for more professional podcast operations.',
    highlights: [
      'Collaborator roles for owner, producer, editor, analyst, and guest.',
      'Episode tasks, comments, and approval states.',
      'Reusable show-level brand kit fields.',
    ],
  },
  {
    slug: 'creator-monetization-tools',
    date: '2026-07-18',
    label: 'Monetization',
    title: 'Creator monetization tools expanded',
    summary: 'VicPods now includes support links, sponsor profiles, outreach templates, ad slot planning, and private feed groundwork for monetized podcast workflows.',
    highlights: [
      'Support links on public show and episode pages.',
      'Sponsor media kit and outreach template generation.',
      'Private feed token support and premium episode visibility controls.',
    ],
  },
  {
    slug: 'recording-day-workflow',
    date: '2026-07-17',
    label: 'Recording prep',
    title: 'Recording-day workflow is now built into the episode editor',
    summary: 'Creators can now prepare to record with teleprompter scripts, guest prep sheets, interview questions, checklists, session notes, and transcript import support.',
    highlights: [
      'Teleprompter and read mode from episode structure.',
      'Guest prep sheet and interview question support.',
      'Recording checklist, notes, and transcript import flow.',
    ],
  },
  {
    slug: 'analytics-and-growth-loop',
    date: '2026-07-16',
    label: 'Analytics',
    title: 'Analytics and growth reporting were added',
    summary: 'VicPods now tracks podcast performance events and surfaces growth dashboards with top episodes, source breakdowns, platform trends, and recommendations.',
    highlights: [
      'Feed, audio, player, and share event tracking.',
      'Top episodes, timeline views, and breakdowns by source/device/platform.',
      'Recommendation logic and CSV export coverage.',
    ],
  },
  {
    slug: 'publishing-foundation',
    date: '2026-07-15',
    label: 'Publishing',
    title: 'Podcast publishing foundation shipped',
    summary: 'VicPods moved beyond planning into real podcast publishing with hosted shows, public RSS feeds, public pages, scheduled publishing, and show-level publish controls.',
    highlights: [
      'Hosted show model, audio upload, and public publishing routes.',
      'Public RSS feed, show archive, episode pages, and embeds.',
      'Feed validation and directory checklist foundations.',
    ],
  },
];

function normalizeEntry(entry, index) {
  const parsedDate = new Date(`${entry.date}T00:00:00.000Z`);

  return {
    ...entry,
    position: index + 1,
    dateValue: parsedDate,
    dateLabel: DATE_FORMATTER.format(parsedDate),
    highlights: Array.isArray(entry.highlights) ? entry.highlights.filter(Boolean).slice(0, 6) : [],
  };
}

function getWhatsNewEntries() {
  return WHAT_NEW_ENTRIES
    .slice()
    .sort((left, right) => (
      new Date(`${right.date}T00:00:00.000Z`).getTime() - new Date(`${left.date}T00:00:00.000Z`).getTime()
    ))
    .map(normalizeEntry);
}

function getWhatsNewPageData() {
  const entries = getWhatsNewEntries();

  return {
    entries,
    featuredEntry: entries[0] || null,
  };
}

module.exports = {
  getWhatsNewEntries,
  getWhatsNewPageData,
};
