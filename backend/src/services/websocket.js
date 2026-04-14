const jwt = require('jsonwebtoken');
const config = require('../config');

function initializeWebSocket(io) {
  // Authentication middleware for WebSocket
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      socket.userId = decoded.userId;
      socket.restaurantId = decoded.restaurantId;
      socket.userRole = decoded.role;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`WebSocket connected: user=${socket.userId}, restaurant=${socket.restaurantId}`);

    // Join restaurant room for scoped broadcasts
    socket.join(`restaurant_${socket.restaurantId}`);

    // Handle admin joining their restaurant dashboard
    socket.on('join_dashboard', () => {
      console.log(`Admin ${socket.userId} joined dashboard for restaurant ${socket.restaurantId}`);
    });

    // Handle order status update from admin app
    socket.on('update_order_status', (data) => {
      io.to(`restaurant_${socket.restaurantId}`).emit('order_updated', data);
    });

    socket.on('disconnect', (reason) => {
      console.log(`WebSocket disconnected: user=${socket.userId}, reason=${reason}`);
    });

    socket.on('error', (err) => {
      console.error(`WebSocket error for user ${socket.userId}:`, err.message);
    });
  });

  return io;
}

module.exports = { initializeWebSocket };
