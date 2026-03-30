Component({
  data: {
    selected: 0,
    list: [
      { pagePath: "/pages/index/index", text: "首页" },
      { pagePath: "/pages/mine/mine", text: "我的" }
    ]
  },
  methods: {
    switchTab(e) {
      var url = e.currentTarget.dataset.path;
      wx.switchTab({ url: url });
    }
  }
});
