HTTPS subscriptions

Profiles > HTTPS subscription > Update subscription. Paste the full URL,
for example https://example.com/private-token. This supports a plain or Base64
list of vless://, hysteria2://, hy2:// and trojan:// URLs. Select the desired
entry and Save profile while VPN is disconnected. Loading a subscription does
not save an active profile or connect VPN. Use Connect explicitly afterwards.

One subscription URL is saved in profiles/subscription.url with mode 0600.
The URL field is masked; the saved URL is not stored in browser localStorage.
Updates are manual. Clash YAML and sing-box JSON are not imported.
HTTPS port 443 only, TLS verification enabled, at most 3 redirect hops,
20-second timeout, 1 MiB response limit, at most 1024 distinct profiles.
Every resolved IP and redirect destination is checked; local/private addresses
are denied and connections use the validated address without another lookup.
A real subscription returning two entries was loaded on the TV. Other provider-specific formats have not been verified.

Security changes

The runtime installer no longer modifies boot hooks. Runtime directories use
0700, sensitive files 0600; app directories use 0755 and UI files 0644 on the TV.
The helper listens on loopback and requires its random token, checks Host and
Origin, and requires POST for changes. The exact legacy webOS Origin
file://com.webosbrew.xraytun is allowed; other app origins are rejected.

Remaining limitations

The TV's existing Chromium debugging listener on port 9998 was not disabled:
that belongs to the system WebAppMgr, outside the authorized application-only
changes. It remains a serious risk on an untrusted LAN. Chromium 38 is old.
Root processes can still read credentials. File permissions are not encryption.
The file: CSP compatibility allowance remains. DNS/IPv6 leak resistance and
VPN failure behavior have not been verified. No claim of complete security.

For the latest publication audit, temporary-file hardening and review limits, see docs/SECURITY-REVIEW.md. The review changes have not been installed on the TV automatically.
