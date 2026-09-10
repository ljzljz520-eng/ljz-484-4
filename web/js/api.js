'use strict';

// 如果用独立静态服务器（如 VS Code Live Server / python -m http.server 8080），
// 把这里改成 API 地址即可：const API_BASE = 'http://localhost:4000';
const API_BASE = '';

async function request(method, url, body) {
  const opts = {
    method,
    headers: {},
  };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(API_BASE + url, opts);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `请求失败（${res.status}）`);
  }
  return data;
}

window.API = {
  // 读者
  listPublicWorks: () => request('GET', '/api/public/works'),
  getPublicWork: (workId) => request('GET', `/api/public/works/${workId}`),
  getPublicChapter: (workId, chapterId) =>
    request('GET', `/api/public/works/${workId}/chapters/${chapterId}`),

  // 作者
  listAuthorWorks: () => request('GET', '/api/author/works'),
  getAuthorWork: (workId) => request('GET', `/api/author/works/${workId}`),
  createWork: (body) => request('POST', '/api/author/works', body),
  updateWork: (workId, body) =>
    request('PUT', `/api/author/works/${workId}`, body),
  deleteWork: (workId) => request('DELETE', `/api/author/works/${workId}`),

  getAuthorChapter: (workId, chapterId) =>
    request('GET', `/api/author/works/${workId}/chapters/${chapterId}`),
  createChapter: (workId, body) =>
    request('POST', `/api/author/works/${workId}/chapters`, body),
  updateChapter: (workId, chapterId, body) =>
    request('PUT', `/api/author/works/${workId}/chapters/${chapterId}`, body),
  publishChapter: (workId, chapterId) =>
    request(
      'POST',
      `/api/author/works/${workId}/chapters/${chapterId}/publish`
    ),
  unpublishChapter: (workId, chapterId) =>
    request(
      'POST',
      `/api/author/works/${workId}/chapters/${chapterId}/unpublish`
    ),
  deleteChapter: (workId, chapterId) =>
    request('DELETE', `/api/author/works/${workId}/chapters/${chapterId}`),
};
