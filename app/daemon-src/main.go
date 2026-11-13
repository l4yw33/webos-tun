package main

import (
	"bytes"
	"context"
 "crypto/rand"
 "crypto/subtle"
 "encoding/hex"
 "regexp"
 "reflect"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const (
	baseDir    = "/home/root/webos-xray-tun"
	listenAddr = "127.0.0.1:17999"
	maxBody    = 1024 * 1024
)

var actionMu sync.Mutex
var sessionToken string

type response struct {
	OK       bool   `json:"ok"`
	Action   string `json:"action,omitempty"`
	Output   string `json:"output,omitempty"`
	Error    string `json:"error,omitempty"`
	ExitCode int    `json:"exit_code,omitempty"`
	TimedOut bool   `json:"timed_out,omitempty"`
	Daemon   string `json:"daemon,omitempty"`
}

type profileSaveRequest struct {
	URL        string          `json:"url"`
	Profile    json.RawMessage `json:"profile"`
	Xray       json.RawMessage `json:"xray"`
	ServerHost string          `json:"serverHost"`
}

func main() {
	for _, dir := range []string{"logs", "profiles", "configs", "state"} {
  path := filepath.Join(baseDir, dir)
  if err := os.MkdirAll(path, 0700); err != nil { panic("cannot create private runtime directory") }
  if err := os.Chmod(path, 0700); err != nil { panic("cannot protect runtime directory") }
 }
 tokenBytes := make([]byte, 32)
 if _, err := rand.Read(tokenBytes); err != nil { panic("cannot generate helper token") }
 sessionToken = hex.EncodeToString(tokenBytes)
 if err := atomicWrite(filepath.Join(baseDir, "state/api-token"), []byte(sessionToken), 0600); err != nil { panic("cannot save helper token") }
	logLine("daemon starting")

	mux := http.NewServeMux()
	mux.HandleFunc("/health", handleHealth)
 mux.HandleFunc("/subscription", handleSubscription)
 mux.HandleFunc("/subscription/update", handleSubscription)
	mux.HandleFunc("/status", handleScript("status", filepath.Join(baseDir, "scripts/status.sh"), 6*time.Second, false))
	mux.HandleFunc("/connect", handleScript("connect", filepath.Join(baseDir, "scripts/vpn-on.sh"), 35*time.Second, true))
	mux.HandleFunc("/disconnect", handleScript("disconnect", filepath.Join(baseDir, "scripts/vpn-off.sh"), 12*time.Second, true))
	mux.HandleFunc("/restart", handleScript("restart", filepath.Join(baseDir, "scripts/vpn-restart.sh"), 45*time.Second, true))
	mux.HandleFunc("/fix", handleScript("fix", filepath.Join(baseDir, "scripts/fix-network.sh"), 12*time.Second, true))
	mux.HandleFunc("/check-ip", handleCheckIP)
	mux.HandleFunc("/profile/load", handleProfileLoad)
	mux.HandleFunc("/profile/save", handleProfileSave)
	mux.HandleFunc("/logs", handleLogs)

	srv := &http.Server{Handler: secure(mux), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 55 * time.Second, IdleTimeout: 20 * time.Second, MaxHeaderBytes: 8192}
	ln, err := net.Listen("tcp", listenAddr)
	if err != nil {
		logLine("listen failed: " + err.Error())
		os.Exit(1)
	}
	logLine("daemon listening on " + listenAddr)
	if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
		logLine("serve failed: " + err.Error())
		os.Exit(1)
	}
}

func logLine(s string) {
	f, err := os.OpenFile(filepath.Join(baseDir, "logs/daemon.log"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600)
	if err != nil {
		return
	}
	defer f.Close()
	_, _ = fmt.Fprintf(f, "[%s] %s\n", time.Now().Format("2006-01-02 15:04:05"), s)
}

func cors(w http.ResponseWriter) {
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-XrayTun-Token")
	w.Header().Set("Cache-Control", "no-store")
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	cors(w)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func preflight(w http.ResponseWriter, r *http.Request) bool {
	cors(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return true
	}
	return false
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	if preflight(w, r) {
		return
	}
	writeJSON(w, 200, response{OK: true, Daemon: "ok"})
}

func handleScript(action, path string, timeout time.Duration, exclusive bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if preflight(w, r) {
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodPost {
			writeJSON(w, 405, response{OK: false, Action: action, Error: "method not allowed"})
			return
		}
		if exclusive {
			actionMu.Lock()
			defer actionMu.Unlock()
		}
		out, code, timedOut, err := runShell(timeout, "sh", path)
		if err != nil {
			logLine(action + " failed: " + err.Error())
			writeJSON(w, 200, response{OK: false, Action: action, Output: out, Error: err.Error(), ExitCode: code, TimedOut: timedOut})
			return
		}
		logLine(action + " ok")
		writeJSON(w, 200, response{OK: true, Action: action, Output: out, ExitCode: code})
	}
}

func runShell(timeout time.Duration, name string, args ...string) (string, int, bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Dir = baseDir
	var buf bytes.Buffer
	cmd.Stdout = &buf
	cmd.Stderr = &buf
	err := cmd.Run()
	output := buf.String()
	if ctx.Err() == context.DeadlineExceeded {
		return output, -1, true, fmt.Errorf("timeout after %s", timeout)
	}
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			return output, exitErr.ExitCode(), false, err
		}
		return output, -1, false, err
	}
	return output, 0, false, nil
}

func handleProfileLoad(w http.ResponseWriter, r *http.Request) {
	if preflight(w, r) {
		return
	}
	p := filepath.Join(baseDir, "profiles/default.url")
	b, err := os.ReadFile(p)
	if err != nil {
		writeJSON(w, 200, response{OK: false, Action: "profile-load", Error: err.Error()})
		return
	}
	writeJSON(w, 200, response{OK: true, Action: "profile-load", Output: strings.TrimSpace(string(b))})
}

func handleProfileSave(w http.ResponseWriter, r *http.Request) {
	if preflight(w, r) {
		return
	}
	if r.Method != http.MethodPost {
		writeJSON(w, 405, response{OK: false, Action: "profile-save", Error: "method not allowed"})
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxBody)
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeJSON(w, 200, response{OK: false, Action: "profile-save", Error: err.Error()})
		return
	}
	var req profileSaveRequest
	if err := json.Unmarshal(body, &req); err != nil {
		writeJSON(w, 200, response{OK: false, Action: "profile-save", Error: "invalid json: " + err.Error()})
		return
	}
 actionMu.Lock()
 defer actionMu.Unlock()
 out, _, _, statusErr := runShell(6*time.Second, "sh", filepath.Join(baseDir, "scripts/status.sh"))
 var status map[string]any
 if statusErr != nil || json.Unmarshal([]byte(out), &status) != nil { writeJSON(w, 409, response{Error:"cannot verify stopped VPN"}); return }
 if status["xray_pid"] != "" || status["singbox_pid"] != "" || strings.Contains(fmt.Sprint(status["route"]), "dev tun0") { writeJSON(w,409,response{Error:"disconnect VPN before saving"}); return }
	req.URL = strings.TrimSpace(req.URL)
	req.ServerHost = strings.TrimSpace(req.ServerHost)
	if req.URL == "" || len(req.Profile) == 0 || len(req.Xray) == 0 || req.ServerHost == "" {
		writeJSON(w, 200, response{OK: false, Action: "profile-save", Error: "missing url/profile/xray/serverHost"})
		return
	}
	if !regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9.-]*$`).MatchString(req.ServerHost) || strings.ContainsAny(req.URL,"\r\n") {
  writeJSON(w,400,response{Error:"invalid endpoint or multiline URL"}); return
 }
 if err := validateConfig(req); err != nil { writeJSON(w,400,response{Error:err.Error()}); return }
 // Validate JSON blobs before writing.
	var tmp any
	if err := json.Unmarshal(req.Profile, &tmp); err != nil {
		writeJSON(w, 200, response{OK: false, Action: "profile-save", Error: "profile json invalid: " + err.Error()})
		return
	}
	if err := json.Unmarshal(req.Xray, &tmp); err != nil {
		writeJSON(w, 200, response{OK: false, Action: "profile-save", Error: "xray json invalid: " + err.Error()})
		return
	}
	_ = os.MkdirAll(filepath.Join(baseDir, "profiles"), 0755)
	_ = os.MkdirAll(filepath.Join(baseDir, "configs"), 0755)
	_ = os.MkdirAll(filepath.Join(baseDir, "state"), 0755)
	writes := []struct {
		path string
		data []byte
		mode os.FileMode
	}{
		{filepath.Join(baseDir, "profiles/default.url"), []byte(req.URL + "\n"), 0600},
		{filepath.Join(baseDir, "profiles/profile.json"), prettyJSON(req.Profile), 0600},
		{filepath.Join(baseDir, "configs/xray.json"), prettyJSON(req.Xray), 0600},
		{filepath.Join(baseDir, "profiles/server_host"), []byte(req.ServerHost + "\n"), 0600},
	}
 // Roll back already replaced files if one write fails; actions share actionMu.
 before:=make([][]byte,len(writes)); existed:=make([]bool,len(writes))
 for i,item:=range writes { b,err:=os.ReadFile(item.path); if err==nil {before[i]=b;existed[i]=true} else if !os.IsNotExist(err) {writeJSON(w,500,response{Error:"cannot read previous profile"});return} }
 for i,item:=range writes {
  if err:=atomicWrite(item.path,item.data,item.mode); err!=nil {
   for j:=i-1;j>=0;j-- {if existed[j] {_=atomicWrite(writes[j].path,before[j],0600)} else {_=os.Remove(writes[j].path)}}
   writeJSON(w,500,response{Error:"profile save failed; previous files restored where possible"});return
  }
 }

	_ = os.Remove(filepath.Join(baseDir, "profiles/server_ip"))
	_ = os.Remove(filepath.Join(baseDir, "state/server_ip"))
	logLine("profile saved")
	writeJSON(w, 200, response{OK: true, Action: "profile-save", Output: "profile saved"})
}

func prettyJSON(raw json.RawMessage) []byte {
	var out bytes.Buffer
	if err := json.Indent(&out, raw, "", "  "); err != nil {
		return raw
	}
	out.WriteByte('\n')
	return out.Bytes()
}

func handleLogs(w http.ResponseWriter, r *http.Request) {
	if preflight(w, r) {
		return
	}
	name := r.URL.Query().Get("name")
	var p string
	switch name {
	case "app":
		p = filepath.Join(baseDir, "logs/app.log")
	case "xray":
		p = filepath.Join(baseDir, "logs/xray.log")
	case "sing", "singbox":
		p = filepath.Join(baseDir, "logs/singbox.log")
	case "daemon":
		p = filepath.Join(baseDir, "logs/daemon.log")
	default:
		writeJSON(w, 200, response{OK: false, Action: "logs", Error: "unknown log"})
		return
	}
 f,err:=os.Open(p)
 if err!=nil {writeJSON(w,200,response{Error:"log unavailable"});return};defer f.Close()
 if stat,err:=f.Stat();err==nil && stat.Size()>12000 {_,_=f.Seek(-12000,io.SeekEnd)}
 b,err:=io.ReadAll(io.LimitReader(f,12000));if err!=nil {writeJSON(w,200,response{Error:"log read failed"});return}
 s:=redactLog(string(b))

	writeJSON(w, 200, response{OK: true, Action: "logs", Output: s})
}

// A token is generated per helper process and read only through Homebrew root exec.
// Opaque file origins are allowed for webOS, but still require the secret header.
func secure(next http.Handler) http.Handler {
 return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request) {
  if r.Host != "127.0.0.1:17999" { http.Error(w,"invalid host",403); return }
  ip,_,err := net.SplitHostPort(r.RemoteAddr)
  if err != nil || !net.ParseIP(ip).IsLoopback() { http.Error(w,"loopback only",403); return }
  origin := r.Header.Get("Origin")
  if origin != "" && origin != "null" && origin != "file://" && origin != "file://com.webosbrew.xraytun" && origin != "app://com.webosbrew.xraytun" { http.Error(w,"origin denied",403); return }
  if origin != "" { w.Header().Set("Access-Control-Allow-Origin",origin); w.Header().Set("Vary","Origin") }
  if r.Method == "OPTIONS" { cors(w); w.WriteHeader(204); return }
  method := "GET"
  switch r.URL.Path { case "/subscription/update","/connect","/disconnect","/restart","/fix","/profile/save","/check-ip": method="POST" }
  if r.Method != method { http.Error(w,"method not allowed",405); return }
  if r.URL.Path != "/health" {
   token := r.Header.Get("X-XrayTun-Token")
   if sessionToken == "" || subtle.ConstantTimeCompare([]byte(token),[]byte(sessionToken)) != 1 { http.Error(w,"authentication required",401); return }
  }
  next.ServeHTTP(w,r)
 })
}

func atomicWrite(path string, data []byte, mode os.FileMode) error {
 f,err := os.CreateTemp(filepath.Dir(path),".write-*")
 if err != nil { return err }
 name:=f.Name(); defer os.Remove(name)
 if err=f.Chmod(mode); err==nil { _,err=f.Write(data) }
 if err==nil { err=f.Sync() }
 closeErr:=f.Close(); if err!=nil { return err }; if closeErr!=nil { return closeErr }
 return os.Rename(name,path)
}

func redactLog(s string) string {
 s=regexp.MustCompile(`(?i)(?:trojan|vless|hy2|hysteria2)://[^\s"<>]+`).ReplaceAllString(s,"[profile hidden]")
 s=regexp.MustCompile(`(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`).ReplaceAllString(s,"[UUID hidden]")
 // Also mask exact secrets from the selected profile if cores echoed them.
 var p map[string]any
 if b,err:=os.ReadFile(filepath.Join(baseDir,"profiles/profile.json")); err==nil && json.Unmarshal(b,&p)==nil {
  for _,key:=range []string{"password","obfs_password","uuid"} { if v,ok:=p[key].(string); ok && v!="" { s=strings.ReplaceAll(s,v,"***") } }
 }
 return s
}

func validateConfig(req profileSaveRequest) error {
 var p map[string]any; var c map[string]any
 if json.Unmarshal(req.Profile,&p)!=nil || json.Unmarshal(req.Xray,&c)!=nil { return fmt.Errorf("invalid configuration") }
 proto:=p["protocol"]
 if proto!="hysteria2" && proto!="trojan" && proto!="vless" { return fmt.Errorf("unsupported protocol") }
 if p["server"]!=req.ServerHost || p["insecure"]==true { return fmt.Errorf("endpoint mismatch or insecure TLS") }
 // Reject file paths, APIs, remote rule sets and other non-app configuration features.
 allowed:=strings.Fields("log loglevel level timestamp inbounds outbounds route tag listen port protocol settings udp auth servers address password vnext users id encryption flow streamSettings network security tlsSettings serverName allowInsecure fingerprint alpn grpcSettings authority serviceName multiMode wsSettings path headers Host xhttpSettings host mode extra xmux maxConcurrency maxConnections cMaxReuseTimes hMaxRequestTimes hMaxReusableSecs hKeepAlivePeriod realitySettings publicKey shortId spiderX type interface_name mtu stack auto_route strict_route server server_port tls enabled server_name insecure obfs up_mbps down_mbps rules ip_cidr outbound final version")
 keys:=map[string]bool{}; for _,k:=range allowed { keys[k]=true }
 var walk func(any) bool
 walk=func(v any) bool { switch x:=v.(type) {case map[string]any: for k,val:=range x { if !keys[k] {return false}; if (k=="insecure"||k=="allowInsecure") && val==true {return false}; if !walk(val) {return false} }; case []any: for _,val:=range x {if !walk(val){return false}} }; return true }
 if !walk(c) { return fmt.Errorf("configuration contains unsupported or unsafe options") }
 log,ok:=c["log"].(map[string]any); if !ok || len(log)>2 {return fmt.Errorf("invalid log settings")}
 if proto=="hysteria2" {if log["level"]!="warning" {return fmt.Errorf("invalid log level")}} else {if log["loglevel"]!="warning" {return fmt.Errorf("invalid log level")}}
 expected:=`[{"tag":"socks-in","listen":"127.0.0.1","port":10808,"protocol":"socks","settings":{"udp":true,"auth":"noauth"}}]`
 if proto=="hysteria2" {expected=`[{"type":"tun","tag":"tun-in","interface_name":"tun0","address":["172.19.0.1/30"],"mtu":1400,"stack":"gvisor","auto_route":false,"strict_route":false}]`}
 var inbound any; _=json.Unmarshal([]byte(expected),&inbound)
 if !reflect.DeepEqual(c["inbounds"],inbound) {return fmt.Errorf("only the app's private inbound is permitted")}
 outs,ok:=c["outbounds"].([]any); if !ok || len(outs)<1 {return fmt.Errorf("missing outbound")}
 first,ok:=outs[0].(map[string]any); if !ok {return fmt.Errorf("invalid outbound")}
 if proto=="hysteria2" {
  if len(outs)!=2 || first["type"]!="hysteria2" || first["server"]!=req.ServerHost {return fmt.Errorf("invalid native outbound")}
  direct,ok:=outs[1].(map[string]any);if !ok || len(direct)!=2 || direct["type"]!="direct" || direct["tag"]!="direct" {return fmt.Errorf("invalid direct outbound")}
  tls,ok:=first["tls"].(map[string]any);if !ok || tls["enabled"]!=true {return fmt.Errorf("TLS required")}
 } else {
  if len(outs)!=1 || first["protocol"]!=proto {return fmt.Errorf("invalid Xray outbound")}
  stream,ok:=first["streamSettings"].(map[string]any);if !ok || (stream["security"]!="tls" && stream["security"]!="reality") {return fmt.Errorf("encrypted transport required")}
 }

 return nil
}

func publicIPv4(ctx context.Context, client *http.Client, endpoints []string)(string,error){
 failures:=[]string{}
 for _,endpoint:=range endpoints {
  req,err:=http.NewRequestWithContext(ctx,"GET",endpoint,nil);if err!=nil{return "",err}
  req.Header.Set("User-Agent","webos-xray-tun/1.3")
  resp,err:=client.Do(req)
  if err!=nil {failures=append(failures,"HTTPS request failed");continue}
  body,readErr:=io.ReadAll(io.LimitReader(resp.Body,129));resp.Body.Close()
  ip:=net.ParseIP(strings.TrimSpace(string(body)))
  if readErr==nil&&resp.StatusCode==200&&len(body)<=128&&ip!=nil&&ip.To4()!=nil&&publicSubscriptionIP(ip) {return ip.To4().String(),nil}
  failures=append(failures,fmt.Sprintf("HTTP %d or invalid IPv4 response",resp.StatusCode))
 }
 return "",fmt.Errorf("IPv4 check failed: %s",strings.Join(failures,"; "))
}

func handleCheckIP(w http.ResponseWriter, r *http.Request) {
 ctx,cancel:=context.WithTimeout(r.Context(),10*time.Second);defer cancel()
 transport:=&http.Transport{DialContext:func(ctx context.Context,network,address string)(net.Conn,error){return (&net.Dialer{Timeout:2*time.Second}).DialContext(ctx,"tcp4",address)},TLSHandshakeTimeout:2*time.Second,ResponseHeaderTimeout:3*time.Second}
 defer transport.CloseIdleConnections()
 client:=&http.Client{Transport:transport,Timeout:3*time.Second,CheckRedirect:func(_ *http.Request,_ []*http.Request)error{return fmt.Errorf("redirect refused")}}
 ip,err:=publicIPv4(ctx,client,[]string{"https://api.ipify.org","https://checkip.amazonaws.com","https://icanhazip.com"})
 if err!=nil{writeJSON(w,200,response{Error:err.Error()});return}
 writeJSON(w,200,response{OK:true,Output:ip})
}
