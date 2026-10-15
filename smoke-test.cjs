const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require(path.join(process.env.TEMP, 'omni-space-qa/node_modules/playwright'));

(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omni-smoke-'));
  const port = Number(process.env.OMNI_TEST_PORT || 4191);
  const base = `http://127.0.0.1:${port}/`;
  const server = spawn(process.execPath, ['server.cjs'], { cwd: __dirname, env: { ...process.env, OMNI_PORT: String(port), OMNI_DB_DRIVER: 'json', OMNI_DATA_DIR: dataDir }, stdio: 'ignore', windowsHide: true });
  let browser;
  try {
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try { ready = (await fetch(`${base}api/auth/me`)).ok; if (ready) break; } catch { /* Wait for startup. */ }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!ready) throw Error('Smoke test server did not start');
    browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.locator('.mode-button').first().waitFor();
    for (const mode of ['3d', 'build', 'media', 'video', 'data', 'inspector', 'agents', 'files', 'history', 'canvas']) {
      await page.locator(`.mode-button[data-mode="${mode}"]`).click();
      if (mode === 'canvas') assert.equal(await page.locator('#canvasArea').isVisible(), true);
      else assert.equal(await page.locator('#modeWorkspace h1').isVisible(), true, `${mode} workspace`);
    }

    await page.locator('#accountButton').click();
    await page.locator('[data-account-view="register"]').click();
    await page.locator('#accountName').fill('QA Admin');
    await page.locator('#accountEmail').fill('qa-admin@example.com');
    await page.locator('#accountPassword').fill('password123');
    await page.locator('#accountPasswordConfirm').fill('password123');
    await page.locator('#accountForm button[type="submit"]').click();
    await page.locator('#accountLogout').waitFor();
    assert.equal(await page.locator('#accountButton').textContent(), 'QA');
    await page.reload();
    await page.locator('#accountButton').click();
    await page.locator('#accountLogout').click();
    await page.locator('#accountEmail').fill('qa-admin@example.com');
    await page.locator('#accountPassword').fill('password123');
    await page.locator('#accountForm button[type="submit"]').click();
    await page.locator('#accountLogout').waitFor();
    await page.locator('#accountClose').click();

    await page.locator('#runButton').click();
    await page.locator('#consoleLine').getByText('预览已加载', { exact: false }).waitFor();
    await page.locator('#buildCode').fill('<main>QA BUILD<script>throw new Error("qa boom")</script></main>');
    await page.locator('#runCode').click();
    await page.locator('#consoleLine').getByText('qa boom', { exact: false }).waitFor();
    await page.locator('#saveCode').click();

    await page.locator('.mode-button[data-mode="inspector"]').click();
    await page.locator('#runInspector').click();
    assert.match(await page.locator('#auditScoreNote').textContent(), /发现/);

    await page.locator('.mode-button[data-mode="agents"]').click();
    await page.locator('.agent-menu button').nth(1).click();
    await page.locator('.agent-layout .workspace-panel:last-child input:not([type="checkbox"])').fill('QA designer');
    await page.locator('#saveAgent').click();
    await page.locator('.mode-button[data-mode="files"]').click();
    await page.locator('.mode-button[data-mode="agents"]').click();
    await page.locator('.agent-menu button').nth(1).click();
    assert.equal(await page.locator('.agent-layout .workspace-panel:last-child input:not([type="checkbox"])').inputValue(), 'QA designer');

    await page.locator('.mode-button[data-mode="files"]').click();
    await page.locator('#fileUpload').setInputFiles({ name: 'qa.txt', mimeType: 'text/plain', buffer: Buffer.from('qa content') });
    await page.locator('.file-row').filter({ hasText: 'qa.txt' }).click();
    const fileDownload = page.waitForEvent('download');
    await page.locator('[data-file-action="download"]').click();
    assert.equal((await fileDownload).suggestedFilename(), 'qa.txt');
    await page.locator('[data-file-action="delete"]').click();
    assert.equal(await page.locator('.file-row').filter({ hasText: 'qa.txt' }).count(), 0);
    await page.locator('#fileUpload').setInputFiles({ name: 'too-large.txt', mimeType: 'text/plain', buffer: Buffer.alloc(1024 * 1024 + 1, 'x') });
    assert.equal(await page.locator('.file-row').filter({ hasText: 'too-large.txt' }).count(), 0);
    assert.match(await page.locator('#toastText').textContent(), /超过 1 MB/);

    await page.locator('.mode-button[data-mode="web"]').click();
    assert.equal(await page.locator('#presentationOverlay').isVisible(), true);
    await page.locator('#sceneTitle').fill('QA 场景');
    await page.locator('#activeUsersMetric').fill('73');
    await page.locator('#saveScene').click();
    assert.equal(await page.locator('#editorSaveState').textContent(), '已保存');
    await page.locator('#sceneUndo').click();
    assert.notEqual(await page.locator('#sceneTitle').inputValue(), 'QA 场景');
    await page.locator('#sceneRedo').click();
    assert.equal(await page.locator('#sceneTitle').inputValue(), 'QA 场景');
    await page.locator('#addScene').click();
    assert.equal(await page.locator('.scene-item').count(), 4);
    await page.locator('#duplicateScene').click();
    assert.equal(await page.locator('.scene-item').count(), 5);
    await page.locator('#deleteScene').click();
    assert.equal(await page.locator('.scene-item').count(), 4);
    await page.locator('#presentationPreview').click();
    assert.equal(await page.locator('#presentationOverlay').evaluate(el => el.classList.contains('preview-mode')), true);
    await page.locator('#presentationPreview').click();
    const deckDownload = page.waitForEvent('download');
    await page.locator('#presentationExport').click();
    assert.equal((await deckDownload).suggestedFilename(), 'omni-space-presentation.html');
    await page.locator('#closePresentation').click();

    await page.locator('.mode-button[data-mode="history"]').click();
    assert.ok(await page.locator('[data-version-select]').count() >= 2);
    await page.locator('[data-version-select]').nth(0).click();
    await page.locator('[data-version-select]').nth(1).click();
    await page.locator('#compareHistory').click();
    assert.match(await page.locator('#historyDiff').textContent(), /场景/);
    page.once('dialog', dialog => dialog.accept());
    await page.locator('[data-version-restore]').nth(0).click();
    await page.locator('[data-version-select]').first().waitFor();

    await page.locator('#commandButton').click();
    await page.locator('#commandInput').fill('历史');
    await page.locator('#commandInput').press('Enter');
    assert.equal(await page.locator('#commandOverlay').getAttribute('aria-hidden'), 'true');
    await page.locator('#languageButton').click();
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    await page.locator('.mode-button[data-mode="inspector"]').click();
    await page.locator('#runInspector').click();
    assert.doesNotMatch(await page.locator('#modeWorkspace').innerText(), /只读检查|开始审查|当前状态|审查发现/);
    assert.deepEqual(errors, ['qa boom']);

    await page.screenshot({ path: path.join(process.env.TEMP, 'omni-space-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'mobile page must not overflow horizontally');
    await page.screenshot({ path: path.join(process.env.TEMP, 'omni-space-mobile.png'), fullPage: true });
    await page.locator('#projectSwitcher').click();
    const backupDownload = page.waitForEvent('download');
    await page.locator('[data-project-action="export"]').click();
    assert.match((await backupDownload).suggestedFilename(), /\.omni\.json$/);
    await page.locator('#projectSwitcher').click();
    const originalProject = await page.locator('#projectSwitcher span:nth-child(2)').textContent();
    page.once('dialog', dialog => dialog.accept('QA second project'));
    await page.locator('[data-project-action="new"]').click();
    await page.locator('#projectSwitcher span:nth-child(2)').getByText('QA second project').waitFor();
    assert.equal(await page.locator('[data-version-select]').count(), 0);
    await page.locator('#projectSwitcher').click();
    await page.locator('[data-project-id]').filter({ hasText: originalProject }).click();
    await page.locator('#projectSwitcher span:nth-child(2)').getByText(originalProject).waitFor();
    await page.locator('.mode-button[data-mode="history"]').click();
    assert.ok(await page.locator('[data-version-select]').count() >= 2);
    console.log('PASS: workspace, build, inspector, agents, files, presentation, history, command, language; no page errors');
  } finally {
    if (browser) await browser.close();
    if (server.exitCode === null && server.signalCode === null) {
      const stopped = new Promise(resolve => server.once('exit', resolve));
      server.kill();
      await stopped;
    }
    if (path.resolve(dataDir).startsWith(path.resolve(os.tmpdir()) + path.sep)) fs.rmSync(dataDir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
