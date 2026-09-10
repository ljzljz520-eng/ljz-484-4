# 漫画分镜脚本工具

一个给漫画作者使用的轻量分镜脚本工具，包含：

- **作者工作台**：新增 / 编辑作品、话数，为每话编写分镜（画幅、场景、画面描述）与对白（对白 / 内心独白 / 旁白 / 音效），支持分镜与台词的增删和排序。
- **草稿 / 发布机制**：话数默认为**草稿**，只留在作者工作台；点击「发布」后才进入**读者预览**，也可随时撤回到草稿。
- **读者预览**：只展示已发布的作品与话数，以漫画格子的形式阅读分镜与台词。

零数据库依赖，数据以 JSON 文件存储。

## 目录结构

```
.
├── server/                 # 服务端（Node.js + Express，REST API）
│   ├── server.js           # API 入口（同时托管 web/ 静态文件）
│   ├── seed.js             # 示例数据初始化脚本
│   ├── lib/
│   │   └── db.js           # JSON 文件数据读写层
│   ├── data/
│   │   ├── seed.json       # ★ 示例数据（随仓库提供，只读的"出厂数据"）
│   │   └── db.json         # 运行时数据（首次启动自动从 seed.json 生成）
│   └── package.json
└── web/                    # 网页端（原生 HTML/CSS/JS，无构建步骤）
    ├── index.html
    ├── css/style.css
    └── js/
        ├── api.js          # API 封装
        └── app.js          # 路由 + 读者预览 + 作者工作台 + 分镜编辑器
```

## 示例数据在哪里

- 出厂示例：[`server/data/seed.json`](server/data/seed.json)，包含两部示例漫画：
  - 《星尘信使》（科幻 / 冒险）：2 话已发布 + 1 话草稿；
  - 《夜雨食堂》（治愈 / 日常）：1 话已发布 + 1 话草稿。
- 运行数据：`server/data/db.json`。首次启动服务时若不存在，会自动从 `seed.json`
  复制生成；页面上的所有增删改都写入这个文件。

## 启动方式

需要 Node.js 18+（自带 `fetch`；开发环境使用 Node.js 20 验证）。

### 方式一：只启动服务端（推荐，开箱即用）

服务端会同时把 `web/` 目录作为静态站点托管，前后端同源，无需跨域配置：

```bash
cd server
npm install
npm start
```

然后浏览器打开：

| 入口 | 地址 |
| --- | --- |
| 网页端 | http://localhost:4000/ |
| 读者预览 | http://localhost:4000/#/reader |
| 作者工作台 | http://localhost:4000/#/author |

可用 `PORT=3001 npm start` 修改端口。

### 方式二：网页端独立静态服务器（前后端分离）

```bash
# 终端 1：API 服务
cd server
npm install
npm start                       # http://localhost:4000/api

# 终端 2：静态文件服务（任选其一）
cd web
npx http-server -p 8080
# 或：python3 -m http.server 8080
```

打开 http://localhost:8080/ 。

如两端不同源，请把网页端的 API 地址改成完整地址：编辑
[`web/js/api.js`](web/js/api.js) 顶部：

```js
const API_BASE = 'http://localhost:4000';
```

## 重置示例数据

```bash
cd server
npm run seed      # 仅当 data/db.json 不存在时写入示例数据
npm run reset     # 用 data/seed.json 强制覆盖 data/db.json（慎用，会丢失改动）
```

## 使用说明

1. 打开 **作者工作台**，点「＋ 新增作品」创建作品（标题、作者、类型、简介）。
2. 进入作品，点「＋ 新增话数」。新话数默认是**草稿**状态。
3. 点「编辑分镜」进入分镜编辑器：
   - 添加分镜：设置画幅（小格 / 中格 / 大格）、场景镜头与画面描述；
   - 每个分镜下可添加多条台词，类型可选：**对白 / 内心独白 / 旁白 / 音效**，
     并填写角色名；
   - 分镜可上移 / 下移 / 删除；
   - 点「💾 保存草稿」只保存在工作台，读者看不到。
4. 编辑完成后点「保存并发布」（或在话数列表点「发布」），该话立即出现在
   **读者预览**中；点「撤回到草稿」则重新对读者隐藏。

> 读者侧接口（`/api/public/*`）只会返回 `status = published` 的话数；
> 草稿只通过作者侧接口（`/api/author/*`）返回。

## API 一览

### 读者（仅已发布）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/public/works` | 作品列表（只含有已发布话数的作品） |
| GET | `/api/public/works/:workId` | 作品详情及已发布话数目录 |
| GET | `/api/public/works/:workId/chapters/:chapterId` | 阅读单话 |

### 作者（含草稿）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/author/works` | 全部作品（含草稿话数） |
| POST | `/api/author/works` | 新增作品 |
| PUT | `/api/author/works/:workId` | 修改作品信息 |
| DELETE | `/api/author/works/:workId` | 删除作品（连同话数） |
| GET | `/api/author/works/:workId/chapters/:chapterId` | 话数详情（含草稿） |
| POST | `/api/author/works/:workId/chapters` | 新增话数（默认草稿） |
| PUT | `/api/author/works/:workId/chapters/:chapterId` | 保存话数（分镜 / 对白 / 状态） |
| POST | `/api/author/works/:workId/chapters/:chapterId/publish` | 发布 |
| POST | `/api/author/works/:workId/chapters/:chapterId/unpublish` | 撤回到草稿 |
| DELETE | `/api/author/works/:workId/chapters/:chapterId` | 删除话数 |

## 数据模型（摘要）

```jsonc
{
  "works": [
    {
      "id": "w_xxx",
      "title": "作品标题",
      "author": "作者",
      "genre": "类型",
      "summary": "简介",
      "chapters": [
        {
          "id": "c_xxx",
          "chapterNo": 1,
          "title": "第一话：……",
          "status": "draft | published",
          "synopsis": "本话梗概",
          "panels": [
            {
              "size": "small | medium | large",
              "scene": "场景 / 镜头",
              "description": "画面描述",
              "dialogues": [
                { "type": "dialogue | thought | narration | sfx",
                  "speaker": "角色名", "text": "台词" }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```
