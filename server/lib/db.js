'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SEED_FILE = path.join(DATA_DIR, 'seed.json');

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const seed = fs.existsSync(SEED_FILE)
      ? fs.readFileSync(SEED_FILE, 'utf-8')
      : '{"works":[]}';
    fs.writeFileSync(DB_FILE, seed);
  }
}

function readAll() {
  ensureDataFile();
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  const data = JSON.parse(raw || '{"works":[]}');
  if (!Array.isArray(data.works)) data.works = [];
  return data;
}

function writeAll(data) {
  ensureDataFile();
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, DB_FILE);
}

function genId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function nowISO() {
  return new Date().toISOString();
}

// ---------- works ----------

function listWorks() {
  return readAll().works;
}

function getWork(workId) {
  return listWorks().find((w) => w.id === workId) || null;
}

function createWork(input) {
  const data = readAll();
  const work = {
    id: genId('w'),
    title: String(input.title || '').trim() || '未命名作品',
    author: String(input.author || '').trim(),
    genre: String(input.genre || '').trim(),
    summary: String(input.summary || '').trim(),
    cover: String(input.cover || '').trim(),
    createdAt: nowISO(),
    updatedAt: nowISO(),
    chapters: [],
  };
  data.works.push(work);
  writeAll(data);
  return work;
}

function updateWork(workId, input) {
  const data = readAll();
  const work = data.works.find((w) => w.id === workId);
  if (!work) return null;
  const fields = ['title', 'author', 'genre', 'summary', 'cover'];
  for (const f of fields) {
    if (Object.prototype.hasOwnProperty.call(input, f)) {
      work[f] = String(input[f] ?? '').trim();
    }
  }
  work.updatedAt = nowISO();
  writeAll(data);
  return work;
}

function deleteWork(workId) {
  const data = readAll();
  const idx = data.works.findIndex((w) => w.id === workId);
  if (idx === -1) return false;
  data.works.splice(idx, 1);
  writeAll(data);
  return true;
}

// ---------- chapters ----------

function findChapter(work, chapterId) {
  return work.chapters.find((c) => c.id === chapterId) || null;
}

function normalizeDialogue(d = {}) {
  return {
    id: d.id || genId('d'),
    type: ['dialogue', 'thought', 'narration', 'sfx'].includes(d.type)
      ? d.type
      : 'dialogue',
    speaker: String(d.speaker || '').trim(),
    text: String(d.text ?? ''),
  };
}

function normalizePanel(p = {}) {
  const panels = Array.isArray(p.dialogues)
    ? p.dialogues.map(normalizeDialogue)
    : [];
  return {
    id: p.id || genId('p'),
    size: ['small', 'medium', 'large'].includes(p.size) ? p.size : 'medium',
    scene: String(p.scene ?? ''),
    description: String(p.description ?? ''),
    dialogues: panels,
  };
}

function normalizeChapter(input) {
  return {
    title: String(input.title || '').trim() || '未命名话数',
    volumeNo: Number.isFinite(Number(input.volumeNo))
      ? Number(input.volumeNo)
      : null,
    chapterNo: Number.isFinite(Number(input.chapterNo))
      ? Number(input.chapterNo)
      : 1,
    status: input.status === 'published' ? 'published' : 'draft',
    synopsis: String(input.synopsis || '').trim(),
    panels: Array.isArray(input.panels)
      ? input.panels.map(normalizePanel)
      : [],
  };
}

function getChapter(workId, chapterId) {
  const work = getWork(workId);
  if (!work) return null;
  return findChapter(work, chapterId);
}

function createChapter(workId, input) {
  const data = readAll();
  const work = data.works.find((w) => w.id === workId);
  if (!work) return null;
  const chapter = {
    id: genId('c'),
    ...normalizeChapter(input),
    createdAt: nowISO(),
    updatedAt: nowISO(),
    publishedAt: null,
  };
  work.chapters.push(chapter);
  work.updatedAt = nowISO();
  writeAll(data);
  return chapter;
}

function updateChapter(workId, chapterId, input) {
  const data = readAll();
  const work = data.works.find((w) => w.id === workId);
  if (!work) return null;
  const chapter = findChapter(work, chapterId);
  if (!chapter) return null;

  const normalized = normalizeChapter(input);
  // 草稿可任意编辑；已发布的话也允许修订正文，但状态需显式改回
  chapter.title = normalized.title;
  chapter.volumeNo = normalized.volumeNo;
  chapter.chapterNo = normalized.chapterNo;
  chapter.synopsis = normalized.synopsis;
  chapter.panels = normalized.panels;
  if (input.status === 'published' && chapter.status !== 'published') {
    chapter.status = 'published';
    chapter.publishedAt = nowISO();
  } else if (input.status === 'draft') {
    chapter.status = 'draft';
    chapter.publishedAt = null;
  }
  chapter.updatedAt = nowISO();
  work.updatedAt = nowISO();
  writeAll(data);
  return chapter;
}

function setChapterStatus(workId, chapterId, status) {
  const data = readAll();
  const work = data.works.find((w) => w.id === workId);
  if (!work) return null;
  const chapter = findChapter(work, chapterId);
  if (!chapter) return null;
  if (status === 'published') {
    chapter.status = 'published';
    chapter.publishedAt = chapter.publishedAt || nowISO();
  } else {
    chapter.status = 'draft';
    chapter.publishedAt = null;
  }
  chapter.updatedAt = nowISO();
  work.updatedAt = nowISO();
  writeAll(data);
  return chapter;
}

function deleteChapter(workId, chapterId) {
  const data = readAll();
  const work = data.works.find((w) => w.id === workId);
  if (!work) return false;
  const idx = work.chapters.findIndex((c) => c.id === chapterId);
  if (idx === -1) return false;
  work.chapters.splice(idx, 1);
  work.updatedAt = nowISO();
  writeAll(data);
  return true;
}

module.exports = {
  DATA_DIR,
  DB_FILE,
  SEED_FILE,
  readAll,
  writeAll,
  listWorks,
  getWork,
  createWork,
  updateWork,
  deleteWork,
  getChapter,
  createChapter,
  updateChapter,
  setChapterStatus,
  deleteChapter,
};
