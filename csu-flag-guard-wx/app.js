const storage = require('./utils/storage');

App({
  onLaunch() {
    storage.initMockData().catch(function (err) {
      console.error('Cloud init failed:', err);
    });
  },

  globalData: {
    userInfo: null,
    isAdmin: false
  }
});
