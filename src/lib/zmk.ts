import JSZip from 'jszip';
import { ProjectSettings, PhysicalKey } from '@/types/keyboard';
import { actionToZmkString } from './protocols/zmk-action-converter';
import { sortKeys } from './sorting';

/**
 * Generates a full standard ZMK config source code ZIP.
 */
export const generateZmkZip = async (state: { settings: ProjectSettings, keys: PhysicalKey[] }) => {
  const { settings, keys } = state;

  // Filter only keys that have a valid, unique matrix position to prevent compiler errors
  const validKeys = keys.filter((key, idx) => {
    if (key.row === undefined || key.col === undefined) return false;
    if (key.row >= settings.matrix.rows || key.col >= settings.matrix.cols) return false;
    const firstIdx = keys.findIndex(k => k.row === key.row && k.col === key.col);
    return firstIdx === idx;
  });

  const sortedKeys = sortKeys(validKeys, 0.25);

  const zip = new JSZip();
  const kbName = settings.name.replace(/\s+/g, '_').toLowerCase() || 'smidr_keyboard';
  
  // ZMK configs are typically inside a config/ folder
  const configFolder = zip.folder('config');
  if (!configFolder) return null;

  const shieldsFolder = configFolder.folder('boards')?.folder('shields')?.folder(kbName);
  if (!shieldsFolder) return null;

  // 1. Kconfig.shield
  const kconfigShield = `# Copyright (c) 2026 Smidr User
# SPDX-License-Identifier: MIT

config SHIELD_${kbName.toUpperCase()}
    def_bool \$(shields_list_contains,${kbName})
`;
  shieldsFolder.file('Kconfig.shield', kconfigShield);

  // 2. Kconfig.defconfig
  const kconfigDefconfig = `# Copyright (c) 2026 Smidr User
# SPDX-License-Identifier: MIT

if SHIELD_${kbName.toUpperCase()}

config ZMK_KEYBOARD_NAME
    default "${settings.name}"

endif
`;
  shieldsFolder.file('Kconfig.defconfig', kconfigDefconfig);

  // 3. [kbName].conf
  const keyboardConf = `# Copyright (c) 2026 Smidr User
# SPDX-License-Identifier: MIT

# Enable deep sleep support (uncomment to activate)
# CONFIG_ZMK_SLEEP=y

# RGB features
${settings.features.rgb ? `CONFIG_ZMK_RGB_UNDERGLOW=y\nCONFIG_WS2812_STRIP=y\n` : '# CONFIG_ZMK_RGB_UNDERGLOW is not set'}
`;
  shieldsFolder.file(`${kbName}.conf`, keyboardConf);

  // 4. [kbName].overlay
  // We construct the matrix transform map and pins
  let transformMapStr = '';
  for (let i = 0; i < sortedKeys.length; i += 10) {
    transformMapStr += (i > 0 ? '\n            ' : '') + sortedKeys.slice(i, i + 10).map(key => `RC(${key.row},${key.col})`).join(' ');
  }

  const rowPins = settings.pins.rows || [];
  const rowGpiosStr = rowPins.length > 0 
    ? rowPins.map((pin, i) => `&pro_micro ${i} (GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN) /* Row ${i}: ${pin} */`).join('\n            , ')
    : '&pro_micro 0 (GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN) /* Please configure pins */';

  const colPins = settings.pins.cols || [];
  const colGpiosStr = colPins.length > 0 
    ? colPins.map((pin, i) => `&pro_micro ${i} GPIO_ACTIVE_HIGH /* Col ${i}: ${pin} */`).join('\n            , ')
    : '&pro_micro 0 GPIO_ACTIVE_HIGH /* Please configure pins */';

  const keyboardOverlay = `/*
 * Copyright (c) 2026 Smidr User
 * SPDX-License-Identifier: MIT
 */

#include <dt-bindings/zmk/matrix_transform.h>

/ {
    chosen {
        zmk,kscan = &kscan0;
        zmk,matrix-transform = &default_transform;
    };

    default_transform: keymap_transform_0 {
        compatible = "zmk,matrix-transform";
        columns = <${settings.matrix.cols}>;
        rows = <${settings.matrix.rows}>;
        map = <
            ${transformMapStr}
        >;
    };

    kscan0: kscan {
        compatible = "zmk,kscan-gpio-matrix";
        diode-direction = "${settings.hardware.diodeDirection === 'ROW2COL' ? 'row2col' : 'col2row'}";

        row-gpios
            = ${rowGpiosStr}
            ;

        col-gpios
            = ${colGpiosStr}
            ;
    };
};
`;
  shieldsFolder.file(`${kbName}.overlay`, keyboardOverlay);

  // 5. [kbName].keymap
  const layersCount = settings.layers || 4;
  let keymapDts = `/*
 * Copyright (c) 2026 Smidr User
 * SPDX-License-Identifier: MIT
 */

#include <behaviors.dtsi>
#include <dt-bindings/zmk/keys.h>
#include <dt-bindings/zmk/bt.h>
#include <dt-bindings/zmk/outputs.h>
#include <dt-bindings/zmk/rgb.h>
#include <dt-bindings/zmk/mouse.h>

/ {
    keymap {
        compatible = "zmk,keymap";
`;

  for (let l = 0; l < layersCount; l++) {
    const layerBindings = sortedKeys.map(key => {
      const action = key.keymap?.[l] || { action: 'trans' };
      return actionToZmkString(action);
    });

    let layerBindingsStr = '';
    for (let i = 0; i < layerBindings.length; i += 10) {
      layerBindingsStr += (i > 0 ? '\n                ' : '') + layerBindings.slice(i, i + 10).join(' ');
    }

    keymapDts += `
        layer_${l} {
            bindings = <
                ${layerBindingsStr}
            >;
        };
`;
  }

  keymapDts += `    };
};
`;
  configFolder.file(`${kbName}.keymap`, keymapDts);

  // 6. README.md
  const readmeContent = `# ZMK Config for ${settings.name}

This directory structure has been automatically generated by **Smiðr** to compile ZMK firmware for your custom keyboard.

## Directory Structure
- \`config/${kbName}.keymap\`: Contains all keymap layers defined in Smiðr.
- \`config/boards/shields/${kbName}/\`: Contains custom shield definition files (\`.overlay\`, \`.conf\`, \`Kconfig\`, and \`Kconfig.defconfig\`).

## Setup and Compilation
To build ZMK firmware using this configuration:
1. Initialize or open your \`zmk-config\` repository.
2. Copy the \`config/\` directory from this exported folder directly into your \`zmk-config\` repository.
3. Configure your GitHub Actions \`build.yaml\` file to point to your new shield:
   \`\`\`yaml
   include:
     - board: nice_nano_v2
       shield: ${kbName}
   \`\`\`
4. Push the changes to GitHub and download the compiled \`.uf2\` binary from the GitHub Actions tab!

## GPIO Matrix Pin Configuration
The \`${kbName}.overlay\` file has been populated with a standard \`gpio-matrix\` configuration. 
Depending on your microcontroller board (e.g. \`nice!nano\`, \`Xiao\`), you may need to update the pin bindings (e.g., \`&pro_micro 4\`) to match your physical wiring. Please verify the comments indicating which physical Smiðr pin corresponds to each entry.
`;
  configFolder.file('README.md', readmeContent);

  return await zip.generateAsync({ type: 'blob' });
};
