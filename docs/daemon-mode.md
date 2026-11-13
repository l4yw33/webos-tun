# Daemon Mode

The daemon exists because repeated `luna://org.webosbrew.hbchannel.service/exec` calls can become unreliable while TUN traffic is active on some older webOS TVs.

Policy:

- start daemon when the app opens;
- do not start daemon on TV boot;
- do not auto-connect VPN after reboot;
- do not expose daemon outside `127.0.0.1`;
- do not use daemon for arbitrary shell execution.

Manual daemon check:

```sh
pidof xraytun-daemon
wget -T 5 -Y off -O - http://127.0.0.1:17999/health
```

Manual start:

```sh
sh /home/root/webos-xray-tun/scripts/start-daemon.sh
```

Manual stop:

```sh
sh /home/root/webos-xray-tun/scripts/stop-daemon.sh
```
