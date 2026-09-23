import { PhysicalKey, ProjectSettings } from '@/types/keyboard';
import { getDirectLocalMatrixPosition, getDirectMatrixSide, getDirectSideDimensions, getFirmwareMatrixPosition, isDirectPinMatrix, resolveDirectPin } from './matrix-utils';
import { getRmkChip, getRmkTrackballs, normalizeRmkPin } from './rmk-hardware';
import { getSplitCommunication } from './split-communication';
import nrfSupport from './rmk-templates/nrf-support.rs.txt?raw';
import nrfInit from './rmk-templates/nrf-init.rs.txt?raw';

const rustString = (value: string) => JSON.stringify(value).replace(/\\u([0-9a-f]{4})/gi, '\\u{$1}');
const modifiers = (value: string) => {
  const names = ['LCtrl', 'LShift', 'LAlt', 'LGui', 'RCtrl', 'RShift', 'RAlt', 'RGui'];
  const bits = value.split('|').reduce((mask, name) => {
    const index = names.indexOf(name.trim());
    if (index < 0) throw new Error(`Unsupported RMK modifier: ${name}`);
    return mask | (1 << index);
  }, 0);
  return `rmk::types::modifier::ModifierCombination::from_bits(${bits})`;
};

/** Convert the same action tokens used by TOML, rejecting unrepresentable raw expressions. */
export const rmkActionToRust = (value: string): string => {
  const token = value.trim();
  if (token === '_') return 'rmk::a!(Transparent)';
  if (token === 'No') return 'rmk::a!(No)';
  if (['Bootloader', 'Reboot', 'CapsWordToggle'].includes(token))
    return `KeyAction::Single(rmk::types::action::Action::KeyboardControl(rmk::types::action::KeyboardAction::${token}))`;
  const layer = token.match(/^(MO|TG|TO|DF|PDF|OSL)\((\d+)\)$/);
  if (layer) {
    const variant = { MO: 'LayerOn', TG: 'LayerToggle', TO: 'LayerToggleOnly', DF: 'DefaultLayer', PDF: 'PersistentDefaultLayer', OSL: 'OneShotLayer' }[layer[1]];
    return `KeyAction::Single(rmk::types::action::Action::${variant}(${layer[2]}))`;
  }
  const lt = token.match(/^LT\((\d+),\s*(\w+)\)$/);
  if (lt) return `rmk::lt!(${lt[1]}, ${lt[2]})`;
  const modified = token.match(/^(MT|WM)\((\w+),\s*([\w |]+)\)$/);
  if (modified) return `rmk::${modified[1].toLowerCase()}!(${modified[2]}, ${modifiers(modified[3])})`;
  const macro = token.match(/^Macro\((\d+)\)$/);
  if (macro) return `KeyAction::Single(rmk::types::action::Action::TriggerMacro(${macro[1]}))`;
  if (/^[A-Za-z][A-Za-z0-9_]*$/.test(token)) return `rmk::k!(${token})`;
  throw new Error(`RMK Rust API export cannot translate this action: ${value}`);
};

export const generateRustKeymap = (
  settings: ProjectSettings, keys: PhysicalKey[], matrix: ProjectSettings['matrix'], action: (key: PhysicalKey, layer: number) => string,
) => {
  const layers = settings.layers || 4;
  const maps = Array.from({ length: layers }, (_, layer) => {
    const rows = Array.from({ length: matrix.rows }, () => Array<string>(matrix.cols).fill('rmk::a!(No)'));
    keys.forEach(key => {
      const pos = getFirmwareMatrixPosition(settings, key, keys)!;
      rows[pos.row][pos.col] = rmkActionToRust(action(key, layer));
    });
    return `        [\n${rows.map(row => `            [${row.join(', ')}],`).join('\n')}\n        ],`;
  });
  return `use rmk::types::action::KeyAction;
pub const ROW: usize = ${matrix.rows};
pub const COL: usize = ${matrix.cols};
pub const NUM_LAYER: usize = ${layers};
pub const fn get_default_keymap() -> [[[KeyAction; COL]; ROW]; NUM_LAYER] {
    [
${maps.join('\n')}
    ]
}
`;
};

export const generateRustMain = (settings: ProjectSettings, keys: PhysicalKey[], allKeys: PhysicalKey[], unlock: number[][], side: 'left' | 'right' = 'left') => {
  const nrf = getRmkChip(settings) === 'nrf52840';
  const split = settings.features.split;
  const peripheral = split && side === 'right';
  const hal = nrf ? 'embassy_nrf' : 'embassy_rp';
  const outputDrive = nrf ? ', OutputDrive::Standard' : '';
  const pin = (value?: string) => {
    const name = normalizeRmkPin(value);
    if (!(nrf ? /^P[01]_\d{2}$/ : /^PIN_\d+$/).test(name)) throw new Error(`Invalid ${nrf ? 'nRF52840' : 'RP2040'} pin: ${value}`);
    return `p.${name}`;
  };
  const sidePins = (side: 'left' | 'right') => ({
    rows: side === 'right' && settings.pins.splitRows?.length ? settings.pins.splitRows : settings.pins.rows,
    cols: side === 'right' && settings.pins.splitCols?.length ? settings.pins.splitCols : settings.pins.cols,
  });
  const dimensions = (side: 'left' | 'right') => isDirectPinMatrix(settings)
    ? getDirectSideDimensions(settings, keys, side)
    : { rows: sidePins(side).rows.length, cols: sidePins(side).cols.length };
  const dim = dimensions(side);
  const right = dimensions('right');
  const remote = `PeripheralMatrixConfig { rows: ${right.rows}, cols: ${right.cols}, row_offset: ${dimensions('left').rows}, col_offset: 0 }`;
  let matrixCode: string;
  if (isDirectPinMatrix(settings)) {
    const rows = Array.from({ length: dim.rows }, () => Array<string>(dim.cols).fill('None'));
    keys.filter(key => !split || getDirectMatrixSide(settings, key, keys) === side).forEach(key => {
      const pos = getDirectLocalMatrixPosition(settings, key, keys)!;
      rows[pos.row][pos.col] = `Some(Input::new(${pin(resolveDirectPin(settings, key, keys))}, Pull::Up))`;
    });
    matrixCode = `let direct_pins: [[Option<Input<'_>>; ${dim.cols}]; ${dim.rows}] = [${rows.map(row => `[${row.join(', ')}]`).join(', ')}];
    let mut matrix = rmk::matrix::direct_pin::DirectPinMatrix::<_, _, ${dim.rows}, ${dim.cols}, ${dim.rows * dim.cols}>::new(direct_pins, DefaultDebouncer::new(), true);`;
  } else {
    const col2row = settings.hardware.diodeDirection !== 'ROW2COL';
    const pins = sidePins(side);
    const inputs = col2row ? pins.rows : pins.cols;
    const outputs = col2row ? pins.cols : pins.rows;
    matrixCode = `let input_pins = [${inputs.map(p => `Input::new(${pin(p)}, Pull::Down)`).join(', ')}];
    let output_pins = [${outputs.map(p => `Output::new(${pin(p)}, Level::Low${outputDrive})`).join(', ')}];
    let mut matrix = rmk::matrix::Matrix::<_, _, _, ${dim.rows}, ${dim.cols}, ${col2row}>::new(input_pins, output_pins, DefaultDebouncer::new());`;
  }
  const tracks = getRmkTrackballs(settings, allKeys);
  const local = tracks.filter(t => !split || t.side === side);
  const pointing = local.map(t => `let mut trackball_${t.index} = rmk::input_device::pointing::PointingDevice::<rmk::input_device::pmw3610::Pmw3610<_, _, _>>::new(
        ${t.index},
        rmk::input_device::pmw3610::BitBangSpiBus::new(Output::new(${pin(t.sclk)}, Level::High${outputDrive}), Flex::new(${pin(t.sdio)})),
        Output::new(${pin(t.cs)}, Level::High${outputDrive}),
        ${t.motion?.trim() ? `Some(Input::new(${pin(t.motion)}, Pull::Up))` : "None::<Input<'static>>"},
        rmk::input_device::pmw3610::Pmw3610Config { res_cpi: ${t.cpi ?? 1200}, invert_x: ${!!t.invertX}, invert_y: ${!!t.invertY}, swap_xy: ${!!t.swapXy}, ..Default::default() },
    );`).join('\n    ');
  const processors = peripheral ? [] : tracks.map(t => `let mut pointing_${t.index} = rmk::input_device::pointing::PointingProcessor::new(&keymap, rmk::input_device::pointing::PointingProcessorConfig { device_id: ${t.index}, ..Default::default() });`);
  const runners = ['matrix', ...(peripheral && !nrf ? [] : ['storage']), ...(!peripheral ? ['keyboard', 'usb_transport'] : []), ...(nrf && !peripheral ? ['ble_transport'] : []), 'watchdog_runner', ...local.map(t => `trackball_${t.index}`), ...(!peripheral ? tracks.map(t => `pointing_${t.index}`) : [])];
  const communication = getSplitCommunication(settings);
  const uart = !nrf && split ? `static RX_BUF: static_cell::StaticCell<[u8; rmk::split::SPLIT_MESSAGE_MAX_SIZE]> = static_cell::StaticCell::new();
    let rx_buf = &mut RX_BUF.init([0; rmk::split::SPLIT_MESSAGE_MAX_SIZE])[..];
    ${communication.duplex === 'full' ? `static TX_BUF: static_cell::StaticCell<[u8; rmk::split::SPLIT_MESSAGE_MAX_SIZE]> = static_cell::StaticCell::new();
    let tx_buf = &mut TX_BUF.init([0; rmk::split::SPLIT_MESSAGE_MAX_SIZE])[..];
    let uart = rmk::split::rp::uart::BufferedUart::new_full_duplex(p.PIO0, ${pin(settings.pins.splitSerial)}, ${pin(settings.pins.splitSerialRx)}, tx_buf, rx_buf, Irqs);` : `let uart = rmk::split::rp::uart::BufferedUart::new_half_duplex(p.PIO0, ${pin(settings.pins.splitSerial)}, rx_buf, Irqs);`}` : '';
  const run = `run_all!(${runners.join(', ')})`;
  const runCode = peripheral
    ? `rmk::futures::future::join(${run}, rmk::split::peripheral::run_rmk_split_peripheral(${nrf ? '0, sdc, ble_addr()' : 'uart'})).await;`
    : !nrf && split ? `rmk::futures::future::join(${run}, rmk::split::central::run_peripheral_manager(0, uart, ${remote})).await;` : `${run}.await;`;
  return `// Generated for RMK 0.9.0. Nordic initialization derives from RMK's MIT-licensed examples.
#![no_std]
#![no_main]
${peripheral ? '' : 'mod keymap;\nmod vial;'}
use defmt_rtt as _;
use panic_probe as _;
use embassy_executor::Spawner;
use ${hal}::gpio::{Input, Output, Flex, Pull, Level${nrf ? ', OutputDrive' : ''}};
use rmk::debounce::default_debouncer::DefaultDebouncer;
use rmk::run_all;
${split ? 'use rmk::split::PeripheralMatrixConfig;' : ''}
${nrf ? `use defmt::unwrap;
use embassy_nrf::{bind_interrupts, rng, usb};
use embassy_nrf::mode::Async;
use embassy_nrf::peripherals::{RNG, USBD};
use nrf_sdc::{self as sdc, mpsl};
use nrf_sdc::mpsl::MultiprotocolServiceLayer;
use static_cell::StaticCell;
bind_interrupts!(struct Irqs {
    USBD => usb::InterruptHandler<USBD>;
    RNG => rng::InterruptHandler<RNG>;
    EGU0_SWI0 => mpsl::LowPrioInterruptHandler;
    CLOCK_POWER => mpsl::ClockInterruptHandler, usb::vbus_detect::InterruptHandler;
    RADIO => mpsl::HighPrioInterruptHandler;
    TIMER0 => mpsl::HighPrioInterruptHandler;
    RTC0 => mpsl::HighPrioInterruptHandler;
});
${nrfSupport}` : `use embassy_rp::{bind_interrupts, dma};
use embassy_rp::peripherals::{USB, DMA_CH0${split ? ', PIO0' : ''}};
bind_interrupts!(struct Irqs {
    USBCTRL_IRQ => embassy_rp::usb::InterruptHandler<USB>;
    DMA_IRQ_0 => dma::InterruptHandler<DMA_CH0>;
    ${split ? 'PIO0_IRQ_0 => rmk::split::rp::uart::UartInterruptHandler<PIO0>;' : ''}
});`}
#[embassy_executor::main]
async fn main(${nrf ? '' : '_'}spawner: Spawner) {
    let p = ${hal}::init(Default::default());
${nrf ? nrfInit : ''}
    ${matrixCode}
    ${uart}
    ${peripheral && !nrf ? '' : `let flash = ${nrf ? 'nrf_mpsl::Flash::take(mpsl, p.NVMC)' : 'embassy_rp::flash::Flash::<_, embassy_rp::flash::Async, { 2 * 1024 * 1024 }>::new(p.FLASH, p.DMA_CH0, Irqs)'};
    let storage_config = rmk::config::StorageConfig { ${nrf ? 'start_addr: 0xE0000, num_sectors: 8,' : ''} ..Default::default() };`}
    ${peripheral ? nrf ? 'let mut storage = rmk::storage::new_storage_without_keymap(flash, storage_config).await;' : '' : `let mut keymap_data = rmk::KeymapData::new(keymap::get_default_keymap());
    let mut behavior = rmk::config::BehaviorConfig::default();
    let positional = rmk::config::PositionalConfig::default();
    let (keymap, mut storage) = rmk::initialize_keymap_and_storage(&mut keymap_data, flash, &storage_config, &mut behavior, &positional).await;
    let mut keyboard = rmk::keyboard::Keyboard::new(&keymap);
    let rmk_config = rmk::config::RmkConfig {
        device_config: rmk::config::DeviceConfig {
            vid: ${settings.vendorProductId >>> 16}, pid: ${settings.vendorProductId & 0xffff},
            manufacturer: ${rustString(settings.manufacturer || 'Smidr User')}, product_name: ${rustString(settings.name || 'Smidr Keyboard')},
            ..Default::default()
        },
        vial_config: rmk::config::VialConfig::new(vial::VIAL_KEYBOARD_ID, vial::VIAL_KEYBOARD_DEF, &[${unlock.map(pos => `(${pos.join(', ')})`).join(', ')}]),
        storage_config,
        ..Default::default()
    };
    let host = rmk::host::HostService::new(&keymap, &rmk_config);
    let driver = ${nrf ? 'embassy_nrf::usb::Driver::new(p.USBD, Irqs, embassy_nrf::usb::vbus_detect::HardwareVbusDetect::new(Irqs))' : 'embassy_rp::usb::Driver::new(p.USB, Irqs)'};
    let mut usb_transport = rmk::usb::UsbTransport::new(driver, rmk_config.device_config).with_host_service(&host);
    ${nrf ? `let mut ble_transport = rmk::ble::BleTransport::new(sdc, ble_addr(), rmk_config${split ? `, [${remote}]` : ''}).with_host_service(&host);` : ''}`}
    ${pointing}
    ${processors.join('\n    ')}
    let mut watchdog_runner = ${nrf ? 'rmk::watchdog::Nrf52Watchdog::default_runner(p.WDT)' : 'rmk::watchdog::Rp2040Watchdog::default_runner(embassy_rp::watchdog::Watchdog::new(p.WATCHDOG))'};
    ${runCode}
}
`;
};
