module.exports = {
  apps: [
    {
      name: 'n8n',
      script: 'C:/Users/rdani/AppData/Roaming/npm/node_modules/n8n/bin/n8n',
      args: 'start',
      env: {
        BACKEND_URL: 'http://localhost:3001',
        RESTAURANT_ID: 'c39b790c-1907-46b2-9ee9-b7362d624f7f',
        WA_PHONE_NUMBER_ID: '1013078875229678',
        WA_ACCESS_TOKEN: 'EAANbDx5TcZAABRPyIsKYpumgpgFCdCGZCdvFuMJ28RYe3FUj1Timdeo3cV5GFwVUoZCt7KegeWeCWPfy0guv7XBC0E3uUI8iiItC2Ag98T7fkWpqZBv9v2MTKi3CWzZBjvEZAeGH8CQyZB1dA0vIi2DBUMuuBalNsjwe0jB2HsQZAehKJKMsD0CZBA7eqNXdqd4JWChtL8ISlZCspSj1ETcMwtxZCrbZBNSwGywHSkRS82Lp9km0iVJ8MOGvSao24EfFZANXeqjm9wmomdZAofpOaMGDTpH3lG8AZDZD',
        ADMIN_WHATSAPP: '923462967765',
        WEBHOOK_URL: 'https://swinging-wizard-extent.ngrok-free.dev/',
        N8N_BASIC_AUTH_ACTIVE: 'false',
        N8N_BLOCK_ENV_ACCESS_IN_NODE: 'false',
      },
    },
    {
      name: 'backend',
      script: 'D:/restaurant-automation/backend/src/app.js',
      cwd: 'D:/restaurant-automation/backend',
      env: {
        PORT: '3001',
        USE_SQLITE: 'true',
        SQLITE_PATH: './database/restaurant_bot.db',
      },
    },
  ],
};
