require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());

app.use('/api/menu', require('./routes/menu'));
app.use('/api/orders', require('./routes/orders'));

app.get('/health', (_, res) => res.json({ status: 'ok' }));

// Meta webhook verification
app.get('/webhook/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === (process.env.VERIFY_TOKEN || 'mytoken123')) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Meta webhook messages → forward to N8N Workflow 01
app.post('/webhook/whatsapp', async (req, res) => {
  res.sendStatus(200); // ack Meta immediately
  try {
    const n8nUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/whatsapp';
    await fetch(n8nUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
  } catch (err) {
    console.error('Failed to forward to N8N:', err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));

module.exports = app;
