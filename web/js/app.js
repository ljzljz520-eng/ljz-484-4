'use strict';

/* ---------------- utils ---------------- */

const app = document.getElementById('app');

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

let toastTimer = null;
function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (isError ? ' error' : '');
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 2400);
}

function openModal(title, innerHtml, onMount) {
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
    <h3>${esc(title)}</h3>
    <div class="modal-body">${innerHtml}</div>
  </div>`;
  mask.addEventListener('click', (e) => {
    if (e.target === mask) mask.remove();
  });
  document.body.appendChild(mask);
  if (onMount) onMount(mask);
  return mask;
}

function statusBadge(status) {
  return status === 'published'
    ? '<span class="badge published">已发布</span>'
    : '<span class="badge draft">草稿</span>';
}

const SIZE_LABEL = { small: '小格', medium: '中格', large: '大格' };
const DLG_TYPE_LABEL = {
  dialogue: '对白',
  thought: '内心独白',
  narration: '旁白',
  sfx: '音效',
};

/* ---------------- router ---------------- */

const routes = {
  reader: renderReaderHome,
  'reader/work': renderReaderWork,
  'reader/chapter': renderReaderChapter,
  author: renderAuthorHome,
  'author/work': renderAuthorWork,
  'author/chapter': renderChapterEditor,
};

function parseHash() {
  const raw = (location.hash || '#/reader').replace(/^#\/?/, '');
  const [pathPart, queryPart] = splitQuery(raw);
  const parts = pathPart.split('/').filter(Boolean);
  const params = {};
  new URLSearchParams(queryPart || '').forEach((v, k) => {
    params[k] = v;
  });
  return { parts, params };
}

function splitQuery(s) {
  const i = s.indexOf('?');
  if (i === -1) return [s, ''];
  return [s.slice(0, i), s.slice(i + 1)];
}

async function router() {
  const { parts, params } = parseHash();
  const name = parts[0] || 'reader';
  const sub = parts[1] || '';
  const key = sub ? `${name}/${sub}` : name;

  document.querySelectorAll('.main-nav a').forEach((a) => {
    a.classList.toggle('active', a.dataset.route === name);
  });

  const handler = routes[key];
  app.innerHTML = '<p class="loading">加载中…</p>';
  window.scrollTo(0, 0);
  try {
    if (handler) {
      await handler(params);
    } else if (name === 'reader') {
      await renderReaderHome(params);
    } else {
      await renderAuthorHome(params);
    }
  } catch (e) {
    app.innerHTML = `<div class="empty"><div class="big">⚠️</div>${esc(
      e.message
    )}</div>`;
  }
}

window.addEventListener('hashchange', router);

/* =========================================================
 * 读者预览（只能看到已发布话数）
 * ========================================================= */

async function renderReaderHome() {
  const { works } = await API.listPublicWorks();
  if (!works.length) {
    app.innerHTML = `
      <div class="page-head">
        <div><h1>读者预览</h1><p>这里只展示已发布的话数</p></div>
      </div>
      <div class="empty"><div class="big">📚</div>还没有已发布的作品，去作者工作台发布第一话吧。</div>`;
    return;
  }
  app.innerHTML = `
    <div class="page-head">
      <div>
        <h1>读者预览</h1>
        <p>已上架的漫画作品 · 共 ${works.length} 部</p>
      </div>
    </div>
    <div class="work-grid">
      ${works
        .map(
          (w) => `
        <div class="work-card">
          <h3><a href="#/reader/work?workId=${encodeURIComponent(w.id)}">${esc(
            w.title
          )}</a></h3>
          <div class="meta">${esc(w.author || '佚名')}${
            w.genre ? ' · ' + esc(w.genre) : ''
          } · 已更新 ${w.chapters.length} 话</div>
          <p class="summary">${esc(w.summary || '暂无简介')}</p>
          <div class="card-foot">
            <a class="btn small" href="#/reader/work?workId=${encodeURIComponent(
              w.id
            )}">开始阅读 →</a>
          </div>
        </div>`
        )
        .join('')}
    </div>`;
}

async function renderReaderWork(params) {
  const { work } = await API.getPublicWork(params.workId);
  app.innerHTML = `
    <div class="crumbs"><a href="#/reader">读者预览</a> / ${esc(work.title)}</div>
    <div class="work-detail-head">
      <h1>${esc(work.title)}</h1>
      <div class="meta">${esc(work.author || '佚名')}${
        work.genre ? ' · ' + esc(work.genre) : ''
      }</div>
      <p>${esc(work.summary || '暂无简介')}</p>
    </div>
    <div class="chapter-list reader-toc">
      ${work.chapters
        .map(
          (c) => `
        <a class="chapter-row" style="color:inherit" href="#/reader/chapter?workId=${encodeURIComponent(
          work.id
        )}&chapterId=${encodeURIComponent(c.id)}">
          <div class="ch-main">
            <h4>第 ${c.chapterNo} 话 · ${esc(c.title.replace(/^第.+?话[：:]\s*/, ''))}</h4>
            <div class="ch-sub">${esc(c.synopsis || '暂无简介')}</div>
          </div>
          <span class="badge published">已发布</span>
        </a>`
        )
        .join('')}
    </div>`;
}

function renderDialogue(d, index) {
  return `<div class="bubble ${esc(d.type)}">
    ${d.speaker ? `<span class="speaker">${esc(d.speaker)}</span>` : ''}
    ${esc(d.text) || '<span style="opacity:.5">（空台词）</span>'}
  </div>`;
}

function renderReaderPanel(p, i) {
  return `
  <section class="panel size-${esc(p.size)}">
    <div class="panel-canvas">
      <span class="panel-num">${i + 1}</span>
      <span class="panel-size-tag">${SIZE_LABEL[p.size] || '中格'}</span>
      ${p.scene ? `<span class="scene-line">🎬 ${esc(p.scene)}</span>` : ''}
      <p class="panel-desc">${esc(p.description) || '<em style="color:#999">（暂无画面描述）</em>'}</p>
      ${
        p.dialogues && p.dialogues.length
          ? `<div class="dialogues">${p.dialogues
              .map(renderDialogue)
              .join('')}</div>`
          : ''
      }
    </div>
  </section>`;
}

async function renderReaderChapter(params) {
  const { work, chapter } = await API.getPublicChapter(
    params.workId,
    params.chapterId
  );
  app.innerHTML = `
    <div class="reader-view">
      <div class="crumbs"><a href="#/reader">读者预览</a> / <a href="#/reader/work?workId=${encodeURIComponent(
        work.id
      )}">${esc(work.title)}</a></div>
      <h1 class="chapter-title">${esc(chapter.title)}</h1>
      <p class="chapter-synopsis">${esc(chapter.synopsis || '')}</p>
      ${chapter.panels.map(renderReaderPanel).join('') ||
        '<div class="empty">本话暂无分镜</div>'}
      <div class="reader-nav">
        <a class="btn ghost" href="#/reader/work?workId=${encodeURIComponent(
          work.id
        )}">← 返回目录</a>
      </div>
    </div>`;
}

/* =========================================================
 * 作者工作台
 * ========================================================= */

async function renderAuthorHome() {
  const { works } = await API.listAuthorWorks();
  app.innerHTML = `
    <div class="page-head">
      <div>
        <h1>作者工作台</h1>
        <p>管理作品、话数与分镜；点「发布」后话数才会进入读者预览，草稿仅自己可见</p>
      </div>
      <button class="btn primary" id="btn-new-work">＋ 新增作品</button>
    </div>
    ${
      works.length
        ? `<div class="work-grid">${works
            .map((w) => {
              const pub = w.chapters.filter((c) => c.status === 'published')
                .length;
              const draft = w.chapters.length - pub;
              return `
          <div class="work-card">
            <h3><a href="#/author/work?workId=${encodeURIComponent(
              w.id
            )}">${esc(w.title)}</a></h3>
            <div class="meta">${esc(w.author || '佚名')}${
                w.genre ? ' · ' + esc(w.genre) : ''
              }</div>
            <p class="summary">${esc(w.summary || '暂无简介')}</p>
            <div class="meta">
              <span class="badge published">已发布 ${pub}</span>
              <span class="badge draft">草稿 ${draft}</span>
            </div>
            <div class="card-foot">
              <a class="btn small" href="#/author/work?workId=${encodeURIComponent(
                w.id
              )}">管理话数 →</a>
              <button class="btn small ghost js-del-work" data-id="${esc(
                w.id
              )}" data-title="${esc(w.title)}">删除</button>
            </div>
          </div>`;
            })
            .join('')}</div>`
        : `<div class="empty"><div class="big">✏️</div>还没有作品，点击右上角「新增作品」开始吧。</div>`
    }`;

  document.getElementById('btn-new-work').onclick = () => showWorkForm(null);
  app.querySelectorAll('.js-del-work').forEach((btn) => {
    btn.onclick = async () => {
      if (
        !confirm(
          `确定删除作品《${btn.dataset.title}》吗？其下所有话数将一并删除。`
        )
      )
        return;
      await API.deleteWork(btn.dataset.id);
      toast('作品已删除');
      router();
    };
  });
}

function workFormHtml(work) {
  return `
  <form id="work-form">
    <div class="form-grid">
      <label class="field full">作品标题 *
        <input type="text" name="title" required maxlength="80" value="${esc(
          work?.title || ''
        )}" />
      </label>
      <label class="field">作者
        <input type="text" name="author" maxlength="40" value="${esc(
          work?.author || ''
        )}" />
      </label>
      <label class="field">类型 / 标签
        <input type="text" name="genre" maxlength="40" placeholder="如：科幻 / 冒险" value="${esc(
          work?.genre || ''
        )}" />
      </label>
      <label class="field full">简介
        <textarea name="summary" rows="3" maxlength="500">${esc(
          work?.summary || ''
        )}</textarea>
      </label>
    </div>
    <div class="form-actions">
      <button type="button" class="btn ghost js-cancel">取消</button>
      <button type="submit" class="btn primary">${work ? '保存修改' : '创建作品'}</button>
    </div>
  </form>`;
}

function showWorkForm(work) {
  const mask = openModal(work ? '编辑作品' : '新增作品', workFormHtml(work), (m) => {
    const form = m.querySelector('#work-form');
    form.querySelector('.js-cancel').onclick = () => m.remove();
    form.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const body = Object.fromEntries(fd.entries());
      try {
        if (work) {
          await API.updateWork(work.id, body);
          toast('作品已保存');
        } else {
          await API.createWork(body);
          toast('作品已创建');
        }
        m.remove();
        router();
      } catch (err) {
        toast(err.message, true);
      }
    };
  });
}

async function renderAuthorWork(params) {
  const { work } = await API.getAuthorWork(params.workId);
  const chapters = [...work.chapters].sort(
    (a, b) => a.chapterNo - b.chapterNo
  );
  app.innerHTML = `
    <div class="crumbs"><a href="#/author">作者工作台</a> / ${esc(work.title)}</div>
    <div class="work-detail-head">
      <h1>${esc(work.title)}</h1>
      <div class="meta">${esc(work.author || '佚名')}${
        work.genre ? ' · ' + esc(work.genre) : ''
      } · 更新于 ${formatDate(work.updatedAt)}</div>
      <p>${esc(work.summary || '暂无简介')}</p>
      <div class="head-actions">
        <button class="btn primary" id="btn-new-chapter">＋ 新增话数</button>
        <button class="btn" id="btn-edit-work">编辑作品信息</button>
        <a class="btn ghost" href="#/reader/work?workId=${encodeURIComponent(
          work.id
        )}">在读者预览中打开 ↗</a>
      </div>
    </div>
    <div class="chapter-list" id="chapter-list">
      ${
        chapters.length
          ? chapters
              .map((c) => {
                const published = c.status === 'published';
                return `
          <div class="chapter-row">
            <div class="ch-main">
              <h4>第 ${c.chapterNo} 话 · ${esc(
                  c.title.replace(/^第.+?话[：:]\s*/, '')
                )} ${statusBadge(c.status)}</h4>
              <div class="ch-sub">
                ${c.panels.length} 个分镜 ·
                ${published ? '发布于 ' + formatDate(c.publishedAt) : '草稿，仅作者可见'}
              </div>
            </div>
            <div class="ch-actions">
              <a class="btn small" href="#/author/chapter?workId=${encodeURIComponent(
                work.id
              )}&chapterId=${encodeURIComponent(c.id)}">编辑分镜</a>
              ${
                published
                  ? `<button class="btn small ghost js-unpublish" data-cid="${esc(
                      c.id
                    )}">撤回到草稿</button>`
                  : `<button class="btn small success js-publish" data-cid="${esc(
                      c.id
                    )}">发布</button>`
              }
              <button class="btn small danger js-del-ch" data-cid="${esc(
                c.id
              )}" data-title="${esc(c.title)}">删除</button>
            </div>
          </div>`;
              })
              .join('')
          : '<div class="empty">还没有话数，先新增第一话吧。</div>'
      }
    </div>`;

  document.getElementById('btn-edit-work').onclick = () => showWorkForm(work);
  document.getElementById('btn-new-chapter').onclick = () =>
    showChapterForm(work.id, chapters.length + 1, null);

  app.querySelectorAll('.js-publish').forEach((btn) => {
    btn.onclick = async () => {
      await API.publishChapter(work.id, btn.dataset.cid);
      toast('已发布，读者现在可以看到这一话');
      router();
    };
  });
  app.querySelectorAll('.js-unpublish').forEach((btn) => {
    btn.onclick = async () => {
      await API.unpublishChapter(work.id, btn.dataset.cid);
      toast('已撤回到草稿');
      router();
    };
  });
  app.querySelectorAll('.js-del-ch').forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm(`确定删除话数《${btn.dataset.title}》吗？`)) return;
      await API.deleteChapter(work.id, btn.dataset.cid);
      toast('话数已删除');
      router();
    };
  });
}

function chapterFormHtml(chapter, nextNo) {
  const c = chapter || {
    chapterNo: nextNo,
    title: '',
    status: 'draft',
    synopsis: '',
  };
  return `
  <form id="chapter-form">
    <div class="form-grid">
      <label class="field">话数序号
        <input type="number" name="chapterNo" min="1" step="1" value="${esc(
          c.chapterNo
        )}" />
      </label>
      <label class="field">状态
        <select name="status">
          <option value="draft" ${c.status === 'draft' ? 'selected' : ''}>草稿（仅作者可见）</option>
          <option value="published" ${
            c.status === 'published' ? 'selected' : ''
          }>发布（进入读者预览）</option>
        </select>
      </label>
      <label class="field full">话数标题 *
        <input type="text" name="title" required maxlength="100" value="${esc(
          c.title
        )}" placeholder="如：第一话：沉睡者醒来" />
      </label>
      <label class="field full">本话梗概
        <textarea name="synopsis" rows="2" maxlength="300">${esc(
          c.synopsis || ''
        )}</textarea>
      </label>
    </div>
    <div class="form-actions">
      <button type="button" class="btn ghost js-cancel">取消</button>
      <button type="submit" class="btn primary">${chapter ? '保存' : '创建话数'}</button>
    </div>
  </form>`;
}

function showChapterForm(workId, nextNo, chapter) {
  const mask = openModal(
    chapter ? '编辑话数信息' : '新增话数',
    chapterFormHtml(chapter, nextNo),
    (m) => {
      const form = m.querySelector('#chapter-form');
      form.querySelector('.js-cancel').onclick = () => m.remove();
      form.onsubmit = async (e) => {
        e.preventDefault();
        const body = Object.fromEntries(new FormData(form).entries());
        body.chapterNo = Number(body.chapterNo) || 1;
        try {
          if (chapter) {
            // 仅更新标题/序号/梗概/状态，保留分镜内容
            const merged = {
              ...chapter,
              ...body,
              panels: chapter.panels,
            };
            await API.updateChapter(workId, chapter.id, merged);
            toast('话数信息已保存');
          } else {
            await API.createChapter(workId, { ...body, panels: [] });
            toast('话数已创建，可以开始写分镜了');
          }
          m.remove();
          router();
        } catch (err) {
          toast(err.message, true);
        }
      };
    }
  );
}

/* =========================================================
 * 分镜编辑器
 * ========================================================= */

// 编辑器内存中的话数草稿（结构与后端一致）
let editorState = null;

function dlgHtml(d, di) {
  return `
    <div class="dlg-row" data-di="${di}">
      <div class="dlg-row-head">
        <select data-field="type">
          ${Object.entries(DLG_TYPE_LABEL)
            .map(
              ([v, label]) =>
                `<option value="${v}" ${
                  d.type === v ? 'selected' : ''
                }>${label}</option>`
            )
            .join('')}
        </select>
        <input type="text" data-field="speaker" placeholder="角色名（旁白/音效可留空）" value="${esc(
          d.speaker
        )}" />
        <span class="spacer"></span>
        <button type="button" class="btn small js-dlg-up">↑ 上移</button>
        <button type="button" class="btn small js-dlg-down">↓ 下移</button>
        <button type="button" class="btn small danger js-del-dlg">删除台词</button>
      </div>
      <textarea data-field="text" rows="2" placeholder="对白 / 独白 / 旁白 / 音效文字">${esc(
        d.text
      )}</textarea>
    </div>`;
}

function panelHtml(p, pi) {
  return `
  <div class="editor-panel" data-pi="${pi}">
    <div class="editor-panel-head">
      <span class="tag">分镜 ${pi + 1}</span>
      <select data-field="size" title="画幅">
        ${Object.entries(SIZE_LABEL)
          .map(
            ([v, label]) =>
              `<option value="${v}" ${
                p.size === v ? 'selected' : ''
              }>${label}</option>`
          )
          .join('')}
      </select>
      <span class="spacer"></span>
      <button type="button" class="btn small js-move-up">↑ 上移</button>
      <button type="button" class="btn small js-move-down">↓ 下移</button>
      <button type="button" class="btn small danger js-del-panel">删除分镜</button>
    </div>
    <div class="editor-panel-body">
      <input type="text" data-field="scene" placeholder="场景 / 镜头说明，如：中景·维修通道" value="${esc(
        p.scene
      )}" />
      <textarea data-field="description" rows="3" placeholder="画面描述：构图、人物动作、光影……">${esc(
        p.description
      )}</textarea>
      <div>
        <div class="status-line" style="margin-bottom:8px">台词与声音</div>
        <div class="dlg-list">
          ${p.dialogues.map((d, di) => dlgHtml(d, di)).join('')}
        </div>
        <button type="button" class="btn small js-add-dlg" style="margin-top:10px">＋ 添加台词</button>
      </div>
    </div>
  </div>`;
}

async function renderChapterEditor(params) {
  const { work, chapter } = await API.getAuthorChapter(
    params.workId,
    params.chapterId
  );
  editorState = JSON.parse(JSON.stringify(chapter)); // 深拷贝，未点保存不落库

  app.innerHTML = `
    <div class="crumbs">
      <a href="#/author">作者工作台</a> /
      <a href="#/author/work?workId=${encodeURIComponent(work.id)}">${esc(
        work.title
      )}</a> / 分镜编辑
    </div>
    <div class="page-head">
      <div>
        <h1>${esc(chapter.title)} ${statusBadge(chapter.status)}</h1>
        <p>${esc(chapter.synopsis || '暂无梗概')}</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" id="btn-edit-meta">编辑话数信息</button>
        ${
          chapter.status === 'published'
            ? `<button class="btn ghost" id="btn-unpublish">撤回到草稿</button>`
            : `<button class="btn success" id="btn-publish">保存并发布</button>`
        }
      </div>
    </div>

    <div class="editor-bar">
      <button class="btn primary" id="btn-save">💾 保存草稿</button>
      <button class="btn" id="btn-add-panel">＋ 添加分镜</button>
      <span class="spacer status-line" id="save-hint"></span>
    </div>

    <div id="panels-wrap">
      ${
        editorState.panels.length
          ? editorState.panels.map(panelHtml).join('')
          : '<div class="empty" id="empty-panels">还没有分镜，点击「添加分镜」开始创作。</div>'
      }
    </div>`;

  bindEditor(work, chapter);
}

// 把 DOM 里所有输入同步回 editorState（增删/排序之外的保存前必做）
function syncPanelsFromDom() {
  const panelEls = app.querySelectorAll('.editor-panel');
  editorState.panels = Array.from(panelEls).map((pel) => {
    const pi = Number(pel.dataset.pi);
    const old = editorState.panels[pi] || { dialogues: [] };
    const get = (field) =>
      pel.querySelector(`[data-field="${field}"]`)?.value ?? '';
    const dialogues = Array.from(pel.querySelectorAll('.dlg-row')).map(
      (drow) => {
        const di = Number(drow.dataset.di);
        const oldD = old.dialogues[di] || {};
        return {
          id: oldD.id,
          type: drow.querySelector('[data-field="type"]').value,
          speaker: drow.querySelector('[data-field="speaker"]').value.trim(),
          text: drow.querySelector('[data-field="text"]').value,
        };
      }
    );
    return {
      id: old.id,
      size: get('size'),
      scene: get('scene').trim(),
      description: get('description'),
      dialogues,
    };
  });
}

// 重新按 editorState 渲染分镜列表。
// 注意：不要在渲染前再次 syncPanelsFromDom() —— 调用方都是
// 「先 sync → 改 editorState → 再渲染」，渲染前若再同步一次，
// 未更新的旧 DOM 会把刚做的增删/排序覆盖回去。
function rerenderPanels() {
  const wrap = document.getElementById('panels-wrap');
  wrap.innerHTML = editorState.panels.length
    ? editorState.panels.map(panelHtml).join('')
    : '<div class="empty" id="empty-panels">还没有分镜，点击「添加分镜」开始创作。</div>';
  bindPanelButtons();
}

function bindPanelButtons() {
  app.querySelectorAll('.editor-panel').forEach((pel) => {
    pel.querySelector('.js-add-dlg').onclick = () => {
      syncPanelsFromDom();
      const pi = Number(pel.dataset.pi);
      editorState.panels[pi].dialogues.push({
        type: 'dialogue',
        speaker: '',
        text: '',
      });
      rerenderPanels();
      const lists = document.querySelectorAll('.dlg-list');
      const last = lists[pi]?.lastElementChild;
      last?.querySelector('textarea')?.focus();
    };
    // 台词：上移 / 下移 / 删除
    pel.querySelectorAll('.js-dlg-up').forEach((btn) => {
      btn.onclick = () => {
        syncPanelsFromDom();
        const pi = Number(pel.dataset.pi);
        const di = Number(btn.closest('.dlg-row').dataset.di);
        const dialogues = editorState.panels[pi].dialogues;
        if (di <= 0) return;
        [dialogues[di - 1], dialogues[di]] = [dialogues[di], dialogues[di - 1]];
        rerenderPanels();
      };
    });
    pel.querySelectorAll('.js-dlg-down').forEach((btn) => {
      btn.onclick = () => {
        syncPanelsFromDom();
        const pi = Number(pel.dataset.pi);
        const di = Number(btn.closest('.dlg-row').dataset.di);
        const dialogues = editorState.panels[pi].dialogues;
        if (di >= dialogues.length - 1) return;
        [dialogues[di], dialogues[di + 1]] = [dialogues[di + 1], dialogues[di]];
        rerenderPanels();
      };
    });
    pel.querySelectorAll('.js-del-dlg').forEach((btn) => {
      btn.onclick = () => {
        syncPanelsFromDom();
        const pi = Number(pel.dataset.pi);
        const drow = btn.closest('.dlg-row');
        const di = Number(drow.dataset.di);
        editorState.panels[pi].dialogues.splice(di, 1);
        rerenderPanels();
      };
    });
    pel.querySelector('.js-del-panel').onclick = () => {
      syncPanelsFromDom();
      const pi = Number(pel.dataset.pi);
      if (!confirm('确定删除这个分镜及其全部台词吗？')) return;
      editorState.panels.splice(pi, 1);
      rerenderPanels();
    };
    pel.querySelector('.js-move-up').onclick = () => {
      syncPanelsFromDom();
      const pi = Number(pel.dataset.pi);
      if (pi === 0) return;
      [editorState.panels[pi - 1], editorState.panels[pi]] = [
        editorState.panels[pi],
        editorState.panels[pi - 1],
      ];
      rerenderPanels();
    };
    pel.querySelector('.js-move-down').onclick = () => {
      syncPanelsFromDom();
      const pi = Number(pel.dataset.pi);
      if (pi >= editorState.panels.length - 1) return;
      [editorState.panels[pi], editorState.panels[pi + 1]] = [
        editorState.panels[pi + 1],
        editorState.panels[pi],
      ];
      rerenderPanels();
    };
  });
}

function bindEditor(work, chapter) {
  document.getElementById('btn-add-panel').onclick = () => {
    syncPanelsFromDom();
    editorState.panels.push({
      size: 'medium',
      scene: '',
      description: '',
      dialogues: [],
    });
    rerenderPanels();
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  document.getElementById('btn-edit-meta').onclick = () => {
    syncPanelsFromDom();
    showChapterForm(work.id, editorState.chapterNo, {
      ...editorState,
    });
  };

  const save = async (andPublish = false) => {
    syncPanelsFromDom();
    const body = JSON.parse(JSON.stringify(editorState));
    if (andPublish) body.status = 'published';
    const { chapter: saved } = await API.updateChapter(
      work.id,
      chapter.id,
      body
    );
    editorState = JSON.parse(JSON.stringify(saved));
    const hint = document.getElementById('save-hint');
    if (hint) {
      hint.textContent = `已保存 · ${new Date().toLocaleTimeString('zh-CN')}`;
    }
    toast(andPublish ? '已保存并发布，读者可以阅读这一话' : '草稿已保存');
    if (andPublish) router();
  };

  document.getElementById('btn-save').onclick = () =>
    save(false).catch((e) => toast(e.message, true));
  const pubBtn = document.getElementById('btn-publish');
  if (pubBtn)
    pubBtn.onclick = () =>
      save(true).catch((e) => toast(e.message, true));
  const unpublishBtn = document.getElementById('btn-unpublish');
  if (unpublishBtn)
    unpublishBtn.onclick = async () => {
      await API.unpublishChapter(work.id, chapter.id);
      toast('已撤回到草稿');
      router();
    };

  bindPanelButtons();
}

/* ---------------- boot ---------------- */
router();
