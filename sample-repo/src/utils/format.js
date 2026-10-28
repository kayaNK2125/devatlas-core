const logger = require('./logger');

function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

module.exports = {
  formatCurrency
};
