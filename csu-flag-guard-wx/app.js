const storage = require('./utils/storage');

App({
  onLaunch() {
    storage.initMockData();
  },

  globalData: {
    userInfo: null,
    isAdmin: false
  }
});
