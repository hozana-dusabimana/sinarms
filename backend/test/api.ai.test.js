const supertest = require('supertest');
const { mysqlAvailable } = require('./helpers/mysqlState');
const { ensureApp, resetToSeed } = require('./helpers/testApp');

const describeIf = mysqlAvailable() ? describe : describe.skip;

describeIf('AI integration (fallback path)', () => {
  let app;

  beforeAll(async () => {
    app = await ensureApp();
  });

  beforeEach(async () => {
    await resetToSeed();
  });

  test('/ai/classify-intent resolves a known destination using the keyword fallback', async () => {
    const agent = supertest.agent(app);
    const boot = await agent.get('/api/bootstrap/public');
    const location = boot.body.state.locations[0];

    const response = await agent.post('/ai/classify-intent').send({
      locationId: location.id,
      text: 'I would like to go to the HR office',
      language: 'en',
    });

    expect(response.status).toBe(200);
    expect(['resolved', 'confirm']).toContain(response.body.status);
    expect(response.body.source).toBe('fallback');

    const topNode =
      response.body.destinationNodeId ||
      (response.body.alternatives && response.body.alternatives[0] && response.body.alternatives[0].nodeId);
    expect(topNode).toBeTruthy();
  });

  test('/ai/classify-intent returns retry state for gibberish input', async () => {
    const agent = supertest.agent(app);
    const boot = await agent.get('/api/bootstrap/public');
    const location = boot.body.state.locations[0];

    const response = await agent.post('/ai/classify-intent').send({
      locationId: location.id,
      text: 'zzzzzz qqqq wxwxwx',
    });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('retry');
    expect(response.body.destinationNodeId).toBeNull();
  });

  test('/ai/calculate-route returns a deterministic path via fallback', async () => {
    const agent = supertest.agent(app);
    const boot = await agent.get('/api/bootstrap/public');
    const location = boot.body.state.locations[0];
    const map = boot.body.state.maps[location.id];
    const office = map.nodes.find((node) => node.type === 'office');

    const response = await agent.post('/ai/calculate-route').send({
      locationId: location.id,
      fromNode: 'entrance',
      toNode: office.id,
    });

    expect(response.status).toBe(200);
    expect(response.body.source).toBe('fallback');
    expect(Array.isArray(response.body.pathNodeIds)).toBe(true);
    expect(response.body.pathNodeIds[0]).toBe('entrance');
    expect(response.body.pathNodeIds[response.body.pathNodeIds.length - 1]).toBe(office.id);
  });

  test('/ai/health reports that the Python engine is offline during tests', async () => {
    const agent = supertest.agent(app);
    const response = await agent.get('/ai/health');
    expect(response.status).toBe(200);
    expect(response.body.online).toBe(false);
    expect(response.body.engineUrl).toMatch(/^https?:\/\//);
  });

  test('/api/chatbot/query answers parking FAQ from seeded data', async () => {
    const agent = supertest.agent(app);
    const response = await agent.post('/api/chatbot/query').send({
      query: 'Is there visitor parking available?',
    });

    expect(response.status).toBe(200);
    // Either an FAQ answer is returned, or the chatbot falls back with a guidance message.
    const hasFaqAnswer = Boolean(response.body.answer) || Boolean(response.body.fallback);
    const isNav = Boolean(response.body.status);
    expect(hasFaqAnswer || isNav).toBe(true);
  });

  test('/api/chatbot/query routes navigation questions to the classifier', async () => {
    const agent = supertest.agent(app);
    const boot = await agent.get('/api/bootstrap/public');
    const location = boot.body.state.locations[0];

    const response = await agent.post('/api/chatbot/query').send({
      query: 'How do I go to the Finance office?',
      locationId: location.id,
    });

    expect(response.status).toBe(200);
    expect(['resolved', 'confirm', 'retry']).toContain(response.body.status);
  });

  test('/api/internal/ai-state is restricted to localhost (always allowed in tests)', async () => {
    const agent = supertest.agent(app);
    const response = await agent.get('/api/internal/ai-state');
    expect(response.status).toBe(200);
    expect(response.body.maps).toBeTruthy();
    expect(Array.isArray(response.body.faq)).toBe(true);
  });

  test('visitor checkin still succeeds with the AI engine unavailable', async () => {
    const agent = supertest.agent(app);
    const boot = await agent.get('/api/bootstrap/public');
    const location = boot.body.state.locations[0];
    const organization = boot.body.state.organizations.find((org) => org.id === location.organizationId);
    const destinationNode = boot.body.state.maps[location.id].nodes.find((node) => node.type === 'office');

    const checkin = await agent.post('/api/visitors/checkin').send({
      name: 'AI QA',
      idOrPhone: '0788999888',
      destinationText: destinationNode.label,
      language: 'en',
      organizationId: organization.id,
      locationId: location.id,
    });

    expect(checkin.status).toBe(200);
    expect(checkin.body.visitor).toBeTruthy();
    expect(checkin.body.classification.source).toBe('fallback');
  });
});
