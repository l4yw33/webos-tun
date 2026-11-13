(function () {
  function t(text) { return window.XrayTunI18n ? XrayTunI18n.t(text) : text; }
  var BASE = '/home/root/webos-xray-tun';
  var API = 'http://127.0.0.1:17999';
  var EXEC_URI = 'luna://org.webosbrew.hbchannel.service/exec';
  var daemonStarting = false;
  var busy = false;
  var toastTimer = null;
  var initialized = false;
  var profileLines = [];
  var apiToken = '';

  function $(id) { return document.getElementById(id); }

  function showToast(text, type) {
    var node = $('toast');
    if (!node) return;
    node.textContent = text || '';
    node.className = 'toast show ' + (type || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.className = 'toast ' + (type || ''); }, 3200);
  }

  function setLast(text) { if ($('lastAction')) $('lastAction').textContent = text || ''; }
  function setLog(text) { if ($('logOutput')) $('logOutput').textContent = text || ''; }



  function lunaCall(uri, parameters, timeout, cb) {
    timeout = timeout || 12000;
    var done = false;
    function finish(res) {
      if (done) return;
      done = true;
      cb(res || {});
    }
    var timer = setTimeout(function () {
      finish({ returnValue: false, errorText: 'Timeout calling ' + uri });
    }, timeout);
    function finishClear(res) { clearTimeout(timer); finish(res); }
    try {
      if (window.webOS && webOS.service && webOS.service.request) {
        var cut = uri.indexOf('/', 7);
        var service = cut > 0 ? uri.substring(0, cut) : uri;
        var method = cut > 0 ? uri.substring(cut + 1) : '';
        webOS.service.request(service, {
          method: method,
          parameters: parameters || {},
          onSuccess: finishClear,
          onFailure: function (res) { finishClear(res || { returnValue: false }); }
        });
        return;
      }
      if (window.PalmServiceBridge) {
        var bridge = new PalmServiceBridge();
        bridge.onservicecallback = function (message) {
          var parsed = null;
          try { parsed = JSON.parse(message); } catch (e) { parsed = { returnValue: false, stdoutString: message }; }
          finishClear(parsed);
        };
        bridge.call(uri, JSON.stringify(parameters || {}));
        return;
      }
      finishClear({ returnValue: false, errorText: 'No webOS service API available.' });
    } catch (e) {
      finishClear({ returnValue: false, errorText: e.message });
    }
  }

  function lunaExec(command, cb, timeout) {
    lunaCall(EXEC_URI, { command: command }, timeout || 12000, cb);
  }

  function startDaemonViaHomebrew(cb) {
    if (daemonStarting) { cb && cb(false, 'daemon start already in progress'); return; }
    daemonStarting = true;
    setLast(t('Запуск помощника'));
    setLog('Daemon offline. Starting app helper once via Homebrew...');
    var cmd = 'sh /media/developer/apps/usr/palm/applications/com.webosbrew.xraytun/scripts/install-runtime.sh >/dev/null 2>&1; sh /home/root/webos-xray-tun/scripts/start-daemon.sh 2>&1';
    lunaExec(cmd, function (res) {
      daemonStarting = false;
      setLog(stdout(res));
      setTimeout(function () {
        api('/health', 'GET', null, 4000, function (h) {
          if (!h || !h.ok) { cb && cb(false, t('Помощник недоступен')); return; }
          lunaExec('cat /home/root/webos-xray-tun/state/api-token', function (tokenResult) {
            var token = (tokenResult.stdoutString || tokenResult.stdout || tokenResult.output || '').trim();
            if (!/^[a-f0-9]{64}$/.test(token)) { cb && cb(false, t('Ключ доступа недоступен')); return; }
            apiToken = token;
            cb && cb(true, t('Помощник готов'));
          }, 5000);
        });
      }, 900);
    }, 15000);
  }

  function stdout(res) {
    if (!res) return '';
    if (res.stdoutString) return res.stdoutString;
    if (res.output) return res.output;
    if (res.error) return res.error;
    return JSON.stringify(res, null, 2);
  }

  function api(path, method, body, timeout, cb) {
    timeout = timeout || 12000;
    var xhr = new XMLHttpRequest();
    var done = false;
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      try { xhr.abort(); } catch (e) {}
      cb({ ok: false, error: 'Daemon timeout: ' + path });
    }, timeout);

    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4 || done) return;
      done = true;
      clearTimeout(timer);
      var text = xhr.responseText || '';
      var data = null;
      try { data = JSON.parse(text); } catch (e) { data = { ok: false, output: text, error: 'Bad daemon response' }; }
      cb(data);
    };

    try {
      xhr.open(method || 'GET', API + path, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      if (apiToken) xhr.setRequestHeader('X-XrayTun-Token', apiToken);
      xhr.send(body ? JSON.stringify(body) : null);
    } catch (e) {
      clearTimeout(timer);
      cb({ ok: false, error: e.message });
    }
  }

  function setPill(kind, text) {
    var pill = $('statusPill');
    if (!pill) return;
    var cls = kind === 'ok' ? 'pill-ok' : (kind === 'warn' ? 'pill-warn' : 'pill-off');
    pill.className = 'pill ' + cls;
    pill.textContent = text;
  }

  function setBusy(value, label) {
    busy = value;
    setLast(value ? (label || t('Выполняется')) : t('Готово'));
    var ids = ['btnConnect','btnDisconnect','btnRestart','btnStatus','btnFix','btnSave','btnLoadFile','btnAppLog','btnXrayLog','btnSingLog','btnDaemonLog','btnClearLog','btnCheckIp','profileSelect','profileUrl','subscriptionUrl','btnSubscription','btnLoadSubscription'];
    for (var i = 0; i < ids.length; i++) {
      if ($(ids[i])) $(ids[i]).disabled = value;
    }
  }

  function renderStatus(data) {
    var vpn = data.vpn || (data.ready ? 'ON' : (data.stale ? 'STALE' : 'OFF'));
    $('vpnState').textContent = vpn;
    $('powerOrb').className = vpn === 'ON' ? 'power-orb connected' : 'power-orb';
    $('connectionTitle').textContent = vpn === 'ON' ? t('Туннель включён') : (vpn === 'OFF' ? t('Готов к подключению') : t('Нужна проверка сети'));
    $('connectionHint').textContent = vpn === 'ON' ? t('Процессы и маршрут активны. Проверьте внешний IP, чтобы подтвердить доступ в интернет.') : t('Выберите сохранённый профиль и подключите телевизор.');
    $('xrayPid').textContent = data.xray_pid || '—';
    $('singPid').textContent = data.singbox_pid || '—';
    $('routeState').textContent = data.route || data.default_route || '—';
    $('serverRoute').textContent = data.server_route || '—';
    $('ipv6State').textContent = data.ipv6 || (data.ipv6_disabled ? 'disabled' : 'enabled/unknown');
    $('runtimeState').textContent = (data.engine || 'xray') + ': ' + (data.runtime_detail || data.runtime || 'unknown');
    if ($('externalIp')) $('externalIp').textContent = data.external_ip || $('externalIp').textContent || 'not checked';
    if (vpn === 'ON') setPill('ok', 'on');
    else if (vpn === 'STALE' || vpn === 'BROKEN_ROUTE') setPill('warn', vpn.toLowerCase());
    else setPill('off', 'off');
  }

  function refreshStatus(silent, after) {
    if (busy && !after) return;
    if (!after) setBusy(true, t('Обновление'));
    api('/status', 'GET', null, 7000, function (res) {
      if (!after) setBusy(false, t('Готово'));
      var text = stdout(res);
      var data = null;
      try { data = JSON.parse(text); } catch (e) {}
      if (res && res.ok && data) {
        renderStatus(data);
        setLog(JSON.stringify(data, null, 2));
        if (!silent) showToast(t('Статус обновлён'), 'ok');
        return;
      }
      setPill('warn', 'daemon?');
      setLog(text || 'Daemon offline. Trying to start it once via Homebrew...');
      if (!silent) showToast(t('Daemon offline, starting...'), 'warn');
      startDaemonViaHomebrew(function (ok) {
        if (ok) {
          showToast(t('Daemon started'), 'ok');
          refreshStatus(true, true);
        } else {
          showToast(t('Daemon start failed'), 'err');
        }
      });
    });
  }

  function runAction(path, label, timeout) {
    if (busy) return;
    setBusy(true, label || path);
    showToast(label || path, 'warn');
    api(path, 'POST', {}, timeout || 25000, function (res) {
      var out = stdout(res);
      setLog(out);
      setBusy(false, t('Готово'));
      showToast((res && res.ok) ? t('Команда выполнена') : t('Ошибка выполнения'), (res && res.ok) ? 'ok' : 'err');
      setTimeout(function () { refreshStatus(true, true); }, 700);
    });
  }

  function updateProfiles() {
    var lines = $('profileUrl').value.split(/\r?\n/);
    profileLines = lines.filter(function (line) { return line.trim() && line.trim().charAt(0) !== '#'; });
    var select = $('profileSelect');
    var selected = select.selectedIndex;
    select.innerHTML = '';
    profileLines.forEach(function (line, i) {
      var option = document.createElement('option');
      option.value = String(i);
      try { var p = XrayTunParser.parseProxyUrl(line); option.textContent = p.name + ' (' + p.protocol + ')'; }
      catch (e) { option.textContent = 'Line ' + (i + 1) + ': ' + e.message; }
      select.appendChild(option);
    });
    select.selectedIndex = Math.max(0, Math.min(selected, profileLines.length - 1));
  }

  function parseProfile() {
    var url = profileLines[$('profileSelect').selectedIndex];
    if (!url) throw new Error('Paste a profile URL or load a profile file');
    url = url.trim();
    var profile = XrayTunParser.parseProxyUrl(url);
    var config = XrayTunParser.configFromProfile(profile);
    $('profilePreview').textContent = JSON.stringify(XrayTunParser.redact({
      engine: profile.protocol === 'hysteria2' ? 'sing-box' : 'xray', profile: profile, config: config
    }), null, 2);
    return { profile: profile, xray: config, url: url };
  }

  function saveProfile() {
    if (busy) return;
    setBusy(true, t('Проверка сети'));
    api('/status', 'GET', null, 7000, function (res) {
      var status;
      try { status = JSON.parse(res.output); } catch (e) {}
      setBusy(false, t('Готово'));
      if (!res.ok || !status) { showToast(t('Cannot check VPN status; profile not saved'), 'err'); return; }
      if (status.xray_pid || status.singbox_pid || /dev tun0/.test(status.route || '')) {
        showToast(t('Отключите VPN перед сохранением профиля'), 'warn'); return;
      }
      saveProfileNow();
    });
  }

  function saveProfileNow() {
    if (busy) return;
    setBusy(true, t('Сохранение профиля'));
    try {
      updateProfiles();
      var parsed = parseProfile();
      var serverHost = parsed.profile.server;
      api('/profile/save', 'POST', {
        url: parsed.url,
        profile: parsed.profile,
        xray: parsed.xray,
        serverHost: serverHost
      }, 12000, function (res) {
        setBusy(false, t('Готово'));
        setLog(stdout(res));
        showToast((res && res.ok) ? t('Профиль сохранён') : t('Ошибка сохранения'), (res && res.ok) ? 'ok' : 'err');
        setTimeout(function () { refreshStatus(true, true); }, 700);
      });
    } catch (e) {
      setBusy(false, 'profile error');
      setLog('Import error: ' + e.message);
      showToast('Profile error: ' + e.message, 'err');
    }
  }

  function loadProfileFile() {
    if (busy) return;
    setBusy(true, t('Загрузка профиля'));
    api('/profile/load', 'GET', null, 8000, function (res) {
      setBusy(false, t('Готово'));
      var url = stdout(res).trim();
      if (!res || !res.ok || !url) {
        setLog(url || 'No profile file found at ' + BASE + '/profiles/default.url');
        showToast(t('No profile file found'), 'err');
        return;
      }
      $('profileUrl').value = url;
      try { updateProfiles(); parseProfile(); showToast(t('Профиль загружен'), 'ok'); }
      catch (e) { setLog('Parse error: ' + e.message); showToast('Parse error', 'err'); }
    });
  }

  function loadSubscriptionFile(silent, after) {
    if (!silent && busy) return;
    if (!silent) setBusy(true, t('Loading subscription file'));
    api('/subscription', 'GET', null, 5000, function (res) {
      if (!silent) setBusy(false);
      if (res && res.ok && res.output && $('subscriptionUrl')) {
        $('subscriptionUrl').value = res.output.trim();
        if (!silent) showToast(t('Subscription URL loaded. Press Update subscription.'), 'ok');
      } else if (!silent) {
        showToast(t('Subscription file is empty or unavailable'), 'err');
      }
      if (after) after();
    });
  }

  function updateSubscription() {
    if (busy) return;
    var url = $('subscriptionUrl').value.trim();
    if (url && !/^https:\/\//i.test(url)) { showToast(t('Use an HTTPS subscription URL'), 'err'); return; }
    setBusy(true, t('Updating subscription'));
    api('/subscription/update', 'POST', {url:url}, 25000, function (res) {
      setBusy(false);
      if (!res || !res.ok) { showToast(t('Subscription update failed'), 'err'); setLog(res && res.error || t('Subscription update failed')); return; }
      $('profileUrl').value = res.output || '';
      updateProfiles();
      try { parseProfile(); } catch (e) { $('profilePreview').textContent = e.message; }
      showToast(t('Subscription loaded. Select and save a profile.'), 'ok');
    });
  }

  function showLog(name) {
    if (busy) return;
    setBusy(true, t('Чтение журнала'));
    api('/logs?name=' + encodeURIComponent(name), 'GET', null, 8000, function (res) {
      setBusy(false, t('Готово'));
      setLog(stdout(res));
    });
  }

  function checkIp() {
    if (busy) return;
    setBusy(true, t('Проверка IP'));
    api('/check-ip', 'POST', {}, 12000, function (res) {
      var out = res && res.ok ? (res.output || '').trim() : '';
      setBusy(false, t('Готово'));
      if ($('externalIp')) $('externalIp').textContent = out || t('Не удалось проверить IP');
      setLog(out || (res && res.error) || t('Не удалось проверить IP'));
      showToast((res && res.ok && out) ? t('IP проверен') : t('Не удалось проверить IP'), (res && res.ok && out) ? 'ok' : 'err');
    });
  }

  function init() {
    if (initialized) return;
    initialized = true;
    if (window.XrayTunI18n) XrayTunI18n.apply();
    function openPane(name) {
      ['Home', 'Profiles', 'Logs'].forEach(function (key) {
        $('pane' + key).className = key === name ? 'pane' : 'pane hidden';
        $('nav' + key).className = key === name ? 'nav active' : 'nav';
        $('nav' + key).setAttribute('aria-selected', key === name ? 'true' : 'false');
      });
    }
    ['Home', 'Profiles', 'Logs'].forEach(function (key) { $('nav' + key).onclick = function () { openPane(key); }; });
    document.addEventListener('keydown', function (e) {
      var key = e.keyCode;
      var current = document.activeElement;
      if (key === 461 || key === 27) { openPane('Home'); $('navHome').focus(); e.preventDefault(); return; }
      if (key < 37 || key > 40 || !current || /TEXTAREA|SELECT|INPUT/.test(current.tagName)) return;
      var controls = document.querySelectorAll('button,select,textarea,pre[tabindex]');
      var from = current.getBoundingClientRect(), best = null, distance = Infinity;
      var fx = from.left + from.width / 2, fy = from.top + from.height / 2;
      for (var i = 0; i < controls.length; i++) {
        var node = controls[i];
        if (node === current || node.disabled || !node.offsetWidth || !node.offsetHeight) continue;
        var r = node.getBoundingClientRect();
        var dx = r.left + r.width / 2 - fx, dy = r.top + r.height / 2 - fy;
        var forward = key === 37 ? -dx : key === 39 ? dx : key === 38 ? -dy : dy;
        if (forward <= 2) continue;
        var cross = key === 37 || key === 39 ? Math.abs(dy) : Math.abs(dx);
        var score = forward + cross * 3;
        if (score < distance) { distance = score; best = node; }
      }
      if (best) { best.focus(); e.preventDefault(); }
    }, true);
    $('btnConnect').focus();
    $('btnConnect').onclick = function () { runAction('/connect', t('Подключаем VPN'), 40000); };
    $('btnDisconnect').onclick = function () { runAction('/disconnect', t('Отключаем VPN'), 15000); };
    $('btnRestart').onclick = function () { runAction('/restart', t('Переподключаем VPN'), 50000); };
    $('btnStatus').onclick = function () { refreshStatus(false); };
    if ($('btnCheckIp')) $('btnCheckIp').onclick = checkIp;
    $('btnFix').onclick = function () { runAction('/fix', t('Восстанавливаем сеть'), 15000); };
    $('btnSave').onclick = saveProfile;
    $('profileUrl').oninput = function () { updateProfiles(); try { parseProfile(); } catch (e) { $('profilePreview').textContent = e.message; } };
    $('profileSelect').onchange = function () { try { parseProfile(); } catch (e) { $('profilePreview').textContent = e.message; } };
    $('btnLoadFile').onclick = loadProfileFile;
    if ($('btnSubscription')) $('btnSubscription').onclick = updateSubscription;
    if ($('btnLoadSubscription')) $('btnLoadSubscription').onclick = function () { loadSubscriptionFile(false); };
    $('btnAppLog').onclick = function () { showLog('app'); };
    $('btnXrayLog').onclick = function () { showLog('xray'); };
    $('btnSingLog').onclick = function () { showLog('sing'); };
    if ($('btnDaemonLog')) $('btnDaemonLog').onclick = function () { showLog('daemon'); };
    $('btnClearLog').onclick = function () { setLog(''); };

    setPill('warn', 'daemon');
    setLast(t('Готово'));
    setLog('Daemon mode. The helper starts when the app opens; no boot autostart.');
    // Refresh app-owned scripts after an IPK upgrade, even if the old helper is alive.
    lunaExec('sh /media/developer/apps/usr/palm/applications/com.webosbrew.xraytun/scripts/install-runtime.sh >/dev/null 2>&1 && sh /home/root/webos-xray-tun/scripts/start-daemon.sh 2>&1', function (res) {
      if (res.returnValue === false) {
        setLog(stdout(res));
        showToast(t('Runtime update failed; reopen with Homebrew root service available'), 'err');
        return;
      }
      lunaExec('cat /home/root/webos-xray-tun/state/api-token', function (tokenResult) {
        var token = (tokenResult.stdoutString || tokenResult.stdout || tokenResult.output || '').trim();
        if (!/^[a-f0-9]{64}$/.test(token)) { setLog(t('Не удалось получить ключ доступа к помощнику.')); return; }
        apiToken = token;
        loadSubscriptionFile(true, function () {
          setTimeout(function () { refreshStatus(true); }, 700);
        });
      }, 5000);
    }, 15000);
  }

  window.onload = init;
  document.addEventListener('webOSLaunch', init, true);
}());
