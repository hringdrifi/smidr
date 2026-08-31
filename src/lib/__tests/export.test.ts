import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { generateKleJson, generateSmidrProjectJson, generateViaJson } from '../export';
import { generateQmkZip } from '../qmk';
import { generateRmkZip } from '../rmk';
import { generateVialZip } from '../vial';
import { generateZmkZip } from '../zmk';
import { DEFAULT_KICAD_EXPORT_OPTIONS, generateKiCadZip, getKiCadExportWarnings, getKiCadLedPreviewInfo } from '../kicad';
import { validateFirmwareExport } from '../export-validation';
import { PhysicalKey, ProjectSettings } from '@/types/keyboard';

const baseSettings: ProjectSettings = {
  name: 'Test Keyboard',
  manufacturer: 'Test',
  description: '',
  vendorProductId: 0xFEED0001,
  matrix: { rows: 0, cols: 0 },
  pins: { rows: [], cols: [], splitRows: [], splitCols: [] },
  hardware: {
    controllerType: 'development_board',
    mcu: 'rp2040',
    board: 'promicro',
    diodeDirection: 'ROW2COL',
  },
  features: {
    rgb: false,
    encoder: false,
    oled: false,
    via: true,
    split: false,
  },
  layers: 2,
  tapDances: [],
  layoutOptions: {},
  activeOptions: {},
};

describe('KiCad export defaults', () => {
  it('uses the standard diode placement', () => {
    expect(DEFAULT_KICAD_EXPORT_OPTIONS).toMatchObject({
      diodeOffsetX: 6.746875,
      diodeOffsetY: 3.96875,
      diodeRotation: -90,
    });
  });

  it('provides switch-specific LED preview templates and offsets', () => {
    const mx = getKiCadLedPreviewInfo('Smidr:SW_Smidr_MX_Solder');
    expect(mx.offset).toEqual({ x: 0, y: 5.08 });
    expect(mx.backlightBack).toBe(false);
    expect(mx.backlightTemplate).toContain('(footprint "LED_Smidr_Backlight"');

    const choc = getKiCadLedPreviewInfo('Smidr:SW_Smidr_Choc_Solder');
    expect(choc.offset).toEqual({ x: 0, y: -4.7 });
    expect(choc.backlightBack).toBe(true);
    expect(choc.backlightTemplate).toContain('(footprint "LED_Smidr_Backlight_1206_Reverse"');

    const gateronLp = getKiCadLedPreviewInfo('Smidr:SW_Smidr_Gateron_LP_Solder');
    expect(gateronLp.offset).toEqual({ x: 0, y: -5.175 });
    expect(gateronLp.rgbTemplate).toContain('(footprint "LED_Smidr_SK6812MINI_E"');
  });
});

describe('export generation', () => {
  it('exports KiCad schematic and PCB data with selected footprints and matrix nets', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'KiCad Board',
      matrix: { rows: 1, cols: 2 },
      hardware: {
        ...baseSettings.hardware,
        diodeDirection: 'COL2ROW',
      },
    };
    const keys: PhysicalKey[] = [
      { row: 0, col: 0, x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'A' },
      { row: 0, col: 1, x: 1, y: 0, w: 1, h: 1, r: 0, rx: 1, ry: 0, label: 'B' },
    ];

    const blob = await generateKiCadZip(
      { settings, keys },
      {
        switchFootprint: 'Smidr:SW_Smidr_MX_Hotswap',
        diodeFootprint: 'Smidr:D_Smidr_SOD323',
        diodeOffsetX: 5.08,
        diodeOffsetY: 4,
        diodeRotation: 90,
      }
    );
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const schematic = await zip.file('kicad_board.kicad_sch')!.async('string');
    const pcb = await zip.file('kicad_board.kicad_pcb')!.async('string');
    const platePcb = await zip.file('kicad_board_plate.kicad_pcb')!.async('string');
    const symbolLibrary = await zip.file('smidr.kicad_sym')!.async('string');
    const symLibTable = await zip.file('sym-lib-table')!.async('string');
    const fpLibTable = await zip.file('fp-lib-table')!.async('string');
    const readme = await zip.file('README.md')!.async('string');

    expect(zip.file('kicad_board.kicad_pro')).toBeTruthy();
    expect(symLibTable).toContain('(name "Smidr")');
    expect(symLibTable).toContain('${KIPRJMOD}/smidr.kicad_sym');
    expect(symLibTable).not.toContain('power.kicad_sym');
    expect(fpLibTable).toContain('(name "Smidr")');
    expect(fpLibTable).toContain('${KIPRJMOD}/smidr.pretty');
    expect(zip.file('smidr.kicad_sym')).toBeTruthy();
    expect(zip.file('kicad_board.kicad_sym')).toBeNull();
    expect(zip.file('smidr.pretty/SW_Smidr_MX_Solder.kicad_mod')).toBeTruthy();
    expect(zip.file('smidr.pretty/SW_Smidr_MX_Hotswap.kicad_mod')).toBeTruthy();
    expect(zip.file('smidr.pretty/SW_Smidr_Choc_Solder.kicad_mod')).toBeTruthy();
    expect(zip.file('smidr.pretty/SW_Smidr_Choc_Hotswap.kicad_mod')).toBeTruthy();
    expect(zip.file('smidr.pretty/SW_Smidr_Gateron_LP_Solder.kicad_mod')).toBeTruthy();
    expect(zip.file('smidr.pretty/SW_Smidr_Gateron_LP_Hotswap.kicad_mod')).toBeTruthy();
    expect(zip.file('smidr.pretty/D_Smidr_SOD123.kicad_mod')).toBeTruthy();
    expect(zip.file('smidr.pretty/D_Smidr_SOD323.kicad_mod')).toBeTruthy();
    expect(zip.file('smidr.pretty/D_Smidr_DO35.kicad_mod')).toBeTruthy();
    expect(zip.file('smidr.pretty/LED_Smidr_Backlight.kicad_mod')).toBeTruthy();
    expect(zip.file('smidr.pretty/LED_Smidr_Backlight_1206_Reverse.kicad_mod')).toBeTruthy();
    expect(zip.file('smidr.pretty/LED_Smidr_SK6812MINI_E.kicad_mod')).toBeTruthy();
    expect(zip.file('smidr.pretty/Plate_Smidr_Key_Hole.kicad_mod')).toBeTruthy();
    expect(zip.file('NOTICE.md')).toBeNull();
    expect(zip.file('LICENSE-marbastlib.txt')).toBeNull();
    expect(schematic).toContain('Generated by Smiðr KiCad export');
    expect(schematic).not.toContain('KiCad MVP export');
    expect(schematic).toContain('Switch footprint: Smidr:SW_Smidr_MX_Hotswap');
    expect(schematic).toContain('(symbol "Switch:SW_Push"');
    expect(schematic).toContain('(lib_id "Switch:SW_Push")');
    expect(schematic).toContain('(property "Footprint" "Smidr:SW_Smidr_MX_Hotswap"');
    expect(schematic).toContain('(symbol "Device:D"');
    expect(schematic).toContain('(lib_id "Device:D")');
    expect(schematic).toContain('(symbol_instances');
    const sw1Path = schematic.match(/\(path "(\/[^"]+)"\s+\(reference "SW1"\)[\s\S]*?\(footprint "Smidr:SW_Smidr_MX_Hotswap"\)/)?.[1];
    const d1Path = schematic.match(/\(path "(\/[^"]+)"\s+\(reference "D1"\)[\s\S]*?\(footprint "Smidr:D_Smidr_SOD323"\)/)?.[1];
    expect(sw1Path).toBeTruthy();
    expect(d1Path).toBeTruthy();
    expect(symbolLibrary).toContain('(symbol "SK6812MINI_E"');
    expect(symbolLibrary).not.toContain('(symbol "D"');
    expect(symbolLibrary).not.toContain('(symbol "SW_Push"');
    expect(schematic).toContain('(label "ROW0"');
    expect(schematic).toContain('(label "COL1"');
    expect(schematic).toContain('(label "ROW0" (at 17.780 25.400 0)');
    expect(schematic).toContain('(label "COL0" (at 43.180 25.400 0)');
    expect(schematic).not.toContain('(label "KEY_R');
    expect(pcb).toContain('(footprint "Smidr:SW_Smidr_MX_Hotswap"');
    expect(pcb).toContain(`(path "${sw1Path}")`);
    expect(pcb).toContain('center-origin template');
    expect(pcb).toContain('(property "Reference" "SW1"');
    expect(pcb).toContain('(property "Value" "R0C0"');
    expect(pcb).not.toContain('(angle ');
    expect(pcb).toContain('(footprint "Smidr:D_Smidr_SOD323"');
    expect(pcb).toContain(`(path "${d1Path}")`);
    expect(pcb).toMatch(/\(footprint "Smidr:D_Smidr_SOD323"[\s\S]*?\(layer "B\.Cu"\)/);
    expect(pcb).toMatch(/\(footprint "Smidr:D_Smidr_SOD323"[\s\S]*?\(at 14\.605 13\.525 90\.000\)/);
    expect(pcb).toContain('(pad "1" smd roundrect');
    expect(pcb).toContain('(layers "B.Cu" "B.Mask" "B.Paste")');
    expect(pcb).toContain('(net 1 "COL0"');
    expect(pcb).toContain('"KEY_R0_C1"');
    expect(pcb).toContain('(layer "Edge.Cuts")');
    expect(platePcb).toContain('(footprint "Smidr:Plate_Smidr_Key_Hole"');
    expect(platePcb).toContain('(property "Reference" "PH1"');
    expect(platePcb).toContain('(property "Value" "A"');
    expect(platePcb).toContain('(layer "Edge.Cuts")');
    expect(platePcb).not.toContain('(net ');
    expect(platePcb).not.toContain('(footprint "Smidr:SW_');
    expect(platePcb).not.toContain('(footprint "Smidr:D_');
    expect(platePcb).not.toContain('(footprint "Smidr:LED_');
    expect(readme).toContain('Footprint library: smidr.pretty');
    expect(readme).toContain('This KiCad export places');
    expect(readme).not.toContain('MVP export');
    expect(readme).toContain('Plate PCB: kicad_board_plate.kicad_pcb');
    expect(readme).toContain('Switch outlines: keycap, fab, and courtyard geometry are generated from each key');
    expect(readme).not.toContain('marbastlib');
    expect(readme).not.toContain('key-switches.pretty');
  });

  it('exports KiCad Gateron LP hotswap/solder, switch pad coordinates, and LED offset', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Gateron LP KiCad',
      matrix: { rows: 1, cols: 2 },
      features: { ...baseSettings.features, rgbMatrix: true },
    };
    const keys: PhysicalKey[] = [
      { row: 0, col: 0, x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'A', ledIndex: 0 },
      { row: 0, col: 1, x: 1, y: 0, w: 1, h: 1, r: 0, rx: 1, ry: 0, label: 'B', ledIndex: 1 },
    ];

    const blobHotswap = await generateKiCadZip(
      { settings, keys },
      {
        switchFootprint: 'Smidr:SW_Smidr_Gateron_LP_Hotswap',
        diodeFootprint: 'Smidr:D_Smidr_SOD323',
        diodeOffsetX: 5.08,
        diodeOffsetY: 4,
        diodeRotation: 90,
      }
    );
    const zipHotswap = await JSZip.loadAsync(await blobHotswap.arrayBuffer());
    const pcbHotswap = await zipHotswap.file('gateron_lp_kicad.kicad_pcb')!.async('string');
    const hotswapTemplate = await zipHotswap.file('smidr.pretty/SW_Smidr_Gateron_LP_Hotswap.kicad_mod')!.async('string');

    expect(pcbHotswap).toContain('(footprint "Smidr:SW_Smidr_Gateron_LP_Hotswap"');
    expect(pcbHotswap).toMatch(/\(pad "" np_thru_hole circle[\s\S]*?\(at 0\.000 0\.000 270\.000\)[\s\S]*?\(size 5\.25 5\.25\)[\s\S]*?\(drill 5\.25\)/);
    expect(pcbHotswap).toMatch(/\(pad "1" smd rect[\s\S]*?\(at 6\.350 -4\.700 180\.000\)[\s\S]*?\(size 1\.5 2\.55\)/);
    expect(pcbHotswap).toMatch(/\(pad "1" smd roundrect[\s\S]*?\(at 8\.075 -4\.700 180\.000\)[\s\S]*?\(size 2\.5 2\.55\)/);
    expect(pcbHotswap).toMatch(/\(pad "2" smd rect[\s\S]*?\(at -4\.550 -5\.750 180\.000\)[\s\S]*?\(size 1\.5 2\.55\)/);
    expect(pcbHotswap).toMatch(/\(pad "2" smd roundrect[\s\S]*?\(at -6\.275 -5\.750 180\.000\)[\s\S]*?\(size 2\.5 2\.55\)/);
    expect(pcbHotswap).toContain('(at 9.525 4.350 180.000)');
    expect(hotswapTemplate).toContain('(footprint "SW_Smidr_Gateron_LP_Hotswap"');
    expect(hotswapTemplate).toContain('(attr smd)');

    const blobSolder = await generateKiCadZip(
      { settings, keys },
      {
        switchFootprint: 'Smidr:SW_Smidr_Gateron_LP_Solder',
        diodeFootprint: 'Smidr:D_Smidr_SOD323',
        diodeOffsetX: 5.08,
        diodeOffsetY: 4,
        diodeRotation: 90,
      }
    );
    const zipSolder = await JSZip.loadAsync(await blobSolder.arrayBuffer());
    const pcbSolder = await zipSolder.file('gateron_lp_kicad.kicad_pcb')!.async('string');
    const solderTemplate = await zipSolder.file('smidr.pretty/SW_Smidr_Gateron_LP_Solder.kicad_mod')!.async('string');

    expect(pcbSolder).toContain('(footprint "Smidr:SW_Smidr_Gateron_LP_Solder"');
    expect(pcbSolder).toMatch(/\(pad "1" thru_hole circle[\s\S]*?\(at -4\.400 4\.700 0\.000\)[\s\S]*?\(size 2\.5 2\.5\)[\s\S]*?\(drill 1\.5\)/);
    expect(pcbSolder).toMatch(/\(pad "2" thru_hole circle[\s\S]*?\(at 2\.600 5\.750 0\.000\)[\s\S]*?\(size 2\.5 2\.5\)[\s\S]*?\(drill 1\.5\)/);
    expect(solderTemplate).toContain('(footprint "SW_Smidr_Gateron_LP_Solder"');
    expect(solderTemplate).toContain('(attr through_hole)');
  });

  it('sanitizes multiline KiCad footprint values in plate PCB output', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Plate Labels KiCad',
      matrix: { rows: 1, cols: 1 },
    };
    const keys: PhysicalKey[] = [
      { row: 0, col: 0, x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'Tab\n\n\n0,0' },
    ];

    const blob = await generateKiCadZip({ settings, keys });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const platePcb = await zip.file('plate_labels_kicad_plate.kicad_pcb')!.async('string');

    expect(platePcb).toContain('(property "Value" "Tab 0,0"');
    expect(platePcb).not.toContain('(property "Value" "Tab\n');
  });

  it('generates KiCad switch outlines from each key width and height', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Width KiCad',
      matrix: { rows: 1, cols: 3 },
    };
    const keys: PhysicalKey[] = [
      { row: 0, col: 0, x: 0, y: 0, w: 1.25, h: 1, r: 0, rx: 0, ry: 0, label: 'A' },
      { row: 0, col: 1, x: 1.25, y: 0, w: 1.3, h: 1, r: 0, rx: 1.25, ry: 0, label: 'B' },
      { row: 0, col: 2, x: 2.55, y: 0, w: 2, h: 1.25, r: 0, rx: 2.55, ry: 0, label: 'C' },
    ];

    const blob = await generateKiCadZip({ settings, keys });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const pcb = await zip.file('width_kicad.kicad_pcb')!.async('string');
    const platePcb = await zip.file('width_kicad_plate.kicad_pcb')!.async('string');

    expect(pcb).toContain('(footprint "Smidr:SW_Smidr_MX_Solder"');
    expect(pcb).toMatch(/\(fp_rect[\s\S]*?\(start -11\.906 -9\.525\)[\s\S]*?\(end 11\.906 9\.525\)/);
    expect(pcb).not.toContain('(fp_rect (start -19.300 -12.156) (end 19.300 12.156)');
    expect(pcb).toMatch(/\(fp_rect[\s\S]*?\(start -19\.050 -11\.906\)[\s\S]*?\(end 19\.050 11\.906\)/);
    expect(platePcb).toContain('(footprint "Smidr:Plate_Smidr_Key_Hole"');
    expect(platePcb).toMatch(/\(fp_rect[\s\S]*?\(start -11\.906 -9\.525\)[\s\S]*?\(end 11\.906 9\.525\)/);
    expect(platePcb).toMatch(/\(fp_rect[\s\S]*?\(start -19\.050 -11\.906\)[\s\S]*?\(end 19\.050 11\.906\)/);
  });

  it('exports KiCad direct-pin switches between GPIO nets and GND', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Direct KiCad',
      matrix: { rows: 1, cols: 2, wiring: 'direct' },
    };
    const keys: PhysicalKey[] = [
      { x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, directPin: 'GP2', label: 'A' },
      { x: 1, y: 0, w: 1, h: 1, r: 0, rx: 1, ry: 0, directPin: 'GP3', label: 'B' },
      { x: 2, y: 0, w: 1, h: 1, r: 0, rx: 2, ry: 0, label: 'C' },
    ];

    const blob = await generateKiCadZip({ settings, keys });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const schematic = await zip.file('direct_kicad.kicad_sch')!.async('string');
    const pcb = await zip.file('direct_kicad.kicad_pcb')!.async('string');

    expect(schematic).toContain('(property "Value" "GP2"');
    expect(schematic).toContain('(value "GP2")');
    expect(schematic).toContain('(property "Value" "UNASSIGNED_3"');
    expect(schematic).toContain('(label "PIN_GP2"');
    expect(schematic).not.toContain('(label "PIN_UNASSIGNED_3"');
    expect(schematic).not.toContain('(label "GND"');
    expect(schematic).toContain('(symbol "power:GND" (power)');
    expect(schematic).toContain('Power symbol creates a global label with name \\"GND\\" , ground');
    expect(schematic).toContain('(lib_id "power:GND")');
    expect(schematic).toContain('(pin "1" (uuid');
    expect(schematic).toContain('(wire');
    expect(schematic).toContain('(pts (xy 17.780 25.400) (xy 20.320 25.400))');
    expect(schematic).toContain('(pts (xy 30.480 25.400) (xy 33.020 25.400))');
    expect(schematic).toContain('(pts (xy 53.340 25.400) (xy 55.880 25.400))');
    expect(schematic).not.toContain('(lib_id "Device:D")');
    expect(schematic).not.toContain('(reference "D1")');
    expect(schematic).not.toContain('(value "D1")');
    expect(pcb).toContain('"PIN_GP2"');
    expect(pcb).toContain('"GND"');
    expect(pcb).not.toContain('(footprint "Diode_');
  });

  it('exports KiCad PCB footprints with inverted rotation to match KiCad coordinates', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Rotated KiCad',
      matrix: { rows: 1, cols: 1 },
    };
    const keys: PhysicalKey[] = [
      { row: 0, col: 0, x: 0, y: 0, w: 1, h: 1, r: 15, rx: 0, ry: 0, label: 'A' },
    ];

    const blob = await generateKiCadZip({ settings, keys });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const pcb = await zip.file('rotated_kicad.kicad_pcb')!.async('string');

    expect(pcb).toContain('(at 6.735 11.666 -15.000)');
    expect(pcb).toMatch(/\(footprint "Smidr:SW_Smidr_MX_Solder"[\s\S]*?\(layer "F\.Cu"\)\s+\(uuid "[^"]+"\)\s+\(at 6\.735 11\.666 -15\.000\)/);
    expect(pcb).toContain('(footprint "Smidr:SW_Smidr_MX_Solder"');
    expect(pcb).toContain('(pad "1" thru_hole circle');
    expect(pcb).toContain('(at -3.810 -2.540 345.000)');
    expect(pcb).toContain('np_thru_hole');
  });

  it('exports KiCad Choc hotswap, DO-35 diode, and template footprints', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Template KiCad',
      matrix: { rows: 1, cols: 1 },
    };
    const keys: PhysicalKey[] = [
      { row: 0, col: 0, x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'A' },
    ];

    const blob = await generateKiCadZip(
      { settings, keys },
      {
        switchFootprint: 'Smidr:SW_Smidr_Choc_Hotswap',
        diodeFootprint: 'Smidr:D_Smidr_DO35',
        diodeOffsetX: 5.08,
        diodeOffsetY: 4,
        diodeRotation: 90,
      }
    );
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const schematic = await zip.file('template_kicad.kicad_sch')!.async('string');
    const pcb = await zip.file('template_kicad.kicad_pcb')!.async('string');
    const chocTemplate = await zip.file('smidr.pretty/SW_Smidr_Choc_Hotswap.kicad_mod')!.async('string');
    const do35Template = await zip.file('smidr.pretty/D_Smidr_DO35.kicad_mod')!.async('string');

    expect(schematic).toContain('(property "Footprint" "Smidr:SW_Smidr_Choc_Hotswap"');
    expect(schematic).toContain('(property "Footprint" "Smidr:D_Smidr_DO35"');
    expect(pcb).toContain('(footprint "Smidr:SW_Smidr_Choc_Hotswap"');
    expect(pcb).toMatch(/\(footprint "Smidr:SW_Smidr_Choc_Hotswap"[\s\S]*?\(layer "B\.Cu"\)/);
    expect(pcb).toContain('(pad "1" smd roundrect');
    expect(pcb).toContain('(layers "B.Cu" "B.Mask" "B.Paste")');
    expect(pcb).toContain('(layers "*.Cu" "F.Mask")');
    expect(pcb).toContain('(footprint "Smidr:D_Smidr_DO35"');
    expect(pcb).toMatch(/\(footprint "Smidr:D_Smidr_DO35"[\s\S]*?\(layer "F\.Cu"\)/);
    expect(pcb).toContain('DO-35 horizontal diode');
    expect(pcb).toMatch(/\(pad "1" thru_hole [\s\S]*?\(at -3\.810 0\.000 270\.000\)/);
    expect(pcb).toMatch(/\(pad "2" thru_hole circle[\s\S]*?\(at 3\.810 0\.000 270\.000\)/);
    expect(chocTemplate).toContain('(footprint "SW_Smidr_Choc_Hotswap"');
    expect(chocTemplate).toMatch(/\(footprint "SW_Smidr_Choc_Hotswap"[\s\S]*?\(layer "F\.Cu"\)/);
    expect(chocTemplate).toContain('(layers "F.Cu"');
    expect(do35Template).toContain('(footprint "D_Smidr_DO35"');
    expect(do35Template).toContain('DO-35 horizontal diode');
    expect(do35Template).toMatch(/\(pad "1" thru_hole [\s\S]*?\(at -3\.81 0\)/);
  });

  it('exports KiCad diodes with custom position and rotation options', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Diode Placement KiCad',
      matrix: { rows: 1, cols: 1 },
    };
    const keys: PhysicalKey[] = [
      { row: 0, col: 0, x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'A' },
    ];

    const blob = await generateKiCadZip(
      { settings, keys },
      {
        switchFootprint: 'Smidr:SW_Smidr_MX_Solder',
        diodeFootprint: 'Smidr:D_Smidr_DO35',
        diodeOffsetX: 2,
        diodeOffsetY: 3,
        diodeRotation: 45,
      }
    );
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const pcb = await zip.file('diode_placement_kicad.kicad_pcb')!.async('string');

    expect(pcb).toMatch(/\(footprint "Smidr:D_Smidr_DO35"[\s\S]*?\(at 11\.525 12\.525 -45\.000\)/);
  });

  it('exports KiCad RGB Matrix LEDs as SK6812MINI-E footprints', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'RGB KiCad',
      matrix: { rows: 1, cols: 2 },
      features: { ...baseSettings.features, rgbMatrix: true },
    };
    const keys: PhysicalKey[] = [
      { row: 0, col: 0, x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'A', ledIndex: 0 },
      { row: 0, col: 1, x: 1, y: 0, w: 1, h: 1, r: 0, rx: 1, ry: 0, label: 'B', ledIndex: 1 },
    ];

    const blob = await generateKiCadZip({ settings, keys });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const schematic = await zip.file('rgb_kicad.kicad_sch')!.async('string');
    const pcb = await zip.file('rgb_kicad.kicad_pcb')!.async('string');
    const readme = await zip.file('README.md')!.async('string');
    const ledTemplate = await zip.file('smidr.pretty/LED_Smidr_SK6812MINI_E.kicad_mod')!.async('string');

    expect(schematic).toContain('(lib_id "Smidr:SK6812MINI_E")');
    expect(schematic).toContain('(symbol "SK6812MINI_E_0_1"');
    expect(schematic).not.toContain('SK6812MINI-E_0_1');
    expect(schematic).toContain('(property "Footprint" "Smidr:LED_Smidr_SK6812MINI_E"');
    expect(schematic).toMatch(/\(property "Reference" "LED1"\s+\(at 25\.400 69\.850 0\)/);
    expect(schematic).toMatch(/\(property "Value" "RGB1"[\s\S]*?\(effects \(font \(size 1\.27 1\.27\)\) hide\)/);
    expect(schematic).toContain('(pts (xy 16.510 73.660) (xy 12.700 73.660))');
    expect(schematic).toContain('(label "VCC" (at 12.700 73.660 0)');
    expect(schematic).toContain('(pts (xy 16.510 78.740) (xy 12.700 78.740))');
    expect(schematic).toContain('(label "RGB_DOUT_0" (at 12.700 78.740 0)');
    expect(schematic).toContain('(pts (xy 34.290 73.660) (xy 38.100 73.660))');
    expect(schematic).toContain('(label "RGB_DIN" (at 38.100 73.660 0)');
    expect(schematic).toContain('(pts (xy 34.290 78.740) (xy 38.100 78.740))');
    expect(schematic).toMatch(/\(symbol\s+\(lib_id "power:GND"\)\s+\(at 38\.100 78\.740 0\)/);
    const led0Path = schematic.match(/\(path "(\/[^"]+)"\s+\(reference "LED1"\)[\s\S]*?\(footprint "Smidr:LED_Smidr_SK6812MINI_E"\)/)?.[1];
    expect(led0Path).toBeTruthy();
    expect(pcb).toContain('(footprint "Smidr:LED_Smidr_SK6812MINI_E"');
    expect(pcb).toContain(`(path "${led0Path}")`);
    expect(pcb).toMatch(/\(footprint "Smidr:LED_Smidr_SK6812MINI_E"[\s\S]*?\(layer "B\.Cu"\)/);
    const led0Footprint = pcb.match(/\(footprint "Smidr:LED_Smidr_SK6812MINI_E"[\s\S]*?\(path "[^"]+"\)[\s\S]*?(?=\n  \(footprint|\n  \(gr_|\n\))/)?.[0] ?? '';
    expect(led0Footprint).toMatch(/\(pad "1"[\s\S]*?\(net \d+ "VCC"\)/);
    expect(led0Footprint).toMatch(/\(pad "2"[\s\S]*?\(net \d+ "RGB_DOUT_0"\)/);
    expect(led0Footprint).toMatch(/\(pad "3"[\s\S]*?\(net \d+ "GND"\)/);
    expect(led0Footprint).toMatch(/\(pad "4"[\s\S]*?\(net \d+ "RGB_DIN"\)/);
    expect(pcb).toContain('(pad "1" smd roundrect');
    expect(pcb).toContain('(layers "B.Cu" "B.Mask" "B.Paste")');
    expect(pcb).toContain('"RGB_DIN"');
    expect(pcb).toContain('"RGB_DOUT_0"');
    expect(pcb).toContain('"RGB_DOUT_1"');
    expect(pcb).toContain('(at 9.525 14.605 180.000)');
    expect(pcb).toContain('(at 28.575 14.605 180.000)');
    expect(pcb).toContain('(justify mirror)');
    expect(pcb).not.toMatch(/\(thickness [^)]+\)\s*\(justify mirror\)\s*\)/);
    expect(pcb).toMatch(/\(effects[\s\S]*?\(font[\s\S]*?\)\s*\(justify mirror\)\s*\)/);
    expect(readme).toContain('2 SK6812MINI-E LED footprints are placed with switch-specific LED offsets');
    expect(ledTemplate).toContain('(footprint "LED_Smidr_SK6812MINI_E"');
    expect(ledTemplate).toMatch(/\(footprint "LED_Smidr_SK6812MINI_E"[\s\S]*?\(layer "F\.Cu"\)/);
    expect(ledTemplate).toContain('(layers "F.Cu"');
  });

  it('warns before KiCad export when RGB Matrix has no LED assignments', () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      features: { ...baseSettings.features, rgbMatrix: true },
    };
    const keys: PhysicalKey[] = [
      { row: 0, col: 0, x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'A' },
      { row: 0, col: 1, x: 1, y: 0, w: 1, h: 1, r: 0, rx: 1, ry: 0, label: 'B' },
    ];

    expect(getKiCadExportWarnings({ settings, keys })).toEqual(['rgbMatrixNoLedAssignments']);
  });

  it('does not warn before KiCad export when RGB Matrix has LED assignments', () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      features: { ...baseSettings.features, rgbMatrix: true },
    };
    const keys: PhysicalKey[] = [
      { row: 0, col: 0, x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'A', ledIndex: 0 },
    ];

    expect(getKiCadExportWarnings({ settings, keys })).toEqual([]);
  });

  it('places KiCad RGB Matrix LEDs with Choc switch offsets', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Choc RGB KiCad',
      matrix: { rows: 1, cols: 1 },
      features: { ...baseSettings.features, rgbMatrix: true },
    };
    const keys: PhysicalKey[] = [
      { row: 0, col: 0, x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'A', ledIndex: 0 },
    ];

    const blob = await generateKiCadZip(
      { settings, keys },
      {
        switchFootprint: 'Smidr:SW_Smidr_Choc_Solder',
        diodeFootprint: 'Smidr:D_Smidr_SOD123',
        diodeOffsetX: 5.08,
        diodeOffsetY: 4,
        diodeRotation: 90,
      }
    );
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const pcb = await zip.file('choc_rgb_kicad.kicad_pcb')!.async('string');

    expect(pcb).toContain('(footprint "Smidr:LED_Smidr_SK6812MINI_E"');
    expect(pcb).toContain('(at 9.525 4.825 180.000)');
  });

  it('places per-key KiCad backlight LEDs using switch-specific footprints and RGB offsets', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Backlight KiCad',
      matrix: { rows: 1, cols: 1 },
      features: { ...baseSettings.features, backlight: true },
    };
    const keys: PhysicalKey[] = [
      { row: 0, col: 0, x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'A' },
    ];

    const mxBlob = await generateKiCadZip({ settings, keys });
    const mxZip = await JSZip.loadAsync(await mxBlob.arrayBuffer());
    const mxSchematic = await mxZip.file('backlight_kicad.kicad_sch')!.async('string');
    const mxPcb = await mxZip.file('backlight_kicad.kicad_pcb')!.async('string');
    expect(mxSchematic).toContain('(lib_id "Device:LED")');
    expect(mxSchematic).toContain('(footprint "Smidr:LED_Smidr_Backlight")');
    expect(mxPcb).toMatch(/\(footprint "Smidr:LED_Smidr_Backlight"[\s\S]*?\(at 9\.525 14\.605 0\.000\)/);
    expect(mxPcb).toContain('"BACKLIGHT"');
    expect(mxPcb).toContain('"GND"');

    for (const switchFootprint of [
      'Smidr:SW_Smidr_Choc_Solder',
      'Smidr:SW_Smidr_Gateron_LP_Solder',
    ]) {
      const blob = await generateKiCadZip(
        { settings, keys },
        { ...DEFAULT_KICAD_EXPORT_OPTIONS, switchFootprint }
      );
      const zip = await JSZip.loadAsync(await blob.arrayBuffer());
      const pcb = await zip.file('backlight_kicad.kicad_pcb')!.async('string');
      expect(pcb).toContain('(footprint "Smidr:LED_Smidr_Backlight_1206_Reverse"');
      expect(pcb).toMatch(/\(footprint "Smidr:LED_Smidr_Backlight_1206_Reverse"[\s\S]*?\(layer "B\.Cu"\)/);
      const backlightFootprint = pcb.match(/\(footprint "Smidr:LED_Smidr_Backlight_1206_Reverse"[\s\S]*?(?=\n  \(footprint|\n  \(gr_|\n\))/)?.[0];
      expect(backlightFootprint).toBeTruthy();
      expect(backlightFootprint).toContain('"B.Cu"');
      expect(backlightFootprint).toContain('"B.Paste"');
      expect(backlightFootprint).toContain('"B.Mask"');
    }
  });

  it('exports QMK direct pins from per-key assignments', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      matrix: { rows: 1, cols: 2, wiring: 'direct' },
    };
    const keys: PhysicalKey[] = [
      { x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, row: 0, col: 0, directPin: 'GP2', label: 'A' },
      { x: 1, y: 0, w: 1, h: 1, r: 0, rx: 1, ry: 0, row: 0, col: 1, directPin: 'GP3', label: 'B' },
    ];

    const blob = await generateQmkZip({ settings, keys });
    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keyboardJson = JSON.parse(await zip.file('test_keyboard/keyboard.json')!.async('string'));

    expect(keyboardJson.matrix_pins).toEqual({ direct: [['GP2', 'GP3']] });
    expect(keyboardJson.layouts.LAYOUT.layout.map((key: any) => key.matrix)).toEqual([[0, 0], [0, 1]]);
  });

  it('exports split QMK direct pins per side', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      matrix: { rows: 1, cols: 1, wiring: 'direct' },
      features: { ...baseSettings.features, split: true },
    };
    const keys: PhysicalKey[] = [
      { x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, row: 0, col: 0, matrixSide: 'left', directPin: 'GP2', label: 'A' },
      { x: 8, y: 0, w: 1, h: 1, r: 0, rx: 8, ry: 0, row: 0, col: 0, matrixSide: 'right', directPin: 'GP2', label: 'B' },
    ];

    const blob = await generateQmkZip({ settings, keys });
    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keyboardJson = JSON.parse(await zip.file('test_keyboard/keyboard.json')!.async('string'));

    expect(keyboardJson.matrix_pins).toEqual({ direct: [['GP2']] });
    expect(keyboardJson.split.matrix_pins.right).toEqual({ direct: [['GP2']] });
    expect(keyboardJson.layouts.LAYOUT.layout.map((key: any) => key.matrix)).toEqual([[0, 0], [1, 0]]);
  });

  it('exports ZMK direct GPIO kscan for non-split keyboards', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      matrix: { rows: 1, cols: 2, wiring: 'direct' },
    };
    const keys: PhysicalKey[] = [
      { x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, directPin: 'GP2', label: 'A' },
      { x: 1, y: 0, w: 1, h: 1, r: 0, rx: 1, ry: 0, directPin: 'GP3', label: 'B' },
    ];

    const blob = await generateZmkZip({ settings, keys });
    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const overlay = await zip.file('boards/shields/test_keyboard/test_keyboard.overlay')!.async('string');

    expect(overlay).toContain('compatible = "zmk,kscan-gpio-direct"');
    expect(overlay).toContain('input-gpios');
    expect(overlay).toContain('Direct 0: GP2');
    expect(overlay).toContain('Direct 1: GP3');
  });

  it('exports split ZMK direct GPIO kscan per side', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      matrix: { rows: 1, cols: 2, wiring: 'direct' },
      features: { ...baseSettings.features, split: true },
      zmk: { splitTransport: 'wired' },
    };
    const keys: PhysicalKey[] = [
      { x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, matrixSide: 'left', directPin: 'GP2', label: 'A' },
      { x: 8, y: 0, w: 1, h: 1, r: 0, rx: 8, ry: 0, matrixSide: 'right', directPin: 'GP2', label: 'B' },
    ];

    const blob = await generateZmkZip({ settings, keys });
    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const dtsi = await zip.file('boards/shields/test_keyboard/test_keyboard.dtsi')!.async('string');
    const leftOverlay = await zip.file('boards/shields/test_keyboard/test_keyboard_left.overlay')!.async('string');
    const rightOverlay = await zip.file('boards/shields/test_keyboard/test_keyboard_right.overlay')!.async('string');
    const readme = await zip.file('README.md')!.async('string');

    expect(dtsi).toContain('compatible = "zmk,kscan-gpio-direct"');
    expect(leftOverlay).toContain('Direct 0: GP2');
    expect(rightOverlay).toContain('Direct 0: GP2');
    expect(rightOverlay).toContain('col-offset = <1>');
    expect(readme).toContain('col-offset = <1>');
  });

  it('keeps ZMK direct kscan enabled when a split half has unconfigured switches or peripherals', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      matrix: { rows: 1, cols: 2, wiring: 'direct' },
      features: { ...baseSettings.features, split: true },
      zmk: { splitTransport: 'wired' },
      encoders: [{}],
      trackballs: [{}],
    };
    const keys: PhysicalKey[] = [
      { x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, matrixSide: 'left', directPin: 'GP2', label: 'Left' },
      { x: 8, y: 0, w: 1, h: 1, r: 0, rx: 8, ry: 0, matrixSide: 'right', directPin: 'GP3', label: 'Right' },
      { x: 9, y: 0, w: 1, h: 1, r: 0, rx: 9, ry: 0, matrixSide: 'right', label: 'Unconfigured switch' },
      { kind: 'encoder', encoderIndex: 0, x: 10, y: 0, w: 1, h: 1, r: 0, rx: 10, ry: 0, matrixSide: 'right', label: 'Encoder' },
      { kind: 'trackball', trackballIndex: 0, x: 11, y: 0, w: 1, h: 1, r: 0, rx: 11, ry: 0, matrixSide: 'right', label: 'Trackball' },
    ];

    const blob = await generateZmkZip({ settings, keys });
    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const rightOverlay = await zip.file('boards/shields/test_keyboard/test_keyboard_right.overlay')!.async('string');

    expect(rightOverlay).toContain('Direct 0: GP3');
    expect(rightOverlay).not.toContain('status = "disabled";');
    expect(rightOverlay).not.toContain('Please configure pin');
    expect(rightOverlay).not.toContain('Direct 1:');
  });

  it('omits saved row and column assignments for direct pin projects', () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      matrix: { rows: 1, cols: 2, wiring: 'direct' },
    };
    const keys: PhysicalKey[] = [
      { x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, row: 0, col: 1, directPin: 'GP2', label: 'A' },
    ];

    const project = generateSmidrProjectJson({ settings, keys });

    expect(project.keys[0].directPin).toBe('GP2');
    expect(project.keys[0].row).toBeUndefined();
    expect(project.keys[0].col).toBeUndefined();
  });

  it('exports KLE JSON for only the currently visible layout option', () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      layoutOptions: {
        thumb: { name: 'Thumb', type: 'list', choices: ['1u', '15u'] },
      },
      activeOptions: {
        thumb: 1,
      },
    };
    const keys: PhysicalKey[] = [
      {
        x: -4,
        y: -2,
        w: 1,
        h: 1,
        r: 0,
        rx: -4,
        ry: -2,
        label: 'Hidden',
        group: 'thumb',
        option: 0,
      },
      {
        x: 2,
        y: 3,
        w: 1,
        h: 1,
        r: 0,
        rx: 2,
        ry: 3,
        label: 'Visible',
        group: 'thumb',
        option: 1,
      },
    ];

    const kleJson = generateKleJson(
      { settings, keys },
      { editorMode: 'layout', currentLayer: 0, appMode: 'design' }
    );
    const serialized = JSON.stringify(kleJson);

    expect(serialized).toContain('Visible');
    expect(serialized).not.toContain('Hidden');
    expect(kleJson).toEqual([['Visible']]);
  });

  it('exports KLE labels from the current editor mode', () => {
    const keys: PhysicalKey[] = [
      {
        row: 1,
        col: 2,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: 'Layout Label',
        keymap: {
          0: { action: 'tap', keycode: 'A' },
        },
      },
    ];

    expect(generateKleJson(
      { settings: baseSettings, keys },
      { editorMode: 'layout', currentLayer: 0, appMode: 'design' }
    )).toEqual([['Layout Label']]);
    expect(generateKleJson(
      { settings: baseSettings, keys },
      { editorMode: 'matrix', currentLayer: 0, appMode: 'design' }
    )).toEqual([['R1:C2']]);
    expect(generateKleJson(
      { settings: baseSettings, keys },
      { editorMode: 'keymap', currentLayer: 0, appMode: 'design' }
    )).toEqual([['A']]);
  });

  it('omits split pin settings from saved projects when split is disabled', () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      features: {
        ...baseSettings.features,
        split: false,
      },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: ['GP2'],
        splitCols: ['GP3'],
        splitSerial: 'GP4',
      },
    };

    const project = generateSmidrProjectJson({ settings, keys: [] });

    expect(project.pins).toEqual({
      rows: ['GP0'],
      cols: ['GP1'],
    });
  });

  it('stores USB IDs in .smidr as vendorId/productId instead of vendorProductId', () => {
    const project = generateSmidrProjectJson({ settings: baseSettings, keys: [] });

    expect(project.vendorId).toBe('0xFEED');
    expect(project.productId).toBe('0x0001');
    expect(project).not.toHaveProperty('vendorProductId');
  });

  it('keeps project macros in saved projects', () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      macros: [[{ action: 'text', text: 'Hello' }]],
    };

    const project = generateSmidrProjectJson({ settings, keys: [] });

    expect(project.macros?.[0]).toEqual([{ action: 'text', text: 'Hello' }]);
  });

  it('keeps project combos in saved projects', () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      combos: [{
        inputs: [{ action: 'tap', keycode: 'A' }, { action: 'tap', keycode: 'B' }],
        output: { action: 'tap', keycode: 'ESC' },
      }],
    };

    const project = generateSmidrProjectJson({ settings, keys: [] });

    expect(project.combos?.[0]).toEqual({
      inputs: [{ action: 'tap', keycode: 'A' }, { action: 'tap', keycode: 'B' }],
      output: { action: 'tap', keycode: 'ESC' },
    });
  });

  it('keeps project ZMK settings in saved projects', () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      zmk: {
        splitTransport: 'wired',
        wiredSplitDevice: '&uart0',
      },
    };

    const project = generateSmidrProjectJson({ settings, keys: [] });

    expect(project.zmk).toEqual({
      splitTransport: 'wired',
      wiredSplitDevice: '&uart0',
    });
  });

  it('keeps split pin settings in saved projects when split is enabled', () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      features: {
        ...baseSettings.features,
        split: true,
      },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: ['GP2'],
        splitCols: ['GP3'],
        splitSerial: 'GP4',
      },
    };

    const project = generateSmidrProjectJson({ settings, keys: [] });

    expect(project.pins.splitRows).toEqual(['GP2']);
    expect(project.pins.splitCols).toEqual(['GP3']);
    expect(project.pins.splitSerial).toBe('GP4');
  });

  it('derives VIA matrix dimensions from key row/col assignments when pins are not available', () => {
    const keys: PhysicalKey[] = [
      {
        row: 1,
        col: 2,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
        keymap: {
          0: { action: 'tap', keycode: 'A' },
        },
      },
    ];

    const viaJson = generateViaJson({ settings: baseSettings, keys });

    expect(viaJson.matrix).toEqual({ rows: 2, cols: 3 });
    expect(viaJson.keymaps[0][1][2]).toBe('KC_A');
  });

  it('emits VIA/Vial lighting menus only for enabled lighting features', () => {
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];
    const withoutLighting = generateViaJson({ settings: baseSettings, keys });

    expect(withoutLighting.menus).toEqual([]);
    expect(withoutLighting.keycodes).toEqual([]);

    const withBacklight = generateViaJson({
      settings: {
        ...baseSettings,
        features: { ...baseSettings.features, backlight: true },
      },
      keys,
    });

    expect(withBacklight.menus).toEqual(['qmk_backlight']);
    expect(withBacklight.keycodes).toEqual(['qmk_lighting']);

    const withRgbMatrix = generateViaJson({
      settings: {
        ...baseSettings,
        features: { ...baseSettings.features, rgbMatrix: true },
      },
      keys,
    });

    expect(withRgbMatrix.menus).toEqual(['qmk_rgb_matrix']);
    expect(withRgbMatrix.keycodes).toEqual(['qmk_lighting']);
  });

  it('does not emit a matrix mask from pin overlap alone', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Unmasked Board',
      matrix: { rows: 2, cols: 2 },
      pins: {
        rows: ['GP0', 'GP1'],
        cols: ['GP1', 'GP2'],
        splitRows: [],
        splitCols: [],
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
      {
        row: 1,
        col: 1,
        x: 1,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const blob = await generateQmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keyboardJson = JSON.parse(await zip.file('unmasked_board/keyboard.json')!.async('string'));

    expect(keyboardJson.matrix_pins.masked).toBeUndefined();
    expect(keyboardJson.features.via).toBeUndefined();
    expect(zip.file('unmasked_board/unmasked_board.c')).toBeNull();
  });

  it('emits QMK development_board without processor and bootloader', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Development Board',
      hardware: {
        ...baseSettings.hardware,
        controllerType: 'development_board',
        board: 'elite_pi',
      },
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: [],
        splitCols: [],
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const blob = await generateQmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keyboardJson = JSON.parse(await zip.file('development_board/keyboard.json')!.async('string'));

    expect(keyboardJson.development_board).toBe('elite_pi');
    expect(keyboardJson.processor).toBeUndefined();
    expect(keyboardJson.bootloader).toBeUndefined();
  });

  it('emits current QMK RGB pin settings without deprecated config defines', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'RGB Board',
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: [],
        splitCols: [],
        rgb: 'GP2',
      },
      features: {
        ...baseSettings.features,
        rgb: true,
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const qmkBlob = await generateQmkZip({ settings, keys });
    const vialBlob = await generateVialZip({ settings, keys });
    expect(qmkBlob).toBeTruthy();
    expect(vialBlob).toBeTruthy();

    const qmkZip = await JSZip.loadAsync(await qmkBlob!.arrayBuffer());
    const vialZip = await JSZip.loadAsync(await vialBlob!.arrayBuffer());
    const qmkConfigH = await qmkZip.file('rgb_board/config.h')!.async('string');
    const vialConfigH = await vialZip.file('rgb_board/config.h')!.async('string');

    for (const configH of [qmkConfigH, vialConfigH]) {
      expect(configH).toContain('#define WS2812_DI_PIN GP2');
      expect(configH).toContain('#define RGBLED_NUM 1');
      expect(configH).not.toContain('RGB_DI_PIN');
      expect(configH).not.toContain('RGBLIGHT_ANIMATIONS');
    }
  });

  it('emits backlight firmware settings and pins for QMK and Vial', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Backlight Board',
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: [],
        splitCols: [],
        backlight: 'GP4',
      },
      features: {
        ...baseSettings.features,
        backlight: true,
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const qmkBlob = await generateQmkZip({ settings, keys });
    const vialBlob = await generateVialZip({ settings, keys });
    expect(qmkBlob).toBeTruthy();
    expect(vialBlob).toBeTruthy();

    const qmkZip = await JSZip.loadAsync(await qmkBlob!.arrayBuffer());
    const vialZip = await JSZip.loadAsync(await vialBlob!.arrayBuffer());
    const qmkKeyboardJson = JSON.parse(await qmkZip.file('backlight_board/keyboard.json')!.async('string'));
    const vialKeyboardJson = JSON.parse(await vialZip.file('backlight_board/keyboard.json')!.async('string'));
    const qmkConfigH = await qmkZip.file('backlight_board/config.h')!.async('string');
    const vialConfigH = await vialZip.file('backlight_board/config.h')!.async('string');

    for (const keyboardJson of [qmkKeyboardJson, vialKeyboardJson]) {
      expect(keyboardJson.features.backlight).toBe(true);
      expect(keyboardJson.backlight).toEqual({ pin: 'GP4', levels: 5 });
    }
    for (const configH of [qmkConfigH, vialConfigH]) {
      expect(configH).toContain('#define BACKLIGHT_PIN GP4');
      expect(configH).toContain('#define BACKLIGHT_LEVELS 5');
    }
  });

  it('emits QMK new-keyboard style processor and bootloader defaults when MCU is selected', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'STM Board',
      hardware: {
        ...baseSettings.hardware,
        controllerType: 'mcu',
        mcu: 'STM32F103',
      },
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['A0'],
        cols: ['B0'],
        splitRows: [],
        splitCols: [],
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const blob = await generateQmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keyboardJson = JSON.parse(await zip.file('stm_board/keyboard.json')!.async('string'));

    expect(keyboardJson.processor).toBe('STM32F103');
    expect(keyboardJson.bootloader).toBe('stm32duino');
  });

  it('emits QMK tap dance definitions and rules when configured', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Tap Dance Board',
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: [],
        splitCols: [],
      },
      tapDances: [
        {
          id: 0,
          tapAction: { action: 'tap', keycode: 'ESC' },
          holdAction: { action: 'tap', keycode: 'LSFT' },
          doubleTapAction: { action: 'tap', keycode: 'CAPS' },
          tapHoldAction: { action: 'tap', keycode: 'LCTL' },
          tappingTerm: 175,
        },
      ],
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
        keymap: {
          0: { action: 'td', tapDanceId: 0 },
        },
      },
    ];

    const blob = await generateQmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keymapC = await zip.file('tap_dance_board/keymaps/default/keymap.c')!.async('string');
    const rulesMk = await zip.file('tap_dance_board/keymaps/default/rules.mk')!.async('string');

    expect(keymapC).toContain('tap_dance_action_t tap_dance_actions[]');
    expect(keymapC).toContain('void smidr_td_0_finished(tap_dance_state_t *state, void *user_data)');
    expect(keymapC).toContain('register_code16(smidr_td_0_held)');
    expect(keymapC).toContain('tap_code16(KC_ESC)');
    expect(keymapC).toContain('tap_code16(KC_CAPS)');
    expect(keymapC).toContain('[0] = ACTION_TAP_DANCE_FN_ADVANCED(NULL, smidr_td_0_finished, smidr_td_0_reset)');
    expect(keymapC).toContain('TD(0)');
    expect(rulesMk).toContain('TAP_DANCE_ENABLE = yes');
  });

  it('emits QMK static project macros when configured', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Macro Board',
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: [],
        splitCols: [],
      },
      macros: [[
        { action: 'text', text: 'Hi' },
        { action: 'delay', duration: 25 },
        { action: 'tap', keycodes: ['ENT'] },
      ]],
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
        keymap: {
          0: { action: 'macro', macroId: 0 },
        },
      },
    ];

    const blob = await generateQmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keymapC = await zip.file('macro_board/keymaps/default/keymap.c')!.async('string');

    expect(keymapC).toContain('SMIDR_MACRO_0 = SAFE_RANGE');
    expect(keymapC).toContain('process_record_user');
    expect(keymapC).toContain('SEND_STRING("Hi")');
    expect(keymapC).toContain('wait_ms(25)');
    expect(keymapC).toContain('tap_code16(KC_ENT)');
    expect(keymapC).toContain('SMIDR_MACRO_0');
  });

  it('emits QMK project combos when configured', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Combo Board',
      matrix: { rows: 1, cols: 2 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1', 'GP2'],
        splitRows: [],
        splitCols: [],
      },
      combos: [{
        inputs: [{ action: 'tap', keycode: 'A' }, { action: 'tap', keycode: 'B' }],
        output: { action: 'tap', keycode: 'ESC' },
      }],
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
        keymap: { 0: { action: 'tap', keycode: 'A' } },
      },
      {
        row: 0,
        col: 1,
        x: 1,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
        keymap: { 0: { action: 'tap', keycode: 'B' } },
      },
    ];

    const blob = await generateQmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keymapC = await zip.file('combo_board/keymaps/default/keymap.c')!.async('string');
    const rulesMk = await zip.file('combo_board/keymaps/default/rules.mk')!.async('string');

    expect(keymapC).toContain('const uint16_t PROGMEM smidr_combo_0[] = { KC_A, KC_B, COMBO_END };');
    expect(keymapC).toContain('COMBO(smidr_combo_0, KC_ESC)');
    expect(rulesMk).toContain('COMBO_ENABLE = yes');
  });

  it('emits explicit QMK bootmagic settings', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Bootmagic Board',
      matrix: { rows: 3, cols: 4 },
      pins: {
        rows: ['GP0', 'GP1', 'GP2'],
        cols: ['GP3', 'GP4', 'GP5', 'GP6'],
        splitRows: [],
        splitCols: [],
      },
      qmk: {
        bootmagic: {
          enabled: true,
          row: 1,
          col: 2,
        },
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const blob = await generateQmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keyboardJson = JSON.parse(await zip.file('bootmagic_board/keyboard.json')!.async('string'));

    expect(keyboardJson.features.bootmagic).toBeUndefined();
    expect(keyboardJson.bootmagic).toEqual({ enabled: true, matrix: [1, 2] });
  });

  it('emits disabled QMK bootmagic without a matrix position', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'No Bootmagic Board',
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: [],
        splitCols: [],
      },
      qmk: {
        bootmagic: {
          enabled: false,
        },
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const blob = await generateQmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keyboardJson = JSON.parse(await zip.file('no_bootmagic_board/keyboard.json')!.async('string'));

    expect(keyboardJson.bootmagic).toEqual({ enabled: false });
  });

  it('emits a matrix mask when MATRIX_MASKED is enabled', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Split Masked Board',
      matrix: { rows: 2, cols: 2 },
      pins: {
        rows: ['GP0', 'GP1'],
        cols: ['GP2', 'GP3'],
        splitRows: ['GP4', 'GP5'],
        splitCols: ['GP5', 'GP6'],
      },
      features: {
        ...baseSettings.features,
        split: true,
      },
      qmk: {
        matrixMasked: true,
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const blob = await generateQmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keyboardJson = JSON.parse(await zip.file('split_masked_board/keyboard.json')!.async('string'));
    const keyboardC = await zip.file('split_masked_board/split_masked_board.c')!.async('string');

    expect(keyboardJson.matrix_pins.masked).toBe(true);
    expect(keyboardJson.split.matrix_pins.right.rows).toEqual(['GP4', 'GP5']);
    expect(keyboardJson.split.matrix_pins.right.cols).toEqual(['GP5', 'GP6']);
    expect(keyboardC).toContain('(matrix_row_t)0x1ULL');
  });

  it('builds matrix masks from all layout options and excludes same row/column pin positions', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Option Mask Board',
      matrix: { rows: 2, cols: 3 },
      pins: {
        rows: ['GP0', 'GP1'],
        cols: ['GP2', 'GP1', 'GP3'],
        splitRows: [],
        splitCols: [],
      },
      layoutOptions: {
        thumb: {
          name: 'Thumb',
          type: 'toggle',
        },
      },
      activeOptions: {
        thumb: 0,
      },
      qmk: {
        matrixMasked: true,
      },
    };
    const keys: PhysicalKey[] = [
      { row: 0, col: 0, x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'A' },
      { row: 1, col: 1, x: 1, y: 0, w: 1, h: 1, r: 0, rx: 1, ry: 0, label: 'SamePin' },
      { row: 1, col: 2, x: 2, y: 0, w: 1, h: 1, r: 0, rx: 2, ry: 0, label: 'Hidden', group: 'thumb', option: 1 },
    ];

    const qmkBlob = await generateQmkZip({ settings, keys });
    expect(qmkBlob).toBeTruthy();
    const qmkZip = await JSZip.loadAsync(await qmkBlob!.arrayBuffer());
    const qmkKeyboardC = await qmkZip.file('option_mask_board/option_mask_board.c')!.async('string');

    expect(qmkKeyboardC).toContain('(matrix_row_t)0x1ULL');
    expect(qmkKeyboardC).toContain('(matrix_row_t)0x4ULL');
    expect(qmkKeyboardC).not.toContain('(matrix_row_t)0x6ULL');

    const vialBlob = await generateVialZip({ settings, keys });
    expect(vialBlob).toBeTruthy();
    const vialZip = await JSZip.loadAsync(await vialBlob!.arrayBuffer());
    const vialKeyboardC = await vialZip.file('option_mask_board/option_mask_board.c')!.async('string');

    expect(vialKeyboardC).toContain('(matrix_row_t)0x1ULL');
    expect(vialKeyboardC).toContain('(matrix_row_t)0x4ULL');
    expect(vialKeyboardC).not.toContain('(matrix_row_t)0x6ULL');
  });

  it('uses configured QMK right-side split pins even when their counts differ from the left side', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Asymmetric Split QMK',
      matrix: { rows: 2, cols: 3 },
      pins: {
        rows: ['GP0', 'GP1'],
        cols: ['GP2', 'GP3', 'GP4'],
        splitRows: ['GP5'],
        splitCols: ['GP6', 'GP7'],
      },
      features: {
        ...baseSettings.features,
        split: true,
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        matrixSide: 'left',
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
      {
        row: 0,
        col: 0,
        matrixSide: 'right',
        x: 5,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const blob = await generateQmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keyboardJson = JSON.parse(await zip.file('asymmetric_split_qmk/keyboard.json')!.async('string'));

    expect(keyboardJson.split.matrix_pins.right.rows).toEqual(['GP5']);
    expect(keyboardJson.split.matrix_pins.right.cols).toEqual(['GP6', 'GP7']);
  });

  it('exports split Vial matrix positions as per-half rows and columns', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Split Vial Board',
      matrix: { rows: 4, cols: 6 },
      pins: {
        rows: ['GP0', 'GP1', 'GP2', 'GP3'],
        cols: ['GP4', 'GP5', 'GP6', 'GP7', 'GP8', 'GP9'],
        splitRows: ['GP10', 'GP11', 'GP12', 'GP13'],
        splitCols: ['GP14', 'GP15', 'GP16', 'GP17', 'GP18', 'GP19'],
      },
      features: {
        ...baseSettings.features,
        split: true,
        encoder: true,
      },
      encoders: [{ pinA: 'GP20', pinB: 'GP21' }],
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        matrixSide: 'left',
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
      {
        row: 0,
        col: 0,
        matrixSide: 'right',
        x: 8,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const blob = await generateVialZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keyboardJson = JSON.parse(await zip.file('split_vial_board/keyboard.json')!.async('string'));
    const configH = await zip.file('split_vial_board/config.h')!.async('string');
    const vialJson = JSON.parse(await zip.file('split_vial_board/keymaps/vial/vial.json')!.async('string'));

    expect(keyboardJson.layouts.LAYOUT.layout.map((key: any) => key.matrix)).toEqual([[0, 0], [4, 0]]);
    expect(keyboardJson.encoder.rotary).toEqual([{ pin_a: 'GP20', pin_b: 'GP21' }]);
    expect(configH).not.toContain('ENCODERS_PAD_A');
    expect(configH).not.toContain('ENCODERS_PAD_B');
    expect(vialJson.matrix).toEqual({ rows: 8, cols: 6 });
  });

  it('uses configured Vial right-side split pins even when their counts differ from the left side', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Asymmetric Split Vial',
      matrix: { rows: 2, cols: 3 },
      pins: {
        rows: ['GP0', 'GP1'],
        cols: ['GP2', 'GP3', 'GP4'],
        splitRows: ['GP5'],
        splitCols: ['GP6', 'GP7'],
      },
      features: {
        ...baseSettings.features,
        split: true,
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        matrixSide: 'left',
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
      {
        row: 0,
        col: 0,
        matrixSide: 'right',
        x: 5,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const blob = await generateVialZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keyboardJson = JSON.parse(await zip.file('asymmetric_split_vial/keyboard.json')!.async('string'));

    expect(keyboardJson.split.matrix_pins.right.rows).toEqual(['GP5']);
    expect(keyboardJson.split.matrix_pins.right.cols).toEqual(['GP6', 'GP7']);
  });

  it('keeps encoder output enabled when encoder pins are missing', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Encoder Missing Pins',
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: [],
        splitCols: [],
      },
      features: {
        ...baseSettings.features,
        backlight: true,
        encoder: true,
      },
      encoders: [{}],
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const blob = await generateVialZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keyboardJson = JSON.parse(await zip.file('encoder_missing_pins/keyboard.json')!.async('string'));
    expect(keyboardJson.features.encoder).toBe(true);
    expect(keyboardJson.encoder.rotary).toEqual([{ pin_a: 'B0', pin_b: 'B1' }]);
  });

  it('serializes runtime encoder ids to saved encoder indexes', () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      features: { ...baseSettings.features, encoder: true },
      encoders: [
        {
          id: 'runtime-encoder-0',
          pinA: 'GP2',
          pinB: 'GP3',
          keymap: {
            0: {
              counterClockwise: { action: 'tap', keycode: 'VOLD' },
              clockwise: { action: 'tap', keycode: 'VOLU' },
            },
          },
        },
      ],
    };
    const keys: PhysicalKey[] = [
      {
        id: 'runtime-key',
        kind: 'encoder',
        encoderId: 'runtime-encoder-0',
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        w2: 2,
        h2: 2,
        x2: 0.5,
        y2: 0.5,
        stepped: true,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const saved = generateSmidrProjectJson({ settings, keys });

    expect(saved.encoders?.[0]).toEqual({
      pinA: 'GP2',
      pinB: 'GP3',
      keymap: {
        0: {
          counterClockwise: { action: 'tap', keycode: 'VOLD' },
          clockwise: { action: 'tap', keycode: 'VOLU' },
        },
      },
    });
    expect((saved.encoders?.[0] as any).id).toBeUndefined();
    expect(saved.keys[0].kind).toBe('encoder');
    expect(saved.keys[0].encoderIndex).toBe(0);
    expect((saved.keys[0] as any).encoderId).toBeUndefined();
    expect(saved.keys[0].w2).toBeUndefined();
    expect(saved.keys[0].h2).toBeUndefined();
    expect(saved.keys[0].x2).toBeUndefined();
    expect(saved.keys[0].y2).toBeUndefined();
    expect(saved.keys[0].stepped).toBeUndefined();
  });

  it('omits secondary shape properties from VIA encoder layout entries', () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      features: { ...baseSettings.features, encoder: true },
      encoders: [{ pinA: 'GP2', pinB: 'GP3' }],
    };
    const keys: PhysicalKey[] = [
      {
        kind: 'encoder',
        encoderIndex: 0,
        x: 0,
        y: 0,
        w: 2,
        h: 1,
        w2: 1,
        h2: 2,
        x2: 0.25,
        y2: 0.25,
        stepped: true,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const via = generateViaJson({ settings, keys });
    const keymapJson = JSON.stringify(via.layouts.keymap);

    expect(keymapJson).toContain('e0');
    expect(keymapJson).toContain('"w":2');
    expect(keymapJson).not.toContain('"w2"');
    expect(keymapJson).not.toContain('"h2"');
    expect(keymapJson).not.toContain('"x2"');
    expect(keymapJson).not.toContain('"y2"');
    expect(keymapJson).not.toContain('"l"');
  });

  it('exports multiple encoder pins and encoder_map for QMK', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Encoder Map Board',
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: [],
        splitCols: [],
      },
      features: {
        ...baseSettings.features,
        backlight: true,
        encoder: true,
      },
      encoders: [
        {
          pinA: 'GP2',
          pinB: 'GP3',
          keymap: {
            0: {
              counterClockwise: { action: 'tap', keycode: 'VOLD' },
              clockwise: { action: 'tap', keycode: 'VOLU' },
            },
          },
        },
        {
          pinA: 'GP4',
          pinB: 'GP5',
          keymap: {
            0: {
              counterClockwise: { action: 'tap', keycode: 'LEFT' },
              clockwise: { action: 'tap', keycode: 'RIGHT' },
            },
          },
        },
      ],
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        encoderIndex: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const blob = await generateQmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keyboardJson = JSON.parse(await zip.file('encoder_map_board/keyboard.json')!.async('string'));
    const keymapC = await zip.file('encoder_map_board/keymaps/default/keymap.c')!.async('string');
    const rulesMk = await zip.file('encoder_map_board/keymaps/default/rules.mk')!.async('string');

    expect(keyboardJson.encoder.rotary).toEqual([
      { pin_a: 'GP2', pin_b: 'GP3' },
      { pin_a: 'GP4', pin_b: 'GP5' },
    ]);
    expect(keymapC).toContain('const uint16_t PROGMEM encoder_map[][NUM_ENCODERS][NUM_DIRECTIONS]');
    expect(keymapC).toContain('ENCODER_CCW_CW(KC_VOLD, KC_VOLU)');
    expect(keymapC).toContain('ENCODER_CCW_CW(KC_LEFT, KC_RGHT)');
    expect(rulesMk).toContain('ENCODER_MAP_ENABLE = yes');
  });

  it('explains when ZMK direct-pin warnings come from hidden layout-option keys', () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      matrix: { rows: 1, cols: 3, wiring: 'direct' },
      activeOptions: { layout: 0 },
    };
    const keys: PhysicalKey[] = [
      { id: 'default', group: 'layout', option: 0, directPin: 'GP0', x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'Default' },
      { id: 'alternate', group: 'layout', option: 1, x: 1, y: 0, w: 1, h: 1, r: 0, rx: 1, ry: 0, label: 'Alternate' },
      { id: 'always', directPin: 'GP2', x: 2, y: 0, w: 1, h: 1, r: 0, rx: 2, ry: 0, label: 'Always' },
    ];

    const issue = validateFirmwareExport(settings, keys, 'zmk').find(issue => issue.code === 'direct-pins-missing');

    expect(issue?.message).toContain('1 key(s) have no direct pin assignment');
    expect(issue?.message).toContain('2 key(s) are currently visible, while 3 key(s) are export targets');
    expect(issue?.message).toContain('1 unassigned key(s) are hidden by the selected layout options');
  });

  it('does not require encoder or trackball input pins unless they are configured as buttons', () => {
    const directSettings: ProjectSettings = {
      ...baseSettings,
      matrix: { rows: 1, cols: 2, wiring: 'direct' },
      encoders: [{}],
      trackballs: [{}],
    };
    const directKeys: PhysicalKey[] = [
      { id: 'switch', directPin: 'GP0', x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'Switch' },
      { id: 'encoder', kind: 'encoder', encoderIndex: 0, x: 1, y: 0, w: 1, h: 1, r: 0, rx: 1, ry: 0, label: 'Encoder' },
      { id: 'trackball', kind: 'trackball', trackballIndex: 0, x: 2, y: 0, w: 1, h: 1, r: 0, rx: 2, ry: 0, label: 'Trackball' },
    ];

    expect(validateFirmwareExport(directSettings, directKeys, 'zmk').some(issue => issue.code === 'direct-pins-missing')).toBe(false);

    const matrixSettings: ProjectSettings = {
      ...baseSettings,
      matrix: { rows: 1, cols: 1 },
      pins: { rows: ['GP0'], cols: ['GP1'], splitRows: [], splitCols: [] },
      encoders: [{}],
      trackballs: [{}],
    };
    const peripheralOnlyKeys: PhysicalKey[] = [
      { id: 'encoder', kind: 'encoder', encoderIndex: 0, x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'Encoder' },
      { id: 'trackball', kind: 'trackball', trackballIndex: 0, x: 1, y: 0, w: 1, h: 1, r: 0, rx: 1, ry: 0, label: 'Trackball' },
    ];

    expect(validateFirmwareExport(matrixSettings, peripheralOnlyKeys, 'zmk').some(issue => issue.code === 'matrix-keys-missing')).toBe(false);
  });

  it('disables unconfigured ZMK switch input and omits incomplete peripherals', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'ZMK Unconfigured Inputs',
      matrix: { rows: 1, cols: 1 },
      encoders: [{}],
      trackballs: [{}],
    };
    const keys: PhysicalKey[] = [
      { row: 0, col: 0, x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'A' },
      { kind: 'encoder', encoderIndex: 0, x: 1, y: 0, w: 1, h: 1, r: 0, rx: 1, ry: 0, label: 'Encoder' },
      { kind: 'trackball', trackballIndex: 0, x: 2, y: 0, w: 1, h: 1, r: 0, rx: 2, ry: 0, label: 'Trackball' },
    ];

    const blob = await generateZmkZip({ settings, keys });
    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const overlay = await zip.file('boards/shields/zmk_unconfigured_inputs/zmk_unconfigured_inputs.overlay')!.async('string');
    const conf = await zip.file('boards/shields/zmk_unconfigured_inputs/zmk_unconfigured_inputs.conf')!.async('string');

    expect(overlay).toContain('status = "disabled";');
    expect(overlay).not.toContain('row-gpios');
    expect(overlay).not.toContain('col-gpios');
    expect(overlay).not.toContain('encoder_0');
    expect(overlay).not.toContain('pmw3610');
    expect(conf).not.toContain('CONFIG_EC11=y');
    expect(conf).not.toContain('CONFIG_PMW3610_ALT=y');
    expect(zip.file('config/west.yml')).toBeNull();
  });

  it('warns when encoder pins are missing during QMK and Vial export validation', () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: [],
        splitCols: [],
      },
      features: {
        ...baseSettings.features,
        encoder: true,
      },
      encoders: [{}],
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
        encoderIndex: 0,
      },
    ];

    for (const target of ['qmk', 'vial'] as const) {
      const issues = validateFirmwareExport(settings, keys, target);
      expect(issues).toContainEqual(expect.objectContaining({
        severity: 'warning',
        code: 'encoder-pins-missing',
        message: expect.stringContaining('may fail to compile'),
      }));
    }
  });

  it('ignores the legacy encoder feature flag when no encoder is configured', () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      features: {
        ...baseSettings.features,
        encoder: true,
      },
      encoders: [],
    };

    const issues = validateFirmwareExport(settings, [], 'qmk');
    expect(issues.some(issue => issue.code.startsWith('encoder-'))).toBe(false);
  });

  it('warns when encoder is enabled without a layout encoder assignment', () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: [],
        splitCols: [],
      },
      features: {
        ...baseSettings.features,
        encoder: true,
      },
      encoders: [{ pinA: 'GP2', pinB: 'GP3' }],
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const issues = validateFirmwareExport(settings, keys, 'vial');
    expect(issues).toContainEqual(expect.objectContaining({
      severity: 'warning',
      code: 'encoder-layout-missing',
    }));
  });

  it('warns about unknown pins and missing split transport during export validation', () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: [],
        splitCols: [],
      },
      features: {
        ...baseSettings.features,
        encoder: true,
        split: true,
      },
      encoders: [{ pinA: 'B0', pinB: 'GP2' }],
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        matrixSide: 'left',
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const issues = validateFirmwareExport(settings, keys, 'qmk');
    expect(issues).toContainEqual(expect.objectContaining({
      severity: 'warning',
      code: 'unknown-pin',
      message: expect.stringContaining('Encoder 0 A'),
    }));
    expect(issues).toContainEqual(expect.objectContaining({
      severity: 'warning',
      code: 'split-serial-missing',
    }));
    expect(issues).toContainEqual(expect.objectContaining({
      severity: 'warning',
      code: 'split-matrix-pins-missing',
    }));
  });

  it('warns when only one right-side split matrix axis is assigned during export validation', () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: ['GP2'],
        splitCols: [],
      },
      features: {
        ...baseSettings.features,
        split: true,
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        matrixSide: 'right',
        x: 2,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const issues = validateFirmwareExport(settings, keys, 'qmk');
    expect(issues).toContainEqual(expect.objectContaining({
      severity: 'warning',
      code: 'split-matrix-pins-partial',
    }));
    expect(issues).not.toContainEqual(expect.objectContaining({
      code: 'split-matrix-pins-missing',
    }));
  });

  it('allows ZMK custom-board split source export during validation', () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      matrix: { rows: 1, cols: 1 },
      hardware: {
        ...baseSettings.hardware,
        controllerType: 'mcu',
        mcu: 'nRF52840',
      },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: ['GP2'],
        splitCols: ['GP3'],
        splitSerial: 'GP4',
      },
      features: {
        ...baseSettings.features,
        split: true,
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        matrixSide: 'left',
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const issues = validateFirmwareExport(settings, keys, 'zmk');
    expect(issues.filter(issue => issue.severity === 'error')).toEqual([]);
  });

  it('allows ZMK nRF52840 development-board split source export during validation', () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      matrix: { rows: 1, cols: 1 },
      hardware: {
        ...baseSettings.hardware,
        controllerType: 'development_board',
        mcu: 'nRF52840',
        board: 'nice_nano',
      },
      pins: {
        rows: ['P0.06'],
        cols: ['P0.08'],
        splitRows: ['P1.06'],
        splitCols: ['P1.08'],
      },
      features: {
        ...baseSettings.features,
        split: true,
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        matrixSide: 'left',
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
      {
        row: 0,
        col: 0,
        matrixSide: 'right',
        x: 4,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const issues = validateFirmwareExport(settings, keys, 'zmk');
    expect(issues.filter(issue => issue.severity === 'error')).toEqual([]);
  });

  it('uses the ZMK development board target during split export validation', () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      matrix: { rows: 1, cols: 1 },
      hardware: {
        ...baseSettings.hardware,
        controllerType: 'development_board',
        mcu: 'atmega32u4',
        board: 'nice_nano',
      },
      pins: {
        rows: ['P0.06'],
        cols: ['P0.08'],
        splitRows: ['P1.06'],
        splitCols: ['P1.08'],
      },
      features: {
        ...baseSettings.features,
        split: true,
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        matrixSide: 'left',
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const issues = validateFirmwareExport(settings, keys, 'zmk');
    expect(issues.filter(issue => issue.severity === 'error')).toEqual([]);
  });

  it('warns when ZMK wired split has no UART device configured', () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      matrix: { rows: 1, cols: 1 },
      hardware: {
        ...baseSettings.hardware,
        controllerType: 'development_board',
        mcu: 'RP2040',
        board: 'kb2040',
      },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: ['GP2'],
        splitCols: ['GP3'],
      },
      features: {
        ...baseSettings.features,
        split: true,
      },
      zmk: {
        splitTransport: 'wired',
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        matrixSide: 'left',
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const issues = validateFirmwareExport(settings, keys, 'zmk');
    expect(issues.filter(issue => issue.severity === 'error')).toEqual([]);
    expect(issues).toContainEqual(expect.objectContaining({
      severity: 'warning',
      code: 'zmk-wired-split-device-missing',
    }));
  });

  it('emits Vial MATRIX_MASKED through rules.mk instead of keyboard.json', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Vial Masked Board',
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: [],
        splitCols: [],
      },
      qmk: {
        matrixMasked: true,
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const blob = await generateVialZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keyboardJson = JSON.parse(await zip.file('vial_masked_board/keyboard.json')!.async('string'));
    const configH = await zip.file('vial_masked_board/config.h')!.async('string');
    const rulesMk = await zip.file('vial_masked_board/rules.mk')!.async('string');
    const keyboardC = await zip.file('vial_masked_board/vial_masked_board.c')!.async('string');

    expect(keyboardJson.matrix_pins.masked).toBeUndefined();
    expect(keyboardJson.features.bootmagic).toBeUndefined();
    expect(keyboardJson.features.extrakey).toBe(false);
    expect(keyboardJson.features.mousekey).toBe(false);
    expect(keyboardJson.bootmagic).toEqual({ enabled: true, matrix: [0, 0] });
    expect(configH).toContain('#define MATRIX_MASKED');
    expect(rulesMk).toContain('MATRIX_MASKED = yes');
    expect(keyboardC).toContain('const matrix_row_t matrix_mask[MATRIX_ROWS]');
  });

  it('enables mousekey in QMK and Vial only when mouse keys are assigned', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Mouse Key Board',
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: [],
        splitCols: [],
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
        keymap: {
          0: { action: 'tap', keycode: 'MOUSE_WHEEL_UP' },
        },
      },
    ];

    const qmkBlob = await generateQmkZip({ settings, keys });
    const vialBlob = await generateVialZip({ settings, keys });

    const qmkZip = await JSZip.loadAsync(await qmkBlob!.arrayBuffer());
    const vialZip = await JSZip.loadAsync(await vialBlob!.arrayBuffer());
    const qmkKeyboardJson = JSON.parse(await qmkZip.file('mouse_key_board/keyboard.json')!.async('string'));
    const vialKeyboardJson = JSON.parse(await vialZip.file('mouse_key_board/keyboard.json')!.async('string'));

    expect(qmkKeyboardJson.features.mousekey).toBe(true);
    expect(vialKeyboardJson.features.mousekey).toBe(true);
  });

  it('omits Vial static tap dance definitions and warns when configured', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Vial Tap Dance',
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: [],
        splitCols: [],
      },
      tapDances: [
        {
          id: 1,
          tapAction: { action: 'tap', keycode: 'ESC' },
          holdAction: { action: 'tap', keycode: 'LSFT' },
          doubleTapAction: { action: 'tap', keycode: 'CAPS' },
          tapHoldAction: { action: 'tap', keycode: 'LCTL' },
          tappingTerm: 225,
        },
      ],
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
        keymap: {
          0: { action: 'td', tapDanceId: 1 },
        },
      },
    ];

    const blob = await generateVialZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keymapC = await zip.file('vial_tap_dance/keymaps/vial/keymap.c')!.async('string');
    const rulesMk = await zip.file('vial_tap_dance/keymaps/vial/rules.mk')!.async('string');
    const issues = validateFirmwareExport(settings, keys, 'vial');

    expect(keymapC).not.toContain('tap_dance_action_t tap_dance_actions');
    expect(keymapC).not.toContain('void smidr_td_1_finished(tap_dance_state_t *state, void *user_data)');
    expect(keymapC).toContain('TD(1)');
    expect(rulesMk).toContain('TAP_DANCE_ENABLE = yes');
    expect(issues).toContainEqual(expect.objectContaining({
      severity: 'warning',
      code: 'vial-tap-dance-source-not-emitted',
    }));
  });

  it('emits Vial static project macros when configured', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Vial Macro',
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: [],
        splitCols: [],
      },
      macros: [[{ action: 'text', text: 'Vial' }]],
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
        keymap: {
          0: { action: 'macro', macroId: 0 },
        },
      },
    ];

    const blob = await generateVialZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keymapC = await zip.file('vial_macro/keymaps/vial/keymap.c')!.async('string');

    expect(keymapC).toContain('SMIDR_MACRO_0 = SAFE_RANGE');
    expect(keymapC).toContain('SEND_STRING("Vial")');
    expect(keymapC).toContain('SMIDR_MACRO_0');
  });

  it('emits Vial project combos when configured', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Vial Combo',
      matrix: { rows: 1, cols: 2 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1', 'GP2'],
        splitRows: [],
        splitCols: [],
      },
      combos: [{
        inputs: [{ action: 'tap', keycode: 'A' }, { action: 'tap', keycode: 'B' }],
        output: { action: 'tap', keycode: 'ESC' },
      }],
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
        keymap: { 0: { action: 'tap', keycode: 'A' } },
      },
      {
        row: 0,
        col: 1,
        x: 1,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
        keymap: { 0: { action: 'tap', keycode: 'B' } },
      },
    ];

    const blob = await generateVialZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keymapC = await zip.file('vial_combo/keymaps/vial/keymap.c')!.async('string');
    const rulesMk = await zip.file('vial_combo/keymaps/vial/rules.mk')!.async('string');

    expect(keymapC).toContain('COMBO(smidr_combo_0, KC_ESC)');
    expect(rulesMk).toContain('COMBO_ENABLE = yes');
  });

  it('emits configured Vial unlock combo positions', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Vial Unlock Board',
      matrix: { rows: 4, cols: 5 },
      pins: {
        rows: ['GP0', 'GP1', 'GP2', 'GP3'],
        cols: ['GP4', 'GP5', 'GP6', 'GP7', 'GP8'],
        splitRows: [],
        splitCols: [],
      },
      vial: {
        unlockCombo: {
          key1: { row: 1, col: 2 },
          key2: { row: 3, col: 4 },
        },
      },
      vialUid: '43A8F8008844F971',
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
      {
        row: 2,
        col: 2,
        x: 1,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const blob = await generateVialZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const configH = await zip.file('vial_unlock_board/keymaps/vial/config.h')!.async('string');

    expect(configH).toContain('#define VIAL_UNLOCK_COMBO_ROWS { 1, 3 }');
    expect(configH).toContain('#define VIAL_UNLOCK_COMBO_COLS { 2, 4 }');
    expect(configH).toContain('#define VIAL_KEYBOARD_UID { 0x71, 0xF9, 0x44, 0x88, 0x00, 0xF8, 0xA8, 0x43 }');
  });

  it('emits nRF52840 ZMK custom board GPIO ports', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Nordic Board',
      hardware: {
        ...baseSettings.hardware,
        controllerType: 'mcu',
        mcu: 'nRF52840',
      },
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['P0.06'],
        cols: ['P1.02'],
        splitRows: [],
        splitCols: [],
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const blob = await generateZmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const boardDts = await zip.file('boards/arm/nordic_board/nordic_board.dts')!.async('string');
    const boardYaml = await zip.file('boards/arm/nordic_board/board.yml')!.async('string');
    const kconfigBoard = await zip.file('boards/arm/nordic_board/Kconfig.board')!.async('string');

    expect(kconfigBoard).toContain('select SOC_NRF52840_QIAA');
    expect(boardYaml).toContain('name: nordic_board');
    expect(boardYaml).toContain('vendor: test');
    expect(boardYaml).toContain('name: nrf52840');
    expect(boardYaml).toContain('name: zmk');
    expect(boardDts).toContain('#include <nordic/nrf52840_qiaa.dtsi>');
    expect(boardDts).toContain('&gpio0 6 (GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)');
    expect(boardDts).toContain('&gpio1 2 GPIO_ACTIVE_HIGH');
  });

  it('emits a BLE-only nRF52832 ZMK custom board for HY0020', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'HY0020 Board',
      hardware: { ...baseSettings.hardware, controllerType: 'mcu', mcu: 'HY0020' },
      matrix: { rows: 1, cols: 1 },
      pins: { rows: ['P0.06'], cols: ['P0.20'], splitRows: [], splitCols: [] },
    };
    const keys: PhysicalKey[] = [{ row: 0, col: 0, x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: '' }];

    const blob = await generateZmkZip({ settings, keys });
    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const boardDts = await zip.file('boards/arm/hy0020_board/hy0020_board.dts')!.async('string');
    const boardDefconfig = await zip.file('boards/arm/hy0020_board/hy0020_board_defconfig')!.async('string');
    const kconfigBoard = await zip.file('boards/arm/hy0020_board/Kconfig.board')!.async('string');

    expect(kconfigBoard).toContain('select SOC_NRF52832_QFAA');
    expect(boardDts).toContain('#include <nordic/nrf52832_qfaa.dtsi>');
    expect(boardDts).toContain('&gpio0 6 (GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)');
    expect(boardDts).toContain('&gpio0 20 GPIO_ACTIVE_HIGH');
    expect(boardDts).toContain('reg = <0x00000000 0x00078000>');
    expect(boardDefconfig).toContain('CONFIG_BT=y');
    expect(boardDefconfig).toContain('CONFIG_ZMK_BLE=y');
    expect(boardDefconfig).toContain('CONFIG_BUILD_OUTPUT_HEX=y');
    expect(boardDefconfig).not.toContain('CONFIG_USB=y');
  });

  it('emits ZMK split custom boards for MCU projects', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Split MCU Board',
      hardware: {
        ...baseSettings.hardware,
        controllerType: 'mcu',
        mcu: 'RP2040',
      },
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: ['GP2'],
        splitCols: ['GP3'],
      },
      features: {
        ...baseSettings.features,
        split: true,
      },
      zmk: {
        splitTransport: 'wired',
        wiredSplitDevice: '&uart0',
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        matrixSide: 'left',
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
        keymap: { 0: { action: 'tap', keycode: 'A' } },
      },
      {
        row: 0,
        col: 0,
        matrixSide: 'right',
        x: 4,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
        keymap: { 0: { action: 'tap', keycode: 'B' } },
      },
    ];

    const blob = await generateZmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const leftDts = await zip.file('boards/arm/split_mcu_board_left/split_mcu_board_left.dts')!.async('string');
    const rightDts = await zip.file('boards/arm/split_mcu_board_right/split_mcu_board_right.dts')!.async('string');
    const leftBoardYaml = await zip.file('boards/arm/split_mcu_board_left/board.yml')!.async('string');
    const rightBoardYaml = await zip.file('boards/arm/split_mcu_board_right/board.yml')!.async('string');
    const leftKconfig = await zip.file('boards/arm/split_mcu_board_left/Kconfig.defconfig')!.async('string');
    const rightKconfig = await zip.file('boards/arm/split_mcu_board_right/Kconfig.defconfig')!.async('string');
    const leftConf = await zip.file('boards/arm/split_mcu_board_left/split_mcu_board_left.conf')!.async('string');
    const keymap = await zip.file('config/split_mcu_board.keymap')!.async('string');
    const readme = await zip.file('README.md')!.async('string');
    const buildYaml = await zip.file('build.yaml')!.async('string');

    expect(leftDts).toContain('model = "Split MCU Board left"');
    expect(leftBoardYaml).toContain('name: split_mcu_board_left');
    expect(leftBoardYaml).toContain('name: rp2040');
    expect(rightBoardYaml).toContain('name: split_mcu_board_right');
    expect(rightBoardYaml).toContain('name: rp2040');
    expect(leftDts).toContain('RC(0,0) RC(0,1)');
    expect(leftDts).toContain('compatible = "zmk,wired-split"');
    expect(leftDts).toContain('device = <&uart0>;');
    expect(rightDts).toContain('model = "Split MCU Board right"');
    expect(rightDts).toContain('col-offset = <1>');
    expect(rightDts).toContain('&gpio0 2 (GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)');
    expect(rightDts).toContain('&gpio0 3 GPIO_ACTIVE_HIGH');
    expect(leftKconfig).toContain('config ZMK_SPLIT_ROLE_CENTRAL');
    expect(leftKconfig).toContain('config ZMK_SPLIT');
    expect(rightKconfig).not.toContain('config ZMK_SPLIT_ROLE_CENTRAL');
    expect(rightKconfig).toContain('config ZMK_SPLIT');
    expect(leftConf).toContain('CONFIG_ZMK_SPLIT_WIRED=y');
    expect(keymap).toContain('&kp A &kp B');
    expect(readme).toContain('- board: split_mcu_board_left');
    expect(readme).toContain('- board: split_mcu_board_right');
    expect(buildYaml).toContain('include:');
    expect(buildYaml).toContain('- board: split_mcu_board_left');
    expect(buildYaml).toContain('- board: split_mcu_board_right');
  });

  it('emits ZMK as an existing board plus shield when development board is selected', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Shield Board',
      hardware: {
        ...baseSettings.hardware,
        controllerType: 'development_board',
        mcu: 'nRF52840',
        board: 'nice_nano',
      },
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['P0.06'],
        cols: ['P1.02'],
        splitRows: [],
        splitCols: [],
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const blob = await generateZmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const shieldOverlay = await zip.file('boards/shields/shield_board/shield_board.overlay')!.async('string');
    const readme = await zip.file('README.md')!.async('string');
    const buildYaml = await zip.file('build.yaml')!.async('string');
    const zmkYml = await zip.file('boards/shields/shield_board/shield_board.zmk.yml')!.async('string');

    expect(zip.file('boards/arm/shield_board/Kconfig.board')).toBeNull();
    expect(shieldOverlay).toContain('zmk,kscan = &kscan0;');
    expect(shieldOverlay).toContain('&gpio0 6 (GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)');
    expect(shieldOverlay).toContain('&gpio1 2 GPIO_ACTIVE_HIGH');
    expect(zmkYml).toContain('requires:\n  - pro_micro');
    expect(readme).toContain('- board: nice_nano');
    expect(readme).toContain('shield: shield_board');
    expect(buildYaml).toContain('- board: nice_nano');
    expect(buildYaml).toContain('shield: shield_board');
  });

  it('emits Seeed XIAO nRF52840 ZMK shield metadata and build entry', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'XIAO Shield',
      hardware: {
        ...baseSettings.hardware,
        controllerType: 'development_board',
        mcu: 'nRF52840',
        board: 'xiao_ble',
      },
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['P0.06'],
        cols: ['P1.02'],
        splitRows: [],
        splitCols: [],
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const blob = await generateZmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const zmkYml = await zip.file('boards/shields/xiao_shield/xiao_shield.zmk.yml')!.async('string');
    const buildYaml = await zip.file('build.yaml')!.async('string');

    expect(zmkYml).toContain('requires:\n  - seeed_xiao');
    expect(buildYaml).toContain('- board: seeeduino_xiao_ble');
    expect(buildYaml).toContain('shield: xiao_shield');
  });

  it('emits ZMK encoder sensors and sensor bindings', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'ZMK Encoder Board',
      hardware: {
        ...baseSettings.hardware,
        controllerType: 'development_board',
        mcu: 'RP2040',
        board: 'kb2040',
      },
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: [],
        splitCols: [],
      },
      features: {
        ...baseSettings.features,
        backlight: true,
        encoder: true,
      },
      encoders: [{
        pinA: 'GP2',
        pinB: 'GP3',
        keymap: {
          0: {
            clockwise: { action: 'tap', keycode: 'VOLU' },
            counterClockwise: { action: 'tap', keycode: 'VOLD' },
          },
        },
      }],
    };
    const keys: PhysicalKey[] = [
      {
        kind: 'encoder',
        encoderIndex: 0,
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const blob = await generateZmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const overlay = await zip.file('boards/shields/zmk_encoder_board/zmk_encoder_board.overlay')!.async('string');
    const conf = await zip.file('boards/shields/zmk_encoder_board/zmk_encoder_board.conf')!.async('string');
    const keymap = await zip.file('config/zmk_encoder_board.keymap')!.async('string');

    expect(conf).toContain('CONFIG_EC11=y');
    expect(conf).toContain('CONFIG_EC11_TRIGGER_GLOBAL_THREAD=y');
    expect(overlay).toContain('compatible = "alps,ec11"');
    expect(overlay).toContain('a-gpios = <&gpio0 2 (GPIO_ACTIVE_HIGH | GPIO_PULL_UP)');
    expect(overlay).toContain('b-gpios = <&gpio0 3 (GPIO_ACTIVE_HIGH | GPIO_PULL_UP)');
    expect(overlay).toContain('compatible = "zmk,keymap-sensors"');
    expect(overlay).toContain('sensors = <&encoder_0>');
    expect(keymap).toContain('compatible = "zmk,behavior-sensor-rotate"');
    expect(keymap).toContain('bindings = <&kp C_VOL_UP>, <&kp C_VOL_DN>;');
    expect(keymap).toContain('sensor-bindings = <');
    expect(keymap).toContain('&smidr_encoder_0_layer_0');
  });

  it('includes ZMK backlight bindings when exporting keymaps', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'ZMK Backlight Board',
      hardware: {
        ...baseSettings.hardware,
        controllerType: 'development_board',
        mcu: 'RP2040',
        board: 'kb2040',
      },
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: [],
        splitCols: [],
      },
      features: {
        ...baseSettings.features,
        backlight: true,
        encoder: true,
      },
      encoders: [{
        pinA: 'GP2',
        pinB: 'GP3',
        keymap: {
          0: {
            clockwise: { action: 'tap', keycode: 'BL_UP' },
            counterClockwise: { action: 'tap', keycode: 'BL_DOWN' },
          },
        },
      }],
    };
    const keys: PhysicalKey[] = [
      {
        kind: 'encoder',
        encoderIndex: 0,
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const blob = await generateZmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const conf = await zip.file('boards/shields/zmk_backlight_board/zmk_backlight_board.conf')!.async('string');
    const keymap = await zip.file('config/zmk_backlight_board.keymap')!.async('string');

    expect(conf).toContain('CONFIG_ZMK_BACKLIGHT=y');
    expect(keymap).toContain('#include <dt-bindings/zmk/backlight.h>');
    expect(keymap).toContain('bindings = <&bl BL_INC>, <&bl BL_DEC>;');
  });

  it('emits ZMK split as left and right shield siblings', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Split ZMK Board',
      hardware: {
        ...baseSettings.hardware,
        controllerType: 'development_board',
        mcu: 'nRF52840',
        board: 'nice_nano',
      },
      matrix: { rows: 2, cols: 2 },
      pins: {
        rows: ['P0.06', 'P0.07'],
        cols: ['P0.08', 'P0.09'],
        splitRows: ['P1.06', 'P1.07'],
        splitCols: ['P1.08', 'P1.09'],
      },
      features: {
        ...baseSettings.features,
        split: true,
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        matrixSide: 'left',
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
        keymap: { 0: { action: 'tap', keycode: 'A' } },
      },
      {
        row: 0,
        col: 0,
        matrixSide: 'right',
        x: 5,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
        keymap: { 0: { action: 'tap', keycode: 'B' } },
      },
    ];

    const blob = await generateZmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const dtsi = await zip.file('boards/shields/split_zmk_board/split_zmk_board.dtsi')!.async('string');
    const leftOverlay = await zip.file('boards/shields/split_zmk_board/split_zmk_board_left.overlay')!.async('string');
    const rightOverlay = await zip.file('boards/shields/split_zmk_board/split_zmk_board_right.overlay')!.async('string');
    const kconfigShield = await zip.file('boards/shields/split_zmk_board/Kconfig.shield')!.async('string');
    const kconfigDefconfig = await zip.file('boards/shields/split_zmk_board/Kconfig.defconfig')!.async('string');
    const zmkYml = await zip.file('boards/shields/split_zmk_board/split_zmk_board.zmk.yml')!.async('string');
    const keymap = await zip.file('boards/shields/split_zmk_board/split_zmk_board.keymap')!.async('string');
    const readme = await zip.file('README.md')!.async('string');
    const buildYaml = await zip.file('build.yaml')!.async('string');

    expect(zip.file('config/split_zmk_board.keymap')).toBeNull();
    expect(dtsi).toContain('columns = <4>');
    expect(dtsi).toContain('rows = <2>');
    expect(dtsi).toContain('RC(0,0) RC(0,2)');
    expect(leftOverlay).toContain('#include "split_zmk_board.dtsi"');
    expect(leftOverlay).toContain('&gpio0 6 (GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)');
    expect(leftOverlay).toContain('&gpio0 8 GPIO_ACTIVE_HIGH');
    expect(rightOverlay).toContain('col-offset = <2>');
    expect(rightOverlay).toContain('&gpio1 6 (GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)');
    expect(rightOverlay).toContain('&gpio1 8 GPIO_ACTIVE_HIGH');
    expect(kconfigShield).toContain('config SHIELD_SPLIT_ZMK_BOARD_LEFT');
    expect(kconfigShield).toContain('config SHIELD_SPLIT_ZMK_BOARD_RIGHT');
    expect(kconfigDefconfig).toContain('config ZMK_SPLIT_ROLE_CENTRAL');
    expect(kconfigDefconfig).toContain('config ZMK_SPLIT');
    expect(zmkYml).toContain('siblings:');
    expect(zmkYml).toContain('requires:\n  - pro_micro');
    expect(zmkYml).toContain('  - split_zmk_board_left');
    expect(zmkYml).toContain('  - split_zmk_board_right');
    expect(keymap).toContain('&kp A &kp B');
    expect(readme).toContain('shield: split_zmk_board_left');
    expect(readme).toContain('shield: split_zmk_board_right');
    expect(buildYaml).toContain('- board: nice_nano');
    expect(buildYaml).toContain('shield: split_zmk_board_left');
    expect(buildYaml).toContain('shield: split_zmk_board_right');
  });

  it('uses the selected ZMK development board target during split source export', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Nice Nano Split',
      hardware: {
        ...baseSettings.hardware,
        controllerType: 'development_board',
        mcu: 'atmega32u4',
        board: 'nice_nano',
      },
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['P0.06'],
        cols: ['P0.08'],
        splitRows: ['P1.06'],
        splitCols: ['P1.08'],
      },
      features: {
        ...baseSettings.features,
        split: true,
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        matrixSide: 'left',
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const blob = await generateZmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const readme = await zip.file('README.md')!.async('string');

    expect(readme).toContain('- board: nice_nano');
    expect(readme).toContain('shield: nice_nano_split_left');
    expect(readme).toContain('shield: nice_nano_split_right');
  });

  it('enables ZMK split encoder sensors on their assigned half', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Split ZMK Encoder',
      hardware: {
        ...baseSettings.hardware,
        controllerType: 'development_board',
        mcu: 'nRF52840',
        board: 'nice_nano',
      },
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['P0.06'],
        cols: ['P0.08'],
        splitRows: ['P1.06'],
        splitCols: ['P1.08'],
      },
      features: {
        ...baseSettings.features,
        encoder: true,
        split: true,
      },
      encoders: [
        {
          pinA: 'P0.10',
          pinB: 'P0.11',
          keymap: {
            0: {
              clockwise: { action: 'tap', keycode: 'PGUP' },
              counterClockwise: { action: 'tap', keycode: 'PGDN' },
            },
          },
        },
        {
          pinA: 'P1.10',
          pinB: 'P1.11',
          keymap: {
            0: {
              clockwise: { action: 'tap', keycode: 'VOLU' },
              counterClockwise: { action: 'tap', keycode: 'VOLD' },
            },
          },
        },
      ],
    };
    const keys: PhysicalKey[] = [
      {
        kind: 'encoder',
        encoderIndex: 0,
        matrixSide: 'left',
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
      {
        kind: 'encoder',
        encoderIndex: 1,
        matrixSide: 'right',
        x: 5,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
      {
        row: 0,
        col: 0,
        matrixSide: 'left',
        x: 1,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 1,
        ry: 0,
        label: '',
      },
    ];

    const blob = await generateZmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const dtsi = await zip.file('boards/shields/split_zmk_encoder/split_zmk_encoder.dtsi')!.async('string');
    const leftOverlay = await zip.file('boards/shields/split_zmk_encoder/split_zmk_encoder_left.overlay')!.async('string');
    const rightOverlay = await zip.file('boards/shields/split_zmk_encoder/split_zmk_encoder_right.overlay')!.async('string');
    const conf = await zip.file('boards/shields/split_zmk_encoder/split_zmk_encoder.conf')!.async('string');
    const keymap = await zip.file('boards/shields/split_zmk_encoder/split_zmk_encoder.keymap')!.async('string');

    expect(conf).toContain('CONFIG_EC11=y');
    expect(dtsi).toContain('encoder_0: encoder_0');
    expect(dtsi).toContain('encoder_1: encoder_1');
    expect(dtsi).toContain('sensors = <&encoder_0 &encoder_1>');
    expect(leftOverlay).toContain('&encoder_0');
    expect(leftOverlay).not.toContain('&encoder_1');
    expect(rightOverlay).toContain('&encoder_1');
    expect(rightOverlay).not.toContain('&encoder_0');
    expect(keymap).toContain('&smidr_encoder_0_layer_0 &smidr_encoder_1_layer_0');
    expect(keymap).toContain('bindings = <&kp PG_UP>, <&kp PG_DN>;');
    expect(keymap).toContain('bindings = <&kp C_VOL_UP>, <&kp C_VOL_DN>;');
  });

  it('emits ZMK wired split transport settings', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Wired ZMK Split',
      hardware: {
        ...baseSettings.hardware,
        controllerType: 'development_board',
        mcu: 'RP2040',
        board: 'kb2040',
      },
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: ['GP2'],
        splitCols: ['GP3'],
      },
      features: {
        ...baseSettings.features,
        split: true,
      },
      zmk: {
        splitTransport: 'wired',
        wiredSplitDevice: '&uart0',
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        matrixSide: 'left',
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
      {
        row: 0,
        col: 0,
        matrixSide: 'right',
        x: 4,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const blob = await generateZmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const dtsi = await zip.file('boards/shields/wired_zmk_split/wired_zmk_split.dtsi')!.async('string');
    const conf = await zip.file('boards/shields/wired_zmk_split/wired_zmk_split.conf')!.async('string');
    const readme = await zip.file('README.md')!.async('string');

    expect(dtsi).toContain('compatible = "zmk,wired-split"');
    expect(dtsi).toContain('device = <&uart0>;');
    expect(conf).toContain('CONFIG_ZMK_SPLIT_BLE=n');
    expect(conf).toContain('CONFIG_ZMK_SPLIT_WIRED=y');
    expect(readme).toContain('ZMK wired split firmware');
    expect(readme).toContain('using `&uart0`');
    expect(readme).toContain('- board: adafruit_kb2040');
    expect(readme).toContain('shield: wired_zmk_split_left');
    expect(readme).toContain('shield: wired_zmk_split_right');
  });

  it('emits ZMK tap dance behaviors from Vial-style definitions', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'ZMK Tap Dance',
      hardware: {
        ...baseSettings.hardware,
        controllerType: 'development_board',
        mcu: 'RP2040',
        board: 'kb2040',
      },
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: [],
        splitCols: [],
      },
      tapDances: [
        {
          id: 0,
          tapAction: { action: 'tap', keycode: 'ESC' },
          holdAction: { action: 'tap', keycode: 'LSFT' },
          doubleTapAction: { action: 'tap', keycode: 'CAPS' },
          tapHoldAction: { action: 'tap', keycode: 'LCTL' },
          tappingTerm: 180,
        },
      ],
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
        keymap: {
          0: { action: 'td', tapDanceId: 0 },
        },
      },
    ];

    const blob = await generateZmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keymap = await zip.file('config/zmk_tap_dance.keymap')!.async('string');

    expect(keymap).toContain('compatible = "zmk,behavior-tap-dance"');
    expect(keymap).toContain('compatible = "zmk,behavior-hold-tap"');
    expect(keymap).toContain('tapping-term-ms = <180>');
    expect(keymap).toContain('bindings = <&smidr_td_0_1_ht LSHIFT ESC>, <&smidr_td_0_2_ht LCTRL CLCK>');
    expect(keymap).toContain('&smidr_td_0');
  });

  it('emits ZMK macro behaviors from project macros', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'ZMK Macro',
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['P0.06'],
        cols: ['P0.08'],
        splitRows: [],
        splitCols: [],
      },
      hardware: {
        controllerType: 'development_board',
        mcu: 'nRF52840',
        board: 'nice_nano_v2',
        diodeDirection: 'COL2ROW',
      },
      macros: [[
        { action: 'text', text: 'Az' },
        { action: 'delay', duration: 30 },
        { action: 'tap', keycodes: ['ENT'] },
      ]],
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
        keymap: {
          0: { action: 'macro', macroId: 0 },
        },
      },
    ];

    const blob = await generateZmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keymap = await zip.file('config/zmk_macro.keymap')!.async('string');

    expect(keymap).toContain('compatible = "zmk,behavior-macro"');
    expect(keymap).toContain('smidr_macro_0: smidr_macro_0');
    expect(keymap).toContain('&macro_press &kp LSHIFT');
    expect(keymap).toContain('&macro_wait_time 30');
    expect(keymap).toContain('&macro_tap &kp RET');
    expect(keymap).toContain('&smidr_macro_0');
  });

  it('emits ZMK combos from project combos', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'ZMK Combo',
      matrix: { rows: 1, cols: 2 },
      pins: {
        rows: ['P0.06'],
        cols: ['P0.08', 'P0.09'],
        splitRows: [],
        splitCols: [],
      },
      hardware: {
        controllerType: 'development_board',
        mcu: 'nRF52840',
        board: 'nice_nano_v2',
        diodeDirection: 'COL2ROW',
      },
      combos: [{
        inputs: [{ action: 'tap', keycode: 'A' }, { action: 'tap', keycode: 'B' }],
        output: { action: 'tap', keycode: 'ESC' },
      }],
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
        keymap: { 0: { action: 'tap', keycode: 'A' } },
      },
      {
        row: 0,
        col: 1,
        x: 1,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
        keymap: { 0: { action: 'tap', keycode: 'B' } },
      },
    ];

    const blob = await generateZmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keymap = await zip.file('config/zmk_combo.keymap')!.async('string');

    expect(keymap).toContain('compatible = "zmk,combos"');
    expect(keymap).toContain('key-positions = <0 1>');
    expect(keymap).toContain('bindings = <&kp ESC>');
  });

  it('maps shared development board selections to ZMK board ids', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Shared Board',
      hardware: {
        ...baseSettings.hardware,
        controllerType: 'development_board',
        mcu: 'RP2040',
        board: 'kb2040',
      },
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: [],
        splitCols: [],
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const blob = await generateZmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const readme = await zip.file('README.md')!.async('string');

    expect(readme).toContain('- board: adafruit_kb2040');
    expect(readme).toContain('shield: shared_board');
  });

  it('exports a PMW3610 ZMK module, configuration, and Nordic overlay', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Trackball Board',
      hardware: { ...baseSettings.hardware, controllerType: 'development_board', mcu: 'nrf52840', board: 'nice_nano_v2' },
      matrix: { rows: 1, cols: 1 },
      pins: { rows: ['P0.02'], cols: ['P0.03'], splitRows: [], splitCols: [] },
      trackballs: [{ id: 'trackball-1', sclk: 'P0.05', sdio: 'P0.06', cs: 'P0.07', motion: 'P0.08', cpi: 1400, swapXy: true, invertY: true }],
    };
    const keys: PhysicalKey[] = [
      { row: 0, col: 0, x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: '' },
      { kind: 'trackball', trackballId: 'trackball-1', x: 1, y: 0, w: 1, h: 1, r: 0, rx: 1, ry: 0, label: '' },
    ];
    const blob = await generateZmkZip({ settings, keys });
    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const west = await zip.file('config/west.yml')!.async('string');
    const conf = await zip.file('boards/shields/trackball_board/trackball_board.conf')!.async('string');
    const overlay = await zip.file('boards/shields/trackball_board/trackball_board.overlay')!.async('string');
    expect(west).toContain('zmk-pmw3610-driver');
    expect(conf).toContain('CONFIG_PMW3610_ALT=y');
    expect(overlay).toContain('compatible = "pixart,pmw3610-alt"');
    expect(overlay).toContain('cpi = <1400>');
    expect(overlay).toContain('swap-xy;');
    expect(overlay).toContain('invert-y;');
    expect(overlay.indexOf('};\n&pinctrl {')).toBeGreaterThan(-1);
    expect(overlay.indexOf('&pinctrl {')).toBeLessThan(overlay.indexOf('&spi0 {'));
  });

  it('exports RMK keyboard.toml and Vial layout data', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'RMK Board',
      matrix: { rows: 2, cols: 2 },
      pins: {
        rows: ['GP0', 'GP1'],
        cols: ['GP2', 'GP3'],
        splitRows: [],
        splitCols: [],
      },
      layers: 2,
    };
    const keys: PhysicalKey[] = [
      { row: 0, col: 0, x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'A', keymap: { 0: { action: 'tap', keycode: 'A' }, 1: { action: 'mo', layerId: 0 } } },
      { row: 0, col: 1, x: 1, y: 0, w: 1, h: 1, r: 0, rx: 1, ry: 0, label: 'B', keymap: { 0: { action: 'lt', layerId: 1, tapAction: { action: 'tap', keycode: 'SPC' } } } },
      { row: 1, col: 0, x: 0, y: 1, w: 1, h: 1, r: 0, rx: 0, ry: 1, label: 'C', keymap: { 0: { action: 'mt', modifiers: ['LCTL'], tapAction: { action: 'tap', keycode: 'ESC' } } } },
      { row: 1, col: 1, x: 1, y: 1, w: 1, h: 1, r: 0, rx: 1, ry: 1, label: 'D', keymap: { 0: { action: 'tap', keycode: 'B', mods: ['LSFT'] } } },
    ];

    const blob = await generateRmkZip({ settings, keys });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const toml = await zip.file('keyboard.toml')!.async('string');
    const vialJson = await zip.file('vial.json')!.async('string');

    expect(zip.file('Cargo.toml')).toBeTruthy();
    expect(zip.file('README.md')).toBeTruthy();
    expect(toml).toContain('[keyboard]');
    expect(toml).toContain('chip = "rp2040"');
    expect(toml).toContain('row_pins = ["PIN_0", "PIN_1"]');
    expect(toml).toContain('col_pins = ["PIN_2", "PIN_3"]');
    expect(toml).not.toContain('matrix_map');
    expect(toml).not.toContain('[[layer]]');
    expect(toml).toContain('keymap = [');
    expect(toml).toContain('["A", "LT(1, Space)"]');
    expect(toml).toContain('["MT(Escape, LCtrl)", "WM(B, LShift)"]');
    expect(toml).toContain('["MO(0)", "_"]');
    expect(JSON.parse(vialJson).name).toBe('RMK Board');
  });

  it('exports RMK direct pin matrix pins', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'RMK Direct',
      matrix: { rows: 1, cols: 2, wiring: 'direct' },
    };
    const keys: PhysicalKey[] = [
      { row: 0, col: 0, directPin: 'P0.06', x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'A' },
      { row: 0, col: 1, directPin: 'P1.02', x: 1, y: 0, w: 1, h: 1, r: 0, rx: 1, ry: 0, label: 'B' },
    ];

    const blob = await generateRmkZip({ settings, keys });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const toml = await zip.file('keyboard.toml')!.async('string');

    expect(toml).toContain('matrix_type = "direct_pin"');
    expect(toml).toContain('["P0_06", "P1_02"]');
  });

  it('uses only active layout option keys for RMK firmware output and validation', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'RMK Options',
      matrix: { rows: 1, cols: 2 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1', 'GP2'],
        splitRows: [],
        splitCols: [],
      },
      layoutOptions: {
        thumb: {
          name: 'Thumb',
          type: 'toggle',
        },
      },
      activeOptions: {
        thumb: 1,
      },
    };
    const keys: PhysicalKey[] = [
      { row: 0, col: 0, x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'A', keymap: { 0: { action: 'tap', keycode: 'A' } } },
      { row: 0, col: 1, x: 1, y: 0, w: 1, h: 1, r: 0, rx: 1, ry: 0, label: 'Old', group: 'thumb', option: 0, keymap: { 0: { action: 'tap', keycode: 'F13' } } },
      { row: 0, col: 1, x: 1, y: 0, w: 1, h: 1, r: 0, rx: 1, ry: 0, label: 'New', group: 'thumb', option: 1, keymap: { 0: { action: 'tap', keycode: 'F14' } } },
    ];

    const issues = validateFirmwareExport(settings, keys, 'rmk');
    expect(issues.some(issue => issue.code === 'matrix-position-duplicates')).toBe(false);

    const blob = await generateRmkZip({ settings, keys });
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const toml = await zip.file('keyboard.toml')!.async('string');

    expect(toml).toContain('["A", "F14"]');
    expect(toml).not.toContain('F13');
  });

  it('warns that RMK TOML export cannot represent bidirectional matrix pin overlap', () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      matrix: { rows: 2, cols: 2 },
      pins: {
        rows: ['GP0', 'GP1'],
        cols: ['GP1', 'GP2'],
        splitRows: [],
        splitCols: [],
      },
    };
    const keys: PhysicalKey[] = [
      { row: 0, col: 0, x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: '' },
    ];

    const issues = validateFirmwareExport(settings, keys, 'rmk');

    expect(issues).toContainEqual(expect.objectContaining({
      severity: 'warning',
      code: 'rmk-bidirectional-matrix-not-represented',
      message: 'RMK TOML export cannot represent bidirectional matrix yet. Use Rust API or change wiring.',
    }));
  });

  it('uses only active layout option keys for QMK and Vial firmware source output and validation', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Option Source',
      matrix: { rows: 1, cols: 2 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1', 'GP2'],
        splitRows: [],
        splitCols: [],
      },
      layoutOptions: {
        thumb: {
          name: 'Thumb',
          type: 'toggle',
        },
      },
      activeOptions: {
        thumb: 1,
      },
    };
    const keys: PhysicalKey[] = [
      { row: 0, col: 0, x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'A', keymap: { 0: { action: 'tap', keycode: 'A' } } },
      { row: 0, col: 1, x: 1, y: 0, w: 1, h: 1, r: 0, rx: 1, ry: 0, label: 'Old', group: 'thumb', option: 0, keymap: { 0: { action: 'tap', keycode: 'F13' } } },
      { row: 0, col: 1, x: 1, y: 0, w: 1, h: 1, r: 0, rx: 1, ry: 0, label: 'New', group: 'thumb', option: 1, keymap: { 0: { action: 'tap', keycode: 'F14' } } },
    ];

    expect(validateFirmwareExport(settings, keys, 'qmk').some(issue => issue.code === 'matrix-position-duplicates')).toBe(false);
    expect(validateFirmwareExport(settings, keys, 'vial').some(issue => issue.code === 'matrix-position-duplicates')).toBe(false);

    const qmkBlob = await generateQmkZip({ settings, keys });
    expect(qmkBlob).toBeTruthy();
    const qmkZip = await JSZip.loadAsync(await qmkBlob!.arrayBuffer());
    const qmkKeymap = await qmkZip.file('option_source/keymaps/via/keymap.c')!.async('string');
    const qmkKeyboardJson = JSON.parse(await qmkZip.file('option_source/keyboard.json')!.async('string'));

    expect(qmkKeymap).toContain('KC_F14');
    expect(qmkKeymap).not.toContain('KC_F13');
    expect(qmkKeyboardJson.layouts.LAYOUT.layout).toHaveLength(2);

    const vialBlob = await generateVialZip({ settings, keys });
    expect(vialBlob).toBeTruthy();
    const vialZip = await JSZip.loadAsync(await vialBlob!.arrayBuffer());
    const vialKeymap = await vialZip.file('option_source/keymaps/vial/keymap.c')!.async('string');
    const vialJson = JSON.parse(await vialZip.file('option_source/keymaps/vial/vial.json')!.async('string'));

    expect(vialKeymap).toContain('KC_F14');
    expect(vialKeymap).not.toContain('KC_F13');
    expect(vialJson.layouts.keymap.flat().join('\n')).toContain('0,1');
  });
});
