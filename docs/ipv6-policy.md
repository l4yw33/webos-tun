# IPv6 Policy

The current build disables native IPv6 while VPN is connected.

Reason: on tested webOS 3.x hardware, YouTube could prefer native IPv6 even when IPv4 traffic was routed through TUN. That produced leaks and playback failures.

On Connect:

- disable IPv6 sysctls for `all`, `default`, `eth0`, and `wlan0` when available;
- remove IPv6 default route when available;
- flush global IPv6 addresses from `eth0` when available.

On Disconnect/Fix network:

- restore IPv4 default route;
- stop VPN processes;
- remove `tun0`;
- re-enable IPv6 sysctls.

Future releases may add an explicit `allow IPv6` option only after IPv6 tunneling is implemented and tested.
