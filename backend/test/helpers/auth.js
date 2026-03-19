async function login(agent, { email, password }) {
  const response = await agent.post('/api/auth/login').send({ email, password });
  return response;
}

async function loginAdmin(agent) {
  return login(agent, { email: 'admin@ruliba.rw', password: 'Admin123!' });
}

async function loginReceptionist(agent) {
  return login(agent, { email: 'reception@ruliba.rw', password: 'Reception123!' });
}

module.exports = {
  login,
  loginAdmin,
  loginReceptionist,
};

