const express = require('express');
const { getState, mutateState } = require('../data/store');
const { queryFaq, resolveDestinationForLocation } = require('../services/domain');

const router = express.Router();

router.post('/query', async (req, res) => {
  const state = await getState();
  const query = req.body.query || '';
  const locationId = req.body.locationId || state.locations[0].id;

  if (/(navigate|direction|office|department|go to|where is|manager|meet)/i.test(query)) {
    return res.json(resolveDestinationForLocation(state, locationId, query));
  }

  const result = queryFaq(state, req.body.organizationId || null, query);

  if (result.faqId) {
    await mutateState((draft) => {
      const faqEntry = draft.faq.find((entry) => entry.id === result.faqId);
      if (faqEntry) {
        faqEntry.hitCount += 1;
      }
      return draft;
    });
  }

  return res.json(result);
});

module.exports = router;
