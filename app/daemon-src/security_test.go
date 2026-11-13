package main
import("net/http";"net/http/httptest";"testing")
func TestSecurityBoundary(t *testing.T) {
 sessionToken="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
 cases:=[]struct{name,path,method,host,origin,token string; code int}{
 {"no token","/status","GET","127.0.0.1:17999","null","",401},
 {"bad token","/status","GET","127.0.0.1:17999","null","wrong",401},
 {"host rebinding","/status","GET","attacker.example","null",sessionToken,403},
 {"web origin","/status","GET","127.0.0.1:17999","https://attacker.example",sessionToken,403},
 {"GET cannot connect","/connect","GET","127.0.0.1:17999","null",sessionToken,405},
 {"authenticated app","/connect","POST","127.0.0.1:17999","null",sessionToken,200},
 {"webOS 3 app origin","/subscription/update","POST","127.0.0.1:17999","file://com.webosbrew.xraytun",sessionToken,200},
 {"other file app denied","/subscription/update","POST","127.0.0.1:17999","file://other.app",sessionToken,403},
 {"health no secret","/health","GET","127.0.0.1:17999","null","",200},
 {"private preflight","/connect","OPTIONS","127.0.0.1:17999","null","",204},
 }
 for _,c:=range cases {t.Run(c.name,func(t *testing.T){r:=httptest.NewRequest(c.method,"http://127.0.0.1:17999"+c.path,nil);r.Host=c.host;r.RemoteAddr="127.0.0.1:10000";r.Header.Set("Origin",c.origin);r.Header.Set("X-XrayTun-Token",c.token);w:=httptest.NewRecorder();secure(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){w.WriteHeader(200)})).ServeHTTP(w,r);if w.Code!=c.code {t.Fatalf("got %d want %d",w.Code,c.code)};if w.Header().Get("Access-Control-Allow-Origin")=="*" {t.Fatal("wildcard CORS")}})}
}
func TestNonLoopbackDenied(t *testing.T){r:=httptest.NewRequest("GET","http://127.0.0.1:17999/health",nil);r.Host="127.0.0.1:17999";r.RemoteAddr="192.168.1.10:1234";w:=httptest.NewRecorder();secure(http.NotFoundHandler()).ServeHTTP(w,r);if w.Code!=403 {t.Fatal(w.Code)}}
func TestLogURIHidden(t *testing.T){if redactLog("hy2://sensitive@host.example?obfs-password=secret")!="[profile hidden]" {t.Fatal("URI leak")}}
