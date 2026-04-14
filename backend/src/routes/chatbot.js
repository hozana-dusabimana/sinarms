const express = require('express');
const { getState, mutateState } = require('../data/store');
const { chatbotRespond } = require('../services/domain');

const router = express.Router();

router.post('/query', async (req, res) => {
  const state = await getState();
  const locationId = req.body.locationId || (state.locations[0] ? state.locations[0].id : null);

  const result = await chatbotRespond(state, {
    query: req.body.query || '',
    locationId,
    organizationId: req.body.organizationId || null,
  });

  if (result && result.faqId) {
    await mutateState((draft) => {
      const faqEntry = draft.faq.find((entry) => entry.id === result.faqId);
      if (faqEntry) {
        faqEntry.hitCount = Number(faqEntry.hitCount || 0) + 1;
      }
      return draft;
    });
  }

  return res.json(result);
});

module.exports = router;
