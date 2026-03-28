const storage = require('./utils/storage');

App({
  onLaunch() {
    storage.warmupCloud().catch(function (err) {
      console.error('Cloud warmup failed:', err);
    });

    setTimeout(function() {
      storage.initMockData().catch(function (err) {
        console.error('Cloud bootstrap failed:', err);
      });
    }, 300);
  },

  globalData: {
    userInfo: null,
    isAdmin: false
  }
});
