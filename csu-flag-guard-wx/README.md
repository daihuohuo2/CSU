# 中南大学国旗班管理小程序

> 微信原生小程序 · AppID: `wxc1487e042867ed9a` · 基础库版本: 2.19.4

面向国旗班内部使用的管理工具，涵盖成员档案、训练考勤、升降旗考勤、动作教程四大模块。目前使用本地 Mock 数据存储，无需后端服务。

---

## 目录

- [项目结构总览](#项目结构总览)
- [根目录文件](#根目录文件)
- [工具库 utils/](#工具库-utils)
- [Mock 数据 mock/](#mock-数据-mock)
- [页面模块 pages/](#页面模块-pages)
  - [首页 index](#首页-index)
  - [登录 login](#登录-login)
  - [个人中心 mine](#个人中心-mine)
  - [升降旗管理 flag](#升降旗管理-flag)
  - [成员管理 member](#成员管理-member)
  - [训练管理 training](#训练管理-training)
  - [动作教程 tutorial](#动作教程-tutorial)
- [数据模型](#数据模型)
- [权限设计](#权限设计)
- [样式规范](#样式规范)
- [常见修改指引](#常见修改指引)

---

## 项目结构总览

```
csu-flag-guard-wx/
├── app.js                    # 应用入口，初始化 Mock 数据
├── app.json                  # 全局路由配置、导航栏样式
├── app.wxss                  # 全局公共样式
├── project.config.json       # 微信开发者工具项目配置
├── project.private.config.json # 本地私有配置（不提交）
├── sitemap.json              # 小程序搜索配置
│
├── utils/
│   ├── storage.js            # 数据存储 CRUD 层（封装 wx.storage）
│   └── util.js               # 通用工具函数（日期/ID/统计等）
│
├── mock/
│   └── data.js               # 模拟数据库（成员/训练/升降旗/教程）
│
└── pages/
    ├── index/                # 首页（导航中心）
    ├── login/                # 登录页
    ├── mine/                 # 个人中心
    ├── flag/
    │   ├── list/             # 升降旗任务列表
    │   ├── detail/           # 升降旗任务详情 + 考勤管理
    │   └── create/           # 创建升降旗任务
    ├── member/
    │   ├── list/             # 成员档案列表 + 搜索
    │   ├── detail/           # 成员档案详情
    │   └── edit/             # 新增 / 编辑成员档案
    ├── training/
    │   ├── list/             # 训练记录列表
    │   ├── detail/           # 训练详情 + 考勤管理
    │   └── create/           # 创建训练任务
    └── tutorial/
        ├── list/             # 动作教程列表
        ├── detail/           # 教程详情阅读
        └── edit/             # 新增 / 编辑教程
```

---

## 根目录文件

### `app.js` — 应用入口

调用 `storage.initMockData()` 在首次启动时将 `mock/data.js` 中的示例数据写入本地存储。全局数据 `globalData` 保存 `userInfo` 和 `isAdmin` 字段，但实际读取权限时均通过 `storage.isAdmin()` 完成，不直接读 globalData。

> **如需接入真实后端**：在此文件的 `onLaunch` 中替换初始化逻辑，改为从网络拉取数据。

---

### `app.json` — 全局配置

```json
{
  "pages": [ ... ],           // 所有页面路由（新增页面必须在此注册）
  "window": {
    "navigationBarBackgroundColor": "#8B0000",  // 导航栏深红色
    "navigationBarTitleText": "中南大学国旗班", // 全局标题
    "navigationBarTextStyle": "white"
  }
}
```

> **修改导航栏颜色/标题**：编辑 `window.navigationBarBackgroundColor` 和 `navigationBarTitleText`。\
> **新增页面**：必须在 `pages` 数组中添加路径，否则无法跳转。

---

### `app.wxss` — 全局样式

所有页面共享的基础样式，修改此文件会影响全局 UI。

| 类名 | 作用 |
|------|------|
| `.container` | 页面根容器，底部 padding 40rpx |
| `.card` | 白色圆角卡片，带阴影，用于信息分组 |
| `.btn-primary` | 主操作按钮（深红 `#C41A1A`） |
| `.btn-secondary` | 次级按钮（白底+红色边框） |
| `.btn-danger` | 危险操作按钮（红色 `#EE4D4D`，用于删除） |
| `.form-group` | 表单行容器 |
| `.form-label` | 表单字段标签 |
| `.form-input` | 文本输入框 |
| `.status-badge` | 状态标签（行内色块） |
| `.section-header` | 卡片内分区标题 |
| `.fab-btn` | 右下角浮动操作按钮（"+"） |

> **修改全局主色**：搜索 `#C41A1A` 和 `#8B0000`，统一替换为新颜色。

---

### `project.config.json` — 开发者工具配置

包含 AppID、项目名称、编译选项（ES6 转译、PostCSS、代码压缩等）。通常不需要手动修改，由微信开发者工具自动维护。

---

## 工具库 utils/

### `utils/storage.js` — 数据 CRUD 层

封装所有 `wx.getStorageSync` / `wx.setStorageSync` 操作，是**唯一操作本地数据的入口**。

#### 存储键常量

```javascript
storage.KEYS = {
  MEMBERS:          'fg_members',           // 成员列表
  TRAININGS:        'fg_trainings',         // 训练任务列表
  FLAG_CEREMONIES:  'fg_flag_ceremonies',   // 升降旗任务列表
  TUTORIALS:        'fg_tutorials',         // 动作教程列表
  USER_INFO:        'fg_user_info'          // 当前登录用户
}
```

#### 核心方法

| 方法 | 说明 |
|------|------|
| `initMockData()` | 首次运行时写入 mock 数据，已有数据则跳过 |
| `getList(key)` | 返回指定 key 的完整数组 |
| `getById(key, id)` | 根据 `id` 字段查找并返回单条记录 |
| `add(key, item)` | 将 item 插入列表头部（unshift） |
| `update(key, id, data)` | 找到对应 id 的记录，用 data 做浅合并 |
| `remove(key, id)` | 过滤掉指定 id 的记录 |
| `getUserInfo()` | 返回当前用户 `{name, role}` |
| `setUserInfo(info)` | 保存用户信息到本地存储 |
| `isAdmin()` | 返回 `boolean`，`role === 'admin'` 时为 true |
| `clearUserInfo()` | 清除登录信息（退出登录） |

> **如需接入后端 API**：仅需修改此文件，将各方法内部的 `wx.getStorageSync` 替换为网络请求，页面层代码无需改动。

---

### `utils/util.js` — 通用工具函数

| 函数 | 说明 |
|------|------|
| `formatDate(date)` | Date 对象或字符串 → `YYYY-MM-DD` |
| `formatTime(date)` | Date 对象或字符串 → `HH:mm` |
| `generateId(prefix)` | 生成唯一 ID，格式 `prefix_时间戳_随机串` |
| `showToast(title, icon)` | 封装 `wx.showToast`，icon 默认 none |
| `getStatusColor(status)` | 考勤状态文字 → 对应十六进制颜色 |
| `calcAttendanceStats(attendance)` | 统计考勤数组，返回 `{total, normal, late, absent, arrived, leave}` |

#### 考勤状态映射（calcAttendanceStats 内部）

| 原始状态值 | 返回键名 | 含义 |
|-----------|---------|------|
| `正常` | `normal` | 升降旗正常出勤 |
| `迟到` | `late` | 迟到 |
| `缺席` | `absent` | 升降旗缺席 |
| `缺勤` | `absent` | 训练缺勤（与缺席共用 absent） |
| `已到` | `arrived` | 训练已到 |
| `请假` | `leave` | 请假 |

> **修改状态种类**：在 `calcAttendanceStats` 的 `keyMap` 对象中增减映射，同步修改对应 WXML 中的绑定字段名。

---

## Mock 数据 mock/

### `mock/data.js` — 模拟数据库

项目默认数据，首次启动时由 `storage.initMockData()` 写入本地存储。**修改此文件不会立即生效**，需在个人中心点击「重置数据」或清除小程序本地缓存。

#### 成员数据（6条）

| 姓名 | 职务 | 状态 |
|------|------|------|
| 刘伟 | 队长 | 在队 |
| 王芳 | 副队长 | 在队 |
| 张强 | 旗手 | 在队 |
| 李敏 | 护旗手 | 在队 |
| 陈浩 | 队员 | 在队 |
| 赵雪 | 队员 | 离队 |

#### 训练数据（3条）：日常训练、专项训练（持旗）、彩排
#### 升降旗数据（3条）：升旗2次、降旗1次
#### 教程数据（6条）：基础动作2篇、行进动作2篇、仪式流程2篇

---

## 页面模块 pages/

> 每个页面由 4 个文件组成：
> - `.js` — 页面逻辑、数据、事件处理
> - `.wxml` — 页面模板（HTML 结构）
> - `.wxss` — 页面专属样式（CSS）
> - `.json` — 页面配置（导航栏标题等）

---

### 首页 index

**路径**: `pages/index/`\
**导航栏标题**: 中南大学国旗班

#### 功能
应用的导航中心，展示当前登录用户信息，并提供各模块入口。

#### `index.js` 关键逻辑

| 方法 | 说明 |
|------|------|
| `onShow()` | 每次显示时刷新用户信息和管理员状态 |
| `goLogin()` | 跳转登录页 |
| `goTraining/goFlag/goMember/goTutorial()` | 跳转各模块列表页 |
| `goTrainingCreate/goFlagCreate/goMemberAdd/goTutorialAdd()` | 管理员快捷创建入口 |

#### `index.wxml` UI 结构

```
首页
├── 顶部横幅（标题 + 副标题）
├── 用户信息栏（姓名 + 身份标签，未登录则显示"游客"）
├── 功能模块网格（2×2）
│   ├── 🏃 训练考勤
│   ├── 🚩 升降旗考勤
│   ├── 👥 成员档案
│   └── 📖 动作教程
├── 管理员快捷操作面板（仅管理员可见）
│   ├── 新建训练、新建升降旗任务
│   └── 新增成员、新增教程
└── 底部版权信息
```

---

### 登录 login

**路径**: `pages/login/`\
**导航栏标题**: 登录

#### 功能
模拟登录，选择用户名和角色后写入本地存储。**没有密码校验，仅为演示使用**。

#### `login.js` 关键逻辑

| 方法 | 说明 |
|------|------|
| `onNameInput(e)` | 实时更新 `name` 字段 |
| `selectRole(e)` | 切换 `member`（普通成员）或 `admin`（管理员） |
| `handleLogin()` | 验证姓名非空且已选角色，写入 storage，返回上一页 |

#### `login.wxml` UI 结构

```
登录页
├── 标题"队员登录"
├── 姓名输入框
├── 角色选择（两个选项卡）
│   ├── 👤 普通成员
│   └── 👑 管理员
├── 登录按钮（深红色）
└── 提示文字"当前为模拟登录"
```

> **修改登录逻辑**：编辑 `login.js` 的 `handleLogin()` 方法，可在此接入真实认证接口。

---

### 个人中心 mine

**路径**: `pages/mine/`\
**导航栏标题**: 个人中心

#### 功能
展示当前用户信息，提供身份切换、数据重置、退出登录操作。

#### `mine.js` 关键逻辑

| 方法 | 说明 |
|------|------|
| `onShow()` | 刷新用户信息，按姓名匹配成员档案 |
| `switchRole()` | 在 admin/member 之间切换，刷新页面 |
| `resetData()` | 弹窗确认后清除所有存储并重新写入 mock 数据 |
| `handleLogout()` | 清除用户信息，跳转登录页 |
| `goTraining/goFlag()` | 跳转训练/升降旗列表 |

#### `mine.wxml` UI 结构

```
个人中心
├── 头部卡片（头像首字母 + 姓名 + 身份标签）
├── 个人档案卡片（仅当姓名匹配成员数据时显示）
│   ├── 学号、学院、专业
│   └── 年级、班级、入队时间
├── 我的记录
│   ├── 我的训练记录
│   └── 我的升降旗记录
└── 账户管理
    ├── 切换身份（admin↔member）
    ├── 重置数据（恢复 mock 初始状态）
    └── 退出登录（红色，危险操作）
```

---

### 升降旗管理 flag

#### `pages/flag/list/` — 升降旗列表

**导航栏标题**: 升降旗考勤

| 数据字段 | 说明 |
|---------|------|
| `list` | 所有升降旗记录 |
| `filteredList` | 当前筛选后显示的列表 |
| `currentType` | 筛选类型：`all` / `升旗` / `降旗` |
| `isAdmin` | 控制是否显示"+"创建按钮 |

| 方法 | 说明 |
|------|------|
| `loadData()` | 读取所有记录，调用 `calcAttendanceStats` 附加统计数据 |
| `filterType(e)` | 切换类型筛选并重新过滤 |
| `goDetail(e)` | 跳转详情页，传递 `id` 参数 |
| `goCreate()` | 跳转创建页 |

```
升降旗列表页
├── 类型筛选栏（全部 / 升旗 / 降旗）
├── 任务卡片列表
│   ├── 标题 + 类型标签（升旗=蓝/降旗=橙）
│   ├── 日期、时间、地点
│   └── 考勤统计标签（正常/迟到/缺席/请假）
├── 空状态提示
└── FAB "+" 按钮（仅管理员）
```

---

#### `pages/flag/detail/` — 升降旗详情

**导航栏标题**: 任务详情

| 数据字段 | 说明 |
|---------|------|
| `id` | 当前任务 ID（从路由参数获取） |
| `detail` | 完整任务数据 |
| `stats` | 考勤统计 `{total, normal, late, absent, leave}` |
| `isAdmin` | 控制是否可修改考勤状态 |
| `statusColors` | 状态 → 颜色映射（用于普通用户的状态标签） |

| 方法 | 说明 |
|------|------|
| `loadData()` | 根据 id 读取详情并计算统计 |
| `changeStatus(e)` | 修改指定成员（`data-index`）的考勤状态（`data-status`），立即保存 |
| `handleDelete()` | 弹窗二次确认后删除任务并返回列表 |

```
升降旗详情页
├── 基本信息卡片（标题、类型、日期、时间、地点、描述）
├── 考勤统计卡片（总人数/正常/迟到/缺席/请假）
├── 考勤明细列表
│   ├── 管理员视图：每人显示 4 个状态按钮（点击即改）
│   └── 普通视图：每人显示状态色块标签
└── 删除按钮（仅管理员，红色）
```

---

#### `pages/flag/create/` — 创建升降旗任务

**导航栏标题**: 创建升降旗任务

| 表单字段 | 必填 | 说明 |
|---------|------|------|
| `title` | ✅ | 任务标题 |
| `type` | ✅ | 升旗 / 降旗 |
| `date` | ✅ | 日期选择器 |
| `time` | ❌ | 时间输入 |
| `location` | ❌ | 地点 |
| `description` | ❌ | 备注描述 |
| 成员选择 | ✅（≥1人） | Switch 开关多选 |

| 方法 | 说明 |
|------|------|
| `onLoad()` | 加载全部成员列表，默认全选 |
| `toggleMember(e)` | 切换成员的 `checked` 状态 |
| `handleSubmit()` | 验证后生成任务，初始化所有成员状态为"正常"，写入 storage |

---

### 成员管理 member

#### `pages/member/list/` — 成员列表

**导航栏标题**: 成员档案

| 方法 | 说明 |
|------|------|
| `loadData()` | 读取所有成员 |
| `onSearch(e)` | 按**姓名**或**学号**模糊搜索 |
| `filterStatus(e)` | 按在队/离队状态筛选 |
| `applyFilter()` | 同时应用关键词 + 状态两个过滤条件 |

```
成员列表页
├── 搜索栏（搜索姓名或学号）
├── 状态筛选栏（全部 / 在队 / 离队）
├── 成员卡片列表
│   ├── 头像（姓名首字）
│   ├── 姓名 + 职务标签
│   ├── 学院 / 年级
│   └── 状态标签（绿"在队" / 灰"离队"）
└── FAB "+" 按钮（仅管理员）
```

---

#### `pages/member/detail/` — 成员详情

**导航栏标题**: 成员详情

展示完整成员档案，管理员可跳转编辑或删除。

```
成员详情页
├── 头部（头像、姓名、职务）
├── 基本信息卡片（姓名/性别/学号/学院/专业/年级/班级）
├── 联系方式卡片（手机号/微信号）
├── 队伍信息卡片（入队时间/职务/状态/备注）
└── 管理员操作（编辑档案按钮 + 删除成员按钮）
```

---

#### `pages/member/edit/` — 新增/编辑成员

**导航栏标题**: 新增成员 / 编辑档案（由 `isEdit` 控制）

通过路由参数 `id` 区分新增（无 id）与编辑（有 id）模式。

| 必填字段 | 说明 |
|---------|------|
| `name` | 姓名 |
| `gender` | 性别（男/女） |
| `studentId` | 学号 |

**职务选项**: 队长 / 副队长 / 旗手 / 护旗手 / 队员\
**状态选项**: 在队 / 离队

---

### 训练管理 training

#### `pages/training/list/` — 训练列表

**导航栏标题**: 训练考勤

与 flag/list 结构相同，筛选维度为训练类型（日常训练/专项训练/彩排等）。考勤统计显示 `已到/迟到/缺勤/请假`。

---

#### `pages/training/detail/` — 训练详情

**导航栏标题**: 训练详情

与 flag/detail 结构相同，状态按钮改为：**已到 / 迟到 / 缺勤 / 请假**。

| stats 字段 | 说明 |
|-----------|------|
| `arrived` | 已到 |
| `late` | 迟到 |
| `absent` | 缺勤 |
| `leave` | 请假 |

---

#### `pages/training/create/` — 创建训练任务

**导航栏标题**: 创建训练任务

与 flag/create 结构相同，类型选项改为训练类型（日常训练/专项训练/彩排等），成员初始状态为"已到"。

---

### 动作教程 tutorial

#### `pages/tutorial/list/` — 教程列表

**导航栏标题**: 动作教程

| 方法 | 说明 |
|------|------|
| `loadData()` | 读取所有教程 |
| `filterCategory(e)` | 按分类筛选（基础动作/行进动作/仪式流程） |
| `goDetail(e)` | 跳转教程详情 |
| `goAdd()` | 跳转新增教程（仅管理员） |

```
教程列表页
├── 分类筛选栏（全部/基础动作/行进动作/仪式流程）
├── 教程卡片列表（标题 + 分类标签 + 摘要）
└── FAB "+" 按钮（仅管理员）
```

---

#### `pages/tutorial/detail/` — 教程详情

**导航栏标题**: 教程详情

以富文本格式展示教程正文，管理员可跳转编辑。

```
教程详情页
├── 标题 + 分类标签
├── 正文内容（content）
├── 注意要点（tips）
├── 常见错误（commonMistakes）
├── 小结（summary）
└── 编辑按钮（仅管理员）
```

---

#### `pages/tutorial/edit/` — 新增/编辑教程

**导航栏标题**: 新增教程 / 编辑教程

| 字段 | 必填 | 说明 |
|------|------|------|
| `title` | ✅ | 教程标题 |
| `category` | ✅ | 分类（基础动作/行进动作/仪式流程） |
| `content` | ✅ | 正文内容（textarea） |
| `tips` | ❌ | 注意要点 |
| `commonMistakes` | ❌ | 常见错误 |
| `summary` | ❌ | 小结 |

---

## 数据模型

### 成员 Member

```javascript
{
  id: String,           // 唯一 ID（generateId('member')）
  name: String,         // 姓名（必填）
  gender: String,       // 性别：'男' | '女'
  studentId: String,    // 学号
  college: String,      // 学院
  major: String,        // 专业
  grade: String,        // 年级
  className: String,    // 班级
  phone: String,        // 手机号
  wechat: String,       // 微信号
  joinDate: String,     // 入队时间（YYYY-MM-DD）
  position: String,     // 职务：队长|副队长|旗手|护旗手|队员
  status: String,       // 状态：'在队' | '离队'
  remark: String        // 备注
}
```

### 训练任务 Training

```javascript
{
  id: String,
  title: String,        // 任务名称
  date: String,         // 日期（YYYY-MM-DD）
  time: String,         // 时间（HH:mm）
  location: String,     // 地点
  type: String,         // 类型：日常训练|专项训练|彩排|...
  createdBy: String,    // 创建人姓名
  description: String,  // 备注
  attendance: [         // 考勤数组
    {
      memberId: String,
      name: String,
      status: String    // '已到' | '迟到' | '缺勤' | '请假'
    }
  ]
}
```

### 升降旗任务 FlagCeremony

```javascript
{
  id: String,
  title: String,
  date: String,
  time: String,
  type: String,         // '升旗' | '降旗'
  location: String,
  createdBy: String,
  description: String,
  attendance: [
    {
      memberId: String,
      name: String,
      status: String    // '正常' | '迟到' | '缺席' | '请假'
    }
  ]
}
```

### 动作教程 Tutorial

```javascript
{
  id: String,
  title: String,        // 教程标题
  category: String,     // 分类：基础动作|行进动作|仪式流程
  createdBy: String,    // 创建人
  content: String,      // 正文内容
  tips: String,         // 注意要点
  commonMistakes: String, // 常见错误
  summary: String       // 小结
}
```

---

## 权限设计

项目使用简单的两级权限控制，所有权限判断通过 `storage.isAdmin()` 完成。

| 功能 | 普通成员 | 管理员 |
|------|---------|--------|
| 查看列表 | ✅ | ✅ |
| 查看详情 | ✅ | ✅ |
| 修改考勤状态 | ❌ | ✅ |
| 创建任务 | ❌ | ✅ |
| 新增/编辑成员 | ❌ | ✅ |
| 新增/编辑教程 | ❌ | ✅ |
| 删除任何内容 | ❌ | ✅ |
| 切换他人身份 | ❌ | ✅ |

---

## 样式规范

### 主色系

| 用途 | 颜色值 |
|------|--------|
| 主色（导航栏、主按钮） | `#8B0000` / `#C41A1A` |
| 成功/正常/在队 | `#07C160` |
| 警告/迟到 | `#FFA500` |
| 危险/缺席/缺勤 | `#EE0000` |
| 请假 | `#576B95` |
| 卡片背景 | `#FFFFFF` |
| 页面背景 | `#F5F5F5` |

### 考勤状态颜色

WXML 中直接通过 `style` 属性绑定颜色，修改颜色需同时修改：
1. `utils/util.js` 的 `getStatusColor` 函数
2. 各 detail.wxml 的 `statusColors` 对象（在 detail.js 的 `data` 中）
3. 各 detail.wxml 中硬编码的 `style="color: xxx"` 属性

---

## 常见修改指引

### 修改初始 Mock 数据
编辑 `mock/data.js`，然后在小程序个人中心点击「重置数据」即可生效。

### 新增一种考勤状态
1. `utils/util.js` → `calcAttendanceStats` 的 `keyMap` 增加映射
2. `utils/util.js` → `getStatusColor` 增加颜色映射
3. 对应页面的 `detail.js` → `statusColors` 增加映射
4. 对应页面的 `detail.wxml` → 统计区块增加一个 `stat-box`，考勤明细增加一个状态按钮

### 新增一个模块页面
1. 在 `pages/` 下创建新目录和 4 个文件
2. 在 `app.json` 的 `pages` 数组中注册路由
3. 在 `utils/storage.js` 的 `KEYS` 中添加新的存储键
4. 在 `mock/data.js` 中添加对应初始数据
5. 在首页 `pages/index/index.js` 和 `index.wxml` 中添加入口

### 修改应用主色
全局搜索 `#C41A1A`、`#8B0000`，统一替换为新颜色。

### 接入真实后端
仅需修改 `utils/storage.js`，将 `wx.getStorageSync/setStorageSync` 替换为 `wx.request` 网络请求，页面代码无需改动。
