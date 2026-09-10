'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const db = require('./lib/db');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json({ limit: '2mb' }));

// 跨源支持：网页端用独立静态服务器（如 http://localhost:8080）托管时，
// 浏览器访问本 API 属于跨源请求，需要显式放行（含 OPTIONS 预检）。
app.use((req, res, next) => {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,PATCH,DELETE,OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    req.headers['access-control-request-headers'] || 'Content-Type'
  );
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// 简单请求日志
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// ---- 读者侧 API：只返回已发布话数 ----
function publicWork(work) {
  return {
    id: work.id,
    title: work.title,
    author: work.author,
    genre: work.genre,
    summary: work.summary,
    cover: work.cover,
    updatedAt: work.updatedAt,
    chapters: work.chapters
      .filter((c) => c.status === 'published')
      .map(publicChapter)
      .sort((a, b) => a.chapterNo - b.chapterNo),
  };
}

function publicChapter(chapter) {
  return {
    id: chapter.id,
    volumeNo: chapter.volumeNo,
    chapterNo: chapter.chapterNo,
    title: chapter.title,
    synopsis: chapter.synopsis,
    publishedAt: chapter.publishedAt,
    panels: chapter.panels,
  };
}

// 作品卡片列表（仅含有已发布话数的作品）
app.get('/api/public/works', (_req, res) => {
  const works = db
    .listWorks()
    .filter((w) => w.chapters.some((c) => c.status === 'published'))
    .map(publicWork);
  res.json({ works });
});

// 读者：作品详情（仅已发布话数）
app.get('/api/public/works/:workId', (req, res) => {
  const work = db.getWork(req.params.workId);
  if (!work || !work.chapters.some((c) => c.status === 'published')) {
    return res.status(404).json({ error: '没有找到该作品或尚未发布任何话数' });
  }
  res.json({ work: publicWork(work) });
});

// 读者：单话阅读（只能读到已发布）
app.get('/api/public/works/:workId/chapters/:chapterId', (req, res) => {
  const chapter = db.getChapter(req.params.workId, req.params.chapterId);
  if (!chapter || chapter.status !== 'published') {
    return res.status(404).json({ error: '该话数不存在或尚未发布' });
  }
  const work = db.getWork(req.params.workId);
  res.json({
    work: { id: work.id, title: work.title, author: work.author },
    chapter: publicChapter(chapter),
  });
});

// ---- 作者工作台 API：作品 + 全部话数（含草稿）----
app.get('/api/author/works', (_req, res) => {
  const works = db.listWorks().map((w) => ({
    ...w,
    chapters: [...w.chapters].sort((a, b) => a.chapterNo - b.chapterNo),
  }));
  res.json({ works });
});

app.get('/api/author/works/:workId', (req, res) => {
  const work = db.getWork(req.params.workId);
  if (!work) return res.status(404).json({ error: '作品不存在' });
  work.chapters.sort((a, b) => a.chapterNo - b.chapterNo);
  res.json({ work });
});

app.post('/api/author/works', (req, res) => {
  const title = String(req.body?.title || '').trim();
  if (!title) return res.status(400).json({ error: '作品标题不能为空' });
  const work = db.createWork(req.body || {});
  res.status(201).json({ work });
});

app.put('/api/author/works/:workId', (req, res) => {
  const work = db.updateWork(req.params.workId, req.body || {});
  if (!work) return res.status(404).json({ error: '作品不存在' });
  res.json({ work });
});

app.delete('/api/author/works/:workId', (req, res) => {
  const ok = db.deleteWork(req.params.workId);
  if (!ok) return res.status(404).json({ error: '作品不存在' });
  res.status(204).end();
});

// 话数（草稿/已发布都可见可编辑）
app.get('/api/author/works/:workId/chapters/:chapterId', (req, res) => {
  const work = db.getWork(req.params.workId);
  const chapter = db.getChapter(req.params.workId, req.params.chapterId);
  if (!work || !chapter) return res.status(404).json({ error: '话数不存在' });
  res.json({ work: { id: work.id, title: work.title }, chapter });
});

app.post('/api/author/works/:workId/chapters', (req, res) => {
  const work = db.getWork(req.params.workId);
  if (!work) return res.status(404).json({ error: '作品不存在' });
  const chapter = db.createChapter(req.params.workId, req.body || {});
  res.status(201).json({ chapter });
});

app.put('/api/author/works/:workId/chapters/:chapterId', (req, res) => {
  const chapter = db.updateChapter(
    req.params.workId,
    req.params.chapterId,
    req.body || {}
  );
  if (!chapter) return res.status(404).json({ error: '话数不存在' });
  res.json({ chapter });
});

// 发布 / 撤回为草稿
app.post(
  '/api/author/works/:workId/chapters/:chapterId/publish',
  (req, res) => {
    const chapter = db.setChapterStatus(
      req.params.workId,
      req.params.chapterId,
      'published'
    );
    if (!chapter) return res.status(404).json({ error: '话数不存在' });
    res.json({ chapter });
  }
);

app.post(
  '/api/author/works/:workId/chapters/:chapterId/unpublish',
  (req, res) => {
    const chapter = db.setChapterStatus(
      req.params.workId,
      req.params.chapterId,
      'draft'
    );
    if (!chapter) return res.status(404).json({ error: '话数不存在' });
    res.json({ chapter });
  }
);

app.delete('/api/author/works/:workId/chapters/:chapterId', (req, res) => {
  const ok = db.deleteChapter(req.params.workId, req.params.chapterId);
  if (!ok) return res.status(404).json({ error: '话数不存在' });
  res.status(204).end();
});

// ---- 托管网页端静态文件（同源访问 http://localhost:4000/）----
const WEB_DIR = path.join(__dirname, '..', 'web');
if (fs.existsSync(WEB_DIR)) {
  app.use(express.static(WEB_DIR));
}

// 兜底错误处理
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  if (!fs.existsSync(db.DB_FILE)) {
    try {
      const seed = fs.readFileSync(db.SEED_FILE, 'utf-8');
      fs.writeFileSync(db.DB_FILE, seed);
      console.log(`[init] 已自动载入示例数据：${db.DB_FILE}`);
    } catch (e) {
      console.warn('[init] 示例数据载入失败：', e.message);
    }
  }
  console.log(`漫画分镜脚本工具 API：http://localhost:${PORT}/api`);
  console.log(`网页端（同源托管）：  http://localhost:${PORT}/`);
});
