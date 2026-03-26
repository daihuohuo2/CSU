# 中南大学国旗班管理小程序

> 微信原生小程序  
> AppID: `wxa9de6e6a3fbfc0bc`  
> 基础库版本: `3.15.0`

面向中南大学国旗班内部使用的管理工具，覆盖成员档案、训练考勤、升降旗考勤、部门管理、人物志、动作教程、补训登记等场景。

当前版本已经完成从“本地缓存 + Mock 数据”到“微信云开发 + 云数据库”的迁移：

- `mock/data.js` 只负责初始示例数据
- 业务数据实际写入微信云数据库，人物志图片写入 CloudBase 云存储
- 清除小程序缓存后，成员、任务、教程等业务数据不会丢失
- 登录态仍保存在本地缓存，清缓存后需要重新登录

---

## 当前版本概览

### 已上线模块

- 成员档案管理
  - 支持新增、编辑、删除、搜索、批量入队/离队
  - 支持 Excel 批量导入成员
  - 成员职务为多选
- 训练考勤
  - 训练类型为 `例训` / `补训`
  - 创建训练时只显示在队成员
  - 支持详情页直接改考勤状态
- 升降旗考勤
  - 升旗任务支持“队列成员 / 观礼成员”双分组
  - 降旗任务只记录上岗成员，不显示观礼栏
  - 创建任务时只显示在队成员
- 部门系统
  - 管理员可见“部门管理”
  - 普通成员可见“部门工作”
  - 特勤部已接入“补训记录”模块
- 人物志
  - 管理员可按年级维护人物志
  - 支持手动新增、编辑、Excel 导入文本
  - 支持为每则人物志上传最多 9 张图片
  - 图片本体存入 CloudBase 云存储，数据库只存图片元数据
- 补训系统
  - 个人中心可查看“我的补训”
  - 训练考勤里本人为 `请假` 的记录会生成补训项
  - 可为请假记录登记未来日期的补训日程
  - 支持取消已选补训
- 动作教程
  - 支持分类查看、编辑、新增

### 当前数据存储方式

- 云数据库集合
  - `members`
  - `trainings`
  - `flag_ceremonies`
  - `chronicles`
  - `tutorials`
- 云存储目录
  - `chronicles/{gradeYear}/{chronicleId}/...`
- 云函数
  - `memberImport`
  - `memberManage`
  - `chronicleImport`

---

## 技术栈

- 微信原生小程序
- 微信云开发
- 微信云数据库
- 微信云函数
- 本地 Mock 初始数据

---

## 目录结构

```text
csu-flag-guard-wx/
├── app.js
├── app.json
├── app.wxss
├── project.config.json
├── CLOUD_DATABASE_SETUP.md
├── mock/
│   └── data.js
├── utils/
│   ├── storage.js
│   ├── util.js
│   └── makeup.js
├── cloudfunctions/
│   ├── memberImport/
│   ├── memberManage/
│   └── chronicleImport/
└── pages/
    ├── index/
    ├── login/
    ├── mine/
    ├── member/
    │   ├── list/
    │   ├── detail/
    │   ├── edit/
    │   └── import/
    ├── training/
    │   ├── list/
    │   ├── detail/
    │   ├── create/
    │   └── makeup/
    │       ├── list/
    │       └── select/
    ├── flag/
    │   ├── list/
    │   ├── detail/
    │   └── create/
    ├── department/
    │   ├── list/
    │   ├── work/
    │   └── security/
    │       ├── list/
    │       └── makeup/
    │           ├── list/
    │           └── detail/
    ├── chronicle/
    │   ├── list/
    │   ├── grade/
    │   └── edit/
    └── tutorial/
        ├── list/
        ├── detail/
        └── edit/
```

---

## 页面说明

### 首页

路径：`pages/index/index`

- 未登录时显示登录提示
- 已登录时显示用户身份
- 功能入口包括：
  - 训练考勤
  - 升降旗考勤
  - 成员档案
  - 人物志（仅管理员）
  - 动作教程
  - 部门管理（仅管理员）
  - 部门工作（仅普通成员）
- 管理员首页还提供快捷创建入口

### 登录页

路径：`pages/login/login`

- 使用 `学号 + 密码` 登录
- 登录逻辑基于云数据库成员表校验
- 默认初始密码为 `123456`

### 个人中心

路径：`pages/mine/mine`

- 显示个人档案
- 显示“我的训练记录”“我的补训”“我的升降旗记录”
- “我的补训”会显示：
  - `待补训`
  - `待参加`
  - `暂无补训`
- 仍保留切换身份、清除本地缓存、退出登录功能

### 成员档案

路径：`pages/member/*`

- 成员列表支持：
  - 搜索姓名/学号
  - 按在队/离队筛选
  - 下拉刷新
  - 批量调整状态
- 成员排序规则：
  - 全部视图中 `在队` 在前，`离队` 在后
  - 同状态下按年级升序
  - 同年级下按干部优先级排序
- 成员编辑页支持：
  - 多选职务
  - 选择部门
  - Excel 导入入口

### 训练考勤

路径：`pages/training/*`

- 训练分类只有：
  - `例训`
  - `补训`
- 创建训练时只显示在队成员
- 训练详情支持管理员直接修改考勤状态
- 补训系统与训练请假记录直接关联

### 我的补训

路径：

- `pages/training/makeup/list/list`
- `pages/training/makeup/select/select`

规则如下：

- 只统计当前登录成员在训练考勤中的 `请假` 记录
- 未登记补训：显示 `待补训`
- 已登记未来日期补训：显示 `待参加`
- 已登记且补训日期已到：显示 `已登记补训`
- 只能选择“今天之后”的补训日程
- 只能选择训练类型为 `补训` 的训练
- 支持取消已选补训

### 升降旗考勤

路径：`pages/flag/*`

- 升旗详情页可按“队列成员 / 观礼成员”展示
- 升旗创建页中：
  - 勾选上岗成员后，其余在队成员自动作为观礼成员
- 降旗创建页中：
  - 不显示观礼栏
  - 只记录上岗成员

### 部门管理

路径：`pages/department/*`

- 管理员入口：`部门管理`
- 普通成员入口：`部门工作`
- 普通成员若未分配部门，会显示等待提示
- 当前真正接入功能的部门为：
  - `特勤部`

#### 特勤部补训记录

路径：

- `pages/department/security/list/list`
- `pages/department/security/makeup/list/list`
- `pages/department/security/makeup/detail/detail`

管理员可在这里：

- 查看全体在队成员的补训统计
- 查看待补训 / 待参加 / 总次数
- 进入单个成员详情查看全部补训相关内容

排序规则：

1. 补训总次数多的在前
2. 若总次数相同，则老年级在前
3. 若年级相同，则入队更早的在前

### 人物志

路径：`pages/chronicle/*`

- 首页仅管理员可见“人物志”入口
- 年级菜单从 `2023级` 到 `2012级`
- 年级页每页展示 5 则人物志
- 右下角 `+` 可新增人物志
- 每则人物志右上角提供“编辑”入口
- 正文按长文本展示并保留换行
- 每则人物志最多可上传 9 张图片
- 图片显示在正文下方，可点击预览
- Excel 导入仍然只读取 A 列文本，不导入图片

### 动作教程

路径：`pages/tutorial/*`

- 支持分类筛选
- 管理员可新增、编辑教程

---

## 成员字段说明

### 部门字段

当前支持：

- `办公室成员`
- `财务部成员`
- `特勤部成员`
- `宣传部成员`

### 职务字段

当前 `position` 为数组，多选可用选项如下：

- `班长`
- `超级牛逼雷霆之人`
- `副班长`
- `办公室主任`
- `特勤部部长`
- `财务部部长`
- `宣传部部长`
- `擎旗手`
- `撒旗手`
- `升旗手`
- `指挥员`
- `队员`

### 管理员职务

以下职务自动拥有管理员权限：

- `班长`
- `超级牛逼雷霆之人`
- `副班长`
- `办公室主任`
- `特勤部部长`
- `财务部部长`
- `宣传部部长`

---

## 核心数据模型

### Member

```js
{
  id: String,
  name: String,
  gender: String,
  studentId: String,
  password: String,
  college: String,
  major: String,
  grade: String,
  className: String,
  department: String,
  phone: String,
  wechat: String,
  joinDate: String,
  position: String[],
  status: '在队' | '离队',
  remark: String,
  createdAt: Number,
  updatedAt: Number
}
```

### Training

```js
{
  id: String,
  title: String,
  type: '例训' | '补训',
  date: String,
  time: String,
  location: String,
  description: String,
  createdBy: String,
  attendance: [
    {
      memberId: String,
      name: String,
      status: '已到' | '迟到' | '缺勤' | '请假',
      makeupTrainingId?: String,
      makeupTrainingTitle?: String,
      makeupTrainingDate?: String,
      makeupTrainingTime?: String,
      makeupTrainingLocation?: String,
      makeupAssignedAt?: Number
    }
  ],
  createdAt: Number,
  updatedAt: Number
}
```

### FlagCeremony

```js
{
  id: String,
  title: String,
  type: '升旗' | '降旗',
  date: String,
  time: String,
  location: String,
  description: String,
  createdBy: String,
  queueMemberIds: String[],
  audienceMemberIds: String[],
  attendance: [
    {
      memberId: String,
      name: String,
      status: '正常' | '迟到' | '缺席' | '请假'
    }
  ],
  createdAt: Number,
  updatedAt: Number
}
```

### Tutorial

```js
{
  id: String,
  title: String,
  category: String,
  createdBy: String,
  content: String,
  tips: String,
  commonMistakes: String,
  summary: String,
  createdAt: Number,
  updatedAt: Number
}
```

### Chronicle

```js
{
  id: String,
  gradeYear: String,
  gradeLabel: String,
  content: String,
  coverFileId: String,
  images: [
    {
      imageId: String,
      fileID: String,
      sortOrder: Number,
      caption: String,
      fileName: String,
      uploadedAt: Number
    }
  ],
  createdAt: Number,
  updatedAt: Number,
  sortOrder: Number
}
```

---

## 云开发说明

### 云数据库集合

需要创建以下集合：

- `members`
- `trainings`
- `flag_ceremonies`
- `chronicles`
- `tutorials`

### 云函数

#### `memberManage`

用途：

- 编辑成员
- 批量修改成员状态（在队 / 离队）

#### `memberImport`

用途：

- Excel 批量导入成员
- 按批次导入，默认每批 5 行

#### `chronicleImport`

用途：

- Excel 批量导入人物志文本
- 只读取首个工作表的 A 列
- 每个非空单元格生成一则人物志
- 不导入图片

### 云存储

人物志图片使用 CloudBase 云存储，不单独建图片表。

- 图片本体：存入云存储
- 图片元数据：存入 `chronicles.images`
- 推荐目录：`chronicles/{gradeYear}/{chronicleId}/...`
- 人物志图片属于长期文件
- Excel 导入时产生的临时文件会在导入完成后自动删除

### 如何进行云开发对接

#### 1. 创建并绑定云环境

1. 在微信开发者工具中打开项目
2. 点击顶部 `云开发`
3. 创建或选择一个云环境
4. 确认当前项目绑定到了该环境

#### 2. 创建云数据库集合

在云数据库中创建：

- `members`
- `trainings`
- `flag_ceremonies`
- `chronicles`
- `tutorials`

说明：

- `chronicles` 不需要手动建字段
- 人物志图片不存数据库二进制，只在文档里保存 `fileID`

#### 3. 部署云函数

在 `cloudfunctions` 目录中右键上传并部署：

- `memberImport`
- `memberManage`
- `chronicleImport`

建议统一选择“上传并部署：云端安装依赖”。

#### 4. 人物志图片上传的工作方式

当前人物志图片不依赖额外云函数，页面直接使用：

- `wx.cloud.uploadFile` 上传图片
- `wx.cloud.getTempFileURL` 获取展示用临时链接
- `wx.cloud.deleteFile` 删除被移除图片

#### 5. 云存储目录规则

当前代码使用的持久化目录规则为：

- `chronicles/{gradeYear}/{chronicleId}/{timestamp}_{index}.jpg`

说明：

- 不需要手动先创建文件夹
- 上传时云存储会自动生成逻辑目录
- 数据库里只保存 `fileID`、排序和文件名等元数据

#### 6. 权限建议

开发调试阶段可以先设置为：

- 云数据库：测试成员可读写
- 云存储：允许小程序端上传、读取、删除

如果后续准备正式上线，建议再收紧为：

- 普通成员只读
- 管理员可写
- 或改成通过云函数统一处理人物志写入与删图

### 初始化机制

- 应用启动时会执行 `storage.initMockData()`
- 如果集合为空，则把 `mock/data.js` 中的初始数据灌入云数据库
- 如果集合已有数据，则不会重复覆盖

更详细的环境搭建说明见：

- [CLOUD_DATABASE_SETUP.md](./CLOUD_DATABASE_SETUP.md)

---

## Excel 导入说明

成员新增页右上角支持 `Excel导入`。

模板列说明：

- A 列：姓名
- B 列：性别
- C 列：学号
- D 列：学院
- E 列：专业
- F 列：年级
- G 列：班级
- H 列：部门
- I 列：手机号

导入规则：

- 微信号默认等于手机号
- 职务默认 `队员`
- 状态默认 `在队`
- 密码默认 `123456`
- 入队时间在导入页统一选择

### 人物志 Excel 导入

人物志年级页支持 `Excel导入`。

规则如下：

- 只读取首个工作表
- 只识别 A 列
- 每个非空单元格生成一则人物志正文
- 不会导入图片
- 导入后的人物志图片可再通过编辑页单独上传

---

## 权限说明

### 普通成员

- 查看训练、升降旗、成员、教程
- 查看部门工作
- 使用“我的补训”

### 管理员

- 拥有普通成员全部权限
- 创建训练任务
- 创建升降旗任务
- 新增/编辑/删除成员
- 新增/编辑教程
- 修改考勤状态
- 批量调整成员在队状态
- 进入部门管理
- 查看特勤部补训记录总览

---

## 开发说明

### 关键文件

- `utils/storage.js`
  - 数据访问入口
  - 云数据库 CRUD
  - 登录校验
  - 权限判断
- `utils/makeup.js`
  - 补训状态计算
  - 补训列表生成
  - 管理员补训汇总统计
- `mock/data.js`
  - 初始示例数据

### 运行前确认

1. 在微信开发者工具中打开项目
2. 确认已开通云开发并选择云环境
3. 创建 5 个数据库集合
4. 上传并部署：
   - `cloudfunctions/memberImport`
   - `cloudfunctions/memberManage`
   - `cloudfunctions/chronicleImport`

### 兼容逻辑

项目内保留了部分旧数据兼容处理：

- 旧训练类型会自动归并为 `例训 / 补训`
- 旧职务会自动映射到新职务体系

---

## 当前已知说明

- `mock/data.js` 修改后不会自动覆盖云数据库中的已有数据
- 个人中心的“清除本地缓存”只会清除本地登录态和历史缓存，不会影响云数据库
- 训练详情里若把某成员状态从 `请假` 改成其他状态，会自动清除该条补训登记，避免脏数据
- 补训登记当前是写回原训练记录的 `attendance` 项中，没有单独拆分独立集合
- 若需要删除云数据库或云存储中的人物志内容，需要单独手动操作；“清除本地缓存”不会触碰云端数据

---

## 后续可继续扩展的方向

- 补训完成确认与审核
- 各部门独立任务菜单
- 更细的数据库权限规则
- 报表导出
- 更完整的成员与任务统计看板
