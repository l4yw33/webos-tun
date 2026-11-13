(function (global) {
  'use strict';
  function dec(v) { try { return decodeURIComponent(v || ''); } catch (e) { throw new Error('Invalid URL encoding'); } }
  function flag(v) { return v === '1' || v === 'true'; }
  function parseProxyUrl(url) {
    var m = /^(trojan|vless|hysteria2|hy2):\/\/([^\s]+)$/i.exec(url.trim());
    if (!m) throw new Error('Supported: trojan://, vless://, hysteria2://, hy2://');
    var proto = m[1].toLowerCase(), raw = m[2], q = Object.create(null), i = raw.indexOf('#');
    if (proto === 'hy2') proto = 'hysteria2';
    var name = i < 0 ? proto : dec(raw.slice(i + 1));
    if (i >= 0) raw = raw.slice(0, i);
    i = raw.indexOf('?');
    (i < 0 ? '' : raw.slice(i + 1)).split('&').forEach(function (s) {
      if (!s) return;
      var n = s.indexOf('='); q[dec(n < 0 ? s : s.slice(0, n))] = dec(n < 0 ? '' : s.slice(n + 1));
    });
    raw = (i < 0 ? raw : raw.slice(0, i)).replace(/\/$/, '');
    i = raw.lastIndexOf('@');
    if (i < 1) throw new Error('Missing authentication before @');
    var auth = dec(raw.slice(0, i)), hp = raw.slice(i + 1).split(':');
    if (hp.length > 2 || hp[0].indexOf('[') >= 0) throw new Error('IPv6 endpoints are not supported by this runtime');
    var host = hp[0], port = hp.length > 1 ? hp[1] : '443';
    if (!/^[a-z0-9][a-z0-9.-]*$/i.test(host)) throw new Error('Invalid server hostname');
    if (!/^\d+$/.test(port) || +port < 1 || +port > 65535) throw new Error('Invalid port; port hopping is not supported');
    if (q.ech || q.pinSHA256 || q.mport) throw new Error('ECH, certificate pins and port hopping are not supported');
    var p = { protocol: proto, name: name, server: host, server_ip: '', server_port: +port,
      server_name: q.sni || q.serverName || q.host || host, insecure: flag(q.insecure) || flag(q.allowInsecure),
      network: q.type || q.network || 'tcp', security: q.security || 'tls',
      fingerprint: q.fp || q.fingerprint || 'firefox', authority: q.authority || q.host || q.sni || host,
      path: q.path || '/', service_name: q.serviceName || q.service_name || '', alpn: q.alpn ? q.alpn.split(',') : null };
    if (p.insecure) throw new Error('Небезопасный TLS отключён: нужен действительный сертификат');
    if (proto === 'hysteria2') {
      p.password = auth; p.obfs = q.obfs || ''; p.obfs_password = q['obfs-password'] || q.obfsPassword || '';
      if (p.obfs && p.obfs !== 'salamander') throw new Error('Only Salamander obfuscation is supported');
      if (p.obfs && !p.obfs_password) throw new Error('Missing Salamander password');
      ['upmbps', 'downmbps'].forEach(function (key) {
        if (q[key] !== undefined) {
          if (!/^\d+(\.\d+)?$/.test(q[key])) throw new Error('Invalid bandwidth');
          p[key] = +q[key];
        }
      });
      return p;
    }
    if (['tcp', 'grpc', 'ws', 'xhttp'].indexOf(p.network) < 0) throw new Error('Unsupported transport: ' + p.network);
    if (['tls', 'reality'].indexOf(p.security) < 0) throw new Error('Unsupported security: ' + p.security);
    if (proto === 'trojan') { p.password = auth; if (p.security !== 'tls') throw new Error('Trojan requires TLS'); }
    else {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(auth)) throw new Error('VLESS requires a UUID');
      p.uuid = auth; p.flow = q.flow || '';
      if (q.encryption && q.encryption !== 'none') throw new Error('Unsupported VLESS encryption');
      if (p.flow && (p.flow !== 'xtls-rprx-vision' || p.network !== 'tcp')) throw new Error('Vision requires TCP');
    }
    if (p.security === 'reality') {
      p.public_key = q.pbk || ''; p.short_id = q.sid || ''; p.spider_x = q.spx || '/';
      if (!p.public_key || !q.sni) throw new Error('REALITY requires pbk and sni');
      if (!/^[0-9a-f]{0,16}$/i.test(p.short_id) || p.short_id.length % 2) throw new Error('Invalid REALITY short ID');
    }
    p.mode = q.mode || 'auto';
    if (p.network === 'xhttp' && ['auto', 'packet-up', 'stream-up', 'stream-one'].indexOf(p.mode) < 0) throw new Error('Unsupported XHTTP mode');
    if (q.extra) {
      try { p.extra = JSON.parse(q.extra); } catch (e) { throw new Error('Invalid XHTTP extra JSON'); }
      if (!p.extra || typeof p.extra !== 'object' || Array.isArray(p.extra)) throw new Error('XHTTP extra must be an object');
      if (p.extra.downloadSettings) throw new Error('Separate XHTTP download endpoints are not supported');
    }
    return p;
  }
  function xrayConfigFromProfile(p) {
    if (p.protocol === 'hysteria2') throw new Error('Hysteria2 uses native sing-box');
    var stream = { network: p.network, security: p.security };
    if (p.security === 'tls') stream.tlsSettings = { serverName: p.server_name, allowInsecure: p.insecure, fingerprint: p.fingerprint,
      alpn: p.alpn || (p.network === 'ws' ? ['http/1.1'] : (p.network === 'tcp' ? ['h2', 'http/1.1'] : ['h2'])) };
    if (p.security === 'reality') stream.realitySettings = { serverName: p.server_name, fingerprint: p.fingerprint, publicKey: p.public_key, shortId: p.short_id, spiderX: p.spider_x };
    if (p.network === 'grpc') stream.grpcSettings = { authority: p.authority, serviceName: p.service_name, multiMode: false };
    if (p.network === 'ws') stream.wsSettings = { path: p.path, headers: { Host: p.authority } };
    if (p.network === 'xhttp') { stream.xhttpSettings = { path: p.path, host: p.authority, mode: p.mode }; if (p.extra) stream.xhttpSettings.extra = p.extra; }
    var addr = p.server_ip || p.server;
    var settings = p.protocol === 'trojan' ? { servers: [{ address: addr, port: p.server_port, password: p.password }] } :
      { vnext: [{ address: addr, port: p.server_port, users: [{ id: p.uuid, encryption: 'none', flow: p.flow }] }] };
    return { log: { loglevel: 'warning' }, inbounds: [{ tag: 'socks-in', listen: '127.0.0.1', port: 10808, protocol: 'socks', settings: { udp: true, auth: 'noauth' } }],
      outbounds: [{ tag: 'proxy', protocol: p.protocol, settings: settings, streamSettings: stream }] };
  }
  function configFromProfile(p) {
    if (p.protocol !== 'hysteria2') return xrayConfigFromProfile(p);
    var out = { type: 'hysteria2', tag: 'proxy', server: p.server_ip || p.server, server_port: p.server_port, password: p.password,
      tls: { enabled: true, server_name: p.server_name, insecure: p.insecure } };
    if (p.alpn) out.tls.alpn = p.alpn;
    if (p.obfs) out.obfs = { type: p.obfs, password: p.obfs_password };
    if (p.upmbps > 0) out.up_mbps = p.upmbps;
    if (p.downmbps > 0) out.down_mbps = p.downmbps;
    return { log: { level: 'warning', timestamp: true }, inbounds: [{ type: 'tun', tag: 'tun-in', interface_name: 'tun0', address: ['172.19.0.1/30'], mtu: 1400, stack: 'gvisor', auto_route: false, strict_route: false }],
      outbounds: [out, { type: 'direct', tag: 'direct' }],
      route: { rules: [{ ip_cidr: ['10.0.0.0/8', '127.0.0.0/8', '169.254.0.0/16', '172.16.0.0/12', '192.168.0.0/16'], outbound: 'direct' }], final: 'proxy' } };
  }
  function redact(v) {
    if (!v || typeof v !== 'object') return v;
    var out = Array.isArray(v) ? [] : {};
    Object.keys(v).forEach(function (key) { out[key] = /^(password|obfs_password|uuid|id|public_key|publicKey|short_id|shortId)$/.test(key) ? '***' : redact(v[key]); });
    return out;
  }
  global.XrayTunParser = { parseProxyUrl: parseProxyUrl, xrayConfigFromProfile: xrayConfigFromProfile, configFromProfile: configFromProfile, redact: redact };
}(this));
