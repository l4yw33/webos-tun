const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const nodes={};
for(const m of fs.readFileSync('app/index.html','utf8').matchAll(/id="([^"]+)"/g)) nodes[m[1]]={value:'',textContent:'',selectedIndex:-1,disabled:false,appendChild(){},setAttribute(){},focus(){}};
const sent=[];let active=false;const subscriptions=[];
function XHR() { this.open=(method,url)=>{this.url=url;};this.setRequestHeader=()=>{};this.abort=()=>{};
 this.send=body=>{let data;if(this.url.endsWith('/status'))data={ok:true,output:JSON.stringify({vpn:active?'ON':'OFF',singbox_pid:active?'123':'',xray_pid:'',route:active?'default dev tun0':'default via 192.168.1.1 dev eth0'})};else if(this.url.endsWith('/subscription/update')){subscriptions.push(JSON.parse(body));data={ok:true,output:'hy2://test@vpn.example:443#Subscription'};}else {sent.push(JSON.parse(body));data={ok:true,output:'profile saved'};}this.responseText=JSON.stringify(data);this.readyState=4;this.onreadystatechange();}; }
const context={document:{getElementById:id=>nodes[id],createElement:()=>({}),addEventListener(){}},XMLHttpRequest:XHR,setTimeout:()=>1,clearTimeout(){}};
context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync('app/js/parser.js','utf8'),context);vm.runInContext(fs.readFileSync('app/js/app.js','utf8'),context);context.onload();
nodes.profileUrl.value='hy2://private-auth@host.example?obfs=salamander&obfs-password=private-obfs#Main\nvless://11111111-2222-4333-8444-555555555555@host.example?type=xhttp&security=tls#Backup';
nodes.profileUrl.oninput();assert.equal(nodes.profileSelect.selectedIndex,0);assert.ok(!nodes.profilePreview.textContent.includes('private-auth'));assert.ok(!nodes.profilePreview.textContent.includes('private-obfs'));
nodes.btnSave.onclick();assert.equal(sent.length,1);assert.equal(sent[0].profile.protocol,'hysteria2');assert.equal(sent[0].xray.outbounds[0].type,'hysteria2');assert.ok(!sent[0].url.includes('\n'));
nodes.profileSelect.selectedIndex=1;nodes.profileSelect.onchange();nodes.btnSave.onclick();assert.equal(sent.length,2);assert.equal(sent[1].profile.protocol,'vless');assert.equal(sent[1].xray.outbounds[0].streamSettings.network,'xhttp');
active=true;nodes.btnSave.onclick();assert.equal(sent.length,2);assert.match(nodes.toast.textContent,/Отключите/);
console.log('PASS UI multi-link selection, native save, XHTTP save, redaction and active-VPN save guard');
nodes.subscriptionUrl.value='https://subscription.example/private';nodes.btnSubscription.onclick();assert.equal(subscriptions.length,1);assert.equal(subscriptions[0].url,nodes.subscriptionUrl.value);assert.match(nodes.profileUrl.value,/^hy2:\/\//);assert.equal(sent.length,2);assert.equal(nodes.btnSubscription.disabled,false);
nodes.subscriptionUrl.value='http://subscription.example/private';nodes.btnSubscription.onclick();assert.equal(subscriptions.length,1);
console.log('PASS subscription loads selectable profiles without saving or connecting; HTTP URL rejected');
