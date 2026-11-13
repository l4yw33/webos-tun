# Security and publication review

Review date: 2026-11-13. This is a source/build review, not an external penetration test or a security certification.

## Publication and privacy

- Reviewed the repository tree and reachable commit history, commit author/committer identities, the interface PNG, and both previously published CI packages.
- Compared content locally with known private SSH/VPN values and former personal commit identities. The reference values are not stored in this repository or in CI.
- Found a private LAN address copied into an SSRF rejection test fixture. Replaced it with a synthetic private address, regenerated the clean root commit and removed the old Actions runs/artifacts. A private LAN address is not a credential or a unique hardware ID, but it should not have been published.
- No matching private keys, known VPN credentials, subscription URLs, personal author identities, MAC addresses, Windows account SIDs or personal filesystem paths were found in the reviewed current content.
- PNG files had no text/EXIF metadata chunks. The screenshot was visually reviewed for addresses and credentials. Hardware model names in compatibility documentation describe tested product models, not serial numbers or unique device identifiers.
- The repository owner's public GitHub handle and GitHub activity remain public. Author and committer use a project identity with an address under the reserved .invalid domain.
- Deleted or force-replaced content can remain in GitHub caches, downloaded copies or third-party archives. This review cannot guarantee its erasure. The live TV could not be reached for a fresh comparison against its current secrets.

## Hardening in this revision

| Finding | Change |
| --- | --- |
| Root config checks wrote to predictable files in shared /tmp, allowing a local symlink pre-placement attack | Write check logs under the private runtime logs directory |
| Diagnostic output used a predictable directory and exported host/account, disk and IPv6 route details | Use mktemp for a private directory, write the archive inside it and export only kernel/architecture and route counts |
| Go sources/tests were included in generated IPKs | Exclude daemon-src during packaging; source stays available in the repository |
| GitHub Actions were referenced by movable version tags | Pin the four official Actions to verified commit SHAs |
| Future commits could accidentally publish keys or personal commit email | Add a tracked-content/commit-identity check to CI; this is a heuristic guard, not a universal secret detector |

The on-device application was not changed during this review. These fixes apply when a newly built package is installed. The private-directory diagnostic test runs with synthetic network/hostname commands; Linux CI also checks directory mode 0700.

## Existing controls reviewed

- Helper bound to 127.0.0.1, with loopback peer and exact Host checks, restricted Origin handling, per-process random token and POST-only state changes.
- Exact legacy webOS file origin allowed; opaque origins still need a token. No wildcard CORS.
- TLS certificate validation, destination IP checks before dialing, no second DNS lookup for the connection, redirect checks, download/body/header/time limits for subscriptions.
- Atomic individual file replacement, private runtime directories, token/credential file permissions, profile-save guard while VPN is active.
- UI uses textContent for profile labels and logs. Local file: script/style CSP sources remain necessary for the legacy browser. The only innerHTML assignment empties a select element; imported content is not inserted as HTML.
- No unauthenticated helper-control path was found in this review. This does not exclude vulnerabilities outside the reviewed paths.

## Verification

- JS parser/UI tests and Go middleware, subscription and IPv4 fallback tests passed locally.
- Shell syntax checks and the synthetic diagnostic privacy test passed. POSIX directory permissions are checked on Linux CI rather than inferred from Windows file modes.
- Official govulncheck v1.9.0 reported no known vulnerabilities in the ARMv7 helper built with the configured toolchain. This covers the helper's build, not separately installed Xray/sing-box cores or the TV OS.
- The helper uses Go's standard library without third-party runtime Go modules. Packaging still downloads npm tooling and transitive dependencies; pinning Actions is not a full reproducible-build or supply-chain guarantee.

## Remaining boundaries

- Root processes and the Homebrew root exec service are outside the helper's isolation boundary. They can read credentials or replace programs.
- The TV system Chromium debugging listener is not disabled by this app. Keep it off untrusted networks; an exposed debugger can control app pages.
- This is not a kill switch. DNS/IPv6 leak behavior, reconnect failures, changes made by the OS network manager and power-loss recovery are not fully verified.
- The local UI's status/actions and raw core logs can contain real IP addresses or server details. Review them before sharing. Only the reduced diagnostic archive is designed to omit those fields.
- Authenticated requests can still consume CPU/memory and initiate network checks. This is not a multi-user service or a hardened boundary against a malicious authenticated/root caller.
- A future version may add dependencies or change core behavior; rerun checks for that exact version.
