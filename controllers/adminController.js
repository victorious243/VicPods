const Episode = require('../models/Episode');
const Idea = require('../models/Idea');
const Series = require('../models/Series');
const User = require('../models/User');
const { renderPage } = require('../utils/render');

const PAID_PLANS = ['pro', 'premium'];
const ACTIVE_PAID_STATUSES = ['active', 'trialing'];
const PAYMENT_RISK_STATUSES = ['past_due', 'unpaid'];

function buildCountMap(rows, seed) {
  const output = { ...seed };
  (rows || []).forEach((row) => {
    if (row && row._id && Object.prototype.hasOwnProperty.call(output, row._id)) {
      output[row._id] = row.count;
    }
  });
  return output;
}

async function showDashboard(req, res, next) {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    const last7d = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    const last30d = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      usersLast24h,
      usersLast7d,
      usersLast30d,
      totalSubscribers,
      activePaidUsers,
      paymentRiskUsers,
      totalSeries,
      totalEpisodes,
      totalIdeas,
      episodesLast24h,
      episodesLast7d,
      seriesLast7d,
      ideasLast7d,
      planBreakdownRaw,
      episodeStatusRaw,
      aiUsageTodayRaw,
      recentUsers,
      recentEpisodes,
      recentIdeas,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ createdAt: { $gte: last24h } }),
      User.countDocuments({ createdAt: { $gte: last7d } }),
      User.countDocuments({ createdAt: { $gte: last30d } }),
      User.countDocuments({ plan: { $in: PAID_PLANS } }),
      User.countDocuments({
        plan: { $in: PAID_PLANS },
        planStatus: { $in: ACTIVE_PAID_STATUSES },
      }),
      User.countDocuments({
        plan: { $in: PAID_PLANS },
        planStatus: { $in: PAYMENT_RISK_STATUSES },
      }),
      Series.countDocuments({}),
      Episode.countDocuments({}),
      Idea.countDocuments({}),
      Episode.countDocuments({ createdAt: { $gte: last24h } }),
      Episode.countDocuments({ createdAt: { $gte: last7d } }),
      Series.countDocuments({ createdAt: { $gte: last7d } }),
      Idea.countDocuments({ createdAt: { $gte: last7d } }),
      User.aggregate([
        { $group: { _id: '$plan', count: { $sum: 1 } } },
      ]),
      Episode.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      User.aggregate([
        {
          $match: {
            aiDailyResetDate: { $gte: startOfToday },
            aiDailyCount: { $gt: 0 },
          },
        },
        {
          $group: {
            _id: null,
            totalCalls: { $sum: '$aiDailyCount' },
            activeUsers: { $sum: 1 },
          },
        },
      ]),
      User.find({})
        .sort({ createdAt: -1 })
        .limit(8)
        .select('name email createdAt plan planStatus'),
      Episode.find({})
        .sort({ updatedAt: -1 })
        .limit(8)
        .select('title status isSingle episodeNumberWithinTheme updatedAt userId seriesId')
        .populate({ path: 'userId', select: 'name email' })
        .populate({ path: 'seriesId', select: 'name' }),
      Idea.find({})
        .sort({ updatedAt: -1 })
        .limit(8)
        .select('hook tag updatedAt userId')
        .populate({ path: 'userId', select: 'name email' }),
    ]);

    const planBreakdown = buildCountMap(planBreakdownRaw, {
      free: 0,
      pro: 0,
      premium: 0,
    });

    const episodeStatus = buildCountMap(episodeStatusRaw, {
      Planned: 0,
      Draft: 0,
      Ready: 0,
      Served: 0,
    });

    const aiUsageToday = aiUsageTodayRaw && aiUsageTodayRaw[0]
      ? aiUsageTodayRaw[0]
      : { totalCalls: 0, activeUsers: 0 };

    return renderPage(res, {
      title: req.t('page.admin.title', 'Admin Dashboard - VicPods'),
      pageTitle: req.t('page.admin.header', 'Admin Dashboard'),
      subtitle: req.t('page.admin.subtitle', 'Secret operations panel for subscriptions, paid usage, and product activity.'),
      view: 'admin/dashboard',
      data: {
        dashboardPath: req.baseUrl || '/control-room-ops',
        secretKeyEnabled: Boolean(String(process.env.ADMIN_DASHBOARD_KEY || '').trim()),
        metrics: {
          totalUsers,
          usersLast24h,
          usersLast7d,
          usersLast30d,
          totalSubscribers,
          activePaidUsers,
          paymentRiskUsers,
          totalSeries,
          totalEpisodes,
          totalIdeas,
          episodesLast24h,
          episodesLast7d,
          seriesLast7d,
          ideasLast7d,
          aiCallsToday: aiUsageToday.totalCalls || 0,
          aiActiveUsersToday: aiUsageToday.activeUsers || 0,
        },
        breakdown: {
          plans: planBreakdown,
          episodeStatus,
        },
        recentUsers,
        recentEpisodes,
        recentIdeas,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  showDashboard,
};
