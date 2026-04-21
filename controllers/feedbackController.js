const { recordActivityEvent } = require('../services/analytics/appActivityService');
const {
  FEEDBACK_TYPE_OPTIONS,
  FEEDBACK_PRIORITY_OPTIONS,
  createUserFeedback,
  getUserFeedbackHistory,
} = require('../services/feedback/userFeedbackService');
const { renderPage } = require('../utils/render');

async function showFeedbackForm(req, res, next) {
  try {
    const recentFeedback = await getUserFeedbackHistory(req.currentUser, { limit: 6 });

    return renderPage(res, {
      title: 'Feedback + Feature Requests - VicPods',
      pageTitle: 'Feedback',
      subtitle: 'Send product feedback, report issues, or request features directly to the VicPods team.',
      view: 'feedback/index',
      data: {
        feedbackTypeOptions: FEEDBACK_TYPE_OPTIONS,
        feedbackPriorityOptions: FEEDBACK_PRIORITY_OPTIONS,
        recentFeedback,
        submittedPageContext: String(req.query.from || req.get('referer') || '').slice(0, 420),
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function submitFeedback(req, res, next) {
  try {
    const feedback = await createUserFeedback({
      user: req.currentUser,
      body: req.body,
      visitorId: req.visitorId,
      userAgent: req.get('user-agent'),
      source: 'app',
    });

    void recordActivityEvent(req, {
      eventType: 'feedback_submitted',
      user: req.currentUser,
      statusCode: 200,
      metadata: {
        feedbackId: String(feedback._id),
        type: feedback.type,
        priority: feedback.priority,
      },
    });

    req.flash('success', 'Feedback sent. It is now visible in the VicPods admin dashboard.');
    return res.redirect('/feedback');
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      return res.redirect('/feedback');
    }

    return next(error);
  }
}

module.exports = {
  showFeedbackForm,
  submitFeedback,
};
