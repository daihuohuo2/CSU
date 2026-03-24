# 云数据库启用说明

这个项目现在已经把核心业务数据从本地缓存迁到了微信小程序云数据库，成员档案、训练记录、升旗/降旗记录、教程内容都会写入云端集合，不再依赖 `wx.setStorageSync` 保存整库数据。

## 当前使用的集合

- `members`
- `trainings`
- `flag_ceremonies`
- `tutorials`

应用启动时会自动检查这些集合：

- 如果集合里还没有数据，就把 [mock/data.js](/d:/VScode%20minipro/CSU/csu-flag-guard-wx/mock/data.js) 里的初始数据写进去
- 如果集合里已经有数据，就直接读取现有云端数据

## 你需要做的配置

1. 在微信开发者工具里打开“云开发”
2. 创建或选择一个云环境
3. 确认小程序当前项目绑定到了这个云环境
4. 在云数据库中创建下面 4 个集合：
   - `members`
   - `trainings`
   - `flag_ceremonies`
   - `tutorials`

## 权限建议

因为现在代码是直接从小程序端读写云数据库，所以集合权限必须允许前端访问。开发阶段可以先设置为：

- 所有用户可读
- 所有用户可写

如果后面要正式上线，建议再补一层更严格的权限控制，例如：

- 只允许登录用户读取
- 只允许管理员身份写入
- 或改成通过云函数统一写库

## 现在的数据行为

- 清除小程序缓存后，登录信息会消失，需要重新登录
- 但成员、任务、教程这些业务数据仍然保留在云数据库中
- “重置数据”会清空云数据库里的这 4 个集合，然后重新导入 mock 初始数据

## 代码入口

- 云数据库初始化：[storage.js](/d:/VScode%20minipro/CSU/csu-flag-guard-wx/utils/storage.js)
- 应用启动初始化：[app.js](/d:/VScode%20minipro/CSU/csu-flag-guard-wx/app.js)

