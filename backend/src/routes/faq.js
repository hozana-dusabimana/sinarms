const express = require('express');
const { getState, mutateState } = require('../data/store');
const { requireAuth, requireRole } = require('../middleware/auth');
const { appendAuditEntry, createId } = require('../services/engine');
const aiClient = require('../services/aiClient');

const router = express.Router();

const FAQ_UPDATABLE = ['organizationId', 'language', 'question', 'answer', 'keywords'];

function pick(source, allowed) {
  const result = {};
  if (!source) return result;
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      result[key] = source[key];
    }
  }
  return result;
}

function pushFaqToAiEngine(faq) {
  Promise.resolve()
    .then(() => aiClient.refreshFaq(faq))
    .catch(() => null);
}

// Public, unauthenticated help feed for the visitor-facing FAQ page. Anyone can
// read it, so we expose only display fields. Entries belonging to an inactive
// institution are hidden; a specific ?organizationId= returns that institution's
// entries plus the global ones (organizationId === null) that apply everywhere.
router.get('/public', async (req, res) => {
  const state = await getState();
  const { organizationId } = req.query;
  const activeOrgIds = new Set(
    state.organizations.filter((org) => org.status === 'active').map((org) => org.id),
  );
  const entries = state.faq
    .filter((entry) => !entry.organizationId || activeOrgIds.has(entry.organizationId))
    .filter((entry) => !organizationId || !entry.organizationId || entry.organizationId === organizationId)
    .map((entry) => ({
      id: entry.id,
      organizationId: entry.organizationId || null,
      language: entry.language || 'en',
      question: entry.question,
      answer: entry.answer,
    }));
  return res.json(entries);
});

router.get('/', requireAuth, requireRole(['admin', 'receptionist']), async (req, res) => {
  const state = await getState();
  // Receptionists only manage their own institution; they additionally see the
  // global (organizationId === null) entries that apply to every institution.
  if (req.user.role === 'receptionist') {
    return res.json(
      state.faq.filter((entry) => !entry.organizationId || entry.organizationId === req.user.organizationId),
    );
  }
  return res.json(state.faq);
});

router.post('/', requireAuth, requireRole(['admin', 'receptionist']), async (req, res) => {
  const faqId = createId('faq');
  // A receptionist can only author FAQs for their own institution; an admin may
  // target any institution or leave it global (null).
  const organizationId = req.user.role === 'receptionist'
    ? (req.user.organizationId || null)
    : (req.body.organizationId || null);
  const nextState = await mutateState((draft) => {
    draft.faq.unshift({
      id: faqId,
      organizationId,
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
      ipAddress: req.ip,
      actionType: 'CREATE_FAQ',
      targetType: 'faq',
      targetId: faqId,
      details: `Created FAQ entry: ${req.body.question}.`,
    });
  });
  pushFaqToAiEngine(nextState.faq);
  return res.status(201).json(nextState.faq.find((entry) => entry.id === faqId));
});

router.put('/:id', requireAuth, requireRole(['admin', 'receptionist']), async (req, res) => {
  const existing = (await getState()).faq.find((entry) => entry.id === req.params.id);
  if (!existing) {
    return res.status(404).json({ message: 'FAQ entry not found.' });
  }
  if (req.user.role === 'receptionist' && existing.organizationId !== req.user.organizationId) {
    return res.status(403).json({ message: 'You can only manage FAQs for your institution.' });
  }
  const updates = pick(req.body, FAQ_UPDATABLE);
  // Receptionists cannot move an entry to another institution or make it global.
  if (req.user.role === 'receptionist') {
    delete updates.organizationId;
  }
  const nextState = await mutateState((draft) => {
    const faqEntry = draft.faq.find((entry) => entry.id === req.params.id);
    if (!faqEntry) {
      return draft;
    }
    Object.assign(faqEntry, updates);
    return appendAuditEntry(draft, {
      userId: req.user.id,
      actorName: req.user.name,
      ipAddress: req.ip,
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
  pushFaqToAiEngine(nextState.faq);
  return res.json(faqEntry);
});

router.delete('/:id', requireAuth, requireRole(['admin', 'receptionist']), async (req, res) => {
  const state = await getState();
  const entry = state.faq.find((item) => item.id === req.params.id);
  if (!entry) {
    return res.status(404).json({ message: 'FAQ entry not found.' });
  }
  if (req.user.role === 'receptionist' && entry.organizationId !== req.user.organizationId) {
    return res.status(403).json({ message: 'You can only manage FAQs for your institution.' });
  }

  const nextState = await mutateState((draft) => {
    draft.faq = draft.faq.filter((entry) => entry.id !== req.params.id);
    return appendAuditEntry(draft, {
      userId: req.user.id,
      actorName: req.user.name,
      ipAddress: req.ip,
      actionType: 'DELETE_FAQ',
      targetType: 'faq',
      targetId: req.params.id,
      details: `Deleted FAQ entry ${req.params.id}.`,
    });
  });

  pushFaqToAiEngine(nextState.faq);
  return res.json({ success: true, remaining: nextState.faq.length });
});

module.exports = router;
