# Third-party notices

Smiðr as a whole is licensed under AGPL-3.0-only; see [LICENSE](./LICENSE).
Third-party components retain their own license terms and notices.

## KLE parser adapted from @the-via/reader

- Local file: `src/lib/parser/kle-logic.ts`
- Upstream project: https://github.com/the-via/reader
- Upstream file: `src/kle-parser.ts`
- Upstream package author: Olivia <ofbriggs@gmail.com>
- License: GNU General Public License version 3; see [LICENSES/GPL-3.0.txt](./LICENSES/GPL-3.0.txt).

The local file identifies its parser as ported from `@the-via/reader`.
It was already adapted in Smiðr's initial commit, `01802de` (2026-05-24).
The upstream GPL v3 license is present at commit
[`9cf382d8f9591e858d437689f66abbfca0d0d102`](https://github.com/the-via/reader/tree/9cf382d8f9591e858d437689f66abbfca0d0d102)
(2022-07-11). This reference documents the historical license; the exact
upstream revision used for the port is not recorded in the local file.

The adapted parser remains subject to GPL v3. Its combination with Smiðr's
AGPL v3 code is permitted by section 13 of GPL v3 and section 13 of AGPL v3;
this does not relicense the upstream code as AGPL.
On 2026-10-27, Smiðr added this notice and the upstream license text.

## RMK examples and supporting templates

- Upstream: https://github.com/rmk-rs/rmk/tree/rmk-v0.9.0/examples
- Local templates: `src/lib/rmk-templates/`
- Adaptations: `src/lib/rmk-project.ts` and `src/lib/rmk-rust.ts`
- Copyright (c) 2024 HaoboGu
- License: MIT; see [src/lib/rmk-templates/LICENSE-MIT.txt](./src/lib/rmk-templates/LICENSE-MIT.txt).

The RMK MIT notice is retained. RMK project exports include it as
`LICENSE-RMK-MIT.txt`. License declarations in the upstream Cargo templates
are retained as well.

## Dependencies

JavaScript and Rust dependencies retain their respective licenses. The
AGPL declaration for Smiðr does not replace those licenses or their notice
requirements. Refer to each dependency's distributed license text and
package metadata.
