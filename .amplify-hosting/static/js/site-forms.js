/**
 * Production form helpers — POST to /api with toast feedback
 */
(function (global) {
  const U = (global.URDFW = global.URDFW || {});

  U.postApi = async function (path, body) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || 'Request failed (' + res.status + ')');
    }
    return data;
  };

  U.submitSupport = async function (payload) {
    return U.postApi('/api/integrations/support', payload);
  };

  U.subscribeEmail = async function (email) {
    return U.postApi('/api/integrations/subscribe', { email });
  };

  U.submitListingIntake = async function (payload) {
    return U.postApi('/api/integrations/listing-intake', payload);
  };

  U.submitSiteContact = async function (payload) {
    return U.postApi('/api/integrations/site-contact', payload);
  };
})(window);