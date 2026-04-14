require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());

app.use('/api/menu', require('./routes/menu'));
app.use('/api/orders', require('./routes/orders'));

app.get('/health', (_, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));

module.exports = app;
