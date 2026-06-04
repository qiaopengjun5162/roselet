import { defineConfig } from "@tarojs/cli";
import path from "path";
import webpack from "webpack";

export default defineConfig({
  projectName: "roselet-miniprogram",
  date: "2026-06-04",
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    375: 2,
    828: 1.81 / 2,
  },
  sourceRoot: "src",
  outputRoot: "dist/weapp",
  plugins: [],
  defineConstants: {},
  copy: {
    patterns: [
      {
        from: "pkg/roselet_recommend_bg.wasm",
        to: "dist/weapp/pkg/roselet_recommend_bg.wasm",
      },
    ],
    options: {},
  },
  alias: {
    "@": path.resolve(__dirname, "../src"),
  },
  cache: {
    enable: true,
  },
  framework: "react",
  compiler: "webpack5",
  mini: {
    webpackChain(chain) {
      chain.output.publicPath("").globalObject("global");
      chain.plugin("mp-runtime-patch").use(webpack.BannerPlugin, [{
        banner: 'var document = typeof global !== "undefined" && global.document ? global.document : { baseURI: "/", currentScript: { baseURI: "/" } };',
        raw: true,
        include: /\.js$/,
      }]);
    },
    postcss: {
      pxtransform: { enable: true, config: {} },
      cssModules: {
        enable: true,
        config: { namingPattern: "module", generateScopedName: "[name]__[local]___[hash:base64:5]" },
      },
    },
  },
  h5: {
    publicPath: "/",
    staticDirectory: "static",
    postcss: {
      autoprefixer: { enable: true },
      cssModules: {
        enable: true,
        config: { namingPattern: "module", generateScopedName: "[name]__[local]___[hash:base64:5]" },
      },
    },
  },
});
