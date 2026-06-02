export default {
  title: 'Smiðr Docs',
  description: 'Smiðr の日本語ユーザーガイド',
  lang: 'ja-JP',
  base: process.env.NODE_ENV === 'production' ? '/smidr/docs/' : '/',
  cleanUrls: true,
  themeConfig: {
    logo: '/assets/smidr-design-corne.png',
    siteTitle: 'Smiðr Docs',
    nav: [
      { text: 'Guide', link: '/' },
      { text: 'Smiðr', link: 'https://hringdrifi.github.io/smidr/' },
      { text: 'GitHub', link: 'https://github.com/hringdrifi/smidr' },
    ],
    sidebar: [
      {
        text: '概要',
        items: [
          { text: 'はじめに', link: '/' },
          { text: 'Smiðr でできること', link: '/overview' },
        ],
      },
      {
        text: 'Design',
        items: [
          { text: 'Design モード', link: '/design/' },
          { text: 'レイアウト編集', link: '/design/layout' },
          { text: 'マトリックス編集', link: '/design/matrix' },
          { text: 'キーマップ編集', link: '/design/keymap' },
          { text: 'ハードウェア設定', link: '/design/hardware' },
        ],
      },
      {
        text: 'Remap',
        items: [{ text: 'Remap モード', link: '/remap/' }],
      },
      {
        text: 'データ',
        items: [{ text: 'インポート / エクスポート', link: '/data/import-export' }],
      },
      {
        text: 'リファレンス',
        items: [
          { text: 'ショートカット', link: '/reference/shortcuts' },
          { text: '用語集', link: '/reference/glossary' },
        ],
      },
    ],
    outline: {
      label: 'このページ',
      level: [2, 3],
    },
    docFooter: {
      prev: '前へ',
      next: '次へ',
    },
    darkModeSwitchLabel: 'テーマ',
    sidebarMenuLabel: 'メニュー',
    returnToTopLabel: 'トップへ戻る',
    outlineTitle: 'このページ',
  },
};
