import { KEYCODES, Keycode } from './keycodes';

export type VisualLayoutId =
  | 'qwerty-us'
  | 'qwerty-jp'
  | 'qwerty-kr'
  | 'qwerty-uk'
  | 'qwerty-es'
  | 'qwertz-de'
  | 'azerty-fr'
  | 'qwerty-nordic';

export interface VisualLayout {
  id: VisualLayoutId;
  name: string;
  shortName: string;
  description: string;
  legendOverrides: Record<string, string>;
}

const LETTERS_KR: Record<string, string> = {
  Q: 'Q\nㅂ',
  W: 'W\nㅈ',
  E: 'E\nㄷ',
  R: 'R\nㄱ',
  T: 'T\nㅅ',
  Y: 'Y\nㅛ',
  U: 'U\nㅕ',
  I: 'I\nㅑ',
  O: 'O\nㅐ',
  P: 'P\nㅔ',
  A: 'A\nㅁ',
  S: 'S\nㄴ',
  D: 'D\nㅇ',
  F: 'F\nㄹ',
  G: 'G\nㅎ',
  H: 'H\nㅗ',
  J: 'J\nㅓ',
  K: 'K\nㅏ',
  L: 'L\nㅣ',
  Z: 'Z\nㅋ',
  X: 'X\nㅌ',
  C: 'C\nㅊ',
  V: 'V\nㅍ',
  B: 'B\nㅠ',
  N: 'N\nㅜ',
  M: 'M\nㅡ',
};

export const VISUAL_LAYOUTS: VisualLayout[] = [
  {
    id: 'qwerty-us',
    name: 'QWERTY US',
    shortName: 'US',
    description: 'ANSI US visual legends',
    legendOverrides: {},
  },
  {
    id: 'qwerty-jp',
    name: 'QWERTY JP',
    shortName: 'JP',
    description: 'Japanese JIS visual legends',
    legendOverrides: {
      GRV: '半/全',
      '1': '!\n1',
      '2': '"\n2',
      '3': '#\n3',
      '4': '$\n4',
      '5': '%\n5',
      '6': '&\n6',
      '7': "'\n7",
      '8': '(\n8',
      '9': ')\n9',
      '0': '0',
      MINS: '=\n-',
      EQL: '~\n^',
      YEN: '|\n¥',
      LBRC: '`\n@',
      RBRC: '{\n[',
      BSLS: '}\n]',
      SCLN: '+\n;',
      QUOT: '*\n:',
      NUHS: '}\n]',
      COMM: '<\n,',
      DOT: '>\n.',
      SLSH: '?\n/',
      RO: '_\n\\',
      NUBS: '\\',
      MHEN: '無変換',
      HENK: '変換',
      KANA: 'かな',
      EISU: '英数',
    },
  },
  {
    id: 'qwerty-kr',
    name: 'QWERTY KR',
    shortName: 'KR',
    description: 'Korean 2-set visual legends',
    legendOverrides: {
      ...LETTERS_KR,
      HENK: '한/영',
      KANA: '한자',
      EISU: '한/영',
    },
  },
  {
    id: 'qwerty-uk',
    name: 'QWERTY UK',
    shortName: 'UK',
    description: 'United Kingdom visual legends',
    legendOverrides: {
      '2': '"\n2',
      '3': '£\n3',
      QUOT: '@\n\'',
      NUHS: '~\n#',
      NUBS: '|\n\\',
    },
  },
  {
    id: 'qwerty-es',
    name: 'QWERTY ES',
    shortName: 'ES',
    description: 'Spanish ISO visual legends',
    legendOverrides: {
      GRV: 'ª\nº',
      '1': '!\n1',
      '2': '"\n2',
      '3': '·\n3',
      '4': '$\n4',
      '5': '%\n5',
      '6': '&\n6',
      '7': '/\n7',
      '8': '(\n8',
      '9': ')\n9',
      '0': '=\n0',
      MINS: '?\n\'',
      EQL: '¿\n¡',
      LBRC: '^\n`',
      RBRC: '*\n+',
      BSLS: 'Ç',
      SCLN: 'Ñ',
      QUOT: '¨\n´',
      COMM: ';\n,',
      DOT: ':\n.',
      SLSH: '_\n-',
      NUBS: '>\n<',
    },
  },
  {
    id: 'qwertz-de',
    name: 'QWERTZ DE',
    shortName: 'DE',
    description: 'German QWERTZ visual legends',
    legendOverrides: {
      Y: 'Z',
      Z: 'Y',
      '2': '"\n2',
      '3': '§\n3',
      '6': '&\n6',
      '7': '/\n7',
      '8': '(\n8',
      '9': ')\n9',
      '0': '=\n0',
      MINS: '?\nß',
      EQL: '`\n´',
      LBRC: 'Ü',
      RBRC: '*\n+',
      BSLS: "'\n#",
      SCLN: 'Ö',
      QUOT: 'Ä',
      COMM: ';\n,',
      DOT: ':\n.',
      SLSH: '_\n-',
      NUBS: '>\n<',
    },
  },
  {
    id: 'azerty-fr',
    name: 'AZERTY FR',
    shortName: 'FR',
    description: 'French AZERTY visual legends',
    legendOverrides: {
      Q: 'A',
      W: 'Z',
      A: 'Q',
      Z: 'W',
      M: ';\nM',
      '1': '1\n&',
      '2': '2\né',
      '3': '3\n"',
      '4': '4\n\'',
      '5': '5\n(',
      '6': '6\n-',
      '7': '7\nè',
      '8': '8\n_',
      '9': '9\nç',
      '0': '0\nà',
      MINS: '°\n)',
      EQL: '+\n=',
      LBRC: '¨\n^',
      RBRC: '£\n$',
      BSLS: 'µ\n*',
      SCLN: 'M',
      QUOT: '%\nù',
      COMM: '?\n,',
      DOT: '.\n;',
      SLSH: '/\n:',
      NUBS: '>\n<',
    },
  },
  {
    id: 'qwerty-nordic',
    name: 'QWERTY Nordic',
    shortName: 'NO',
    description: 'Nordic visual legends',
    legendOverrides: {
      '2': '"\n2',
      '3': '#\n3',
      '4': '¤\n4',
      '6': '&\n6',
      '7': '/\n7',
      '8': '(\n8',
      '9': ')\n9',
      '0': '=\n0',
      MINS: '?\n+',
      EQL: '`\n´',
      LBRC: 'Å',
      RBRC: '^\n¨',
      BSLS: '*\n\'',
      SCLN: 'Ø',
      QUOT: 'Æ',
      COMM: ';\n,',
      DOT: ':\n.',
      SLSH: '_\n-',
      NUBS: '>\n<',
    },
  },
];

const VISUAL_LAYOUT_BY_ID = new Map(VISUAL_LAYOUTS.map(layout => [layout.id, layout]));

export const DEFAULT_VISUAL_LAYOUT: VisualLayoutId = 'qwerty-us';

export const normalizeVisualLayout = (layout: unknown): VisualLayoutId => (
  typeof layout === 'string' && VISUAL_LAYOUT_BY_ID.has(layout as VisualLayoutId)
    ? layout as VisualLayoutId
    : DEFAULT_VISUAL_LAYOUT
);

export const getVisualLayout = (layout: unknown): VisualLayout => {
  return VISUAL_LAYOUT_BY_ID.get(normalizeVisualLayout(layout)) || VISUAL_LAYOUTS[0];
};

export const getKeycodeLegend = (code: string, layout: unknown): string => {
  const visualLayout = getVisualLayout(layout);
  const override = visualLayout.legendOverrides[code];
  if (override !== undefined) return override;
  return KEYCODES.find(kc => kc.code === code)?.label || code;
};

export const applyVisualLayoutToKeycode = (keycode: Keycode, layout: unknown): Keycode => ({
  ...keycode,
  label: getKeycodeLegend(keycode.code, layout),
});
