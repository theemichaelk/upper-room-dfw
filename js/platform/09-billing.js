/**
 * Category 9: Monetization, payments, coupons, invoices
 */
(function (global) {
  const P = global.URDFWPlatform;
  if (!P) return;

  P.processPayment = function (opts) {
    opts = opts || {};
    const gateways = ['paypal', 'stripe', '2checkout', 'woocommerce'];
    const gateway = opts.gateway || 'stripe';
    if (!gateways.includes(gateway)) return { error: 'Invalid gateway' };

    const order = {
      id: P.uuid(),
      gateway,
      amount: opts.amount || 29,
      plan: opts.plan || 'standard',
      type: opts.type || 'one-time',
      recurring: opts.recurring || false,
      status: 'success',
      ref: gateway.toUpperCase() + '-' + Date.now(),
      email: opts.email || null,
      maskedUrl: opts.affiliateUrl ? P.maskUrl(opts.affiliateUrl) : null,
      createdAt: new Date().toISOString(),
    };

    const orders = P.get('orders', []);
    orders.unshift(order);
    P.set('orders', orders);

    if (opts.listingId) P.upgradeListing(opts.listingId, opts.plan);
    if (opts.coupon) P.useCoupon(opts.coupon);

    P.createInvoice(order);
    P.sendEmail('order', { order, email: opts.email });
    if (opts.recurring) P.sendEmail('subscription_reminder', { order, email: opts.email });

    return order;
  };

  P.maskUrl = function (url) {
    const masks = P.get('url_masks', {});
    const id = P.uuid().slice(0, 8);
    masks[id] = url;
    P.set('url_masks', masks);
    return location.origin + '/go/' + id;
  };

  P.validateCoupon = function (code) {
    const coupons = P.get('coupons', [
      { code: 'DFW10', discount: 10, type: 'percent', limit: 100, used: 0, expires: '2027-12-31' },
      { code: 'CHURCH50', discount: 50, type: 'fixed', limit: 50, used: 0, expires: '2026-12-31' },
    ]);
    const c = coupons.find((x) => x.code.toUpperCase() === code.toUpperCase());
    if (!c) return null;
    if (c.used >= c.limit) return null;
    if (new Date(c.expires) < new Date()) return null;
    return c;
  };

  P.useCoupon = function (code) {
    const coupons = P.get('coupons', []);
    const c = coupons.find((x) => x.code.toUpperCase() === code.toUpperCase());
    if (c) { c.used = (c.used || 0) + 1; P.set('coupons', coupons); }
  };

  P.createInvoice = function (order) {
    const invoices = P.get('invoices', []);
    invoices.unshift({
      id: 'INV-' + Date.now(),
      orderId: order.id,
      amount: order.amount,
      plan: order.plan,
      gateway: order.gateway,
      date: order.createdAt,
      status: 'paid',
    });
    P.set('invoices', invoices);
    return invoices[0];
  };

  P.getPricingTable = function () {
    return P.config?.packages || [];
  };

  P.chargeForSubmission = function (amount, gateway) {
    return P.processPayment({ amount, gateway, type: 'submission', plan: 'standard' });
  };

  P.chargeForClaim = function (amount, listingId, gateway) {
    return P.processPayment({ amount: amount || 19, gateway, type: 'claim', listingId, plan: 'standard' });
  };
})(window);