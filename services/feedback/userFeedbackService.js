const mongoose = require('mongoose');
const UserFeedback = require('../../models/UserFeedback');
const { AppError } = require('../../utils/errors');

const FEEDBACK_TYPE_OPTIONS = [
  {
    value: 'feedback',
    label: 'Product feedback',
    shortLabel: 'Feedback',
    description: 'Tell us what feels useful, confusing, slow, or missing.',
  },
  {
    value: 'feature_request',
    label: 'Feature request',
    shortLabel: 'Feature',
    description: 'Suggest something that would make VicPods stronger for your workflow.',
  },
  {
    value: 'bug',
    label: 'Something is broken',
    shortLabel: 'Bug',
    description: 'Report a problem, broken page, or unexpected behavior.',
  },
  {
    value: 'other',
    label: 'Other',
    shortLabel: 'Other',
    description: 'Send anything else the VicPods team should see.',
  },
];

const FEEDBACK_STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'planned', label: 'Planned' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'closed', label: 'Closed' },
];

const FEEDBACK_PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
];

const TYPE_VALUES = new Set(FEEDBACK_TYPE_OPTIONS.map((item) => item.value));
const STATUS_VALUES = new Set(FEEDBACK_STATUS_OPTIONS.map((item) => item.value));
const PRIORITY_VALUES = new Set(FEEDBACK_PRIORITY_OPTIONS.map((item) => item.value));

function cleanText(value, maxLength) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
    .slice(0, maxLength);
}

function cleanEmail(value) {
  return String(value || '').trim().toLowerCase().slice(0, 255);
}

function normalizeEnum(value, allowedValues, fallback) {
  const normalized = String(value || '').trim().toLowerCase();
  return allowedValues.has(normalized) ? normalized : fallback;
}

function buildCountMap(rows, options) {
  const counts = options.reduce((summary, item) => {
    summary[item.value] = 0;
    return summary;
  }, {});

  (rows || []).forEach((row) => {
    const key = String(row?._id || '');
    if (Object.prototype.hasOwnProperty.call(counts, key)) {
      counts[key] = Number(row.count || 0);
    }
  });

  return counts;
}

function getOptionLabel(options, value) {
  const option = options.find((item) => item.value === value);
  return option ? option.label : value;
}

function decorateFeedbackItem(item) {
  const rawItem = item.toObject ? item.toObject() : item;
  return {
    ...rawItem,
    typeLabel: getOptionLabel(FEEDBACK_TYPE_OPTIONS, rawItem.type),
    typeShortLabel: (FEEDBACK_TYPE_OPTIONS.find((option) => option.value === rawItem.type) || {}).shortLabel || rawItem.type,
    statusLabel: getOptionLabel(FEEDBACK_STATUS_OPTIONS, rawItem.status),
    priorityLabel: getOptionLabel(FEEDBACK_PRIORITY_OPTIONS, rawItem.priority),
    actorLabel: rawItem.userName || rawItem.userEmail || rawItem.contactEmail || 'VicPods user',
  };
}

async function createUserFeedback({ user, body = {}, visitorId = '', userAgent = '', source = 'app' }) {
  if (!user) {
    throw new AppError('Please log in before sending feedback.', 401);
  }

  const type = normalizeEnum(body.type, TYPE_VALUES, 'feedback');
  const priority = normalizeEnum(body.priority, PRIORITY_VALUES, 'normal');
  const title = cleanText(body.title, 140);
  const message = cleanText(body.message, 2400);
  const pageContext = cleanText(body.pageContext, 420);
  const contactEmail = cleanEmail(body.contactEmail || user.email);

  if (!title) {
    throw new AppError('Please add a short title for your feedback.', 400);
  }

  if (!message || message.length < 12) {
    throw new AppError('Please add a little more detail so the team can understand the request.', 400);
  }

  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    throw new AppError('Please enter a valid contact email.', 400);
  }

  return UserFeedback.create({
    type,
    priority,
    title,
    message,
    pageContext,
    contactEmail,
    userId: user._id,
    userName: user.name || '',
    userEmail: user.email || '',
    visitorId: String(visitorId || '').trim().slice(0, 80),
    source: source === 'public' ? 'public' : 'app',
    userAgent: String(userAgent || '').trim().slice(0, 600),
  });
}

async function getUserFeedbackHistory(user, { limit = 8 } = {}) {
  if (!user) {
    return [];
  }

  const items = await UserFeedback.find({ userId: user._id })
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(Number(limit) || 8, 20)))
    .lean();

  return items.map(decorateFeedbackItem);
}

async function getFeedbackAdminViewModel({ limit = 24 } = {}) {
  const [
    items,
    total,
    statusBreakdownRaw,
    typeBreakdownRaw,
    priorityBreakdownRaw,
  ] = await Promise.all([
    UserFeedback.find({})
      .sort({ createdAt: -1 })
      .limit(Math.max(1, Math.min(Number(limit) || 24, 80)))
      .lean(),
    UserFeedback.countDocuments({}),
    UserFeedback.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    UserFeedback.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
    UserFeedback.aggregate([{ $group: { _id: '$priority', count: { $sum: 1 } } }]),
  ]);

  const statusBreakdown = buildCountMap(statusBreakdownRaw, FEEDBACK_STATUS_OPTIONS);
  const typeBreakdown = buildCountMap(typeBreakdownRaw, FEEDBACK_TYPE_OPTIONS);
  const priorityBreakdown = buildCountMap(priorityBreakdownRaw, FEEDBACK_PRIORITY_OPTIONS);

  return {
    items: items.map(decorateFeedbackItem),
    total,
    newCount: statusBreakdown.new || 0,
    plannedCount: statusBreakdown.planned || 0,
    shippedCount: statusBreakdown.shipped || 0,
    statusBreakdown,
    typeBreakdown,
    priorityBreakdown,
  };
}

async function updateUserFeedbackFromAdmin({ feedbackId, body = {}, adminUser }) {
  if (!mongoose.Types.ObjectId.isValid(feedbackId)) {
    throw new AppError('Feedback item not found.', 404);
  }

  const feedback = await UserFeedback.findById(feedbackId);
  if (!feedback) {
    throw new AppError('Feedback item not found.', 404);
  }

  feedback.status = normalizeEnum(body.status, STATUS_VALUES, feedback.status);
  feedback.priority = normalizeEnum(body.priority, PRIORITY_VALUES, feedback.priority);
  feedback.adminNote = cleanText(body.adminNote, 1600);
  feedback.reviewedAt = new Date();
  feedback.reviewedByUserId = adminUser?._id || null;

  await feedback.save();
  return decorateFeedbackItem(feedback);
}

module.exports = {
  FEEDBACK_TYPE_OPTIONS,
  FEEDBACK_STATUS_OPTIONS,
  FEEDBACK_PRIORITY_OPTIONS,
  createUserFeedback,
  getUserFeedbackHistory,
  getFeedbackAdminViewModel,
  updateUserFeedbackFromAdmin,
};
