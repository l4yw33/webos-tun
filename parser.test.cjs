'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ctx = {}; vm.createContext(ctx); vm.runInContext(fs.readFileSync('app/js/parser.js','utf8'), ctx);
const P = ctx.XrayTunParser;
const id = '11111111-2222-4333-8444-555555555555';
let checks = 0;
function test(name, fn) { fn(); checks++; console.log('PASS ' + name); }
function cfg(url) { return P.configFromProfile(P.parseProxyUrl(url)); }
test('Trojan gRPC legacy fields preserved', () => {
 const c=cfg('trojan://p%40ss@proxy.example:443?type=grpc&security=tls&sni=tls.example&authority=auth.example&serviceName=%2Fservice%2Fpath#Old');
 assert.equal(c.outbounds[0].settings.servers[0].password,'p@ss');
 assert.equal(c.outbounds[0].streamSettings.grpcSettings.serviceName,'/service/path');
 assert.equal(c.outbounds[0].streamSettings.tlsSettings.allowInsecure,false);
});
test('Trojan WS ALPN and Host', () => { const s=cfg('trojan://pw@host.example:443?type=ws&host=front.example&path=%2Fws').outbounds[0].streamSettings; assert.equal(s.wsSettings.headers.Host,'front.example'); assert.equal(s.tlsSettings.alpn[0],'http/1.1'); });
test('Trojan TCP is supported', () => assert.equal(cfg('trojan://pw@host.example').outbounds[0].streamSettings.network,'tcp'));
test('Hiddify-style VLESS XHTTP TLS', () => {
 const p=P.parseProxyUrl('vless://'+id+'@48.102.219.190:443?encryption=none&type=xhttp&security=tls&sni=public.example&host=public.example&path=%2Ftest&mode=auto&alpn=h2&fp=firefox#Backup');
 const c=P.configFromProfile(p), out=c.outbounds[0];
 assert.equal(out.settings.vnext[0].users[0].id,id); assert.equal(out.settings.vnext[0].users[0].flow,'');
 assert.equal(out.streamSettings.xhttpSettings.path,'/test'); assert.equal(out.streamSettings.tlsSettings.serverName,'public.example'); assert.ok(!out.mux);
});
test('REALITY TCP Vision', () => { const s=cfg('vless://'+id+'@host.example:443?security=reality&sni=cover.example&pbk=publickey&sid=abcd&type=tcp&flow=xtls-rprx-vision').outbounds[0].streamSettings; assert.equal(s.realitySettings.shortId,'abcd'); assert.ok(!s.tlsSettings); });
test('XHTTP extra preserved', () => { const e=encodeURIComponent(JSON.stringify({xmux:{maxConcurrency:1,maxConnections:0}})); assert.equal(cfg('vless://'+id+'@host.example?type=xhttp&extra='+e).outbounds[0].streamSettings.xhttpSettings.extra.xmux.maxConcurrency,1); });
test('Hysteria2 Salamander native TUN; credentials decoded; SNI retained', () => {
 const c=cfg('hysteria2://user%3Apass%40word@48.102.219.190:443/?sni=tls.example&obfs=salamander&obfs-password=obfs%2Bsecret#Main');
 assert.equal(c.inbounds[0].interface_name,'tun0'); assert.equal(c.route.final,'proxy');
 assert.equal(c.outbounds[0].password,'user:pass@word'); assert.equal(c.outbounds[0].obfs.password,'obfs+secret'); assert.equal(c.outbounds[0].tls.server_name,'tls.example'); assert.equal(c.outbounds[0].tls.insecure,false);
 assert.ok(!('up_mbps' in c.outbounds[0])); assert.ok(!('network' in c.outbounds[0]));
});
test('hy2 alias and explicit bandwidth', () => { const c=cfg('HY2://pw@host.example/?upmbps=20&downmbps=40'); assert.equal(c.outbounds[0].up_mbps,20); });
test('Insecure TLS rejected', () => assert.throws(() => cfg('hy2://pw@host.example?insecure=1')));
test('Preview removes both auth and Salamander password and UUID', () => { const p=P.parseProxyUrl('hy2://secret-auth@host.example?obfs=salamander&obfs-password=secret-obfs'); const text=JSON.stringify(P.redact({profile:p, config:P.configFromProfile(p)})); assert.ok(!text.includes('secret-auth')); assert.ok(!text.includes('secret-obfs')); assert.ok(!JSON.stringify(P.redact(cfg('vless://'+id+'@host.example'))).includes(id)); });
const invalid = [
 'hy2://pw@host.example:443oops', 'hy2://pw@host.example:0', 'hy2://pw@host.example:65536',
 'hy2://pw@[::1]:443', 'hy2://pw@host.example:443,444', 'hy2://pw@host.example?obfs=gecko',
 'hy2://pw@host.example?obfs=salamander', 'hy2://pw@host.example?pinSHA256=abc',
 'hy2://pw@host.example?upmbps=NaN', 'vmess://anything', 'vless://bad@host.example',
 'vless://'+id+'@host.example?type=invalid', 'vless://'+id+'@host.example?security=reality',
 'vless://'+id+'@host.example?type=xhttp&flow=xtls-rprx-vision', 'hy2://pw@host.example\nother',
 'vless://'+id+'@host.example?type=xhttp&extra='+encodeURIComponent('{"downloadSettings":{"address":"other.example"}}')
];
invalid.forEach((url,i) => test('Invalid/unsupported input '+(i+1)+' rejected', () => assert.throws(() => P.parseProxyUrl(url))));
console.log(checks+' checks passed');
const cp = require('node:child_process');
const fixtures = [
 'trojan://pw@proxy.example?type=grpc&serviceName=test',
 'trojan://pw@proxy.example?type=ws&path=%2Fws',
 'trojan://pw@proxy.example?type=tcp',
 'vless://'+id+'@proxy.example?type=xhttp&mode=auto&security=tls&alpn=h2&path=%2Ftest',
 'vless://'+id+'@proxy.example?type=tcp&security=reality&sni=cover.example&pbk=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA&sid=abcd&flow=xtls-rprx-vision'
];
const core = process.env.XRAY_TEST_BINARY;
if (core) {
 const os = require('node:os'), path = require('node:path');
 const temp = fs.mkdtempSync(path.join(os.tmpdir(),'webos-config-'));
 try {
 fixtures.forEach((uri,i) => {
  const target=path.join(temp, i+'.json'); fs.writeFileSync(target,JSON.stringify(cfg(uri)));
  const result = cp.spawnSync(core,['run','-test','-config',target],{encoding:'utf8',windowsHide:true});
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
  console.log('PASS Xray core config validation '+(i+1));
 });
 } finally { fs.rmSync(temp,{recursive:true,force:true}); }
}
