const router = require('express').Router();
const customerController = require('../controllers/customerController');
const { authenticate, authorizeRestaurant } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

router.get('/phone/:phone', authenticate, customerController.getCustomerByPhone);
router.post('/', validate(schemas.createCustomer), customerController.createCustomer);
router.get('/restaurant/:id', authenticate, authorizeRestaurant, customerController.getRestaurantCustomers);

module.exports = router;
