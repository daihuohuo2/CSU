# 中南大学国旗班管理小程序

> 微信原生小程序  
> AppID: `wxa9de6e6a3fbfc0bc`  
> 基础库版本: `3.15.0`

面向中南大学国旗班内部使用的管理工具，覆盖成员档案、训练考勤、升降旗考勤、部门管理、动作教程、补训登记等场景。

当前版本已经完成从“本地缓存 + Mock 数据”到“微信云开发 + 云数据库”的迁移：

- `mock/data.js` 只负责初始示例数据
- 业务数据实际写入微信云数据库
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
  - `tutorials`
- 云函数
  - `memberImport`
  - `memberManage`

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
│   └── memberManage/
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
- 仍保留切换身份、重置数据、退出登录功能

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

---

## 云开发说明

### 云数据库集合

需要创建以下集合：

- `members`
- `trainings`
- `flag_ceremonies`
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
3. 创建 4 个数据库集合
4. 上传并部署：
   - `cloudfunctions/memberImport`
   - `cloudfunctions/memberManage`

### 兼容逻辑

项目内保留了部分旧数据兼容处理：

- 旧训练类型会自动归并为 `例训 / 补训`
- 旧职务会自动映射到新职务体系

---

## 当前已知说明

- `mock/data.js` 修改后不会自动覆盖云数据库中的已有数据
- 若想重新应用初始示例数据，可在个人中心执行“重置数据”
- 训练详情里若把某成员状态从 `请假` 改成其他状态，会自动清除该条补训登记，避免脏数据
- 补训登记当前是写回原训练记录的 `attendance` 项中，没有单独拆分独立集合

---

## 后续可继续扩展的方向

- 补训完成确认与审核
- 各部门独立任务菜单
- 更细的数据库权限规则
- 报表导出
- 更完整的成员与任务统计看板
