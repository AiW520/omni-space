const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const modeCopy = {
  canvas: ['画布', '项目图谱'], '3d': ['3D 场景', '校园中心'], build: ['代码与应用', 'WebAppNode 运行时'],
  web: ['HTML / 网页', 'HTML 场景'], media: ['图片', '媒体节点'], video: ['视频', '生成堆栈'],
  data: ['数据与图表', '共享源节点'], inspector: ['项目审查', '只读检查'], agents: ['AI Agent', '团队操作'], files: ['文件', '项目源内容'], history: ['历史记录', '版本时间线']
};

const STORAGE_KEY = 'omni-space-project-graph-v2';
const CONFIG_KEY = 'omni-space-model-config-v1';
const LANGUAGE_KEY = 'omni-space-language';
const ACCOUNTS_KEY = 'omni-space-local-accounts-v1';
const ACCOUNT_SESSION_KEY = 'omni-space-local-session-v1';
const MAX_LOCAL_ACCOUNTS = 100;
const PASSWORD_ITERATIONS = 210000;
const PRESENTATION_KEY = 'omni-space-presentation-v1';
const PRESENTATION_DRAFT_KEY = 'omni-space-presentation-draft-v1';
const MEDIA_ASSETS_KEY = 'omni-space-media-assets-v1';
const videoObjectUrls = new Map();
const PROJECT_KEY = 'omni-space-project-v1';
const PROJECTS_KEY = 'omni-space-local-projects-v1';
const ACTIVE_PROJECT_KEY = 'omni-space-active-project-v1';
const PROJECT_CONTENT_KEYS = [STORAGE_KEY, PRESENTATION_KEY, PRESENTATION_DRAFT_KEY, PROJECT_KEY, MEDIA_ASSETS_KEY, 'omni-space-code-v1', 'omni-space-versions-v1', 'omni-space-files-v1', 'omni-space-image-draft', 'omni-space-video-draft', 'omni-space-agent-config-v1', 'omni-space-last-audit'];
if (!localStorage.getItem(ACTIVE_PROJECT_KEY)) localStorage.setItem(ACTIVE_PROJECT_KEY, 'initial');
const projectData = loadProjectData();
const defaultConfig = {
  reasoningModel: 'claude-opus', imageModel: 'gpt-image-2', videoModel: 'runway',
  routeMode: 'auto', imageEndpoint: 'https://api.tu-zi.com/coding', providerEnabled: true, savedAt: '刚刚'
};
const presentationTransitions = ['fade', 'slide', 'zoom', 'none'];
let language = localStorage.getItem(LANGUAGE_KEY) || 'zh';
let modelConfig = loadConfig();
const canvasArea = $('#canvasArea');
const canvasContent = $('#canvasContent');
const canvasGrid = $('.canvas-grid');
const modeWorkspace = $('#modeWorkspace');
const zoomValue = $('#zoomValue');
const overlay = $('#commandOverlay');
const commandInput = $('#commandInput');
const configOverlay = $('#configOverlay');
const accountOverlay = $('#accountOverlay');
const graph = { scale: 1, panX: 0, panY: 0, selected: null, history: [], future: [] };
const presentation = { scenes: loadPresentation(), active: 0, playing: false, dirty: false, history: [], future: [] };
let scenePreviewTimer;
let sceneDraftTimer;
let toastTimer;
let dragState = null;
let projectMenu = null;
let runtimeMessageHandlerBound = false;
const thumbnailResize = new ResizeObserver(entries => {
  entries.forEach(({ target }) => { target.querySelector('iframe').style.transform = `scale(${target.clientWidth / 1280})`; });
});
const stageResize = new ResizeObserver(() => {
  const wrap = $('.presentation-stage-wrap');
  const padding = getComputedStyle(wrap);
  const width = wrap.clientWidth - parseFloat(padding.paddingLeft) - parseFloat(padding.paddingRight);
  const height = wrap.clientHeight - parseFloat(padding.paddingTop) - parseFloat(padding.paddingBottom);
  const naturalHeight = innerWidth <= 700 && !document.fullscreenElement && !$('#presentationOverlay').classList.contains('preview-mode');
  const fittedWidth = Math.max(0, Math.min(width, naturalHeight ? width : height * 16 / 9, 1280));
  $('#stageCanvas').style.width = `${fittedWidth}px`;
  $('#presentationFrame').style.transform = `scale(${fittedWidth / 1280})`;
});
stageResize.observe($('.presentation-stage-wrap'));

const copy = {
  zh: {
    live: '本地', share: '分享', run: '运行', running: '运行中', canvas: '画布', graph: '项目图谱',
    project: '校园 AI 服务', modes: { canvas: '画布', '3d': '3D 场景', build: '代码与应用', web: 'HTML / 网页', media: '图片', video: '视频', data: '数据与图表', inspector: '项目审查', agents: 'AI Agent', files: '文件', history: '历史记录' },
    sub: { canvas: '项目图谱', '3d': '校园中心', build: 'WebAppNode 运行时', web: 'HTML 场景', media: '媒体节点', video: '生成堆栈', data: '共享源节点', inspector: '只读检查', agents: '团队操作', files: '项目源内容', history: '版本时间线' },
    command: '命令', team: 'AI 团队', teamSub: '当前空间有 6 个 Agent', provider: '外部供应商', manage: '管理', activity: '本地审查记录', health: '项目健康度', good: '良好', audit: '运行只读审查', map: '项目地图', saved: '所有更改已保存', nodes: '个本地节点',
    model: '模型配置', modelSub: '为不同工作模式选择模型和供应商。', savedConfig: '配置已保存', connected: '已连接', endpoint: '图片供应商端点', save: '保存配置', cancel: '取消', lastSaved: '上次保存', enabled: '启用外部模型调用', disabled: '已停用', keyConfigured: '已配置 · ****************', keyChange: '更换密钥', routeAuto: '自动选择', routeManual: '按工作模式固定',
    toastSaved: '模型配置已保存', noKey: '密钥只保存在当前浏览器，不会显示完整内容。',
    presentation: { back: '返回画布', print: '打印 / PDF', export: '导出 HTML', preview: '演示模式', scene: '场景', visual: '视觉', code: 'HTML / CSS', title: '场景标题', notes: '演讲备注', notesPlaceholder: '写下这一页的讲解重点...', data: '项目数据', activeUsers: '活跃用户占比', growth: '环比增长', sessions: '本周会话', health: '项目健康度', transition: '场景过渡', duration: '停留时长（秒）', refresh: '刷新预览', unsaved: '未保存', saved: '已保存', save: '保存场景', live: '本地预览 · 已保存', play: '播放', pause: '暂停', noNotes: '暂无演讲备注。', validationPassed: '导出检查通过', validationFailed: '导出前需要处理', validationNone: '暂无检查结果。' },
    projectMenu: { current: '当前项目', newProject: '新建本地项目', rename: '重命名项目', close: '关闭' }
  },
  en: {
    live: 'LOCAL', share: 'Share', run: 'Run', running: 'Running', canvas: 'Canvas', graph: 'Project Graph',
    project: 'Campus AI Service', modes: { canvas: 'Canvas', '3d': '3D Scene', build: 'Code & Apps', web: 'HTML / Web', media: 'Images', video: 'Video', data: 'Data & Charts', inspector: 'Inspector', agents: 'AI Agents', files: 'Files', history: 'History' },
    sub: { canvas: 'Project Graph', '3d': 'Campus Center', build: 'WebAppNode Runtime', web: 'HTML Scene', media: 'Media Nodes', video: 'Generation Stack', data: 'Shared Source Nodes', inspector: 'Read-only audit', agents: 'Team Operations', files: 'Project Source', history: 'Version Timeline' },
    command: 'Commands', team: 'AI Team', teamSub: '6 agents in this space', provider: 'External Providers', manage: 'Manage', activity: 'Local Audit Log', health: 'Project Health', good: 'Good', audit: 'Run Read-only Audit', map: 'Project Map', saved: 'All changes saved', nodes: 'local nodes',
    model: 'Model Configuration', modelSub: 'Choose models and providers for each work mode.', savedConfig: 'Configuration saved', connected: 'Connected', endpoint: 'Image provider endpoint', save: 'Save Configuration', cancel: 'Cancel', lastSaved: 'Last saved', enabled: 'Enable external model calls', disabled: 'Disabled', keyConfigured: 'Configured · ****************', keyChange: 'Change Key', routeAuto: 'Automatic routing', routeManual: 'Fixed by work mode',
    toastSaved: 'Model configuration saved', noKey: 'The key stays in this browser and is never shown in full.',
    presentation: { back: 'Back to Canvas', print: 'Print / PDF', export: 'Export HTML', preview: 'Present', scene: 'Scenes', visual: 'Visual', code: 'HTML / CSS', title: 'Scene title', notes: 'Speaker notes', notesPlaceholder: 'Write the key points for this slide...', data: 'Project data', activeUsers: 'Active users', growth: 'Period growth', sessions: 'Weekly sessions', health: 'Project health', transition: 'Scene transition', duration: 'Duration (seconds)', refresh: 'Refresh preview', unsaved: 'Unsaved', saved: 'Saved', save: 'Save scene', live: 'Local preview · Saved', play: 'Play', pause: 'Pause', noNotes: 'No speaker notes.', validationPassed: 'Export checks passed', validationFailed: 'Resolve before export', validationNone: 'No checks run yet.' },
    projectMenu: { current: 'Current project', newProject: 'New local project', rename: 'Rename project', close: 'Close' }
  }
};

function loadProjectData() {
  try { return { title: '校园 AI 服务', activeUsers: 72.4, growth: 12.6, sessions: '8.4k', health: 92, ...(JSON.parse(localStorage.getItem(PROJECT_KEY)) || {}) }; } catch { return { title: '校园 AI 服务', activeUsers: 72.4, growth: 12.6, sessions: '8.4k', health: 92 }; }
}

let accountState = { account: null, members: [], hasAccounts: false };

function currentAccount() { return accountState.account; }

function readAccounts() { return accountState.members; }

async function accountRequest(path, method = 'GET', payload) {
  const response = await fetch(path, { method, credentials: 'same-origin', headers: payload ? { 'Content-Type': 'application/json' } : {}, body: payload ? JSON.stringify(payload) : undefined });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(Error(result.error || 'Request failed'), { status: response.status });
  return result;
}

function accountError(error) {
  const message = String(error.message || '');
  if (language !== 'zh') return message;
  if (error.status === 429) return '尝试次数过多，请稍后重试。';
  if (error.status === 403) return '当前账户没有此操作权限。';
  if (error.status === 401) return message.includes('Current password') ? '当前密码不正确。' : '邮箱或密码不正确，请重新登录。';
  if (message.includes('already registered')) return '该邮箱已经注册。';
  if (message.includes('limit reached')) return '本地服务账户已达上限。';
  if (message.includes('Sign in required')) return '请先登录。';
  return '操作失败，请检查输入或稍后重试。';
}

async function refreshAccountSession() {
  try {
    const result = await accountRequest('/api/auth/me');
    accountState = { account: result.account || null, members: result.members || [], hasAccounts: !!result.hasAccounts };
    updateAccountButton();
    return true;
  } catch {
    accountState = { account: null, members: [], hasAccounts: false };
    updateAccountButton();
    return false;
  }
}

function accountInitials(account) {
  const value = String(account?.name || account?.email || '访客').trim();
  return value.slice(0, 2).toUpperCase();
}

function updateAccountButton() {
  const button = $('#accountButton');
  const account = currentAccount();
  if (!button) return;
  button.textContent = account ? accountInitials(account) : (language === 'zh' ? '访客' : 'Guest');
  button.title = account ? `${account.name} · ${account.role === 'admin' ? (language === 'zh' ? '管理员' : 'Admin') : (language === 'zh' ? '成员' : 'Member')}` : (language === 'zh' ? '登录或注册' : 'Sign in or register');
  button.setAttribute('aria-label', button.title);
}

async function openAccount() {
  accountOverlay.classList.add('open');
  accountOverlay.setAttribute('aria-hidden', 'false');
  $('#accountBody').innerHTML = `<p class="account-note">${language === 'zh' ? '正在加载账户…' : 'Loading account…'}</p>`;
  const ready = await refreshAccountSession();
  if (!accountOverlay.classList.contains('open')) return;
  renderAccountPanel(currentAccount() ? 'profile' : 'login', ready ? '' : (language === 'zh' ? '账户服务暂时不可用。' : 'Account service is unavailable.'));
  $('#accountEmail, #profileName')?.focus();
}

function closeAccount() {
  accountOverlay.classList.remove('open');
  accountOverlay.setAttribute('aria-hidden', 'true');
  $('#accountButton').focus();
}

function renderAccountPanel(view = currentAccount() ? 'profile' : 'login', alertText = '') {
  const body = $('#accountBody');
  if (!body) return;
  const account = currentAccount();
  const accounts = readAccounts();
  if (account && view === 'profile') {
    const members = account.role === 'admin' ? `<div class="account-section"><div class="account-section-head"><strong>${language === 'zh' ? '成员管理' : 'Member management'}</strong><small>${accounts.length} ${language === 'zh' ? '个账户' : 'accounts'}</small></div><div class="account-member-list">${accounts.map(member => `<div class="account-member"><span class="account-member-avatar">${escapeHtml(accountInitials(member))}</span><span><strong>${escapeHtml(member.name)}</strong><small>${escapeHtml(member.email)} · ${member.role === 'admin' ? (language === 'zh' ? '管理员' : 'Admin') : (language === 'zh' ? '成员' : 'Member')}</small></span><span class="account-member-actions">${member.id === account.id ? `<span class="account-badge admin">${language === 'zh' ? '当前账户' : 'Current'}</span>` : `<select data-account-role="${escapeHtml(member.id)}" aria-label="${language === 'zh' ? '账户角色' : 'Account role'}"><option value="member"${member.role === 'member' ? ' selected' : ''}>${language === 'zh' ? '成员' : 'Member'}</option><option value="admin"${member.role === 'admin' ? ' selected' : ''}>${language === 'zh' ? '管理员' : 'Admin'}</option></select><button type="button" data-delete-account="${escapeHtml(member.id)}">${language === 'zh' ? '移除' : 'Remove'}</button>`}</span></div>`).join('')}</div></div>` : '';
    body.innerHTML = `<div class="account-profile"><div class="account-avatar-large">${escapeHtml(accountInitials(account))}</div><div class="account-meta"><strong>${escapeHtml(account.name)}</strong><small>${escapeHtml(account.email)}</small><div class="account-badges"><span class="account-badge">${language === 'zh' ? '服务端会话' : 'Server session'}</span><span class="account-badge admin">${account.role === 'admin' ? (language === 'zh' ? '管理员' : 'Admin') : (language === 'zh' ? '成员' : 'Member')}</span></div></div></div><div class="account-section"><div class="account-section-head"><strong>${language === 'zh' ? '个人资料' : 'Profile'}</strong><small>${language === 'zh' ? '保存在当前服务器' : 'Saved on this server'}</small></div><form class="account-form" id="profileForm"><label>${language === 'zh' ? '显示名称' : 'Display name'}<input id="profileName" required maxlength="40" autocomplete="name" value="${escapeHtml(account.name)}"></label><label>${language === 'zh' ? '当前密码（修改密码时填写）' : 'Current password (to change password)'}<input id="profileCurrentPassword" type="password" autocomplete="current-password"></label><label>${language === 'zh' ? '新密码（可选）' : 'New password (optional)'}<input id="profilePassword" type="password" minlength="10" autocomplete="new-password"></label><button class="primary-button" type="submit">${language === 'zh' ? '保存资料' : 'Save profile'}</button></form></div>${members}<p class="account-note">${language === 'zh' ? '项目内容仍保存在此浏览器，不随账号同步。' : 'Project content remains in this browser and does not sync with the account.'}</p><div class="account-footer"><button class="secondary-button" type="button" id="accountLogout">${language === 'zh' ? '退出登录' : 'Sign out'}</button></div>`;
    $('#profileForm').addEventListener('submit', async event => {
      event.preventDefault();
      try {
        const result = await accountRequest('/api/auth/profile', 'PATCH', { name: $('#profileName').value.trim(), currentPassword: $('#profileCurrentPassword').value, password: $('#profilePassword').value });
        accountState.account = result.account; accountState.members = result.members || [];
        updateAccountButton(); renderAccountPanel(); showToast(language === 'zh' ? '账户资料已更新' : 'Account profile updated');
      } catch (error) { showToast(accountError(error)); }
    });
    $('#accountLogout').addEventListener('click', async () => {
      try { await accountRequest('/api/auth/logout', 'POST'); accountState = { account: null, members: [], hasAccounts: true }; updateAccountButton(); renderAccountPanel('login'); showToast(language === 'zh' ? '已退出登录' : 'Signed out'); }
      catch (error) { showToast(accountError(error)); }
    });
    $$('[data-account-role]', body).forEach(select => select.addEventListener('change', async () => {
      try { const result = await accountRequest(`/api/auth/members/${encodeURIComponent(select.dataset.accountRole)}`, 'PATCH', { role: select.value }); accountState.members = result.members; renderAccountPanel(); showToast(language === 'zh' ? '成员角色已更新' : 'Member role updated'); }
      catch (error) { renderAccountPanel(); showToast(accountError(error)); }
    }));
    $$('[data-delete-account]', body).forEach(button => button.addEventListener('click', async () => {
      const target = accounts.find(item => item.id === button.dataset.deleteAccount);
      if (!target || !window.confirm(language === 'zh' ? `确定移除“${target.name}”吗？该账户会立即退出，操作无法撤销。` : `Remove “${target.name}”? Their sessions will end immediately.`)) return;
      try { const result = await accountRequest(`/api/auth/members/${encodeURIComponent(target.id)}`, 'DELETE'); accountState.members = result.members; renderAccountPanel(); showToast(language === 'zh' ? '成员已移除' : 'Member removed'); }
      catch (error) { showToast(accountError(error)); }
    }));
    return;
  }
  const register = view === 'register';
  let legacyAccounts = 0;
  try { legacyAccounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY))?.length || 0; } catch { /* Ignore invalid legacy data. */ }
  body.innerHTML = `<div class="account-switch"><button type="button" class="${register ? '' : 'active'}" data-account-view="login">${language === 'zh' ? '登录' : 'Sign in'}</button><button type="button" class="${register ? 'active' : ''}" data-account-view="register">${language === 'zh' ? '注册' : 'Register'}</button></div>${alertText ? `<div class="account-alert" role="alert">${escapeHtml(alertText)}</div>` : ''}<form class="account-form" id="accountForm"><label>${language === 'zh' ? '邮箱' : 'Email'}<input id="accountEmail" type="email" autocomplete="email" required placeholder="name@example.com"></label>${register ? `<label>${language === 'zh' ? '显示名称' : 'Display name'}<input id="accountName" maxlength="40" autocomplete="name" required placeholder="${language === 'zh' ? '你的名称' : 'Your name'}"></label>` : ''}<label>${language === 'zh' ? '密码' : 'Password'}<input id="accountPassword" type="password" minlength="10" autocomplete="${register ? 'new-password' : 'current-password'}" required placeholder="${language === 'zh' ? '至少 10 位' : 'At least 10 characters'}"></label>${register ? `<label>${language === 'zh' ? '确认密码' : 'Confirm password'}<input id="accountPasswordConfirm" type="password" minlength="10" autocomplete="new-password" required></label>` : ''}<button class="primary-button" type="submit">${register ? (language === 'zh' ? '创建账户' : 'Create account') : (language === 'zh' ? '登录' : 'Sign in')}</button></form><p class="account-note">${legacyAccounts ? (language === 'zh' ? '旧版本地账户需重新注册；原本地项目数据仍保留。' : 'Older local accounts need to register again; local projects remain.') : (language === 'zh' ? '账户由服务器管理；项目内容仍保存在此浏览器。' : 'Accounts are managed by the server; projects remain in this browser.')}</p>`;
  $$('[data-account-view]', body).forEach(button => button.addEventListener('click', () => renderAccountPanel(button.dataset.accountView)));
  $('#accountForm').addEventListener('submit', async event => {
    event.preventDefault();
    const email = $('#accountEmail').value.trim().toLowerCase();
    const password = $('#accountPassword').value;
    if (register && password !== $('#accountPasswordConfirm').value) { renderAccountPanel('register', language === 'zh' ? '两次输入的密码不一致。' : 'Passwords do not match.'); return; }
    const button = $('#accountForm button[type="submit"]'); button.disabled = true;
    try {
      const result = await accountRequest(register ? '/api/auth/register' : '/api/auth/login', 'POST', register ? { email, name: $('#accountName').value.trim(), password } : { email, password });
      accountState = { account: result.account, members: result.members || [], hasAccounts: true };
      updateAccountButton(); renderAccountPanel('profile'); showToast(register ? (language === 'zh' ? '账户已创建' : 'Account created') : (language === 'zh' ? '登录成功' : 'Signed in'));
    } catch (error) { renderAccountPanel(register ? 'register' : 'login', accountError(error)); }
  });
}
function readMediaAssets() {
  try {
    const value = JSON.parse(localStorage.getItem(MEDIA_ASSETS_KEY));
    return Array.isArray(value) ? value.filter(asset => {
      if (!asset || !/^[a-zA-Z0-9-]{1,100}$/.test(asset.id) || !['image', 'video'].includes(asset.kind)) return false;
      if (asset.kind === 'image') {
        try { const url = new URL(asset.poster, location.href); if (url.origin === 'http://127.0.0.1:4175' && location.hostname === '127.0.0.1') asset.poster = new URL(url.pathname, location.origin).href; else if (url.origin !== location.origin) return false; return /^\/generated-media\/(?:[a-f\d-]{36}\/)?[a-zA-Z0-9._-]+\.(png|jpe?g|webp)$/.test(url.pathname); }
        catch { return false; }
      }
      return true;
    }) : [];
  } catch { return []; }
}

function persistMediaAssets(assets) {
  try { localStorage.setItem(MEDIA_ASSETS_KEY, JSON.stringify(assets.slice(0, 40))); return true; }
  catch { showToast(language === 'zh' ? '媒体资产存储空间不足，请导出项目备份' : 'Media storage is full. Export a project backup.'); return false; }
}

function videoStore() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('omni-space-video-assets', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('videos');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveVideoBlob(id, blob) {
  const db = await videoStore();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('videos', 'readwrite');
    transaction.objectStore('videos').put(blob, `${localStorage.getItem(ACTIVE_PROJECT_KEY)}:${id}`);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

async function deleteVideoBlob(id) {
  const db = await videoStore();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('videos', 'readwrite');
    transaction.objectStore('videos').delete(`${localStorage.getItem(ACTIVE_PROJECT_KEY)}:${id}`);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

async function deleteMediaAsset(id) {
  const assets = readMediaAssets();
  const asset = assets.find(item => item.id === id);
  if (!asset) return;
  if (!persistMediaAssets(assets.filter(item => item.id !== id))) return;
  if (asset.localFile) { try { await deleteVideoBlob(id); } catch { /* Metadata is already removed. */ } }
  const url = videoObjectUrls.get(id); if (url) { URL.revokeObjectURL(url); videoObjectUrls.delete(id); }
  renderMediaCanvasNodes(); persist();
  if ($('.mode-button.active')?.dataset.mode === 'media' || $('.mode-button.active')?.dataset.mode === 'video') renderModeWorkspace($('.mode-button.active').dataset.mode);
  showToast(language === 'zh' ? '媒体资产已从项目移除' : 'Media asset removed from project');
}

async function videoBlobUrl(id) {
  if (videoObjectUrls.has(id)) return videoObjectUrls.get(id);
  const db = await videoStore();
  const blob = await new Promise((resolve, reject) => {
    const request = db.transaction('videos').objectStore('videos').get(`${localStorage.getItem(ACTIVE_PROJECT_KEY)}:${id}`);
    request.onsuccess = () => { db.close(); resolve(request.result); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  videoObjectUrls.set(id, url);
  return url;
}

async function hydrateVideoElements(root = document) {
  for (const video of $$('video[data-video-asset]', root)) {
    try {
      const url = await videoBlobUrl(video.dataset.videoAsset);
      if (!video.isConnected) continue;
      if (url) video.src = url;
      else video.replaceWith(Object.assign(document.createElement('span'), { className: 'video-missing', textContent: language === 'zh' ? '视频文件不在当前浏览器' : 'Video unavailable in this browser' }));
    } catch { if (video.isConnected) video.replaceWith(Object.assign(document.createElement('span'), { className: 'video-missing', textContent: language === 'zh' ? '视频读取失败' : 'Video could not be loaded' })); }
  }
}

function validateVideoFile(file) {
  return new Promise(resolve => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    const finish = valid => { video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); resolve(valid); };
    video.preload = 'metadata';
    video.onloadedmetadata = () => finish(video.videoWidth > 0 && video.videoHeight > 0);
    video.onerror = () => finish(false);
    video.src = url;
  });
}

function mediaPoster(kind, text, accent = '#7c6aff') {
  const safe = String(text || (kind === 'video' ? 'VIDEO PREVIEW' : 'IMAGE PREVIEW')).replace(/[<>&"']/g, '');
  const label = safe.slice(0, 34);
  const bg = kind === 'video' ? '#102d3b' : '#20253d';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${accent}" stop-opacity=".72"/><stop offset="1" stop-color="${bg}"/></linearGradient></defs><rect width="640" height="360" fill="${bg}"/><circle cx="510" cy="74" r="80" fill="${accent}" opacity=".25"/><path d="M0 294 168 174l110 72 102-104 260 152v66H0z" fill="url(#g)" opacity=".9"/><path d="M0 315 190 219l112 45 112-91 226 122v65H0z" fill="#0c1118" opacity=".72"/><text x="34" y="48" fill="#dfe4ec" font-family="Arial,sans-serif" font-size="18" font-weight="700">${kind === 'video' ? 'VIDEO MOTION PREVIEW' : 'IMAGE PREVIEW'}</text><text x="34" y="330" fill="#b9c3d2" font-family="Arial,sans-serif" font-size="16">${label}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function assetKindLabel(kind) { return kind === 'video' ? (language === 'zh' ? '视频资产' : 'Video asset') : (language === 'zh' ? '图片资产' : 'Image asset'); }

function assetStatusLabel(asset) {
  if (asset.kind === 'image') return language === 'zh' ? '已生成' : 'Generated';
  return asset.localFile ? (language === 'zh' ? '本地视频' : 'Local video') : (language === 'zh' ? '动效草稿' : 'Motion draft');
}

function renderMediaCanvasNodes() {
  $$('.generated-media-node').forEach(node => node.remove());
  const assets = readMediaAssets();
  if (assets.length) {
    const node = document.createElement('article');
    node.className = 'graph-node selectable user-node generated-media-node';
    node.dataset.node = 'media-output-bundle';
    node.dataset.assetIds = assets.map(asset => asset.id).join(',');
    const previews = ['image', 'video'].map(kind => assets.find(asset => asset.kind === kind)).filter(Boolean);
    node.innerHTML = `<div class="node-kicker pink">${language === 'zh' ? '媒体资产' : 'MEDIA ASSETS'} <span class="node-id">${assets.length}</span></div><div class="generated-media-gallery">${previews.map(asset => `<div class="generated-media-tile" title="${escapeHtml(asset.prompt || assetKindLabel(asset.kind))}"><div class="generated-media-visual">${asset.kind === 'video' ? (asset.localFile ? `<video controls playsinline preload="metadata" data-video-asset="${escapeHtml(asset.id)}"></video>` : '<div class="canvas-video-motion"><span>▶</span></div>') : `<img src="${escapeHtml(asset.poster)}" alt="${escapeHtml(asset.prompt || assetKindLabel(asset.kind))}" loading="eager" decoding="async">`}</div><div class="generated-media-caption"><small class="asset-status ${asset.kind === 'video' && !asset.localFile ? 'draft' : ''}">${assetStatusLabel(asset)}</small><button type="button" data-open-media="${asset.kind}" title="${language === 'zh' ? '打开' : 'Open'} ${assetKindLabel(asset.kind)}" aria-label="${language === 'zh' ? '打开' : 'Open'} ${assetKindLabel(asset.kind)}">↗</button></div></div>`).join('')}</div><div class="generated-media-meta"><strong>${language === 'zh' ? `${assets.length} 个资产` : `${assets.length} assets`}</strong><small>${language === 'zh' ? '来自媒体集合' : 'From media set'}</small></div>`;
    const savedLeft = Number(assets[0].left); const savedTop = Number(assets[0].top);
    const legacyPosition = savedLeft === 54 && savedTop === 585;
    node.style.left = `${!legacyPosition && Number.isFinite(savedLeft) ? savedLeft : 714}px`;
    node.style.top = `${!legacyPosition && Number.isFinite(savedTop) ? savedTop : 620}px`;
    canvasContent.appendChild(node);
    bindNode(node);
    node.querySelectorAll('[data-open-media]').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); setMode(button.dataset.openMedia === 'video' ? 'video' : 'media'); }));
    hydrateVideoElements(node);
  }
  const summary = $('.media-copy span');
  if (summary) summary.textContent = assets.length ? (language === 'zh' ? `${assets.filter(a => a.kind === 'image').length} 张图片 · ${assets.filter(a => a.kind === 'video').length} 个视频 / 草稿` : `${assets.filter(a => a.kind === 'image').length} images · ${assets.filter(a => a.kind === 'video').length} videos / drafts`) : (language === 'zh' ? '暂无媒体资产' : 'No media assets');
  $('.media-copy small').textContent = language === 'zh' ? '项目媒体库' : 'Project media library';
  $('.media-copy strong').textContent = language === 'zh' ? '发布视觉系统' : 'Launch visual system';
  const canvasStatus = $('.canvas-status');
  if (canvasStatus) canvasStatus.innerHTML = `<span class="pulse-dot"></span> ${language === 'zh' ? '所有更改已保存' : 'All changes saved'} <span class="status-separator">·</span> ${$$('.graph-node').length} ${language === 'zh' ? '个本地节点' : 'local nodes'}`;
  updateConnectors();
}

function cloneValue(value) {
  try { return structuredClone(value); }
  catch { return JSON.parse(JSON.stringify(value)); }
}

function persistProjectData() { localStorage.setItem(PROJECT_KEY, JSON.stringify(projectData)); }

function updateProjectDataViews() {
  const dataNode = $('.data-node h2'); if (dataNode) dataNode.innerHTML = `${projectData.activeUsers}% <span>${language === 'zh' ? '活跃用户' : 'Active users'}</span>`;
  const dataLine = $('.data-node .data-line span'); if (dataLine) dataLine.style.width = `${Math.max(0, Math.min(100, projectData.activeUsers))}%`;
  $$('.metric-card strong').forEach((node, index) => { node.textContent = [`${projectData.activeUsers}%`, projectData.sessions, projectData.health][index]; });
}

function loadConfig() {
  try { return { ...defaultConfig, ...(JSON.parse(localStorage.getItem(CONFIG_KEY)) || {}), imageModel: 'gpt-image-2', imageEndpoint: defaultConfig.imageEndpoint }; } catch { return { ...defaultConfig }; }
}

function defaultPresentation() {
  return [
    { id: 'scene-01', title: '从想法到执行', notes: '用一句话说明这个项目解决什么问题，以及为什么现在要做。', html: '<main class="slide cover"><div class="eyebrow">OMNI SPACE · CAMPUS AI</div><h1>让校园生活<br><em>更容易找到方向。</em></h1><p>一个可执行的空间，把想法直接变成产品。</p><div class="slide-meta"><span>01 / 03</span><span>校园 AI 服务</span></div></main>', css: ':root{font-family:Inter,Arial,sans-serif;color:#f7f8fb;background:#11152a}*{box-sizing:border-box}body{margin:0}.slide{height:100vh;padding:10% 11%;position:relative;overflow:hidden;background:radial-gradient(circle at 80% 18%,#5968c8 0,transparent 18%),linear-gradient(135deg,#191f42,#0f1220 70%)}.slide:after{content:"";position:absolute;inset:46% -10% -30%;border-top:1px solid #69d4e9;transform:rotate(-8deg);opacity:.55}.eyebrow{font-size:12px;letter-spacing:.16em;color:#94a2ff}.slide h1{position:relative;z-index:1;margin:20px 0;font-size:clamp(34px,6vw,78px);line-height:1.02;letter-spacing:-.05em}.slide h1 em{color:#8cf0d0;font-style:normal}.slide p{position:relative;z-index:1;max-width:420px;color:#aeb9cf;font-size:18px;line-height:1.5}.slide-meta{position:absolute;z-index:1;left:11%;right:11%;bottom:9%;display:flex;justify-content:space-between;color:#8190ac;font-size:12px}' },
    { id: 'scene-02', title: '数据正在发生', notes: '先讲结果，再讲来源。右侧指标来自项目图谱中的实时数据节点。', html: '<main class="slide data"><div class="eyebrow">LIVE PROJECT SIGNALS</div><h1>{{metric.activeUsers}}</h1><p>活跃用户正在持续增长，产品已经进入真实使用阶段。</p><section class="metrics"><div><strong>+{{metric.growth}}</strong><small>环比增长</small></div><div><strong>{{metric.sessions}}</strong><small>本周会话</small></div><div><strong>{{metric.health}}</strong><small>健康度</small></div></section><div class="bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></main>', css: ':root{font-family:Inter,Arial,sans-serif;color:#f5fbff;background:#0c1720}*{box-sizing:border-box}body{margin:0}.slide{height:100vh;padding:9% 11%;background:linear-gradient(145deg,#102d3b,#0d151d 68%)}.eyebrow{font-size:12px;letter-spacing:.16em;color:#66d7e7}.slide h1{margin:32px 0 5px;font-size:clamp(68px,12vw,150px);letter-spacing:-.08em;color:#8cf0d0}.slide p{max-width:470px;color:#a8b7c9;font-size:18px;line-height:1.5}.metrics{display:flex;gap:44px;margin-top:54px}.metrics div{display:grid;gap:7px}.metrics strong{font-size:28px}.metrics small{color:#73899e;font-size:11px}.bars{display:flex;align-items:end;gap:9px;height:150px;margin-top:20px}.bars i{display:block;width:26px;border-radius:4px 4px 0 0;background:linear-gradient(#63dcab,#3e7584)}.bars i:nth-child(1){height:35%}.bars i:nth-child(2){height:50%}.bars i:nth-child(3){height:43%}.bars i:nth-child(4){height:70%}.bars i:nth-child(5){height:63%}.bars i:nth-child(6){height:84%}.bars i:nth-child(7){height:100%}' },
    { id: 'scene-03', title: '一起把它发布', notes: '最后回到行动：从演示、网页到 3D 和媒体，所有输出都来自同一个项目图谱。', html: '<main class="slide close"><div class="eyebrow">ONE PROJECT · MANY OUTPUTS</div><h1>想法、代码、<br><em>现场。</em></h1><p>从画布开始，在同一个空间里完成设计、构建、审查和发布。</p><button>开始运行 →</button><div class="slide-meta"><span>03 / 03</span><span>Think anywhere. Build directly.</span></div></main>', css: ':root{font-family:Inter,Arial,sans-serif;color:#fbf8ff;background:#21192b}*{box-sizing:border-box}body{margin:0}.slide{height:100vh;padding:11% 11%;position:relative;overflow:hidden;background:radial-gradient(circle at 18% 22%,#9952b5 0,transparent 22%),linear-gradient(145deg,#291e3c,#10131d 75%)}.eyebrow{font-size:12px;letter-spacing:.16em;color:#ffc64d}.slide h1{margin:22px 0 14px;font-size:clamp(38px,7vw,88px);line-height:1.02;letter-spacing:-.06em}.slide h1 em{color:#ffc64d;font-style:normal}.slide p{max-width:500px;color:#c1b9cd;font-size:18px;line-height:1.5}.slide button{margin-top:28px;padding:13px 18px;border:1px solid #ffc64d;border-radius:5px;color:#241b2d;background:#ffc64d;font-weight:700}.slide-meta{position:absolute;left:11%;right:11%;bottom:9%;display:flex;justify-content:space-between;color:#9d8cad;font-size:12px}' }
  ];
}

function normalizePresentationScenes(scenes) {
  return scenes.map((scene, index) => ({
    ...scene,
    id: typeof scene.id === 'string' && scene.id ? scene.id : `scene-${Date.now()}-${index}`,
    title: typeof scene.title === 'string' ? scene.title : `场景 ${index + 1}`,
    notes: typeof scene.notes === 'string' ? scene.notes : '',
    html: typeof scene.html === 'string' ? scene.html : '<main class="slide"><h1>未命名场景</h1></main>',
    css: typeof scene.css === 'string' ? scene.css : '',
    transition: presentationTransitions.includes(scene.transition) ? scene.transition : 'fade',
    duration: Number.isFinite(Number(scene.duration)) ? Math.max(1, Math.min(30, Number(scene.duration))) : 3.5
  }));
}

function loadPresentation() {
  try {
    const value = JSON.parse(localStorage.getItem(PRESENTATION_KEY));
    if (!Array.isArray(value) || !value.length) return normalizePresentationScenes(defaultPresentation());
    const legacy = value.find(scene => scene.id === 'scene-02' && scene.html?.includes('<h1>72.4<span>%</span></h1>'));
    if (legacy) legacy.html = legacy.html.replace('<h1>72.4<span>%</span></h1>', '<h1>{{metric.activeUsers}}</h1>');
    return normalizePresentationScenes(value);
  } catch { return normalizePresentationScenes(defaultPresentation()); }
}

function persistPresentation() { localStorage.setItem(PRESENTATION_KEY, JSON.stringify(presentation.scenes)); }

function setKicker(selector, label, id) {
  const node = $(selector);
  if (node) node.innerHTML = `${label} <span class="node-id">${id}</span>`;
}

function applyLanguage() {
  const t = copy[language];
  window.__omniCopy = t;
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  $('#languageButton').textContent = language === 'zh' ? '中 / EN' : '中文 / EN';
  $('#languageButton').setAttribute('aria-label', language === 'zh' ? '切换语言' : 'Switch language');
  $('#modelConfigButton').setAttribute('aria-label', language === 'zh' ? '打开模型配置' : 'Open model configuration');
  $('#accountTitle').textContent = language === 'zh' ? '账户与成员' : 'Account & members';
  $('#accountSubtitle').textContent = language === 'zh' ? '服务端账户 · 登录状态受服务端管理' : 'Server accounts · sessions managed by the server';
  updateAccountButton();
  $('.project-switcher span:nth-child(2)').textContent = projectData.title || t.project;
  $('.sync-status').innerHTML = `<span class="pulse-dot"></span> ${t.live}`;
  $('.share-button').innerHTML = `<span>↗</span> ${t.share}`;
  $('#runButton').innerHTML = `<span class="play-glyph">${$('#runButton').classList.contains('running') ? '■' : '▶'}</span> ${$('#runButton').classList.contains('running') ? t.running : t.run}`;
  $$('.mode-button').forEach(button => { const label = button.querySelector('span:last-child'); if (label) label.textContent = t.modes[button.dataset.mode]; button.setAttribute('aria-label', t.modes[button.dataset.mode]); });
  const activeMode = $('.mode-button.active')?.dataset.mode || 'canvas';
  $('#viewLabel').textContent = t.modes[activeMode]; $('.breadcrumb .muted').textContent = t.sub[activeMode];
  $('.command-button').innerHTML = `<span class="command-key">⌘</span>K <span class="muted">${t.command}</span>`;
  $('.canvas-title-block .eyebrow').innerHTML = `<span class="eyebrow-dot"></span> ${language === 'zh' ? '项目图谱 · V24' : 'PROJECT GRAPH · V24'}`;
  $('.canvas-title-block h1').textContent = projectData.title || t.project;
  $('.canvas-title-block p').textContent = language === 'zh' ? '一个空间，多种输出。从同一份源内容完成构建、测试、演示和发布。' : 'One space, many outputs. Build, test, present, and publish from the same source.';
  setKicker('.goal-node .node-kicker', language === 'zh' ? '项目目标' : 'PROJECT GOAL', 'T-01');
  setKicker('.flow-node .node-kicker', language === 'zh' ? '用户流程' : 'USER FLOW', 'F-02');
  setKicker('.app-node .node-kicker', language === 'zh' ? '网页应用' : 'WEB APP', 'W-04');
  setKicker('.data-node .node-kicker', language === 'zh' ? '数据' : 'DATA', 'D-07');
  setKicker('.scene-node .node-kicker', language === 'zh' ? '3D 场景' : '3D SCENE', '3D-03');
  setKicker('.presentation-node .node-kicker', language === 'zh' ? '演示文稿' : 'PRESENTATION', 'P-09');
  setKicker('.media-node .node-kicker', language === 'zh' ? '媒体集合' : 'MEDIA SET', 'M-12');
  $('.goal-node p').textContent = language === 'zh' ? '一个空间 · 多种输出' : 'One space · many outputs';
  $('.canvas-minimap .mini-map-label').textContent = t.map;
  $('.canvas-status').innerHTML = `<span class="pulse-dot"></span> ${t.saved} <span class="status-separator">·</span> 8 ${t.nodes}`;
  $('.panel-heading h2').textContent = t.team; $('.panel-heading p').textContent = t.teamSub;
  $('.panel-heading .eyebrow').textContent = language === 'zh' ? 'AI 操作系统' : 'AI OPERATING SYSTEM';
  $$('.section-label').forEach(label => { if (label.closest('.provider-section')) label.childNodes[0].textContent = `${t.provider} `; if (label.closest('.activity-section')) label.childNodes[0].textContent = language === 'zh' ? '本地审查记录 ' : 'Local Audit Log '; });
  $('.provider-row[data-provider="image"] strong').textContent = language === 'zh' ? '图片生成' : 'Image generation';
  $('.provider-row[data-provider="video"] strong').textContent = language === 'zh' ? '视频生成' : 'Video generation';
  $$('.agent-card').forEach(card => { const detail = card.querySelector('small'); const state = card.querySelector('.agent-state'); if (detail) detail.textContent = card.dataset.agent === 'Inspector' ? (language === 'zh' ? '本地规则审查' : 'Local rule audit') : (language === 'zh' ? '本地配置 · 未执行' : 'Local config · not executed'); if (state) state.textContent = card.dataset.agent === 'Inspector' ? (language === 'zh' ? '本地' : 'Local') : (language === 'zh' ? '配置' : 'Config'); });
  $('#providerConfigButton').textContent = t.manage; $('.health-top span:first-child').textContent = language === 'zh' ? '本地审查' : 'Local Audit'; $('.health-label').textContent = $('.health-card').dataset.status || (language === 'zh' ? '待检查' : 'Not checked'); $('#auditButton').innerHTML = `${t.audit} <span>→</span>`;
  if (!$('.health-card').dataset.status) $('.health-meta').textContent = language === 'zh' ? '运行后显示本地规则检查结果' : 'Run to see local rule check results';
  if (!$('.activity-section').dataset.audited) { $('.activity-item .activity-time').textContent = '—'; $('.activity-item span:last-child').textContent = language === 'zh' ? '尚未运行本地审查' : 'No local audit has been run'; }
  const providerSmall = $('.provider-row[data-provider="image"] small'); if (providerSmall) providerSmall.textContent = modelConfig.providerEnabled ? `${modelConfig.imageModel} · ${language === 'zh' ? '未验证连接' : 'Connection unverified'}` : t.disabled;
  const videoSmall = $('.provider-row[data-provider="video"] small'); if (videoSmall) videoSmall.textContent = language === 'zh' ? '生成服务未接入 · 可导入本地视频' : 'Generation unavailable · local import works';
  $('.provider-row[data-provider="image"] .provider-dot').classList.toggle('dim', !modelConfig.providerEnabled);
  $('.provider-row[data-provider="video"] .provider-dot').classList.add('dim');
  checkMediaService();
  applyConfigLanguage();
  applyPresentationLanguage();
  const activeWorkspace = $('.mode-button.active')?.dataset.mode;
  if (activeWorkspace && activeWorkspace !== 'canvas' && !modeWorkspace.hidden && !$('#presentationOverlay').classList.contains('open')) renderModeWorkspace(activeWorkspace);
  renderMediaCanvasNodes();
  updateProjectDataViews();
  if (accountOverlay.classList.contains('open')) renderAccountPanel(currentAccount() ? 'profile' : 'login');
}

async function checkMediaService() {
  const label = $('.provider-row[data-provider="image"] small');
  try {
    const response = await fetch('/api/health');
    const status = await response.json();
    if (label && modelConfig.providerEnabled) label.textContent = status.imageReady ? `gpt-image-2 · ${language === 'zh' ? '本地代理就绪' : 'Local proxy ready'}` : `gpt-image-2 · ${language === 'zh' ? '未配置密钥' : 'Key not configured'}`;
    $('.provider-row[data-provider="image"] .provider-dot').classList.toggle('dim', !status.imageReady || !modelConfig.providerEnabled);
  } catch {
    if (label && modelConfig.providerEnabled) label.textContent = language === 'zh' ? '图片服务未启动' : 'Image service offline';
    $('.provider-row[data-provider="image"] .provider-dot').classList.add('dim');
  }
}

function applyPresentationLanguage() {
  const t = copy[language].presentation;
  const map = { presentationBackLabel: t.back, presentationPrint: t.print, presentationExport: t.export, presentationPreview: t.preview, visualTab: t.visual, codeTab: t.code, sceneTitleLabel: t.title, sceneNotesLabel: t.notes, syncPresentation: t.refresh, saveScene: t.save, playPresentation: t.play };
  Object.entries(map).forEach(([id, value]) => { const node = $(`#${id}`); if (node) node.textContent = value; });
  const heading = $('#presentationHeading'); if (heading) heading.textContent = `${projectData.title} · ${language === 'zh' ? '交互式演示' : 'Interactive Presentation'}`;
  const notes = $('#sceneNotes'); if (notes) notes.placeholder = t.notesPlaceholder;
  const sceneHead = $('.presentation-section-head span'); if (sceneHead) sceneHead.innerHTML = `${t.scene} <small id="sceneCount">${presentation.scenes.length}</small>`;
  const dataTitle = $('.binding-box strong'); if (dataTitle) dataTitle.textContent = t.data;
  const metricLabel = $('#activeUsersMetric')?.closest('label'); if (metricLabel) metricLabel.firstChild.textContent = t.activeUsers;
  const bindingLabels = { growthMetric: t.growth, sessionsMetric: t.sessions, healthMetric: t.health, sceneTransition: t.transition, sceneDuration: t.duration };
  Object.entries(bindingLabels).forEach(([id, value]) => { const label = $(`#${id}`)?.closest('label'); if (label) label.firstChild.textContent = value; });
  const status = $('.stage-status'); if (status) status.innerHTML = `<span class="pulse-dot"></span> ${t.live}`;
  if (presentation.playing) $('#playPresentation').innerHTML = `<span>Ⅱ</span> ${t.pause}`;
  else $('#playPresentation').innerHTML = `<span>▶</span> ${t.play}`;
  $('#duplicateScene').textContent = language === 'zh' ? '复制' : 'Duplicate';
  $('#deleteScene').textContent = language === 'zh' ? '删除' : 'Delete';
  $('.notes-card .eyebrow').textContent = language === 'zh' ? '演讲备注' : 'SPEAKER NOTES';
  $('.binding-box .eyebrow').textContent = language === 'zh' ? '数据绑定' : 'DATA BINDING';
  $('.binding-box p').innerHTML = language === 'zh' ? '<code>{{project.title}}</code> · <code>{{metric.activeUsers}}</code>' : '<code>{{project.title}}</code> · <code>{{metric.activeUsers}}</code>';
  $('#presentationPreview').textContent = $('#presentationOverlay').classList.contains('preview-mode') ? (language === 'zh' ? '返回编辑' : 'Back to editor') : t.preview;
  const labels = {addScene:['新增场景','Add scene'],moveSceneUp:['上移场景','Move scene up'],moveSceneDown:['下移场景','Move scene down'],previousScene:['上一场景','Previous scene'],nextScene:['下一场景','Next scene'],stageFullscreen:['全屏预览','Fullscreen'],sceneUndo:['撤销场景操作','Undo scene change'],sceneRedo:['重做场景操作','Redo scene change']};
  Object.entries(labels).forEach(([id, values]) => { const element = $(`#${id}`); if (element) { element.title = values[language === 'zh' ? 0 : 1]; element.setAttribute('aria-label', element.title); } });
  updateSceneSaveState();
  updatePresentationValidation();
}

function applyConfigLanguage() {
  const t = copy[language];
  $('#configTitle').textContent = t.model; $('#configSubtitle').textContent = t.modelSub; $('#configConnection').textContent = t.savedConfig;
  $('.config-summary small').textContent = language === 'zh' ? '配置保存在当前浏览器，生成服务尚未接入。' : 'Settings are stored in this browser. Generation is not connected.';
  $('.connection-state').textContent = language === 'zh' ? '未验证连接' : 'Not verified'; $('#configSave').textContent = t.save; $('#configCancel').textContent = t.cancel;
  $('#configSavedAt').textContent = `${t.lastSaved}：${modelConfig.savedAt}`; $('#keyStatus').textContent = language === 'zh' ? '未连接服务端密钥管理' : 'Server key management not connected'; $('#keyAction').textContent = language === 'zh' ? '密钥状态' : 'Key status';
  $('.toggle-row strong').textContent = modelConfig.providerEnabled ? t.enabled : t.disabled;
  $('#imageEndpoint').previousElementSibling.textContent = t.endpoint;
  $('#routeMode option[value="auto"]').textContent = t.routeAuto; $('#routeMode option[value="manual"]').textContent = t.routeManual;
  const labels = $$('.config-grid label > span');
  const labelCopy = language === 'zh' ? ['推理与 Agent', '图片生成', '视频生成', '默认路由'] : ['Reasoning & Agents', 'Image Generation', 'Video Generation', 'Default Routing'];
  labels.forEach((label, index) => { if (labelCopy[index]) label.textContent = labelCopy[index]; });
}

function showToast(message) {
  $('#toastText').textContent = message;
  const toast = $('#toast');
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

function closeProjectMenu() { if (projectMenu) { projectMenu.remove(); projectMenu = null; $('#projectSwitcher').setAttribute('aria-expanded', 'false'); } }
function localProjects() { try { return JSON.parse(localStorage.getItem(PROJECTS_KEY)) || {}; } catch { return {}; } }
function captureProject() { return Object.fromEntries(PROJECT_CONTENT_KEYS.map(key => [key, localStorage.getItem(key)])); }
function saveCurrentProject() {
  const projects = localProjects();
  const id = localStorage.getItem(ACTIVE_PROJECT_KEY) || 'initial';
  projects[id] = { name: projectData.title, content: captureProject() };
  localStorage.setItem(ACTIVE_PROJECT_KEY, id);
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  return projects;
}
function activateProject(id, projects) {
  for (const key of PROJECT_CONTENT_KEYS) {
    const value = projects[id]?.content?.[key];
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  }
  localStorage.setItem(ACTIVE_PROJECT_KEY, id);
  location.reload();
}
function exportProjectBackup() {
  const projects = saveCurrentProject();
  const id = localStorage.getItem(ACTIVE_PROJECT_KEY) || 'initial';
  const payload = { format: 'omni-space-project', version: 1, exportedAt: new Date().toISOString(), id, name: projects[id]?.name || projectData.title, content: projects[id]?.content || captureProject() };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `${(payload.name || 'omni-space-project').replace(/[\\/:*?"<>|]/g, '-').slice(0, 80)}.omni.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(language === 'zh' ? '项目备份已导出' : 'Project backup exported');
}
function importProjectBackup(file) {
  if (!file || file.size > 5 * 1024 * 1024) { showToast(language === 'zh' ? '备份文件不能超过 5 MB' : 'Backup files must be 5 MB or smaller'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(String(reader.result));
      if (payload?.format !== 'omni-space-project' || payload?.version !== 1 || !payload.content || typeof payload.content !== 'object') throw new Error('invalid backup');
      const importedContent = Object.fromEntries(PROJECT_CONTENT_KEYS.map(key => [key, typeof payload.content[key] === 'string' ? payload.content[key] : null]));
      const importedProject = JSON.parse(importedContent[PROJECT_KEY] || '{}');
      const importedScenes = importedContent[PRESENTATION_KEY] ? JSON.parse(importedContent[PRESENTATION_KEY]) : null;
      const importedGraph = importedContent[STORAGE_KEY] ? JSON.parse(importedContent[STORAGE_KEY]) : null;
      if (!importedProject || typeof importedProject !== 'object' || Array.isArray(importedProject) || (importedScenes && (!Array.isArray(importedScenes) || importedScenes.length > 200 || importedScenes.some(scene => !scene || typeof scene.title !== 'string' || typeof scene.html !== 'string' || typeof scene.css !== 'string'))) || (importedGraph && (!Array.isArray(importedGraph.nodes) || importedGraph.nodes.length > 500))) throw new Error('invalid backup content');
      const name = String(payload.name || importedProject.title || '导入项目').slice(0, 120);
      importedContent[PROJECT_KEY] = JSON.stringify({ ...importedProject, title: name });
      const projects = saveCurrentProject();
      const id = `imported-${Date.now()}`;
      projects[id] = { name, content: importedContent };
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
      activateProject(id, projects);
    } catch { showToast(language === 'zh' ? '项目备份格式无效' : 'Invalid project backup'); }
  };
  reader.readAsText(file);
}
function openProjectMenu() {
  if (projectMenu) return closeProjectMenu();
  const t = copy[language].projectMenu;
  projectMenu = document.createElement('div'); projectMenu.className = 'project-menu';
  const projects = saveCurrentProject();
  const currentId = localStorage.getItem(ACTIVE_PROJECT_KEY);
  projectMenu.innerHTML = `<div class="project-menu-title">${t.current}</div><button data-project-action="rename">${t.rename}</button><button data-project-action="new">${t.newProject}</button><button data-project-action="export">${language === 'zh' ? '导出项目备份' : 'Export project backup'}</button><button data-project-action="import">${language === 'zh' ? '导入项目备份' : 'Import project backup'}</button><div class="project-menu-projects">${Object.entries(projects).map(([id, item]) => `<button data-project-id="${escapeHtml(id)}"${id === currentId ? ' disabled' : ''}>${escapeHtml(item.name)}</button>`).join('')}</div><div class="project-menu-note">${escapeHtml(projectData.title)}</div>`;
  projectMenu.addEventListener('click', event => event.stopPropagation());
  $('#projectSwitcher').appendChild(projectMenu); $('#projectSwitcher').setAttribute('aria-expanded', 'true');
  projectMenu.querySelector('[data-project-action="rename"]').onclick = () => { const name = window.prompt(language === 'zh' ? '输入项目名称' : 'Project name', projectData.title); if (name?.trim()) { projectData.title = name.trim(); persistProjectData(); const updated = localProjects(); const id = localStorage.getItem(ACTIVE_PROJECT_KEY) || 'initial'; updated[id] = { name: projectData.title, content: captureProject() }; localStorage.setItem(PROJECTS_KEY, JSON.stringify(updated)); applyLanguage(); showToast(language === 'zh' ? '项目名称已更新' : 'Project renamed'); } closeProjectMenu(); };
  projectMenu.querySelector('[data-project-action="new"]').onclick = () => { const name = window.prompt(language === 'zh' ? '输入新项目名称' : 'New project name', language === 'zh' ? '未命名项目' : 'Untitled project'); if (name?.trim()) { const updated = saveCurrentProject(); const id = `project-${Date.now()}`; updated[id] = { name: name.trim(), content: { [PROJECT_KEY]: JSON.stringify({ title: name.trim(), activeUsers: 0, growth: 0, sessions: '0', health: 0 }) } }; localStorage.setItem(PROJECTS_KEY, JSON.stringify(updated)); activateProject(id, updated); } closeProjectMenu(); };
  projectMenu.querySelector('[data-project-action="export"]').onclick = () => { exportProjectBackup(); closeProjectMenu(); };
  projectMenu.querySelector('[data-project-action="import"]').onclick = () => { const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,.omni.json,application/json'; input.onchange = () => { importProjectBackup(input.files?.[0]); input.remove(); }; document.body.appendChild(input); input.click(); closeProjectMenu(); };
  projectMenu.querySelectorAll('[data-project-id]').forEach(button => button.addEventListener('click', () => { const updated = saveCurrentProject(); activateProject(button.dataset.projectId, updated); }));
}

async function shareProject() {
  const payload = `${projectData.title}\nOMNI SPACE 本地项目\n场景：${presentation.scenes.length}\n地址：${location.href}`;
  try { await navigator.clipboard.writeText(payload); showToast(language === 'zh' ? '项目摘要已复制' : 'Project summary copied'); } catch { showToast(language === 'zh' ? '浏览器未允许复制，请手动复制地址' : 'Clipboard unavailable; copy the URL manually'); }
}

function snapshot() {
  return {
    nodes: $$('.graph-node').map(node => ({ id: node.dataset.node, left: parseFloat(node.style.left || node.offsetLeft), top: parseFloat(node.style.top || node.offsetTop), className: node.className, html: node.innerHTML })),
    scale: graph.scale, panX: graph.panX, panY: graph.panY
  };
}

function restore(state) {
  if (!state) return;
  const savedIds = new Set((state.nodes || []).map(saved => saved.id));
  $$('.user-node').forEach(node => { if (!savedIds.has(node.dataset.node)) node.remove(); });
  (state.nodes || []).forEach(saved => {
    let node = $$('.graph-node').find(item => item.dataset.node === saved.id);
    if (!node && saved.className?.split(/\s+/).includes('user-node')) {
      node = document.createElement('article');
      node.className = 'graph-node selectable user-node';
      node.dataset.node = String(saved.id || '').slice(0, 100);
      const kicker = document.createElement('div'); kicker.className = 'node-kicker violet'; kicker.textContent = language === 'zh' ? '自定义节点' : 'Custom node';
      const heading = document.createElement('h2'); heading.textContent = node.dataset.node;
      const body = document.createElement('p'); body.textContent = language === 'zh' ? '可拖动的项目对象' : 'Draggable project object';
      const footer = document.createElement('div'); footer.className = 'node-footer'; footer.textContent = 'ProjectNode';
      node.append(kicker, heading, body, footer);
      canvasContent.appendChild(node);
      bindNode(node);
    }
    if (node) { node.style.left = `${saved.left}px`; node.style.top = `${saved.top}px`; }
  });
  graph.scale = state.scale || 1;
  graph.panX = state.panX || 0;
  graph.panY = state.panY || 0;
  applyViewport();
  updateConnectors();
}

function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot())); }

function record(before) {
  graph.history.push(before);
  if (graph.history.length > 40) graph.history.shift();
  graph.future = [];
  persist();
}

function applyViewport() {
  zoomValue.textContent = `${Math.round(graph.scale * 100)}%`;
  canvasContent.style.transform = `translate(${graph.panX}px, ${graph.panY}px) scale(${graph.scale})`;
}

function fitCanvas() {
  const nodes = $$('.graph-node', canvasContent);
  const left = Math.min(54, ...nodes.map(node => node.offsetLeft));
  const top = Math.min(35, ...nodes.map(node => node.offsetTop));
  const right = Math.max(650, ...nodes.map(node => node.offsetLeft + node.offsetWidth));
  const bottom = Math.max(100, ...nodes.map(node => node.offsetTop + node.offsetHeight));
  const width = canvasArea.clientWidth - 48;
  // Reserve the bottom strip for the map and save status.
  const height = canvasArea.clientHeight - 130;
  graph.scale = Math.min(1, width / (right - left), height / (bottom - top));
  graph.panX = 24 + (width - (right - left) * graph.scale) / 2 - left * graph.scale;
  graph.panY = 24 - top * graph.scale;
  applyViewport();
  persist();
}

function updateConnectors() {
  $$('path[data-from]').forEach(path => {
    const from = $$('.graph-node').find(node => node.dataset.node === path.dataset.from);
    const to = $$('.graph-node').find(node => node.dataset.node === path.dataset.to);
    if (!from || !to) { path.style.display = 'none'; return; }
    path.style.display = '';
    const x1 = from.offsetLeft + from.offsetWidth / 2;
    const y1 = from.offsetTop + from.offsetHeight / 2;
    const x2 = to.offsetLeft + to.offsetWidth / 2;
    const y2 = to.offsetTop + to.offsetHeight / 2;
    const curve = Math.max(40, Math.abs(x2 - x1) * .35);
    path.setAttribute('d', `M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`);
  });
}

function selectNode(node, announce = true) {
  $$('.graph-node').forEach(item => item.classList.toggle('selected', item === node));
  graph.selected = node;
  if (announce && node) showToast(`已选择${node.dataset.node}`);
}

function setMode(mode) {
  if (mode !== 'canvas') $$('video', canvasContent).forEach(video => video.pause());
  $$('.mode-button').forEach(button => button.classList.toggle('active', button.dataset.mode === mode));
  const copy = modeCopy[mode] || modeCopy.canvas;
  const t = window.__omniCopy || window['copy']?.[language] || {};
  $('#viewLabel').textContent = t?.modes?.[mode] || copy[0];
  $('.breadcrumb .muted').textContent = t?.sub?.[mode] || copy[1];
  if (mode === 'canvas') { canvasArea.hidden = false; modeWorkspace.hidden = true; }
  else renderModeWorkspace(mode);
  if (mode !== 'canvas') showToast(language === 'zh' ? `已切换到${copy[0]}视图` : `Switched to ${t?.modes?.[mode] || copy[0]} view`);
}

function zoomAt(nextScale, clientX = canvasArea.clientWidth / 2, clientY = canvasArea.clientHeight / 2) {
  const clamped = Math.min(1.35, Math.max(.55, nextScale));
  const rect = canvasArea.getBoundingClientRect();
  const worldX = (clientX - rect.left - graph.panX) / graph.scale;
  const worldY = (clientY - rect.top - graph.panY) / graph.scale;
  graph.panX = clientX - rect.left - worldX * clamped;
  graph.panY = clientY - rect.top - worldY * clamped;
  graph.scale = clamped;
  applyViewport();
  persist();
}

function openCommandBar() {
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  setTimeout(() => commandInput.focus(), 40);
}

function closeCommandBar() {
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  commandInput.value = '';
}

function openConfig() {
  modelConfig = loadConfig();
  $('#reasoningModel').value = modelConfig.reasoningModel;
  $('#imageModel').value = modelConfig.imageModel;
  $('#videoModel').value = modelConfig.videoModel;
  $('#routeMode').value = modelConfig.routeMode;
  $('#imageEndpoint').value = modelConfig.imageEndpoint;
  setProviderEnabled(modelConfig.providerEnabled, false);
  applyConfigLanguage();
  configOverlay.classList.add('open');
  configOverlay.setAttribute('aria-hidden', 'false');
}

function closeConfig() {
  configOverlay.classList.remove('open');
  configOverlay.setAttribute('aria-hidden', 'true');
}

function setProviderEnabled(enabled, announce = true) {
  modelConfig.providerEnabled = Boolean(enabled);
  const toggle = $('#providerToggle');
  toggle.classList.toggle('active', modelConfig.providerEnabled);
  toggle.setAttribute('aria-checked', String(modelConfig.providerEnabled));
  $('.toggle-row strong').textContent = modelConfig.providerEnabled ? copy[language].enabled : copy[language].disabled;
  if (announce) showToast(modelConfig.providerEnabled ? (language === 'zh' ? '外部模型已启用' : 'External models enabled') : (language === 'zh' ? '外部模型已停用' : 'External models disabled'));
}

function saveConfig() {
  modelConfig = {
    reasoningModel: $('#reasoningModel').value,
    imageModel: 'gpt-image-2',
    videoModel: $('#videoModel').value,
    routeMode: $('#routeMode').value,
    imageEndpoint: defaultConfig.imageEndpoint,
    providerEnabled: $('#providerToggle').getAttribute('aria-checked') === 'true',
    savedAt: new Date().toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' })
  };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(modelConfig));
  applyLanguage();
  closeConfig();
  showToast(copy[language].toastSaved);
}

function openPresentation() {
  const view = $('#presentationOverlay');
  presentation.returnMode = $('.mode-button.active')?.dataset.mode || 'canvas';
  $$('.mode-button').forEach(button => button.classList.toggle('active', button.dataset.mode === 'web'));
  view.classList.add('open');
  view.setAttribute('aria-hidden', 'false');
  renderPresentation();
  restoreSceneDraft();
}

function closePresentation() {
  if (presentation.dirty && !saveScene(true)) return;
  const view = $('#presentationOverlay');
  view.classList.remove('open', 'preview-mode');
  view.setAttribute('aria-hidden', 'true');
  presentation.playing = false;
  clearInterval(presentation.playTimer);
  const returnMode = presentation.returnMode || 'canvas';
  $$('.mode-button').forEach(button => button.classList.toggle('active', button.dataset.mode === returnMode));
  $('#viewLabel').textContent = copy[language].modes[returnMode];
  $('.breadcrumb .muted').textContent = copy[language].sub[returnMode];
}

function currentScene() { return presentation.scenes[presentation.active]; }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }

function bindSceneHtml(html, overrides = {}) {
  const bindings = { 'project.title': projectData.title, 'metric.activeUsers': `${projectData.activeUsers}%`, 'metric.growth': `${projectData.growth}%`, 'metric.sessions': projectData.sessions, 'metric.health': projectData.health, ...overrides };
  return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key) => key in bindings ? escapeHtml(bindings[key]) : match);
}

function readBindingValues() {
  return {
    activeUsers: Number($('#activeUsersMetric')?.value),
    growth: Number($('#growthMetric')?.value),
    sessions: $('#sessionsMetric')?.value.trim() || projectData.sessions,
    health: Number($('#healthMetric')?.value)
  };
}

function setBindingFields() {
  if ($('#activeUsersMetric')) $('#activeUsersMetric').value = projectData.activeUsers;
  if ($('#growthMetric')) $('#growthMetric').value = projectData.growth;
  if ($('#sessionsMetric')) $('#sessionsMetric').value = projectData.sessions;
  if ($('#healthMetric')) $('#healthMetric').value = projectData.health;
}

function sceneDocument(scene, overrides = {}) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${scene.css.replace(/<\/style/gi, '<\\/style')}</style></head><body>${bindSceneHtml(scene.html, overrides)}</body></html>`;
}

function validatePresentation() {
  const findings = [];
  presentation.scenes.forEach((scene, index) => {
    const label = `${language === 'zh' ? '场景' : 'Scene'} ${index + 1}「${scene.title || 'Untitled'}」`;
    if (!/<(?:main|section|article)\b/i.test(scene.html || '')) findings.push(`${label}：缺少 main、section 或 article 根节点`);
    const values = { activeUsers: projectData.activeUsers, growth: projectData.growth, health: projectData.health };
    if (Object.values(values).some(value => !Number.isFinite(Number(value)))) findings.push(`${label}：数据绑定值无效`);
    if (!presentationTransitions.includes(scene.transition) || !Number.isFinite(Number(scene.duration)) || Number(scene.duration) < 1 || Number(scene.duration) > 30) findings.push(`${label}：过渡或停留时长配置无效`);
    const allowedBindings = new Set(['project.title','metric.activeUsers','metric.growth','metric.sessions','metric.health']);
    const unresolved = [...(scene.html || '').matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].filter(match => !allowedBindings.has(match[1])).map(match => match[0]);
    if (unresolved.length) findings.push(`${label}：存在未识别数据绑定 ${unresolved.join(', ')}`);
  });
  return findings;
}

function updatePresentationValidation() {
  const node = $('#presentationValidation');
  if (!node) return;
  const findings = validatePresentation();
  node.textContent = findings.length ? `${copy[language].presentation.validationFailed} · ${findings.length}` : copy[language].presentation.validationPassed;
  node.classList.toggle('warning', findings.length > 0);
  node.title = findings.join('\n') || copy[language].presentation.validationPassed;
}

function updateScenePreview() {
  const scene = { ...currentScene(), html: $('#sceneHtml').value, css: $('#sceneCss').value };
  const values = readBindingValues();
  const overrides = Number.isFinite(values.activeUsers) ? {
    'metric.activeUsers': `${values.activeUsers}%`, 'metric.growth': `${values.growth}%`,
    'metric.sessions': values.sessions, 'metric.health': values.health
  } : {};
  $('#presentationFrame').srcdoc = sceneDocument(scene, overrides);
  const canvas = $('#stageCanvas');
  if (canvas) { canvas.className = `transition-${scene.transition || 'fade'}`; canvas.getBoundingClientRect(); }
}

function draftSceneFromEditor() {
  const scene = currentScene();
  return { ...scene, title: $('#sceneTitle').value.trim() || scene.title, notes: $('#sceneNotes').value, html: $('#sceneHtml').value, css: $('#sceneCss').value, transition: $('#sceneTransition').value, duration: Number($('#sceneDuration').value) };
}

function markSceneDirty() {
  if (presentation.playing) { presentation.playing = false; clearInterval(presentation.playTimer); $('#playPresentation').textContent = copy[language].presentation.play; }
  presentation.dirty = true;
  updateSceneSaveState();
  $('#notesPreview').textContent = $('#sceneNotes').value || copy[language].presentation.noNotes;
  clearTimeout(sceneDraftTimer);
  sceneDraftTimer = setTimeout(storeSceneDraft, 250);
}

function storeSceneDraft() {
  if (!presentation.dirty) return;
  try { localStorage.setItem(PRESENTATION_DRAFT_KEY, JSON.stringify({ scene: draftSceneFromEditor(), bindings: readBindingValues() })); }
  catch { showToast(language === 'zh' ? '草稿存储空间不足，请导出备份' : 'Draft storage is full. Export a backup.'); }
}

function clearSceneDraft() {
  clearTimeout(sceneDraftTimer);
  localStorage.removeItem(PRESENTATION_DRAFT_KEY);
}

function restoreSceneDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(PRESENTATION_DRAFT_KEY));
    if (!draft?.scene || !presentation.scenes.some(scene => scene.id === draft.scene.id)) return;
    presentation.active = presentation.scenes.findIndex(scene => scene.id === draft.scene.id);
    renderPresentation();
    for (const [id, key] of [['sceneTitle','title'],['sceneNotes','notes'],['sceneHtml','html'],['sceneCss','css']]) $(`#${id}`).value = draft.scene[key];
    const bindings = draft.bindings || {};
    if ($('#activeUsersMetric')) $('#activeUsersMetric').value = bindings.activeUsers ?? projectData.activeUsers;
    if ($('#growthMetric')) $('#growthMetric').value = bindings.growth ?? projectData.growth;
    if ($('#sessionsMetric')) $('#sessionsMetric').value = bindings.sessions ?? projectData.sessions;
    if ($('#healthMetric')) $('#healthMetric').value = bindings.health ?? projectData.health;
    markSceneDirty(); updateScenePreview();
    showToast(language === 'zh' ? '已恢复未保存的草稿' : 'Unsaved draft restored');
  } catch { clearSceneDraft(); }
}

function presentationSnapshot() {
  return JSON.stringify({ scenes: presentation.scenes, active: presentation.active, activeUsers: projectData.activeUsers });
}

function rememberPresentation(snapshot = presentationSnapshot()) {
  presentation.history.push(snapshot);
  if (presentation.history.length > 40) presentation.history.shift();
  presentation.future = [];
}

function updateSceneSaveState() {
  const text = presentation.dirty ? copy[language].presentation.unsaved : copy[language].presentation.saved;
  const state = $('#editorSaveState'); if (state) state.textContent = text;
  const status = $('.stage-status'); if (status) status.innerHTML = `<span class="pulse-dot"></span> ${presentation.dirty ? copy[language].presentation.unsaved : copy[language].presentation.live}`;
  if ($('#sceneUndo')) $('#sceneUndo').disabled = !presentation.dirty && !presentation.history.length;
  if ($('#sceneRedo')) $('#sceneRedo').disabled = presentation.dirty || !presentation.future.length;
}

function renderPresentation() {
  const scene = currentScene();
  if (!scene) return;
  $('#sceneCount').textContent = presentation.scenes.length;
  $('#scenePosition').textContent = `${String(presentation.active + 1).padStart(2, '0')} / ${String(presentation.scenes.length).padStart(2, '0')}`;
  $('#sceneList').innerHTML = presentation.scenes.map((item, index) => `<button class="scene-item${index === presentation.active ? ' active' : ''}" data-scene-index="${index}"><div class="scene-thumb" aria-hidden="true">${sceneFrameMarkup(item, false)}</div><div class="scene-item-meta"><span>${escapeHtml(item.title)}</span><span>${String(index + 1).padStart(2, '0')}</span></div></button>`).join('');
  thumbnailResize.disconnect();
  $$('.scene-thumb').forEach(node => thumbnailResize.observe(node));
  $('#timelineTrack').innerHTML = presentation.scenes.map((item, index) => `<button class="timeline-item${index === presentation.active ? ' active' : ''}" data-scene-index="${index}" draggable="true" title="${language === 'zh' ? '拖动排序' : 'Drag to reorder'}">${String(index + 1).padStart(2, '0')} · ${escapeHtml(item.title)} <small>${Number(item.duration || 3.5)}s</small></button>`).join('');
  $$('.scene-item, .timeline-item').forEach(button => button.addEventListener('click', () => { if (!ensurePresentationSaved()) return; presentation.active = Number(button.dataset.sceneIndex); renderPresentation(); }));
  $$('.timeline-item').forEach(button => {
    button.addEventListener('dragstart', event => { event.dataTransfer.setData('text/plain', button.dataset.sceneIndex); event.dataTransfer.effectAllowed = 'move'; button.classList.add('dragging'); });
    button.addEventListener('dragend', () => button.classList.remove('dragging'));
    button.addEventListener('dragover', event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; button.classList.add('drop-target'); });
    button.addEventListener('dragleave', () => button.classList.remove('drop-target'));
    button.addEventListener('drop', event => { event.preventDefault(); button.classList.remove('drop-target'); reorderSceneTo(Number(event.dataTransfer.getData('text/plain')), Number(button.dataset.sceneIndex)); });
  });
  $('#sceneTitle').value = scene.title; $('#sceneNotes').value = scene.notes; $('#sceneHtml').value = scene.html; $('#sceneCss').value = scene.css; $('#notesPreview').textContent = scene.notes || copy[language].presentation.noNotes;
  $('#sceneTransition').value = scene.transition || 'fade'; $('#sceneDuration').value = scene.duration || 3.5;
  setBindingFields();
  updateScenePreview();
  updateSceneSaveState();
  updatePresentationValidation();
}

function saveScene(silent = false) {
  const scene = currentScene();
  const values = readBindingValues();
  if (!Number.isFinite(values.activeUsers) || values.activeUsers < 0 || values.activeUsers > 100) { showToast(language === 'zh' ? '活跃用户占比需在 0 到 100 之间' : 'Active users must be between 0 and 100'); return false; }
  if (!Number.isFinite(values.growth) || values.growth < -100 || values.growth > 1000) { showToast(language === 'zh' ? '环比增长需在 -100 到 1000 之间' : 'Period growth must be between -100 and 1000'); return false; }
  if (!Number.isFinite(values.health) || values.health < 0 || values.health > 100 || !values.sessions) { showToast(language === 'zh' ? '请完整填写数据绑定字段' : 'Complete all data binding fields'); return false; }
  const duration = Number($('#sceneDuration').value);
  if (!Number.isFinite(duration) || duration < 1 || duration > 30) { showToast(language === 'zh' ? '停留时长需在 1 到 30 秒之间' : 'Duration must be between 1 and 30 seconds'); return false; }
  const draft = draftSceneFromEditor();
  if ($('#activeUsersMetric').value.trim() === '') { showToast(language === 'zh' ? '请输入活跃用户占比' : 'Enter the active user percentage'); return false; }
  if (JSON.stringify(draft) !== JSON.stringify(scene) || values.activeUsers !== projectData.activeUsers || values.growth !== projectData.growth || values.sessions !== projectData.sessions || values.health !== projectData.health) rememberPresentation();
  scene.title = draft.title || `场景 ${presentation.active + 1}`;
  scene.notes = draft.notes;
  scene.html = draft.html;
  scene.css = draft.css;
  projectData.activeUsers = values.activeUsers; projectData.growth = values.growth; projectData.sessions = values.sessions; projectData.health = values.health;
  persistProjectData();
  updateProjectDataViews();
  persistPresentation(); presentation.dirty = false; clearSceneDraft(); recordVersion(language === 'zh' ? `保存场景：${scene.title}` : `Saved scene: ${scene.title}`); renderPresentation(); if (!silent) showToast(language === 'zh' ? '场景已保存' : 'Scene saved'); return true;
}

function ensurePresentationSaved() { return !presentation.dirty || saveScene(true); }

function undoSceneEdit() {
  if (!ensurePresentationSaved()) return;
  restorePresentationHistory(presentation.history, presentation.future);
}

function redoSceneEdit() {
  if (presentation.dirty) return;
  restorePresentationHistory(presentation.future, presentation.history);
}

function restorePresentationHistory(source, destination) {
  if (!source.length) return;
  destination.push(presentationSnapshot());
  const previous = JSON.parse(source.pop());
  presentation.scenes = previous.scenes; presentation.active = previous.active;
  projectData.activeUsers = previous.activeUsers;
  persistProjectData(); updateProjectDataViews(); persistPresentation();
  presentation.dirty = false; clearSceneDraft(); renderPresentation();
}

function addScene() {
  if (!ensurePresentationSaved()) return;
  rememberPresentation();
  presentation.scenes.push({ id: `scene-${Date.now()}`, title: `新场景 ${presentation.scenes.length + 1}`, notes: '', transition: 'fade', duration: 3.5, html: '<main class="slide"><div class="eyebrow">NEW SCENE</div><h1>写下你的下一幕。</h1><p>这是一个可编辑的 HTML 场景。</p></main>', css: ':root{font-family:Inter,Arial,sans-serif;color:#f4f5fb;background:#181a25}*{box-sizing:border-box}body{margin:0}.slide{height:100vh;padding:12%;background:linear-gradient(145deg,#252b4a,#10131c)}.eyebrow{font-size:12px;letter-spacing:.16em;color:#8cf0d0}.slide h1{font-size:clamp(36px,7vw,84px);letter-spacing:-.06em}.slide p{color:#aeb9cf;font-size:18px}' });
  presentation.active = presentation.scenes.length - 1; persistPresentation(); renderPresentation(); showToast(language === 'zh' ? '已新增场景' : 'Scene added');
}

function duplicateScene() {
  if (!ensurePresentationSaved()) return;
  rememberPresentation();
  const scene = currentScene();
  presentation.scenes.splice(presentation.active + 1, 0, { ...scene, id: `scene-${Date.now()}`, title: `${scene.title} · 副本` });
  presentation.active += 1; persistPresentation(); renderPresentation(); showToast(language === 'zh' ? '场景已复制' : 'Scene duplicated');
}

function reorderScene(step) {
  reorderSceneTo(presentation.active, presentation.active + step);
}

function reorderSceneTo(from, target) {
  if (!ensurePresentationSaved()) return;
  if (!Number.isInteger(from) || from < 0 || from >= presentation.scenes.length) return;
  if (target < 0 || target >= presentation.scenes.length) return;
  if (from === target) return;
  rememberPresentation();
  const activeId = currentScene().id;
  const [scene] = presentation.scenes.splice(from, 1); presentation.scenes.splice(target, 0, scene);
  presentation.active = presentation.scenes.findIndex(item => item.id === activeId);
  persistPresentation(); renderPresentation();
}

function deleteScene() {
  if (!ensurePresentationSaved()) return;
  if (presentation.scenes.length <= 1) { showToast(language === 'zh' ? '至少保留一个场景' : 'Keep at least one scene'); return; }
  rememberPresentation();
  presentation.scenes.splice(presentation.active, 1); presentation.active = Math.min(presentation.active, presentation.scenes.length - 1); persistPresentation(); renderPresentation(); showToast(language === 'zh' ? '场景已删除' : 'Scene deleted');
}

function moveScene(step) { if (!ensurePresentationSaved()) return; presentation.active = (presentation.active + step + presentation.scenes.length) % presentation.scenes.length; renderPresentation(); }

function downloadPresentation() {
  if (!ensurePresentationSaved()) return;
  const findings = validatePresentation();
  if (findings.length) { showToast(`${copy[language].presentation.validationFailed}：${findings[0]}`); updatePresentationValidation(); return; }
  const html = presentationDocument();
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' })); const link = document.createElement('a'); link.href = url; link.download = 'omni-space-presentation.html'; link.click(); URL.revokeObjectURL(url); showToast(language === 'zh' ? 'HTML 演示已导出' : 'HTML presentation exported');
}

function printPresentation() {
  if (!ensurePresentationSaved()) return;
  const findings = validatePresentation();
  if (findings.length) { showToast(`${copy[language].presentation.validationFailed}：${findings[0]}`); updatePresentationValidation(); return; }
  const printWindow = window.open('', '_blank', 'width=1280,height=720');
  if (!printWindow) { showToast(language === 'zh' ? '浏览器阻止了打印窗口，请允许弹窗' : 'Print window was blocked by the browser'); return; }
  printWindow.document.write(presentationDocument());
  printWindow.document.close(); printWindow.focus();
  printWindow.addEventListener('load', () => printWindow.print(), { once: true });
}

function sceneFrameMarkup(scene, interactive = true) {
  const bridge = interactive ? `<script>addEventListener('keydown',function(e){if(e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,textarea,select,[contenteditable]'))return;if(['ArrowRight','ArrowLeft','PageDown','PageUp','Home','End'].includes(e.key)){e.preventDefault();parent.postMessage({source:'omni-deck-key',key:e.key},'*')}});<\/script>` : '';
  return `<iframe title="${escapeHtml(scene.title)}" tabindex="${interactive ? 0 : -1}" ${interactive ? '' : 'loading="lazy"'} sandbox="${interactive ? 'allow-scripts' : ''}" srcdoc="${escapeHtml(sceneDocument(scene).replace('</body>', bridge + '</body>'))}"></iframe>`;
}

function presentationDocument() {
  const en = language === 'en';
  return `<!doctype html><html lang="${en ? 'en' : 'zh-CN'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(projectData.title)}</title><style>
*{box-sizing:border-box}body{margin:0;background:#0b0d10;color:#eef2f6;font:14px Arial,sans-serif;letter-spacing:0}main{height:calc(100dvh - 64px);display:grid;place-items:center}.slide-page{position:relative;width:min(100vw,calc((100dvh - 64px)*16/9));aspect-ratio:16/9;overflow:hidden}.slide-page[hidden]{display:none}.slide-page iframe{display:block;width:1280px;height:720px;position:absolute;inset:0;border:0;transform-origin:0 0}nav{height:64px;display:flex;align-items:center;justify-content:center;gap:12px;padding:8px;background:#171b21}button{height:36px;min-width:36px;border:1px solid #455260;border-radius:5px;background:#232b33;color:#fff;cursor:pointer}button:disabled{opacity:.35;cursor:default}output{min-width:70px;text-align:center}#slideTitle{max-width:30vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}button:focus-visible{outline:2px solid #75dec6}@page{size:1280px 720px;margin:0}@media print{body{background:#fff}main{height:auto;display:block}nav{display:none}.slide-page,.slide-page[hidden]{display:block;width:1280px;height:720px;break-after:page;break-inside:avoid}.slide-page:last-child{break-after:auto}.slide-page iframe{transform:none!important}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body><main>${presentation.scenes.map((scene, index) => `<section class="slide-page transition-${presentationTransitions.includes(scene.transition) ? scene.transition : 'fade'}" data-duration="${Number(scene.duration) || 3.5}" ${index ? 'hidden' : ''}>${sceneFrameMarkup(scene)}</section>`).join('')}</main><nav aria-label="${en ? 'Presentation controls' : '演示控制'}"><button id="previous" title="${en ? 'Previous' : '上一页'}" aria-label="${en ? 'Previous' : '上一页'}">&#8592;</button><output id="position" aria-live="polite"></output><button id="next" title="${en ? 'Next' : '下一页'}" aria-label="${en ? 'Next' : '下一页'}">&#8594;</button><span id="slideTitle"></span><button id="print">${en ? 'Print / PDF' : '打印 / PDF'}</button><button id="fullscreen" title="${en ? 'Fullscreen' : '全屏'}" aria-label="${en ? 'Fullscreen' : '全屏'}">&#x26F6;</button></nav><script>
const pages=[...document.querySelectorAll('.slide-page')];let current=0;const previous=document.getElementById('previous'),next=document.getElementById('next');function fit(){for(const page of pages){if(!page.hidden)page.querySelector('iframe').style.transform='scale('+page.clientWidth/1280+')'}}function show(index){current=Math.max(0,Math.min(pages.length-1,index));pages.forEach((page,i)=>page.hidden=i!==current);const active=pages[current];active.classList.remove('replay');void active.offsetWidth;active.classList.add('replay');document.getElementById('position').textContent=(current+1)+' / '+pages.length;document.getElementById('slideTitle').textContent=active.querySelector('iframe').title;previous.disabled=current===0;next.disabled=current===pages.length-1;fit()}function navigate(key){if(['ArrowRight','PageDown'].includes(key))show(current+1);if(['ArrowLeft','PageUp'].includes(key))show(current-1);if(key==='Home')show(0);if(key==='End')show(pages.length-1)}previous.onclick=()=>show(current-1);next.onclick=()=>show(current+1);document.getElementById('print').onclick=()=>window.print();document.getElementById('fullscreen').onclick=()=>{const request=document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();request?.catch(()=>{})};addEventListener('resize',fit);addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,textarea,select,[contenteditable]'))return;if(['ArrowRight','ArrowLeft','PageDown','PageUp','Home','End'].includes(e.key)){e.preventDefault();navigate(e.key)}});addEventListener('message',e=>{if(e.source===pages[current].querySelector('iframe').contentWindow&&e.data?.source==='omni-deck-key')navigate(e.data.key)});show(0);
<\/script></body></html>`;
}

function renderModeWorkspace(mode) {
  const t = window.__omniCopy || copy[language];
  const title = t.modes[mode];
  const templates = {
    '3d': `<div class="workspace-title"><div><div class="eyebrow">THREE D SCENE</div><h1>${title}</h1><p>编辑原生场景、层级、相机与材质。</p></div><div class="workspace-actions"><button class="secondary-button" id="resetScene">重置视角</button><button class="primary-button" id="expandScene">展开到画布</button></div></div><div class="workspace-grid"><div class="workspace-panel"><div class="workspace-panel-header"><span>校园中心 · WebGL2 预览</span><small>GPU FALLBACK READY</small></div><div class="workspace-panel-body"><div class="scene-viewport"><span class="viewport-label">SCENE / CAMPUS_CENTER</span><div class="scene-object one"></div><div class="scene-object two selected"></div><div class="scene-object three"></div></div></div></div><div class="workspace-panel"><div class="workspace-panel-header"><span>场景树</span><small>5 OBJECTS</small></div><div class="workspace-panel-body"><div class="tree-list"><button class="tree-item active"><span class="tree-icon">◇</span>校园中心</button><button class="tree-item"><span class="tree-icon">□</span>主楼</button><button class="tree-item"><span class="tree-icon">□</span>图书馆</button><button class="tree-item"><span class="tree-icon">◉</span>太阳光</button><button class="tree-item"><span class="tree-icon">◌</span>相机</button></div><div class="property-list"><div class="property-row"><span>选中对象</span><strong>图书馆</strong></div><div class="property-row"><span>位置</span><strong>0.0 · 1.8 · -4.2</strong></div><div class="property-row"><span>材质</span><strong>Concrete / Soft</strong></div><div class="property-row"><span>动画</span><strong>Idle · 24 fps</strong></div></div></div></div></div>`,
    build: `<div class="workspace-title"><div><div class="eyebrow">BUILD RUNTIME</div><h1>${title}</h1><p>编辑代码、运行预览、检查控制台输出。</p></div><div class="workspace-actions"><button class="secondary-button" id="saveCode">保存文件</button><button class="primary-button" id="runCode">运行预览</button></div></div><div class="workspace-panel"><div class="workspace-panel-header"><span>src/App.html</span><small>HTML · LOCAL SANDBOX</small></div><div class="file-layout"><div class="file-tree"><button class="file-item active">src/App.html</button><button class="file-item">src/styles.css</button><button class="file-item">src/data.js</button><button class="file-item">tests/smoke.spec.js</button></div><div class="code-surface"><textarea id="buildCode" spellcheck="false">&lt;main class="campus-home"&gt;\n  &lt;h1&gt;校园 AI 服务&lt;/h1&gt;\n  &lt;p&gt;让校园生活更容易找到方向。&lt;/p&gt;\n  &lt;button&gt;询问 OMNI&lt;/button&gt;\n&lt;/main&gt;</textarea></div><div class="runtime-preview"><div class="eyebrow">RUNTIME PREVIEW</div><iframe class="runtime-frame" id="runtimeFrame" sandbox="allow-scripts"></iframe><div class="console-line" id="consoleLine">● 尚未运行</div></div></div></div>`,
    media: `<div class="workspace-title"><div><div class="eyebrow">MEDIA STUDIO</div><h1>${title}</h1><p>统一管理图片、视频、音频资产与生成版本。</p></div><div class="workspace-actions"><button class="secondary-button" id="openModelFromMedia">模型配置</button><button class="primary-button" id="generateMedia">开始生成</button></div></div><div class="media-grid"><div class="workspace-panel"><div class="workspace-panel-header"><span>生成预览</span><small>IMAGE NODE · LOCAL DRAFT</small></div><div class="workspace-panel-body"><div class="generation-preview image-preview"><img id="mediaPreviewImage" alt="图片本地预览" loading="lazy"><div><span class="provider-logo image-logo">◉</span><strong id="mediaPreviewTitle">发布视觉系统</strong><small id="mediaPreviewStatus">等待图片资产</small><div class="preview-state"><span class="state-local">本地预览</span><span>可连接画布</span></div></div></div><div class="generation-stack" id="imageAssetStack"></div></div></div><div class="workspace-panel"><div class="workspace-panel-header"><span>生成参数</span><small>GPT IMAGE 2 · TUZI CODING</small></div><div class="workspace-panel-body mini-form"><label>提示词<textarea id="mediaPrompt">校园夜间开放的图书馆，数字蓝图风格，真实空间感</textarea></label><label>图片模型<select><option>gpt-image-2</option></select></label><label>画幅<select><option>16:9</option><option>1:1</option><option>9:16</option></select></label></div></div></div>`,
    data: `<div class="workspace-title"><div><div class="eyebrow">DATA VIEW</div><h1>${title}</h1><p>同一份源数据同时驱动 Canvas、网页和演示场景。</p></div><div class="workspace-actions"><button class="secondary-button" id="refreshData">刷新数据</button><button class="primary-button" id="bindData">绑定到演示</button></div></div><div class="metric-grid"><div class="metric-card"><small>活跃用户</small><strong>72.4%</strong><em>+12.6% ↗</em></div><div class="metric-card"><small>本周会话</small><strong>8.4k</strong><em>+18.2% ↗</em></div><div class="metric-card"><small>项目健康度</small><strong>92</strong><em>良好</em></div></div><div class="workspace-panel chart-panel"><div class="workspace-panel-header"><span>校园使用情况</span><small>LIVE DATA NODE · D-07</small></div><div class="workspace-panel-body"><div class="chart"><i class="chart-bar" style="--height:35%"></i><i class="chart-bar" style="--height:43%"></i><i class="chart-bar" style="--height:49%"></i><i class="chart-bar" style="--height:62%"></i><i class="chart-bar" style="--height:58%"></i><i class="chart-bar" style="--height:77%"></i><i class="chart-bar" style="--height:92%"></i></div><div class="source-row"><span>数据来源：campus_usage_v2</span><span id="dataSyncStatus">已同步 · 14:32</span></div></div></div>`,
    inspector: `<div class="workspace-title"><div><div class="eyebrow">PROJECT INSPECTOR</div><h1>${title}</h1><p>只读检查项目图谱、代码运行时和 HTML 演示，问题会保留在本地审查记录。</p></div><div class="workspace-actions"><span class="audit-run-meta" id="auditRunMeta">尚未检查</span><button class="primary-button" id="runInspector">开始审查</button></div></div><div class="audit-summary" id="auditSummary"><div class="audit-score"><small>当前状态</small><strong id="auditScore">待检查</strong><span id="auditScoreNote">运行审查后生成结果</span></div><div class="audit-count"><span class="audit-count-critical"><strong id="auditCritical">0</strong>严重</span><span class="audit-count-major"><strong id="auditMajor">0</strong>主要</span><span class="audit-count-minor"><strong id="auditMinor">0</strong>轻微</span></div></div><div class="workspace-panel"><div class="workspace-panel-header"><span>审查发现</span><small>READ-ONLY · LOCAL</small></div><div class="workspace-panel-body"><div class="audit-list" id="auditList"><div class="empty-state">点击“开始审查”检查当前项目。</div></div></div></div>`,
    agents: `<div class="workspace-title"><div><div class="eyebrow">AGENT STUDIO</div><h1>${title}</h1><p>为每个 Agent 配置角色、工具、上下文和最小权限。</p></div><div class="workspace-actions"><button class="secondary-button" id="previewAgent">预览行为</button><button class="primary-button" id="saveAgent">保存 Agent</button></div></div><div class="agent-layout"><div class="workspace-panel workspace-panel-body agent-menu"><button class="active">Builder · 构建</button><button>Designer · 设计</button><button>Inspector · 审查</button><button>Tester · 测试</button><button>Presenter · 演示</button><button>Media Director · 媒体</button></div><div class="workspace-panel"><div class="workspace-panel-header"><span>Builder 配置</span><small>MINIMUM PRIVILEGE</small></div><div class="workspace-panel-body mini-form"><label>角色<input value="根据需求创建和修改 Web App" /></label><label>系统指令<textarea>先读取项目图谱，再提出最小修改。所有修改生成 diff，并等待用户确认后发布。</textarea></label><span class="eyebrow">PERMISSIONS</span><div class="permission-grid"><label><input type="checkbox" checked /> READ</label><label><input type="checkbox" checked /> COMMENT</label><label><input type="checkbox" checked /> EDIT</label><label><input type="checkbox" checked /> RUN</label><label><input type="checkbox" /> DEPLOY</label><label><input type="checkbox" /> ADMIN</label></div></div></div></div>`,
    history: `<div class="workspace-title"><div><div class="eyebrow">PROJECT HISTORY</div><h1>${title}</h1><p>查看人类和 Agent 的操作轨迹，比较差异并恢复项目状态。</p></div><div class="workspace-actions"><button class="secondary-button" id="compareHistory">比较选中版本</button></div></div><div class="workspace-panel"><div class="workspace-panel-header"><span>版本时间线</span><small>LOCAL SNAPSHOT · 4 VERSIONS</small></div><div class="workspace-panel-body history-list"><div class="history-row"><time>刚刚</time><div><strong>HTML 演示新增场景 03</strong><small>你 · 3 个文件 · PresentationNode</small></div><button data-history="current">当前版本</button></div><div class="history-row"><time>14:31</time><div><strong>Designer 更新视觉系统</strong><small>Designer · 8 个样式变更 · 可比较</small></div><button data-history="designer">查看 Diff</button></div><div class="history-row"><time>14:28</time><div><strong>Builder 部署网页应用</strong><small>Builder · WebAppNode · 可恢复</small></div><button data-history="builder">恢复</button></div><div class="history-row"><time>14:02</time><div><strong>项目初始化</strong><small>你 · Canvas + Project Graph</small></div><button data-history="init">查看</button></div></div></div>`,
    files: `<div class="workspace-title"><div><div class="eyebrow">PROJECT FILES</div><h1>${title}</h1><p>管理项目源文件、演示内容和本地导出物。</p></div><div class="workspace-actions"><label class="secondary-button file-upload-button">上传文件<input id="fileUpload" type="file" multiple hidden /></label><button class="primary-button" id="newFile">新建文件</button></div></div><div class="workspace-panel"><div class="workspace-panel-header"><span>项目文件</span><small id="fileCount">4 FILES · LOCAL</small></div><div class="workspace-panel-body file-manager"><div class="file-toolbar"><input id="fileSearch" type="search" placeholder="搜索文件名..." /><span>仅保存在当前浏览器</span></div><div class="file-list" id="fileList"></div><div class="file-detail" id="fileDetail">选择文件查看元数据。</div></div></div>`,
    video: `<div class="workspace-title"><div><div class="eyebrow">VIDEO STUDIO</div><h1>${title}</h1><p>配置视频生成任务、预览比例并跟踪本地草稿。</p></div><div class="workspace-actions"><button class="secondary-button" id="openModelFromVideo">模型配置</button><label class="secondary-button video-upload-button">导入视频<input id="videoUpload" type="file" accept="video/mp4,video/webm,video/ogg" hidden></label><button class="primary-button" id="createVideoJob">保存视频草稿</button></div></div><div class="media-grid video-grid"><div class="workspace-panel"><div class="workspace-panel-header"><span>视频预览</span><small>LOCAL DRAFT</small></div><div class="workspace-panel-body"><div class="generation-preview video-preview"><div id="videoMotionPreview" class="video-motion-preview"><span>▶</span></div><div><span class="provider-logo video-logo">▹</span><strong id="videoPreviewTitle">等待视频草稿</strong><small id="videoPreviewStatus">当前为动效预览，视频生成服务尚未接入。</small><div class="preview-state"><span class="state-motion">动效预览</span><span>可保存草稿</span></div></div></div><div class="generation-stack" id="videoQueue"><div class="empty-state">暂无视频草稿</div></div></div></div><div class="workspace-panel"><div class="workspace-panel-header"><span>生成参数</span><small>LOCAL DRAFT SETTINGS</small></div><div class="workspace-panel-body mini-form"><label>提示词<textarea id="videoPrompt">夜间开放的校园图书馆，镜头缓慢推进，蓝绿色灯光</textarea></label><label>视频模型<select id="videoModelWorkspace"><option value="runway">Runway</option><option value="pika">Pika</option><option value="luma">Luma</option></select></label><label>时长<select id="videoDuration"><option>5 秒</option><option>8 秒</option><option>12 秒</option></select></label><label>画幅<select id="videoAspect"><option>16:9</option><option>9:16</option><option>1:1</option></select></label></div></div></div>`
  };
  modeWorkspace.innerHTML = templates[mode] || `<div class="workspace-title"><div><div class="eyebrow">WORKSPACE</div><h1>${title}</h1><p>此工作区正在连接项目图谱。</p></div></div><div class="workspace-panel"><div class="workspace-panel-body"><div class="generation-preview"><div><strong>${title} 工作区</strong><small>可以从此处继续处理项目对象。</small></div></div></div></div>`;
  modeWorkspace.dataset.mode = mode;
  modeWorkspace.hidden = false; canvasArea.hidden = true;
  localizeWorkspace(mode);
  updateProjectDataViews();
  bindModeWorkspace(mode);
}

function localizeWorkspace(mode) {
  if (language === 'zh') return;
  const translations = {
    '良好': 'Good', '模型配置': 'Model configuration', '本地草稿': 'Local draft', '统一管理图片、视频、音频资产与生成版本。': 'Manage images, video, audio, and generated versions.', '当前为本地草稿，外部生成服务尚未接入。': 'Local draft. Generation service is not connected.', '发布视觉系统': 'Launch visual system', '校园夜间开放的图书馆，数字蓝图风格，真实空间感': 'Campus library open at night, digital blueprint style, realistic spatial depth', '夜间开放的校园图书馆，镜头缓慢推进，蓝绿色灯光': 'Campus library open at night, slow camera push-in, teal lighting', '视频模型': 'Video model', '校园中心': 'Campus center', '主楼': 'Main building', '图书馆': 'Library', '太阳光': 'Sunlight', '相机': 'Camera', '位置': 'Position',
    '编辑原生场景、层级、相机与材质。': 'Edit native scene hierarchy, camera, and materials.', '重置视角': 'Reset view', '展开到画布': 'Expand to canvas', '校园中心 · WebGL2 预览': 'Campus Center · WebGL2 Preview', '场景树': 'Scene tree', '选中对象': 'Selected object', '材质': 'Material', '动画': 'Animation',
    '编辑代码、运行预览、检查控制台输出。': 'Edit code, run a preview, and inspect console output.', '保存文件': 'Save file', '运行预览': 'Run preview', '生成结果会回到项目图谱并保留 Prompt / Model / Version。': 'Results return to the graph with prompt, model, and version metadata.', '开始生成': 'Generate', '生成预览': 'Generation preview', '生成参数': 'Generation settings', '提示词': 'Prompt', '图片模型': 'Image model', '画幅': 'Aspect ratio',
    '同一份源数据同时驱动 Canvas、网页和演示场景。': 'One source drives Canvas, web, and presentation scenes.', '刷新数据': 'Refresh data', '绑定到演示': 'Bind to presentation', '活跃用户': 'Active users', '本周会话': 'Weekly sessions', '项目健康度': 'Project health', '校园使用情况': 'Campus usage', '数据来源：campus_usage_v2': 'Source: campus_usage_v2', '已同步 · 14:32': 'Synced · 14:32',
    '为每个 Agent 配置角色、工具、上下文和最小权限。': 'Configure role, tools, context, and minimum permissions for each Agent.', '预览行为': 'Preview behavior', '保存 Agent': 'Save Agent', '角色': 'Role', '系统指令': 'System instructions', '构建': 'Build', '设计': 'Design', '审查': 'Inspect', '测试': 'Test', '演示': 'Present', '媒体': 'Media',
    '查看人类和 Agent 的操作轨迹，比较差异并恢复项目状态。': 'Review human and Agent activity, compare changes, and restore project state.', '比较选中版本': 'Compare versions', '版本时间线': 'Version timeline', '查看 Diff': 'View diff', '恢复': 'Restore', '当前版本': 'Current version', '查看': 'View',
    '管理项目源文件、演示内容和本地导出物。': 'Manage project source files, presentation content, and local exports.', '上传文件': 'Upload file', '新建文件': 'New file', '项目文件': 'Project files', '搜索文件名...': 'Search file names...', '仅保存在当前浏览器': 'Stored in this browser only', '选择文件查看元数据。': 'Select a file to view metadata.', '配置视频生成任务、预览比例并跟踪本地队列。': 'Configure video jobs, preview aspect ratios, and track the local queue.', '加入生成队列': 'Add to queue', '视频预览': 'Video preview', '等待生成任务': 'Waiting for a video task', '任务完成后会在这里显示预览。': 'A preview will appear here when the task is complete.', '时长': 'Duration', '生成任务已加入队列': 'Video job added to queue',
    '只读检查项目图谱、代码运行时和 HTML 演示，问题会保留在本地审查记录。': 'Read-only checks for the project graph, code runtime, and HTML presentation. Findings stay in the local audit log.', '开始审查': 'Start audit', '尚未检查': 'Not checked', '当前状态': 'Current status', '待检查': 'Waiting for audit', '运行审查后生成结果': 'Run the audit to generate results', '严重': 'Critical', '主要': 'Major', '轻微': 'Minor', '审查发现': 'Audit findings', '点击“开始审查”检查当前项目。': 'Click “Start audit” to check the current project.', '项目健康度': 'Project health', '版本时间线': 'Version timeline', '保存场景或代码后会出现记录。': 'Save a scene or code file to create a version.', '查看人类和 Agent 的操作轨迹，比较差异并恢复项目状态。': 'Review human and Agent activity, compare diffs, and restore project state.', '为每个 Agent 配置角色、工具、上下文和最小权限。': 'Configure roles, tools, context, and least privilege for each Agent.', '项目审查': 'Project audit', '只读检查': 'Read-only audit', '项目文件': 'Project files', '活跃用户': 'Active users', '本周会话': 'Weekly sessions', '项目健康度': 'Project health', '校园使用情况': 'Campus usage', '数据来源：campus_usage_v2': 'Source: campus_usage_v2', '已读取本地项目数据': 'Local project data loaded', '已同步 · 14:32': 'Synced · 14:32', '保存视频草稿': 'Save video draft', '图片生成': 'Image generation', '视频生成': 'Video generation'
  };
  const walker = document.createTreeWalker(modeWorkspace, NodeFilter.SHOW_TEXT);
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => { const value = node.nodeValue.trim(); if (translations[value]) node.nodeValue = node.nodeValue.replace(value, translations[value]); });
  modeWorkspace.querySelectorAll('[placeholder]').forEach(node => { if (node.placeholder === '搜索文件名...') node.placeholder = translations['搜索文件名...']; });
}

function runBuildPreview(code) {
  const frame = $('#runtimeFrame');
  const status = $('#consoleLine');
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  frame.dataset.runId = runId;
  status.classList.remove('error');
  status.textContent = language === 'zh' ? '● 沙箱正在加载...' : '● Loading sandbox...';
  const documentNode = new DOMParser().parseFromString(code, 'text/html');
  const bootstrap = documentNode.createElement('script');
  bootstrap.textContent = `window.addEventListener('error',event=>parent.postMessage({source:'omni-runtime',runId:${JSON.stringify(runId)},kind:'error',message:event.message||'Script error'},'*'));window.addEventListener('unhandledrejection',event=>parent.postMessage({source:'omni-runtime',runId:${JSON.stringify(runId)},kind:'error',message:String(event.reason)},'*'));window.addEventListener('load',()=>parent.postMessage({source:'omni-runtime',runId:${JSON.stringify(runId)},kind:'ready'},'*'));`;
  documentNode.head.prepend(bootstrap);
  frame.srcdoc = `<!doctype html>${documentNode.documentElement.outerHTML}`;
  if (!runtimeMessageHandlerBound) {
    window.addEventListener('message', event => {
      const currentFrame = $('#runtimeFrame');
      const output = $('#consoleLine');
      if (!currentFrame || !output || event.source !== currentFrame.contentWindow || event.data?.source !== 'omni-runtime' || event.data.runId !== currentFrame.dataset.runId) return;
      if (event.data.kind === 'error') { output.classList.add('error'); output.textContent = `● ${String(event.data.message).slice(0, 280)}`; }
      else if (!output.classList.contains('error')) output.textContent = language === 'zh' ? '● 预览已加载 · 未报告脚本错误' : '● Preview loaded · No reported script errors';
    });
    runtimeMessageHandlerBound = true;
  }
}

function runProject() {
  setMode('build');
  const code = $('#buildCode');
  if (code) { runBuildPreview(code.value); showToast(language === 'zh' ? '项目预览已启动' : 'Project preview started'); }
}

function runProjectAudit() {
  setMode('inspector');
  $('#runInspector')?.click();
}

function bindModeWorkspace(mode) {
  if (mode === '3d') { $$('.tree-item').forEach(item => item.addEventListener('click', () => { $$('.tree-item').forEach(i => i.classList.remove('active')); item.classList.add('active'); showToast(`已选择${item.textContent.trim()}`); })); $('#resetScene').addEventListener('click', () => showToast('相机已重置')); $('#expandScene').addEventListener('click', () => { setMode('canvas'); showToast('3D 场景已关联到画布'); }); }
  if (mode === 'build') { const code = $('#buildCode'); const savedCode = localStorage.getItem('omni-space-code-v1'); if (savedCode) code.value = savedCode; $('#saveCode').addEventListener('click', () => { localStorage.setItem('omni-space-code-v1', code.value); recordVersion(language === 'zh' ? '保存代码文件' : 'Saved code file'); showToast(language === 'zh' ? '代码文件已保存' : 'Code saved'); }); $('#runCode').addEventListener('click', () => { runBuildPreview(code.value); showToast(language === 'zh' ? '本地沙箱已启动' : 'Local sandbox started'); }); }
  if (mode === 'media') {
    $('#openModelFromMedia').addEventListener('click', openConfig);
    const draft = readLocalDraft('image');
    const aspect = modeWorkspace.querySelectorAll('select')[1];
    if (draft) { $('#mediaPrompt').value = draft.prompt; aspect.value = draft.aspect; }
    const renderImageWorkspace = () => {
      const latest = readMediaAssets().filter(asset => asset.kind === 'image');
      const current = latest[0];
      if (current) { $('#mediaPreviewImage').src = current.poster; $('#mediaPreviewImage').hidden = false; $('#mediaPreviewTitle').textContent = current.prompt.slice(0, 34); $('#mediaPreviewStatus').textContent = language === 'zh' ? '真实图片 · 已连接画布' : 'Real image · linked to canvas'; }
      else { $('#mediaPreviewImage').hidden = true; $('#mediaPreviewStatus').textContent = language === 'zh' ? '等待图片资产' : 'Waiting for an image asset'; }
      $('#imageAssetStack').innerHTML = latest.map(asset => `<div class="stack-item"><img class="stack-thumb" src="${asset.poster}" alt=""><span><strong>${escapeHtml(String(asset.prompt || '').slice(0, 28))}</strong><small>${escapeHtml(asset.model)} · ${escapeHtml(asset.aspect)}</small></span><button class="asset-delete" data-delete-asset="${escapeHtml(asset.id)}" aria-label="${language === 'zh' ? '删除图片' : 'Delete image'}" title="${language === 'zh' ? '删除图片' : 'Delete image'}">×</button></div>`).join('') || `<div class="empty-state">${language === 'zh' ? '生成后会显示图片' : 'Generated images appear here'}</div>`;
      $$('[data-delete-asset]', $('#imageAssetStack')).forEach(button => button.addEventListener('click', () => deleteMediaAsset(button.dataset.deleteAsset)));
    };
    $('#generateMedia').textContent = language === 'zh' ? '生成图片' : 'Generate image';
    $('#generateMedia').addEventListener('click', async () => {
      if (!modelConfig.providerEnabled) { showToast(language === 'zh' ? '请先在模型配置中启用外部调用' : 'Enable external calls in model configuration first'); openConfig(); return; }
      const prompt = $('#mediaPrompt').value.trim();
      if (!prompt) { showToast(language === 'zh' ? '请填写图片提示词' : 'Enter an image prompt'); return; }
      localStorage.setItem('omni-space-image-draft', JSON.stringify({ prompt, aspect: aspect.value, model: 'gpt-image-2' }));
      const button = $('#generateMedia'); button.disabled = true; button.textContent = language === 'zh' ? '生成中…' : 'Generating…';
      try {
        const size = aspect.value === '1:1' ? '1024x1024' : aspect.value === '9:16' ? '1024x1536' : '1536x1024';
        const response = await fetch('/api/images', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, size }) });
        const result = await response.json();
        if (response.status === 401) { await refreshAccountSession(); openAccount(); throw Error(language === 'zh' ? '请先登录' : 'Sign in required'); }
        if (response.status === 429 && result.error?.includes('Daily image limit')) throw Error(language === 'zh' ? '今日图片生成额度已用完' : result.error);
        if (!response.ok || !result.url) throw Error(result.error || 'Image generation failed');
        const assets = readMediaAssets();
        const asset = { id: `image-${Date.now()}`, kind: 'image', prompt, aspect: aspect.value, model: 'gpt-image-2', poster: new URL(result.url, location.origin).href, createdAt: Date.now(), left: assets[0]?.left ?? 54, top: assets[0]?.top ?? 585 };
        assets.unshift(asset); if (!persistMediaAssets(assets)) return;
        renderMediaCanvasNodes(); renderImageWorkspace(); persist();
        showToast(language === 'zh' ? '图片已生成并连接到画布' : 'Image generated and linked to canvas');
      } catch (error) { showToast(`${language === 'zh' ? '图片生成失败' : 'Image generation failed'}：${error.message}`); }
      finally { button.disabled = false; button.textContent = language === 'zh' ? '生成图片' : 'Generate image'; }
    });
    renderImageWorkspace();
  }
  if (mode === 'video') {
    $('#openModelFromVideo').addEventListener('click', openConfig);
    let jobs = readLocalDraft('video') || [];
    if (!Array.isArray(jobs)) jobs = [];
    const existingAssets = readMediaAssets();
    const migratedJobs = jobs.filter(job => job && !existingAssets.some(asset => asset.id === job.id)).map((job, index) => ({ ...job, id: job.id || `video-legacy-${Date.now()}-${index}`, kind: 'video', poster: job.poster || mediaPoster('video', job.prompt, '#43baff'), createdAt: job.createdAt || Date.now(), left: Number.isFinite(job.left) ? job.left : 54, top: Number.isFinite(job.top) ? job.top : 585 }));
    if (migratedJobs.length) { jobs = migratedJobs.concat(jobs.filter(job => existingAssets.some(asset => asset.id === job.id))); persistMediaAssets([...migratedJobs, ...existingAssets]); }
    const render = () => { const latest = readMediaAssets().filter(asset => asset.kind === 'video'); $('#videoQueue').innerHTML = latest.map(job => `<div class="stack-item"><div class="stack-video-thumb"><span>▶</span></div><span><strong>${escapeHtml(job.prompt)}</strong><small>${escapeHtml(job.localFile ? '本地视频 · 可播放' : '动效预览 · 未生成')} · ${escapeHtml(job.duration || '')} · ${escapeHtml(job.aspect || '')}</small></span><button class="asset-delete" data-delete-asset="${escapeHtml(job.id)}" aria-label="${language === 'zh' ? '删除视频' : 'Delete video'}" title="${language === 'zh' ? '删除视频' : 'Delete video'}">×</button></div>`).join('') || `<div class="empty-state">${language === 'zh' ? '暂无视频草稿，可导入本地视频' : 'No video drafts; import a local video'}</div>`; $$('[data-delete-asset]', $('#videoQueue')).forEach(button => button.addEventListener('click', () => deleteMediaAsset(button.dataset.deleteAsset))); const current = latest[0]; if (current) { $('#videoPreviewTitle').textContent = current.prompt.slice(0, 30); $('#videoPreviewStatus').textContent = current.localFile ? (language === 'zh' ? '本地视频 · 可播放 · 已连接画布' : 'Local video · playable · linked to canvas') : (language === 'zh' ? '动效预览 · 视频生成服务尚未接入' : 'Motion preview · generation service unavailable'); $('.video-preview .preview-state').innerHTML = current.localFile ? '<span class="state-local">本地视频</span><span>可播放</span>' : '<span class="state-motion">动效预览</span><span>未生成视频</span>'; if (current.localFile) { $('#videoMotionPreview').replaceWith(Object.assign(document.createElement('video'), { id: 'videoMotionPreview', controls: true, playsInline: true, preload: 'metadata' })); $('#videoMotionPreview').dataset.videoAsset = current.id; hydrateVideoElements(modeWorkspace); } else if ($('#videoMotionPreview').classList.contains('video-motion-preview')) $('#videoMotionPreview').style.setProperty('--video-poster', `url("${current.poster || ''}")`); } };
    $('#createVideoJob').textContent = language === 'zh' ? '保存视频草稿' : 'Save video draft';
    $('#videoPreviewStatus').textContent = language === 'zh' ? '当前为动效预览，视频生成服务尚未接入。' : 'Motion preview; video generation is not connected.';
    $('#createVideoJob').addEventListener('click', () => {
      const prompt = $('#videoPrompt').value.trim();
      if (!prompt) { showToast(language === 'zh' ? '请填写提示词' : 'Enter a prompt'); return; }
      const existing = readMediaAssets();
      const asset = { id: `video-${Date.now()}`, kind: 'video', prompt, model: $('#videoModelWorkspace').value, duration: $('#videoDuration').value, aspect: $('#videoAspect').value, poster: mediaPoster('video', prompt, '#43baff'), createdAt: Date.now(), left: existing[0]?.left ?? 54, top: existing[0]?.top ?? 585 };
      jobs.unshift(asset);
      jobs = jobs.slice(0, 50);
      const assets = readMediaAssets().filter(item => item.kind !== 'video'); assets.unshift(...jobs); persistMediaAssets([...readMediaAssets().filter(item => item.kind !== 'video'), ...jobs]); localStorage.setItem('omni-space-video-draft', JSON.stringify(jobs)); renderMediaCanvasNodes(); render(); persist();
      $('#videoPreviewTitle').textContent = prompt.slice(0, 24);
      showToast(language === 'zh' ? '视频草稿已保存，生成服务尚未接入' : 'Video draft saved; generation is not connected');
    });
    $('#videoUpload').addEventListener('change', async event => {
      const file = event.target.files?.[0]; event.target.value = '';
      if (!file) return;
      if (!['video/mp4','video/webm','video/ogg'].includes(file.type) || file.size > 100 * 1024 * 1024) { showToast(language === 'zh' ? '仅支持不超过 100 MB 的 MP4、WebM 或 Ogg 视频' : 'Use MP4, WebM, or Ogg under 100 MB'); return; }
      if (!await validateVideoFile(file)) { showToast(language === 'zh' ? '视频文件无法播放或编码不受支持' : 'Video cannot be played or codec is unsupported'); return; }
      const existing = readMediaAssets();
      const asset = { id: `video-file-${Date.now()}`, kind: 'video', localFile: true, prompt: file.name, model: '本地导入', duration: '', aspect: '原始比例', createdAt: Date.now(), left: existing[0]?.left ?? 54, top: existing[0]?.top ?? 585 };
      try {
        await saveVideoBlob(asset.id, file);
        const assets = readMediaAssets(); assets.unshift(asset);
        if (!persistMediaAssets(assets)) return;
        renderMediaCanvasNodes(); render(); persist();
        showToast(language === 'zh' ? '视频已导入并连接到画布' : 'Video imported and linked to canvas');
      } catch { showToast(language === 'zh' ? '视频保存失败，请检查浏览器存储空间' : 'Could not save video in browser storage'); }
    });
    $('#videoModelWorkspace').value = modelConfig.videoModel;
    render();
  }
  if (mode === 'files') bindFilesWorkspace();
  if (mode === 'data') {
    $('#refreshData').addEventListener('click', () => { updateProjectDataViews(); $('#dataSyncStatus').textContent = language === 'zh' ? '已读取本地项目数据' : 'Local project data loaded'; showToast(language === 'zh' ? '已读取本地项目数据' : 'Local project data loaded'); });
    $('#bindData').addEventListener('click', () => { openPresentation(); showToast(language === 'zh' ? '已打开演示数据绑定' : 'Presentation data binding opened'); });
  }
  if (mode === 'inspector') bindInspectorWorkspace();
  if (mode === 'agents') bindAgentWorkspace();
  if (mode === 'history') bindHistoryWorkspace();
}

function bindInspectorWorkspace() {
  $('#runInspector').addEventListener('click', () => {
    const findings = [];
    if (!document.querySelector('.user-node')) findings.push({ severity: 'minor', title: language === 'zh' ? '画布还没有自定义节点' : 'Canvas has no custom nodes', body: language === 'zh' ? '可以从命令栏创建节点，或直接编辑现有项目图谱。' : 'Create a node from the command bar or edit the existing graph.', action: 'create-node' });
    const activeScene = currentScene();
    if (activeScene?.html && !/<main|<section|<article/i.test(activeScene.html)) findings.push({ severity: 'major', title: language === 'zh' ? '当前场景缺少主要内容容器' : 'Current scene has no main content container', body: language === 'zh' ? '建议使用 main、section 或 article 作为场景根节点。' : 'Use main, section, or article as the scene root.', action: 'presentation' });
    if (!localStorage.getItem('omni-space-code-v1')) findings.push({ severity: 'minor', title: language === 'zh' ? '尚未保存代码文件' : 'Code file has not been saved', body: language === 'zh' ? '进入代码与应用工作区并保存一次本地源文件。' : 'Open Code & Apps and save the local source once.', action: 'build' });
    const score = findings.some(item => item.severity === 'major') ? '需要关注' : findings.length ? '可优化' : '通过';
    $('#auditScore').textContent = score; $('#auditScoreNote').textContent = language === 'zh' ? `发现 ${findings.length} 个问题` : `${findings.length} findings`;
    $('#auditCritical').textContent = findings.filter(item => item.severity === 'critical').length; $('#auditMajor').textContent = findings.filter(item => item.severity === 'major').length; $('#auditMinor').textContent = findings.filter(item => item.severity === 'minor').length;
    $('#auditRunMeta').textContent = `${language === 'zh' ? '检查于' : 'Checked'} ${new Date().toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' })}`;
    const localScore = Math.max(0, 100 - findings.filter(item => item.severity === 'major').length * 20 - findings.filter(item => item.severity === 'minor').length * 5);
    $('.health-card').dataset.status = language === 'zh' ? score : (findings.some(item => item.severity === 'major') ? 'Needs attention' : findings.length ? 'Can improve' : 'Passed');
    $('.health-label').textContent = $('.health-card').dataset.status;
    $('.health-value').innerHTML = `${localScore} <span>/ 100</span>`;
    $('.health-meta').textContent = language === 'zh' ? `${findings.length} 个本地规则问题` : `${findings.length} local rule findings`;
    $('.activity-section').dataset.audited = 'true';
    $('.activity-item .activity-time').textContent = new Date().toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    $('.activity-item span:last-child').textContent = language === 'zh' ? `本地审查完成 · ${findings.length} 个问题` : `Local audit complete · ${findings.length} findings`;
    $('#auditList').innerHTML = findings.length ? findings.map(item => `<div class="audit-row"><span class="audit-severity ${item.severity}">${item.severity.toUpperCase()}</span><div><strong>${item.title}</strong><p>${item.body}</p></div><button data-audit-action="${item.action}">${language === 'zh' ? '处理' : 'Open'}</button></div>`).join('') : `<div class="empty-state">${language === 'zh' ? '未发现阻塞问题。' : 'No blocking issues found.'}</div>`;
    $$('[data-audit-action]').forEach(button => button.addEventListener('click', () => { if (button.dataset.auditAction === 'create-node') createNode(); else if (button.dataset.auditAction === 'presentation') openPresentation(); else setMode('build'); }));
    localStorage.setItem('omni-space-last-audit', JSON.stringify({ at: Date.now(), count: findings.length }));
  });
}

function bindAgentWorkspace() {
  const menu = $$('.agent-menu button');
  const panel = $('.agent-layout .workspace-panel:last-child');
  const role = panel.querySelector('input:not([type="checkbox"])');
  const instructions = panel.querySelector('textarea');
  const permissions = [...panel.querySelectorAll('input[type="checkbox"]')];
  const configKey = 'omni-space-agent-config-v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(configKey)) || {}; } catch { return {}; } };
  const selectedName = () => $('.agent-menu button.active')?.textContent.trim().split(' · ')[0] || 'Builder';
  const read = () => ({ role: role.value, instructions: instructions.value, permissions: permissions.filter(input => input.checked).map(input => input.parentElement.textContent.trim()) });
  const render = () => { const name = selectedName(); const config = load()[name] || {}; panel.querySelector('.workspace-panel-header span').textContent = `${name} ${language === 'zh' ? '配置' : 'configuration'}`; role.value = config.role || ''; instructions.value = config.instructions || ''; permissions.forEach(input => { input.checked = (config.permissions || ['READ']).includes(input.parentElement.textContent.trim()); }); };
  menu.forEach(button => button.addEventListener('click', () => { menu.forEach(item => item.classList.remove('active')); button.classList.add('active'); render(); }));
  $('#previewAgent').addEventListener('click', () => { const config = read(); const list = config.permissions.join(', ') || (language === 'zh' ? '无' : 'None'); showToast(`${selectedName()} · ${list}`); });
  $('#saveAgent').addEventListener('click', () => { const configs = load(); configs[selectedName()] = read(); localStorage.setItem(configKey, JSON.stringify(configs)); showToast(language === 'zh' ? 'Agent 配置已保存在本地；执行服务尚未接入' : 'Agent settings saved locally; execution is not connected'); });
  render();
}

function bindHistoryWorkspace() {
  const selected = new Set();
  const versions = readVersions();
  const list = $('.history-list');
  if (!$('#historyDiff')) { const diff = document.createElement('div'); diff.id = 'historyDiff'; diff.className = 'history-diff'; list.parentElement.appendChild(diff); }
  list.innerHTML = versions.length ? versions.map((entry, index) => `<div class="history-row"><time>${escapeHtml(new Date(entry.at).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US'))}</time><div><strong>${escapeHtml(entry.label)}</strong><small>${escapeHtml(entry.project.title)} · ${entry.presentation.length} ${language === 'zh' ? '个场景' : 'scenes'}</small></div><div><button data-version-select="${index}" aria-pressed="false">${language === 'zh' ? '选择' : 'Select'}</button><button data-version-restore="${index}">${language === 'zh' ? '恢复' : 'Restore'}</button></div></div>`).join('') : `<div class="empty-state">${language === 'zh' ? '尚无本地版本。保存场景或代码后会出现记录。' : 'No local versions yet. Save a scene or code to create one.'}</div>`;
  $$('[data-version-select]', list).forEach(button => button.addEventListener('click', () => { const index = Number(button.dataset.versionSelect); if (selected.has(index)) selected.delete(index); else if (selected.size < 2) selected.add(index); else { showToast(language === 'zh' ? '最多选择两个版本' : 'Select up to two versions'); return; } button.setAttribute('aria-pressed', String(selected.has(index))); button.classList.toggle('selected', selected.has(index)); }));
  $$('[data-version-restore]', list).forEach(button => button.addEventListener('click', () => { const entry = versions[Number(button.dataset.versionRestore)]; if (!window.confirm(language === 'zh' ? `恢复「${entry.label}」？当前内容会先保存为一个版本。` : `Restore "${entry.label}"? The current state will be versioned first.`)) return; recordVersion(language === 'zh' ? '恢复前备份' : 'Backup before restore'); restoreVersion(entry); }));
  $('#compareHistory').addEventListener('click', () => { if (selected.size !== 2) { showToast(language === 'zh' ? '请选择两个版本' : 'Select two versions'); return; } const [a, b] = [...selected].map(index => versions[index]); const summary = language === 'zh' ? `场景 ${a.presentation.length} → ${b.presentation.length}；活跃用户 ${a.project.activeUsers}% → ${b.project.activeUsers}%` : `Scenes ${a.presentation.length} → ${b.presentation.length}; active users ${a.project.activeUsers}% → ${b.project.activeUsers}%`; $('#historyDiff').textContent = summary; });
}

const VERSION_KEY = 'omni-space-versions-v1';
function readVersions() { try { const values = JSON.parse(localStorage.getItem(VERSION_KEY)); return Array.isArray(values) ? values : []; } catch { return []; } }
function recordVersion(label) {
  const versions = readVersions();
  versions.unshift({ at: Date.now(), label, project: { ...projectData }, presentation: cloneValue(presentation.scenes), code: localStorage.getItem('omni-space-code-v1') || '', graph: snapshot() });
  try { localStorage.setItem(VERSION_KEY, JSON.stringify(versions.slice(0, 30))); } catch { showToast(language === 'zh' ? '本地版本存储已满，请导出项目备份' : 'Local history is full. Export a project backup.'); }
}
function restoreVersion(entry) {
  Object.assign(projectData, entry.project);
  presentation.scenes = cloneValue(entry.presentation); presentation.active = 0; presentation.dirty = false; presentation.history = []; presentation.future = [];
  localStorage.setItem('omni-space-code-v1', entry.code || '');
  persistProjectData(); persistPresentation(); restore(entry.graph); persist(); applyLanguage(); updateProjectDataViews(); renderModeWorkspace('history');
  showToast(language === 'zh' ? '本地版本已恢复' : 'Local version restored');
}

function loadFiles() { try { return JSON.parse(localStorage.getItem('omni-space-files-v1')) || [{ name: 'presentation/index.html', type: 'HTML', size: '18 KB', updated: '刚刚', content: '<!doctype html>\n<!-- Export the presentation from HTML-first workspace. -->' }, { name: 'presentation/theme.css', type: 'CSS', size: '9 KB', updated: '刚刚', content: ':root { color-scheme: dark; }' }, { name: 'src/App.html', type: 'HTML', size: '4 KB', updated: '14:28', content: '<main>校园 AI 服务</main>' }, { name: 'data/campus_usage_v2.json', type: 'JSON', size: '2 KB', updated: '14:02', content: JSON.stringify(projectData, null, 2) }]; } catch { return []; } }
function readLocalDraft(kind) { try { return JSON.parse(localStorage.getItem(`omni-space-${kind}-draft`)); } catch { return null; } }
function bindFilesWorkspace() {
  let files = loadFiles();
  const save = () => { try { localStorage.setItem('omni-space-files-v1', JSON.stringify(files)); return true; } catch { showToast(language === 'zh' ? '文件列表存储空间不足，请导出项目备份' : 'File storage is full. Export a project backup.'); return false; } };
  const list = $('#fileList'); const detail = $('#fileDetail'); const search = $('#fileSearch');
  const download = file => { const blob = new Blob([file.content || ''], { type: 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = file.name.split('/').pop(); link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  const render = () => { const query = search.value.trim().toLowerCase(); const visible = files.filter(file => file.name.toLowerCase().includes(query)); $('#fileCount').textContent = `${files.length} FILES · LOCAL`; list.innerHTML = visible.map(file => `<button class="file-row" data-file-index="${files.indexOf(file)}"><span class="file-type">${escapeHtml(file.type)}</span><span><strong>${escapeHtml(file.name)}</strong><small>${escapeHtml(file.size)} · ${escapeHtml(file.updated)}</small></span><span>›</span></button>`).join('') || `<div class="empty-state">${language === 'zh' ? '没有匹配的文件。' : 'No matching files.'}</div>`; $$('.file-row', list).forEach(row => row.addEventListener('click', () => { const file = files[Number(row.dataset.fileIndex)]; detail.innerHTML = `<strong>${escapeHtml(file.name)}</strong><p>${escapeHtml(file.type)} ${language === 'zh' ? '文件' : 'file'} · ${escapeHtml(file.size)} · ${language === 'zh' ? '最近更新' : 'Updated'} ${escapeHtml(file.updated)}</p><div><button class="secondary-button" data-file-action="download">${language === 'zh' ? '下载' : 'Download'}</button><button class="secondary-button" data-file-action="delete">${language === 'zh' ? '删除' : 'Delete'}</button></div>`; detail.querySelector('[data-file-action="download"]').onclick = () => download(file); detail.querySelector('[data-file-action="delete"]').onclick = () => { files = files.filter(item => item !== file); save(); detail.textContent = language === 'zh' ? '文件已删除。' : 'File deleted.'; render(); }; })); };
  search.addEventListener('input', render); $('#newFile').addEventListener('click', () => { const name = window.prompt(language === 'zh' ? '输入文件名' : 'File name', 'notes/new-file.md'); if (!name?.trim()) return; files.unshift({ name: name.trim(), type: name.split('.').pop().toUpperCase(), size: '0 KB', updated: language === 'zh' ? '刚刚' : 'Now', content: '' }); if (save()) { render(); showToast(language === 'zh' ? '文件已创建，可直接下载空文件' : 'File created and ready to download'); } }); $('#fileUpload').addEventListener('change', async event => { const accepted = []; const skipped = []; for (const file of [...event.target.files]) { if (file.size > 1024 * 1024) { skipped.push(file.name); continue; } const content = await file.text().catch(() => ''); accepted.push({ name: file.name, type: (file.name.split('.').pop() || 'FILE').toUpperCase(), size: `${Math.max(1, Math.round(file.size / 1024))} KB`, updated: language === 'zh' ? '刚刚' : 'Now', content }); } if (accepted.length) { files.unshift(...accepted); if (save()) render(); } if (skipped.length) showToast(language === 'zh' ? `已跳过超过 1 MB 的文件：${skipped.join('、')}` : `Skipped files over 1 MB: ${skipped.join(', ')}`); else showToast(language === 'zh' ? '文件已加入本地列表，可下载或删除' : 'Files added to the local list'); event.target.value = ''; }); render();
}

function createNode() {
  const before = snapshot();
  const id = `自定义节点 ${String(Date.now()).slice(-4)}`;
  const node = document.createElement('article');
  node.className = 'graph-node selectable user-node selected';
  node.dataset.node = id;
  node.innerHTML = `<div class="node-kicker violet">自定义节点 <span class="node-id">N-${String(Date.now()).slice(-3)}</span></div><h2>${id}</h2><p>可拖动的实时对象</p><div class="node-footer"><span class="status-chip violet-chip">新建</span><span>ProjectNode</span></div>`;
  node.style.left = `${180 + ((Date.now() / 17) % 320)}px`;
  node.style.top = `${190 + ((Date.now() / 29) % 260)}px`;
  canvasContent.appendChild(node);
  bindNode(node);
  selectNode(node, false);
  record(before);
  updateConnectors();
  showToast('已创建新节点，可直接拖动');
}

function deleteSelected() {
  if (!graph.selected || graph.selected.dataset.node === '项目目标') { showToast('请选择可删除的节点'); return; }
  if (graph.selected.classList.contains('generated-media-node')) { showToast(language === 'zh' ? '请在图片或视频工作区管理资产' : 'Manage assets in the image or video workspace'); return; }
  const before = snapshot();
  const name = graph.selected.dataset.node;
  graph.selected.remove();
  graph.selected = null;
  record(before);
  updateConnectors();
  showToast(`已删除${name}`);
}

function undo() {
  const previous = graph.history.pop();
  if (!previous) { showToast('没有可撤销的操作'); return; }
  graph.future.push(snapshot());
  restore(previous);
  showToast('已撤销上一步操作');
}

function bindNode(node) {
  node.addEventListener('pointerdown', event => {
    if (event.target.closest('button,video,input,select,textarea')) return;
    event.stopPropagation();
    selectNode(node, false);
    node.setPointerCapture(event.pointerId);
    dragState = { node, before: snapshot(), startX: event.clientX, startY: event.clientY, left: node.offsetLeft, top: node.offsetTop, moved: false };
    node.classList.add('dragging');
  });
  node.addEventListener('pointermove', event => {
    if (!dragState || dragState.node !== node) return;
    const dx = (event.clientX - dragState.startX) / graph.scale;
    const dy = (event.clientY - dragState.startY) / graph.scale;
    if (Math.abs(dx) + Math.abs(dy) > 3) dragState.moved = true;
    node.style.left = `${Math.max(0, dragState.left + dx)}px`;
    node.style.top = `${Math.max(0, dragState.top + dy)}px`;
    updateConnectors();
  });
  node.addEventListener('pointerup', () => {
    if (!dragState || dragState.node !== node) return;
    node.classList.remove('dragging');
    if (dragState.moved) {
      record(dragState.before);
      const assetIds = node.dataset.assetIds?.split(',').filter(Boolean) || (node.dataset.assetId ? [node.dataset.assetId] : []);
      if (assetIds.length) { const assets = readMediaAssets(); assets.filter(asset => assetIds.includes(asset.id)).forEach(asset => { asset.left = node.offsetLeft; asset.top = node.offsetTop; }); persistMediaAssets(assets); }
      showToast(`${node.dataset.node} 已移动`);
    }
    dragState = null;
  });
}

function bindCanvas() {
  canvasArea.addEventListener('pointerdown', event => {
    if (event.target.closest('.graph-node, button, .canvas-minimap, .canvas-status')) return;
    canvasArea.setPointerCapture(event.pointerId);
    dragState = { canvas: true, startX: event.clientX, startY: event.clientY, panX: graph.panX, panY: graph.panY, moved: false };
    canvasArea.classList.add('panning');
  });
  canvasArea.addEventListener('pointermove', event => {
    if (!dragState?.canvas) return;
    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) dragState.moved = true;
    graph.panX = dragState.panX + dx;
    graph.panY = dragState.panY + dy;
    applyViewport();
  });
  canvasArea.addEventListener('pointerup', () => {
    if (!dragState?.canvas) return;
    canvasArea.classList.remove('panning');
    if (dragState.moved) persist();
    dragState = null;
  });
  canvasArea.addEventListener('wheel', event => { event.preventDefault(); zoomAt(graph.scale * (event.deltaY > 0 ? .92 : 1.08), event.clientX, event.clientY); }, { passive: false });
}

$$('.mode-button').forEach(button => button.addEventListener('click', () => { if (button.dataset.mode === 'web') { openPresentation(); return; } setMode(button.dataset.mode); }));
$$('.graph-node').forEach(bindNode);
bindCanvas();
$('#zoomOut').addEventListener('click', () => zoomAt(graph.scale - .1));
$('#zoomIn').addEventListener('click', () => zoomAt(graph.scale + .1));
$('#fitCanvas').addEventListener('click', () => { fitCanvas(); showToast(language === 'zh' ? '画布已适配全部节点' : 'Canvas fitted to all nodes'); });
$('#toggleGrid').addEventListener('click', () => { canvasGrid.classList.toggle('off'); showToast(canvasGrid.classList.contains('off') ? '网格已隐藏' : '网格已显示'); });
$('#commandButton').addEventListener('click', openCommandBar);
$('#commandInput').addEventListener('input', event => { const query = event.target.value.trim().toLowerCase(); $$('.command-list button').forEach(button => { button.hidden = Boolean(query && !button.textContent.toLowerCase().includes(query)); }); });
$('#commandInput').addEventListener('keydown', event => { if (event.key === 'Escape') closeCommandBar(); if (event.key === 'Enter') $('.command-list button:not([hidden])')?.click(); });
overlay.addEventListener('click', event => { if (event.target === overlay) closeCommandBar(); });
$$('.command-list button').forEach(button => button.addEventListener('click', () => {
  const action = button.dataset.command;
  closeCommandBar();
  if (action === '创建新节点') return createNode();
  if (action === '运行项目') return runProject();
  if (action === '请求 Inspector 审查') return runProjectAudit();
  if (action === '打开项目历史') return setMode('history');
}));
$$('.agent-card').forEach(card => card.addEventListener('click', () => { $$('.agent-card').forEach(item => item.classList.remove('selected-agent')); card.classList.add('selected-agent'); setMode('agents'); const name = card.dataset.agent; $$('.agent-menu button').find(button => button.textContent.trim().startsWith(name))?.click(); }));
$('#runButton').addEventListener('click', runProject);
$('#auditButton').addEventListener('click', runProjectAudit);
$('#openPresent').addEventListener('click', event => { event.stopPropagation(); openPresentation(); });
$('#projectSwitcher').addEventListener('click', openProjectMenu);
$('#projectSwitcher').addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openProjectMenu(); } });
$('#shareButton').addEventListener('click', shareProject);
$('#accountButton').addEventListener('click', openAccount);
$('#accountClose').addEventListener('click', closeAccount);
accountOverlay.addEventListener('click', event => { if (event.target === accountOverlay) closeAccount(); });
document.addEventListener('click', event => { if (projectMenu && !event.target.closest('#projectSwitcher')) closeProjectMenu(); });
$('#closePresentation').addEventListener('click', closePresentation);
$('#addScene').addEventListener('click', addScene);
$('#duplicateScene').addEventListener('click', duplicateScene);
$('#moveSceneUp').addEventListener('click', () => reorderScene(-1));
$('#moveSceneDown').addEventListener('click', () => reorderScene(1));
$('#deleteScene').addEventListener('click', deleteScene);
$('#previousScene').addEventListener('click', () => moveScene(-1));
$('#nextScene').addEventListener('click', () => moveScene(1));
$('#saveScene').addEventListener('click', () => saveScene());
$('#sceneUndo').addEventListener('click', undoSceneEdit);
$('#sceneRedo').addEventListener('click', redoSceneEdit);
$('#presentationExport').addEventListener('click', downloadPresentation);
$('#presentationPrint').addEventListener('click', printPresentation);
$('#presentationPreview').addEventListener('click', () => { if (!ensurePresentationSaved()) return; $('#presentationOverlay').classList.toggle('preview-mode'); applyPresentationLanguage(); });
$('#stageFullscreen').addEventListener('click', () => { $('.presentation-stage-wrap').requestFullscreen?.().catch(() => showToast(language === 'zh' ? '浏览器未允许全屏' : 'Fullscreen unavailable')); });
$('#playPresentation').addEventListener('click', () => {
  if (!ensurePresentationSaved()) return;
  presentation.playing = !presentation.playing;
  $('#playPresentation').textContent = presentation.playing ? copy[language].presentation.pause : copy[language].presentation.play;
  if (presentation.playing) {
    const schedule = () => { clearInterval(presentation.playTimer); presentation.playTimer = setTimeout(() => { moveScene(1); if (presentation.playing) schedule(); }, Number(currentScene()?.duration || 3.5) * 1000); };
    schedule();
  } else { clearTimeout(presentation.playTimer); }
});
$$('.editor-tab').forEach(tab => tab.addEventListener('click', () => { $$('.editor-tab').forEach(item => item.classList.toggle('active', item === tab)); $('#visualEditor').hidden = tab.dataset.editorTab !== 'visual'; $('#codeEditor').hidden = tab.dataset.editorTab !== 'code'; }));
$('#syncPresentation').addEventListener('click', () => { updateScenePreview(); showToast(language === 'zh' ? '预览已刷新' : 'Preview refreshed'); });
['sceneTitle', 'sceneNotes', 'sceneHtml', 'sceneCss', 'activeUsersMetric', 'growthMetric', 'sessionsMetric', 'healthMetric', 'sceneDuration'].forEach(id => { const field = $(`#${id}`); field?.addEventListener('input', () => { markSceneDirty(); if (id !== 'sceneTitle' && id !== 'sceneNotes') updateScenePreview(); }); });
$('#sceneTransition')?.addEventListener('change', () => { markSceneDirty(); updateScenePreview(); });
$('#languageButton').addEventListener('click', () => {
  language = language === 'zh' ? 'en' : 'zh';
  localStorage.setItem(LANGUAGE_KEY, language);
  applyLanguage();
  showToast(language === 'zh' ? '已切换为中文' : 'Switched to English');
});
$('#modelConfigButton').addEventListener('click', openConfig);
$('#providerConfigButton').addEventListener('click', openConfig);
$('#configClose').addEventListener('click', closeConfig);
$('#configCancel').addEventListener('click', closeConfig);
$('#configSave').addEventListener('click', saveConfig);
$('#providerToggle').addEventListener('click', () => setProviderEnabled(!$('#providerToggle').classList.contains('active')));
$('#keyAction').addEventListener('click', () => showToast(language === 'zh' ? '服务端密钥管理尚未接入，当前未发送模型请求' : 'Server key management is not connected; no model request has been sent'));
configOverlay.addEventListener('click', event => { if (event.target === configOverlay) closeConfig(); });
document.addEventListener('keydown', event => {
  const editing = event.target.closest('input,textarea,select,[contenteditable]');
  const deckOpen = $('#presentationOverlay').classList.contains('open');
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's' && deckOpen) { event.preventDefault(); saveScene(); return; }
  if ((event.metaKey || event.ctrlKey) && ['z','y'].includes(event.key.toLowerCase())) {
    if (editing) return;
    event.preventDefault();
    if (deckOpen) { event.shiftKey || event.key.toLowerCase() === 'y' ? redoSceneEdit() : undoSceneEdit(); } else if (event.key.toLowerCase() === 'z') undo();
    return;
  }
  if (deckOpen && !editing && ['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); moveScene(event.key === 'ArrowLeft' ? -1 : 1); return; }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openCommandBar(); }
  if (event.key === 'Escape' && overlay.classList.contains('open')) closeCommandBar();
  if (event.key === 'Escape' && configOverlay.classList.contains('open')) closeConfig();
  if (event.key === 'Escape' && accountOverlay.classList.contains('open')) closeAccount();
  if (event.key === 'Escape' && $('#presentationOverlay').classList.contains('open')) closePresentation();
  if (!deckOpen && (event.key === 'Delete' || event.key === 'Backspace') && !editing) deleteSelected();
});

window.addEventListener('beforeunload', () => storeSceneDraft());
document.addEventListener('visibilitychange', () => { if (document.hidden) storeSceneDraft(); });

renderMediaCanvasNodes();
try { restore(JSON.parse(localStorage.getItem(STORAGE_KEY))); } catch { applyViewport(); updateConnectors(); }
applyLanguage();
updateProjectDataViews();
applyViewport();
updateConnectors();
refreshAccountSession();
