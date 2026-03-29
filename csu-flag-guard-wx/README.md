# 中南大学国旗班管理小程序

基于微信原生小程序和微信云开发构建的内部管理系统，覆盖成员档案、训练考勤、升降旗考勤、补训登记、部门管理、人物志、动作教程、办公室资料管理等场景。

当前版本已经从“本地缓存 + Mock 数据”迁移为“微信小程序前端 + 云数据库 + 云存储 + 云函数”的架构：

- `mock/data.js` 仅用于首批初始化示例数据
- 业务数据主存储在云数据库
- 图片、PDF、Word、Excel 等文件主存储在 CloudBase 云存储
- 高频列表和统计已逐步下沉到云函数，减少前端整库读取
- 个人中心的“清除本地缓存”只清本地登录态和缓存，不会删除云数据库数据

## 当前功能概览

### 1. 首页与权限

- 首页包含训练考勤、升降旗考勤、成员档案、动作教程等基础入口
- `人物志` 对全体成员可见
- 管理员额外可见：
  - `部门管理`
  - 各类创建与编辑入口
- 普通成员额外可见：
  - `部门工作`
- 个人中心中：
  - `切换身份` 仅干部可见
  - `清除本地缓存` 仅管理员可见
  - `人员去重` 仅管理员可见

### 2. 成员档案管理

- 支持成员新增、编辑、删除、搜索
- 支持按 `全部 / 在队 / 离队` 筛选
- 支持下拉刷新
- 支持批量调整成员状态：
  - 批量入队
  - 批量离队
- 支持 Excel 导入成员
- 支持管理员一键将已有账号密码重置为学号
- 支持管理员在个人中心执行 `人员去重`
- 登录支持使用：
  - `学号 + 密码`
  - `手机号 + 密码`

成员初始密码规则：

- 有学号：初始密码 = 学号
- 无学号但有手机号：初始密码 = 手机号
- 学号和手机号都为空：回退为 `123456`

历史上缺少 `password` 字段的成员，系统会自动补默认密码。

成员字段中已接入：

- 多选职务 `position`
- 部门字段 `department`
- 入队时间
- 状态 `在队 / 离队`

成员列表与创建任务时的排序规则已经统一：

- 先按年级升序，老成员在前
- 同年级内按 `干部 -> 特殊岗 -> 普通成员`
- 干部优先级：
  - `班长`
  - `副班长`
  - `办公室主任`
  - `特勤部部长`
  - `宣传部部长`
  - `财务部部长`
- 特殊岗优先级：
  - `擎旗手`
  - `撒旗手`
  - `升旗手`
  - `指挥员`

### 3. 训练考勤

- 训练类型固定为：
  - `例训`
  - `补训`
- 创建训练时仅显示 `在队` 成员
- 训练列表按日期和时间倒序显示：
  - 日期晚的在前
  - 同一天中时间晚的在前
- 训练详情页支持管理员直接修改考勤状态
- 训练标题存在历史脏数据时，会结合标题文字自动归类：
  - 标题含 `例训` 自动归入 `例训`
  - 标题含 `补训` 自动归入 `补训`

考勤状态支持：

- `已到`
- `迟到`
- `缺勤`
- `请假`

### 4. 补训系统

补训系统已经和训练请假记录打通。

- 个人中心新增 `我的补训`
- 当成员在训练考勤中存在 `请假` 记录时，会自动进入补训统计
- 当前补训状态包括：
  - `待补训`
  - `待参加`
  - `已登记补训`
- 只允许选择“今天之后”的补训日程
- 只允许关联训练类型为 `补训` 的训练
- 支持取消已选补训

补训创建与参与规则：

- 创建 `补训` 任务时无需预先选择成员
- 初始参与人数为 `0`
- 成员在自己的 `我的补训` 中选择某个补训日程后，会自动加入该补训日程名单
- 补训日程详情页支持成员点击 `参加补训`
  - 若本人存在未补训记录，可选择关联一条请假记录
  - 若本人没有待补训记录，则提示无需补训

管理员补训补登：

- 在补训日程详情页底部，管理员可见 `记录补登`
- 可为任意存在未补训记录、且尚未预约补训的成员补登
- 选择成员后，可选择一条未与任何补训关联的请假记录
- 关联后会把该成员记入当前补训日程，并视为本次补训已补登完成

### 5. 升降旗考勤

- 升旗任务支持双分组展示：
  - `队列成员`
  - `观礼成员`
- 当前兼容逻辑：
  - 新建升旗任务时，勾选的为队列成员
  - 其余在队成员自动归入观礼成员
- 降旗任务不显示观礼栏，只记录上岗成员
- 创建升降旗任务时只显示 `在队` 成员
- 升降旗列表同样按日期、时间倒序显示
- 个人中心中的 `我的升降旗记录` 仅显示与本人相关的记录

### 6. 部门管理与部门工作

管理员可见 `部门管理`，普通成员可见 `部门工作`。

当前部门包括：

- `办公室`
- `特勤部`
- `财务部`
- `宣传部`

成员部门来自成员档案中的 `department` 字段：

- `办公室成员`
- `财务部成员`
- `特勤部成员`
- `宣传部成员`

各部门页面均已接入 `部门成员概览`：

- 仅统计 `在队` 成员
- 自动忽略离队成员
- 排序遵循成员统一排序规则

普通成员进入 `部门工作` 时：

- 若尚未分配部门，会显示等待提示
- 若已分配部门，会进入对应部门页并显示当前占位内容

#### 办公室

办公室当前已接入三个模块：

1. `发布任务`

- 支持管理员发布办公室任务
- 可填写：
  - 任务名称
  - 指派成员
  - 截止日期
- 普通办公室成员会在 `部门工作 -> 办公室` 中看到自己的：
  - 待完成任务
  - 已完成任务
- 成员点击任务后可上传文件提交
- 当前支持提交的文件类型包括：
  - PDF
  - Word
  - Excel
  - PPT
  - CSV
- 管理员可在办公室任务管理页查看任务进度、已完成任务与成员提交文件
- 元数据写入 `office_tasks`

2. `会议记录`

- 支持上传 PDF 会议记录
- 上传时可手动输入记录名称
- 文件上传至 CloudBase 云存储
- 元数据写入 `meeting_records`

3. `基础资料`

- 支持上传常见办公文件：
  - PDF
  - Word
  - Excel
  - PPT
  - CSV
- 无需手动重命名
- 列表中显示原始文件名
- 文件上传至 CloudBase 云存储
- 元数据写入 `office_materials`

#### 特勤部

特勤部当前已接入：

1. `补训记录`

- 管理员可查看全体在队成员的补训汇总
- 列表展示：
  - `待补训`
  - `待参加`
  - `总次数`
- 当前排序规则：
  1. `待补训` 降序
  2. `待参加` 降序
  3. `总次数` 降序
  4. 年级更老的在前

2. `补训日程管理`

- 直接跳转到训练考勤中的 `补训` 视图

3. `补训记录 Excel 导出`

- 入口位于补训记录页右上角
- 导出表格规则如下：
  - `A` 列第 `2` 行开始为在队成员姓名
  - 第 `1` 行从 `B` 列开始为全部 `例训` 日期
  - 若成员在某次 `例训` 中 `请假` 且未关联补训，对应格子红色填充
  - 若该请假记录已关联补训，则对应格子绿色填充，并写入关联补训日期
- 导出由云函数 `makeupExport` 生成 `.xlsx` 文件

### 7. 人物志

首页 `人物志` 入口对全体成员可见。

当前结构：

- 年级目录从 `2023级` 到 `2012级`
- 额外包含 `18届`
- 年级页使用双列卡片布局
- 每页显示 8 个“封面图 + 人名”组合
- 点击卡片进入该人物详情页
- 管理员可以看到所有年级
- 普通成员只会看到“已有内容”的年级

人物志详情与编辑：

- 详情页右上角提供 `编辑` 入口
- 编辑页可修改：
  - 人名
  - 人物志正文
  - 封面图
  - 配图
- 封面图单独存储，不占配图数量
- 每篇人物志支持：
  - `1` 张封面图
  - 最多 `9` 张配图
  - 总计最多 `10` 张图片
- 若未单独上传封面，则默认显示第一张配图作为封面
- 管理员在年级页可使用多选并批量删除人物志

人物志图片方案：

- 图片本体存入 CloudBase 云存储
- 云数据库只保存图片元数据和 `fileID`
- 当前目录规则：
  - `chronicles/{gradeYear}/{chronicleId}/cover_*.jpg`
  - `chronicles/{gradeYear}/{chronicleId}/{timestamp}_{index}.jpg`

人物志导入方式：

1. 年级页批量导入

- 读取首个工作表
- `A` 列：姓名
- `B` 列：人物志正文
- 需同时上传一个 ZIP 图片包
- ZIP 中图片会按姓名进行匹配
- 每人最多导入 `9` 张配图

2. 编辑页单条导图

- 在单则人物志编辑页支持 `ZIP 导图`
- ZIP 中图片无需命名
- 导入后会直接挂到当前人物志
- 最多导入剩余可用配图名额

### 8. 动作教程

动作教程现在固定分为 3 个子表：

- `基础动作重点`
- `特殊岗动作`
- `升旗队列流程`

兼容逻辑：

- 历史上的旧分类内容会自动归并到 `基础动作重点`
- 现存旧数据会在初始化过程中自动标准化

权限规则：

- 管理员可新增、编辑、删除任意教程
- 特殊岗成员可新增、编辑、删除 `特殊岗动作` 分类内的教程
- 普通成员仅可浏览

## 云开发架构

### 云数据库集合

当前项目使用以下集合：

- `members`
- `trainings`
- `flag_ceremonies`
- `tutorials`
- `chronicles`
- `meeting_records`
- `office_materials`
- `office_tasks`

### 云存储目录

- 人物志图片：
  - `chronicles/{gradeYear}/{chronicleId}/...`
- 会议记录：
  - `meeting-records/{department}/...`
- 办公室基础资料：
  - `office-materials/office/...`
- 办公室任务提交文件：
  - `office-tasks/{taskId}/...`
- 补训导出文件：
  - `exports/makeup/...`

### 云函数

当前项目使用以下云函数：

#### 1. `memberImport`

用途：

- Excel 批量导入成员
- 默认按批次导入，减轻超时风险

#### 2. `memberManage`

用途：

- 编辑成员
- 批量修改成员状态
- 删除成员
- 人员去重
- 批量重置密码为学号
- 处理成员相关写入逻辑

#### 3. `chronicleImport`

用途：

- Excel + ZIP 批量导入人物志
- 单则人物志编辑页 ZIP 配图导入

#### 4. `listQuery`

用途：

- 高频列表分页查询
- 个人记录查询
- 补训汇总与筛选
- 人物志分页
- 办公室资料分页

当前已下沉到 `listQuery` 的场景包括：

- 成员档案列表
- 训练考勤列表
- 升降旗考勤列表
- 个人训练记录
- 个人升降旗记录
- 我的补训
- 特勤部补训记录
- 人物志年级列表
- 会议记录列表
- 办公室基础资料列表

#### 5. `makeupExport`

用途：

- 导出特勤部补训记录 Excel

依赖：

- `exceljs`
- `wx-server-sdk`

部署时请使用“上传并部署：云端安装依赖”。

#### 6. `officeTaskManage`

用途：

- 办公室任务发布
- 办公室任务列表与详情查询
- 成员提交任务文件

## 权限与角色

### 支持的职务

当前成员职务支持多选，选项如下：

- `班长`
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

### 自动拥有管理员权限的职务

- `班长`
- `副班长`
- `办公室主任`
- `特勤部部长`
- `财务部部长`
- `宣传部部长`

## 关键数据说明

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

### Chronicle

```js
{
  id: String,
  gradeYear: String,
  gradeLabel: String,
  personName: String,
  content: String,
  coverImage: {
    imageId: String,
    fileID: String,
    sortOrder: Number,
    caption: String,
    fileName: String,
    uploadedAt: Number
  },
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
  sortOrder: Number,
  createdAt: Number,
  updatedAt: Number
}
```

### Tutorial

```js
{
  id: String,
  title: String,
  category: '基础动作重点' | '特殊岗动作' | '升旗队列流程',
  content: String,
  tips: String,
  commonMistakes: String,
  summary: String,
  createdBy: String,
  createdAt: Number,
  updatedAt: Number
}
```

## Excel 模板与导入导出说明

### 成员 Excel 导入

成员导入模板列定义如下：

- `A` 列：姓名
- `B` 列：性别
- `C` 列：学号
- `D` 列：学院
- `E` 列：专业
- `F` 列：年级
- `G` 列：班级
- `H` 列：部门
- `I` 列：手机号

导入规则：

- 除姓名外，其余列允许留空
- 微信号默认等于手机号
- 默认身份为 `队员`
- 默认状态为 `在队`
- 有学号时初始密码为学号
- 无学号时初始密码为手机号
- 两者都为空时回退为 `123456`
- 入队时间在导入页统一选择

### 人物志 Excel 导入

- 只读取首个工作表
- `A` 列：姓名
- `B` 列：人物志正文
- 需配合 ZIP 图片包一起上传
- ZIP 中图片按姓名自动匹配到对应人物志
- 每人最多导入 `9` 张配图

### 人物志编辑页 ZIP 导图

- 针对当前单条人物志直接导入图片
- ZIP 中图片无需命名
- 不影响单独封面设置
- 最多导入剩余配图名额

### 特勤部补训记录 Excel 导出

导出表格为二维矩阵：

- 第一列：在队成员姓名
- 第一行：所有 `例训` 日期
- 红色单元格：该成员在该次 `例训` 中请假且未关联补训
- 绿色单元格：该请假记录已关联补训，并在格子中写入补训日期

## 初始化与数据安全

### 初始化机制

- 应用启动时会执行初始化逻辑
- 若云数据库集合为空，则将 `mock/data.js` 中的初始示例数据写入云数据库
- 若云数据库已有数据，则不会重复覆盖

### 清除本地缓存

个人中心的 `清除本地缓存`：

- 只清本地登录态和本地缓存
- 不删除云数据库中的成员、训练、升降旗、人物志、教程、资料
- 不删除云存储中的图片和文件

## 开发与部署

### 1. 绑定云环境

1. 使用微信开发者工具打开项目
2. 打开顶部 `云开发`
3. 创建或绑定云环境
4. 确保 `project.config.json` 中的 `cloudfunctionRoot` 指向 `cloudfunctions`

### 2. 创建云数据库集合

请在云数据库中创建以下集合：

- `members`
- `trainings`
- `flag_ceremonies`
- `tutorials`
- `chronicles`
- `meeting_records`
- `office_materials`
- `office_tasks`

### 3. 部署云函数

请在微信开发者工具中依次右键上传并部署以下云函数，建议统一选择“云端安装依赖”：

- `cloudfunctions/memberImport`
- `cloudfunctions/memberManage`
- `cloudfunctions/chronicleImport`
- `cloudfunctions/listQuery`
- `cloudfunctions/makeupExport`
- `cloudfunctions/officeTaskManage`

### 4. 云存储权限建议

开发调试阶段可先设置为：

- 云数据库：开发环境可读写
- 云存储：允许小程序端上传、读取、删除

正式使用时建议再按权限细化：

- 普通成员只读
- 管理员可写
- 对关键写操作逐步收口到云函数

## 目录结构

```text
csu-flag-guard-wx/
├── app.js
├── app.json
├── app.wxss
├── CLOUD_DATABASE_SETUP.md
├── mock/
│   └── data.js
├── utils/
│   ├── storage.js
│   ├── util.js
│   ├── makeup.js
│   ├── chronicle.js
│   ├── meeting-record.js
│   ├── office-material.js
│   └── office-task.js
├── cloudfunctions/
│   ├── memberImport/
│   ├── memberManage/
│   ├── chronicleImport/
│   ├── listQuery/
│   ├── makeupExport/
│   └── officeTaskManage/
└── pages/
    ├── index/
    ├── login/
    ├── mine/
    ├── member/
    ├── training/
    ├── flag/
    ├── department/
    ├── chronicle/
    └── tutorial/
```

## 补充说明

- 旧训练类型会自动兼容为 `例训 / 补训`
- 旧教程分类会自动兼容到新的三分类体系
- 若训练中的请假状态被改回非请假，关联的补训信息会自动清理，避免脏数据
- 人物志图片、会议记录、办公室资料均依赖云存储，文档删除与文件删除建议保持同步操作

更多云环境接入细节可参考：

- [CLOUD_DATABASE_SETUP.md](./CLOUD_DATABASE_SETUP.md)
