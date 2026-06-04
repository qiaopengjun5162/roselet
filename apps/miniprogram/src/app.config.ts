export default defineAppConfig({
  pages: [
    'pages/garden/index',
    'pages/plant/index',
    'pages/oscilloscope/index',
    'pages/index/index',
    'pages/login/index',
    'pages/rose/index',
  ],
  window: {
    navigationBarBackgroundColor: "#1a1030",
    navigationBarTextStyle: "white",
    navigationBarTitleText: "Roselet",
    backgroundColor: "#0a0b14",
  },
  tabBar: {
    color: "#64748b",
    selectedColor: "#f43f5e",
    backgroundColor: "#1a1030",
    borderStyle: "black",
    list: [
      {
        pagePath: "pages/garden/index",
        text: "花圃",
        iconPath: "assets/tab-garden.png",
        selectedIconPath: "assets/tab-garden-active.png",
      },
      {
        pagePath: "pages/plant/index",
        text: "种花",
        iconPath: "assets/tab-plant.png",
        selectedIconPath: "assets/tab-plant-active.png",
      },
      {
        pagePath: "pages/index/index",
        text: "首页",
        iconPath: "assets/tab-home.png",
        selectedIconPath: "assets/tab-home-active.png",
      },
    ],
  },
});
