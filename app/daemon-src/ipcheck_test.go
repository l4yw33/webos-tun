package main
import("context";"io";"net/http";"strings";"testing")
type ipTransport struct{replies []string;codes []int;calls int}
func(t *ipTransport)RoundTrip(r *http.Request)(*http.Response,error){i:=t.calls;t.calls++;return &http.Response{StatusCode:t.codes[i],Body:io.NopCloser(strings.NewReader(t.replies[i])),Header:make(http.Header)},nil}
func TestIPFallback(t *testing.T){
 tr:=&ipTransport{replies:[]string{"Cloudflare error","1.1.1.1\n"},codes:[]int{520,200}}
 got,err:=publicIPv4(context.Background(),&http.Client{Transport:tr},[]string{"https://first.example","https://second.example"})
 if err!=nil||got!="1.1.1.1"||tr.calls!=2{t.Fatal("fallback failed",err)}
}
func TestIPInvalidResponses(t *testing.T){
 for _,body:=range []string{"<html>error</html>","127.0.0.1","192.168.1.1","2001:4860:4860::8888",strings.Repeat("x",150)}{
  tr:=&ipTransport{replies:[]string{body},codes:[]int{200}}
  if _,err:=publicIPv4(context.Background(),&http.Client{Transport:tr},[]string{"https://first.example"});err==nil{t.Fatal("invalid IPv4 response accepted")}
 }
}
