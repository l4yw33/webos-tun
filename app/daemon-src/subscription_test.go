package main
import("context";"encoding/base64";"net";"testing")
func TestSubscriptionFormats(t *testing.T){
 raw:="hy2://secret@vpn.example:443?sni=vpn.example#One\nvless://11111111-2222-4333-8444-555555555555@vpn.example:443?security=tls#Two"
 for _,body:=range []string{raw,base64.StdEncoding.EncodeToString([]byte(raw)),base64.RawURLEncoding.EncodeToString([]byte(raw))}{got,err:=decodeSubscription([]byte(body));if err!=nil||got!=raw{t.Fatal("subscription decode failed",err)}}
 for _,body:=range []string{"<html>error</html>",`{"outbounds":[]}`,"proxies:\n - type: vless"}{if _,err:=decodeSubscription([]byte(body));err==nil{t.Fatal("invalid format accepted")}}
}
func TestSubscriptionBoundary(t *testing.T){
 u,err:=subscriptionURL("https://vpn.example/sub?token=test#My%20Subscription");if err!=nil||u.String()!="https://vpn.example/sub?token=test"{t.Fatal("fragment label not safely removed")}
 for _,raw:=range []string{"http://vpn.example/s","https://user:pass@vpn.example/s","https://vpn.example:8080/s","file:///etc/passwd"}{if _,err:=subscriptionURL(raw);err==nil{t.Fatal("unsafe URL accepted",raw)}}
 for _,raw:=range []string{"127.0.0.1","10.0.0.1","192.168.50.10","169.254.169.254","100.100.100.200","::1","::ffff:127.0.0.1","fc00::1","64:ff9b::a00:1","2002:7f00:1::"}{if publicSubscriptionIP(net.ParseIP(raw)){t.Fatal("non-public IP accepted",raw)}}
 if !publicSubscriptionIP(net.ParseIP("1.1.1.1")){t.Fatal("public IP denied")}
 if _,err:=subscriptionDial(context.Background(),"tcp","127.0.0.1:443");err==nil{t.Fatal("loopback dial permitted")}
}
