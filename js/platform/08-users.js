/**
 * Category 8: User accounts, roles, dashboard, membership types
 */
(function (global) {
  const P = global.URDFWPlatform;
  if (!P) return;

  P.registerUser = function (data) {
    const users = P.get('users', []);
    const existing = users.find((u) => u.email === data.email);
    if (existing) return { error: 'Email already registered' };
    const user = {
      id: P.uuid(),
      email: data.email,
      name: data.name || data.email.split('@')[0],
      password: data.password || '',
      role: data.role || 'member',
      package: data.package || 'free',
      membershipType: data.membershipType || 'free',
      profileImage: data.profileImage || '',
      bannerImage: data.bannerImage || '',
      savedListings: [],
      savedAuthors: [],
      createdAt: new Date().toISOString(),
      trialEnds: data.trialEnds || null,
    };
    users.push(user);
    P.set('users', users);
    P.set('current_user', user);
    P.sendEmail('welcome', user);
    return user;
  };

  P.loginUser = function (email, password) {
    const users = P.get('users', []);
    let user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      user = P.registerUser({ email, password, membershipType: 'free-trial', trialEnds: new Date(Date.now() + 14 * 86400000).toISOString() });
    }
    P.set('current_user', user);
    return user;
  };

  P.changePassword = function (userId, newPassword) {
    const users = P.get('users', []);
    const u = users.find((x) => x.id === userId);
    if (u) { u.password = newPassword; P.set('users', users); }
  };

  P.getUserRole = function (user) {
    const pkg = user?.package || 'free';
    if (pkg === 'vip' || pkg === 'premium') return 'premium-church';
    if (user?.role === 'admin') return 'admin';
    if (user?.role === 'church-owner') return 'church-owner';
    return user?.role || 'member';
  };

  P.getUserDirectory = function () {
    return P.get('users', []).map((u) => ({
      id: u.id, name: u.name, email: u.email, role: P.getUserRole(u), area: u.area || 'DFW',
    }));
  };

  P.saveListingForUser = function (userId, listingId) {
    const users = P.get('users', []);
    const u = users.find((x) => x.id === userId);
    if (u) {
      if (!u.savedListings.includes(listingId)) u.savedListings.push(listingId);
      P.set('users', users);
    }
  };

  P.getMessages = function (userId) {
    const all = P.get('messages', {});
    return all[userId] || [];
  };

  P.sendMessage = function (toUserId, from, subject, body) {
    const all = P.get('messages', {});
    all[toUserId] = all[toUserId] || [];
    all[toUserId].push({ id: P.uuid(), from, subject, body, read: false, at: Date.now() });
    P.set('messages', all);
    P.emit('notification', { toUserId, subject });
  };

  P.getNotifications = function (userId) {
    return P.get('notifications', {})[userId] || [];
  };
})(window);