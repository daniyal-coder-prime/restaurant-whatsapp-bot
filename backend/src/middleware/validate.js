const Joi = require('joi');

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      const errors = error.details.map((d) => d.message);
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    next();
  };
};

// ======= Validation Schemas =======

const schemas = {
  // Auth
  login: Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required(),
  }),

  registerRestaurant: Joi.object({
    name: Joi.string().max(255).required(),
    owner_name: Joi.string().max(255).required(),
    phone: Joi.string().max(20).required(),
    whatsapp_number: Joi.string().max(20).required(),
    username: Joi.string().max(100).required(),
    password: Joi.string().min(6).required(),
  }),

  refreshToken: Joi.object({
    refresh_token: Joi.string().required(),
  }),

  // Restaurant
  updateRestaurant: Joi.object({
    name: Joi.string().max(255),
    owner_name: Joi.string().max(255),
    phone: Joi.string().max(20),
    bank_account_details: Joi.object({
      bank_name: Joi.string(),
      account_holder: Joi.string(),
      account_number: Joi.string(),
      iban: Joi.string(),
    }),
  }),

  // Menu
  createMenuItem: Joi.object({
    item_name: Joi.string().max(255).required(),
    description: Joi.string().allow(''),
    base_price: Joi.number().positive().required(),
    image_url: Joi.string().uri().allow(''),
    category: Joi.string().max(100).required(),
    is_available: Joi.boolean().default(true),
    sort_order: Joi.number().integer().default(0),
  }),

  updateMenuItem: Joi.object({
    item_name: Joi.string().max(255),
    description: Joi.string().allow(''),
    base_price: Joi.number().positive(),
    image_url: Joi.string().uri().allow(''),
    category: Joi.string().max(100),
    is_available: Joi.boolean(),
    sort_order: Joi.number().integer(),
  }),

  createCustomization: Joi.object({
    customization_name: Joi.string().max(100).required(),
    customization_type: Joi.string().valid('size', 'topping', 'sauce', 'extra', 'spice').required(),
    additional_price: Joi.number().default(0),
    is_optional: Joi.boolean().default(true),
  }),

  // Order
  createOrder: Joi.object({
    restaurant_id: Joi.string().uuid().required(),
    customer_phone: Joi.string().max(20).required(),
    customer_name: Joi.string().max(255).required(),
    delivery_address: Joi.string().required(),
    order_items: Joi.array().items(Joi.object({
      item_id: Joi.string().uuid(),
      item_name: Joi.string().required(),
      quantity: Joi.number().integer().positive().required(),
      customizations: Joi.array().items(Joi.string()).default([]),
      price: Joi.number().positive().required(),
    })).min(1).required(),
    total_amount: Joi.number().positive().required(),
    payment_method: Joi.string().valid('bank_transfer', 'cod').required(),
    notes: Joi.string().allow(''),
  }),

  updateOrderStatus: Joi.object({
    status: Joi.string().valid(
      'placed', 'confirmed', 'preparing', 'ready',
      'out_for_delivery', 'delivered', 'cancelled'
    ).required(),
    rejection_reason: Joi.string().when('status', {
      is: 'cancelled',
      then: Joi.string().required(),
      otherwise: Joi.string().allow(''),
    }),
    estimated_delivery_time: Joi.date().iso(),
  }),

  // Payment
  verifyPayment: Joi.object({
    verification_result: Joi.string().valid('approved', 'rejected').required(),
    verification_notes: Joi.string().allow(''),
  }),

  // Customer
  createCustomer: Joi.object({
    restaurant_id: Joi.string().uuid().required(),
    phone_number: Joi.string().max(20).required(),
    customer_name: Joi.string().max(255).required(),
    address: Joi.string().allow(''),
  }),
};

module.exports = { validate, schemas };
