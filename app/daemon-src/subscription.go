package main

import (
 "context"
 "encoding/base64"
 "encoding/json"
 "fmt"
 "io"
 "net"
 "net/http"
 "net/url"
 "os"
 "path/filepath"
 "strings"
 "time"
)

func subscriptionURL(raw string) (*url.URL,error) {
 u,err:=url.Parse(strings.TrimSpace(raw))
 if err!=nil || u.Scheme!="https" || u.Hostname()=="" || u.User!=nil || len(raw)>4096 {return nil,fmt.Errorf("use an HTTPS subscription URL without userinfo")}
 // A fragment is a client-side label and must never be sent to the provider.
 u.Fragment=""
 u.RawFragment=""
 if u.Port()!="" && u.Port()!="443" {return nil,fmt.Errorf("subscription port must be 443")}
 return u,nil
}

func publicSubscriptionIP(ip net.IP) bool {
 if ip==nil || !ip.IsGlobalUnicast() || ip.IsPrivate() || ip.IsLoopback() || ip.IsLinkLocalUnicast() {return false}
 for _,cidr:=range []string{"0.0.0.0/8","100.64.0.0/10","192.0.0.0/24","192.0.2.0/24","198.18.0.0/15","198.51.100.0/24","203.0.113.0/24","240.0.0.0/4","2001:db8::/32","2001::/32","2002::/16","64:ff9b::/96","64:ff9b:1::/48"} {
  _,block,_:=net.ParseCIDR(cidr);if block.Contains(ip){return false}
 }
 return true
}

func subscriptionDial(ctx context.Context,network,address string)(net.Conn,error){
 host,port,err:=net.SplitHostPort(address);if err!=nil || port!="443" {return nil,fmt.Errorf("invalid subscription address")}
 ips,err:=net.DefaultResolver.LookupIPAddr(ctx,host);if err!=nil || len(ips)==0 {return nil,fmt.Errorf("subscription DNS failed")}
 // Validate every answer, then connect to the validated IP, never resolve it again.
 for _,ip:=range ips {if !publicSubscriptionIP(ip.IP){return nil,fmt.Errorf("subscription must resolve only to public addresses")}}
 for _,ip:=range ips {conn,e:=(&net.Dialer{Timeout:5*time.Second}).DialContext(ctx,network,net.JoinHostPort(ip.IP.String(),port));if e==nil{return conn,nil}}
 return nil,fmt.Errorf("subscription connection failed")
}

func decodeSubscription(body []byte)(string,error){
 text:=strings.TrimSpace(strings.TrimPrefix(string(body),"\ufeff"))
 if !strings.Contains(text,"://") {
  compact:=strings.Join(strings.Fields(text),"")
  var decoded []byte;var err error
  for _,encoding:=range []*base64.Encoding{base64.StdEncoding,base64.RawStdEncoding,base64.URLEncoding,base64.RawURLEncoding}{decoded,err=encoding.DecodeString(compact);if err==nil{break}}
  if err!=nil{return "",fmt.Errorf("expected a plain or Base64 proxy URL list")};text=string(decoded)
 }
 lines:=[]string{};seen:=map[string]bool{}
 for _,line:=range strings.Split(strings.ReplaceAll(text,"\r",""),"\n") {
  line=strings.TrimSpace(line);if line==""||strings.HasPrefix(line,"#"){continue}
  u,err:=url.Parse(line)
  if err!=nil || (u.Scheme!="vless"&&u.Scheme!="trojan"&&u.Scheme!="hysteria2"&&u.Scheme!="hy2") {continue}
  if u.Hostname()=="" || u.User==nil || len(line)>16384 || strings.ContainsAny(line,"\t "){continue}
  if !seen[line]{lines=append(lines,line);seen[line]=true};if len(lines)>1024{return "",fmt.Errorf("subscription contains too many profiles")}
 }
 if len(lines)==0{return "",fmt.Errorf("no supported proxy URLs; Clash YAML and sing-box JSON are not supported")}
 return strings.Join(lines,"\n"),nil
}

func fetchSubscription(raw string)(string,error){
 u,err:=subscriptionURL(raw);if err!=nil{return "",err}
 transport:=&http.Transport{DialContext:subscriptionDial,TLSHandshakeTimeout:5*time.Second,ResponseHeaderTimeout:8*time.Second,MaxResponseHeaderBytes:16384}
 defer transport.CloseIdleConnections()
 client:=&http.Client{Transport:transport,Timeout:20*time.Second,CheckRedirect:func(req *http.Request,via []*http.Request)error{
  if len(via)>=3{return fmt.Errorf("too many redirects")};_,err:=subscriptionURL(req.URL.String());return err
 }}
 req,err:=http.NewRequest("GET",u.String(),nil);if err!=nil{return "",fmt.Errorf("invalid subscription request")}
 req.Header.Set("User-Agent","webos-xray-tun/1.3 Hiddify-compatible")
 req.Header.Set("Accept","text/plain")
 resp,err:=client.Do(req);if err!=nil{return "",fmt.Errorf("subscription fetch failed; HTTPS, DNS or public-address validation failed")}
 defer resp.Body.Close();if resp.StatusCode!=200{return "",fmt.Errorf("subscription server returned HTTP %d",resp.StatusCode)}
 body,err:=io.ReadAll(io.LimitReader(resp.Body,maxBody+1));if err!=nil||len(body)>maxBody{return "",fmt.Errorf("subscription response is too large or incomplete")}
 return decodeSubscription(body)
}

func handleSubscription(w http.ResponseWriter,r *http.Request){
 if r.Method=="GET" {
  b,err:=os.ReadFile(filepath.Join(baseDir,"profiles/subscription.url"));if os.IsNotExist(err){b=nil}else if err!=nil{writeJSON(w,500,response{Error:"cannot read subscription"});return}
  writeJSON(w,200,response{OK:true,Output:string(b)});return
 }
 r.Body=http.MaxBytesReader(w,r.Body,8192)
 var req struct{URL string `json:"url"`}
 if json.NewDecoder(r.Body).Decode(&req)!=nil{writeJSON(w,400,response{Error:"invalid subscription request"});return}
 raw:=strings.TrimSpace(req.URL)
 if raw=="" {b,err:=os.ReadFile(filepath.Join(baseDir,"profiles/subscription.url"));if err!=nil{writeJSON(w,400,response{Error:"enter a subscription URL"});return};raw=string(b)}
 normalized,err:=subscriptionURL(raw);if err!=nil{writeJSON(w,400,response{Error:err.Error()});return}
 raw=normalized.String()
 output,err:=fetchSubscription(raw);if err!=nil{writeJSON(w,400,response{Error:err.Error()});return}
 actionMu.Lock();defer actionMu.Unlock()
 if err=atomicWrite(filepath.Join(baseDir,"profiles/subscription.url"),[]byte(raw),0600);err!=nil{writeJSON(w,500,response{Error:"cannot save subscription"});return}
 writeJSON(w,200,response{OK:true,Output:output})
}
