export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/login/index',
    'pages/about/index',
  ],
  subPackages: [
    {
      root: 'subpkg-garden',
      pages: [
        'pages/garden/index',
        'pages/plant/index',
        'pages/rose/index',
      ],
    },
    {
      root: 'subpkg-oscilloscope',
      pages: [
        'pages/oscilloscope/index',
      ],
    },
  ],
  window: {
    navigationStyle: 'custom',
    backgroundColor: '#0a0b14',
  },
});
