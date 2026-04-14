const axios = require('axios');
const config = require('../config');

const WHATSAPP_API_BASE = `https://graph.facebook.com/${config.whatsapp.apiVersion}/${config.whatsapp.phoneId}`;

async function sendTextMessage(to, text) {
  try {
    await axios.post(
      `${WHATSAPP_API_BASE}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${config.whatsapp.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (err) {
    console.error('WhatsApp send failed:', err.response?.data || err.message);
  }
}

async function sendInteractiveList(to, headerText, bodyText, buttonText, sections) {
  try {
    await axios.post(
      `${WHATSAPP_API_BASE}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive: {
          type: 'list',
          header: { type: 'text', text: headerText },
          body: { text: bodyText },
          action: {
            button: buttonText,
            sections,
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${config.whatsapp.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (err) {
    console.error('WhatsApp interactive send failed:', err.response?.data || err.message);
  }
}

async function sendOrderConfirmation(to, orderData) {
  const text = `✅ *Order Confirmed!*

🆔 Order #${orderData.order_number || orderData.id.slice(0, 8)}
💰 Total: PKR ${orderData.total_amount}
💳 Payment: ${orderData.payment_method === 'cod' ? 'Cash on Delivery' : 'Bank Transfer'}

📍 Delivery to: ${orderData.delivery_address}

You'll receive updates on your order status!`;

  await sendTextMessage(to, text);
}

async function sendStatusUpdate(to, orderData) {
  const statusEmojis = {
    confirmed: '✅',
    preparing: '👨‍🍳',
    ready: '📦',
    out_for_delivery: '🚗',
    delivered: '🎉',
    cancelled: '❌',
  };

  const emoji = statusEmojis[orderData.order_status] || '📋';
  const text = `${emoji} *Order Update*

Order #${orderData.order_number || orderData.id.slice(0, 8)}
Status: *${orderData.order_status.replace(/_/g, ' ').toUpperCase()}*
${orderData.estimated_delivery_time ? `\n⏰ Estimated delivery: ${new Date(orderData.estimated_delivery_time).toLocaleTimeString()}` : ''}`;

  await sendTextMessage(to, text);
}

module.exports = {
  sendTextMessage,
  sendInteractiveList,
  sendOrderConfirmation,
  sendStatusUpdate,
};
