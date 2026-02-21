const Idea = require('../models/Idea');
const { AppError } = require('../utils/errors');
const { renderPage } = require('../utils/render');

async function showPantry(req, res, next) {
  try {
    const ideas = await Idea.find({ userId: req.currentUser._id }).sort({ updatedAt: -1 });

    return renderPage(res, {
      title: 'Pantry - VicPods',
      pageTitle: 'Pantry',
      subtitle: 'Store hooks and ingredients for future episodes.',
      view: 'pantry/index',
      data: {
        ideas,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function createIdea(req, res, next) {
  try {
    const hook = String(req.body.hook || '').trim();
    if (!hook) {
      throw new AppError('Idea hook is required.', 400);
    }

    await Idea.create({
      userId: req.currentUser._id,
      hook,
      tag: String(req.body.tag || 'general').trim() || 'general',
      notes: String(req.body.notes || '').trim(),
    });

    req.flash('success', 'Idea added to pantry.');
    return res.redirect('/pantry');
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      return res.redirect('/pantry');
    }

    return next(error);
  }
}

async function updateIdea(req, res, next) {
  try {
    const hook = String(req.body.hook || '').trim();
    if (!hook) {
      throw new AppError('Idea hook is required.', 400);
    }

    const idea = await Idea.findOneAndUpdate(
      {
        _id: req.params.ideaId,
        userId: req.currentUser._id,
      },
      {
        hook,
        tag: String(req.body.tag || 'general').trim() || 'general',
        notes: String(req.body.notes || '').trim(),
      },
      { new: true }
    );

    if (!idea) {
      throw new AppError('Idea not found.', 404);
    }

    req.flash('success', 'Idea updated.');
    return res.redirect('/pantry');
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      return res.redirect('/pantry');
    }

    return next(error);
  }
}

async function deleteIdea(req, res, next) {
  try {
    const deleted = await Idea.findOneAndDelete({
      _id: req.params.ideaId,
      userId: req.currentUser._id,
    });

    if (!deleted) {
      throw new AppError('Idea not found.', 404);
    }

    req.flash('success', 'Idea removed.');
    return res.redirect('/pantry');
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      return res.redirect('/pantry');
    }

    return next(error);
  }
}

module.exports = {
  showPantry,
  createIdea,
  updateIdea,
  deleteIdea,
};
