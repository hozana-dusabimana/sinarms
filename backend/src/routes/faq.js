const express = require('express');
const { getState, mutateState } = require('../data/store');
const { requireAuth, requireRole } = require('../middleware/auth');
const { appendAuditEntry, createId } = require('../services/engine');

const router = express.Router();

router.get('/', requireAuth, requireRole(['admin']), async (req, res) => {
  const state = await getState();
  return res.json(state.faq);
});

router.post('/', requireAuth, requireRole(['admin']), async (req, res) => {
  const faqId = createId('faq');
  const nextState = await mutateState((draft) => {
    draft.faq.unshift({
      id: faqId,
      organizationId: req.body.organizationId || null,
      language: req.body.language || 'en',
      question: req.body.question,
      answer: req.body.answer,
      keywords: req.body.keywords || [],
      hitCount: 0,
      createdBy: req.user.id,
    });
    return appendAuditEntry(draft, {
      userId: req.user.id,
      actorName: req.user.name,
      ipAddress: '127.0.0.1',
      actionType: 'CREATE_FAQ',
      targetType: 'faq',
      targetId: faqId,
      details: `Created FAQ entry: ${req.body.question}.`,
    });
  });
  return res.status(201).json(nextState.faq.find((entry) => entry.id === faqId));
});

router.put('/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  const nextState = await mutateState((draft) => {
    const faqEntry = draft.faq.find((entry) => entry.id === req.params.id);
    if (!faqEntry) {
      return draft;
    }
    Object.assign(faqEntry, req.body || {});
    return appendAuditEntry(draft, {
      userId: req.user.id,
      actorName: req.user.name,
      ipAddress: '127.0.0.1',
      actionType: 'UPDATE_FAQ',
      targetType: 'faq',
      targetId: faqEntry.id,
      details: `Updated FAQ entry ${faqEntry.question}.`,
    });
  });
  const faqEntry = nextState.faq.find((entry) => entry.id === req.params.id);
  if (!faqEntry) {
    return res.status(404).json({ message: 'FAQ entry not found.' });
  }
  return res.json(faqEntry);
});

router.delete('/:id', requireAuth, requireRole(['admin']), async (req, res) => {
  const state = await getState();
  if (!state.faq.find((entry) => entry.id === req.params.id)) {
    return res.status(404).json({ message: 'FAQ entry not found.' });
  }

  const nextState = await mutateState((draft) => {
    draft.faq = draft.faq.filter((entry) => entry.id !== req.params.id);
    return appendAuditEntry(draft, {
      userId: req.user.id,
      actorName: req.user.name,
      ipAddress: '127.0.0.1',
      actionType: 'DELETE_FAQ',
      targetType: 'faq',
      targetId: req.params.id,
      details: `Deleted FAQ entry ${req.params.id}.`,
    });
  });

  return res.json({ success: true, remaining: nextState.faq.length });
});

module.exports = router;
