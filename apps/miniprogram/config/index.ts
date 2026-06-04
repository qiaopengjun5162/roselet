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
      chain.module.rule("ts").include.add(/packages\/core/);
      chain.plugin("mp-runtime-patch").use(webpack.BannerPlugin, [{
        banner: `var document="undefined"!==typeof global&&global.document?global.document:{baseURI:"/",currentScript:{baseURI:"/"}};if("undefined"!==typeof global){if(!global.TextEncoder){global.TextEncoder=function(){this.encode=function(e){if(!e)return new Uint8Array(0);for(var t=e.length,n=new Uint8Array(3*t),r=0,o=0;o<t;o++){var a=e.charCodeAt(o);a<128?n[r++]=a:a<2048?(n[r++]=192|a>>6,n[r++]=128|63&a):(n[r++]=224|a>>12,n[r++]=128|a>>6&63,n[r++]=128|63&a)}return n.slice(0,r)}}}if(!global.TextDecoder){global.TextDecoder=function(){this.decode=function(e){if(!e)return"";for(var t=e instanceof ArrayBuffer?new Uint8Array(e):e,n="",r=0;r<t.length;){var o=t[r];if(o<128)n+=String.fromCharCode(o),r+=1;else if(192==(224&o))n+=String.fromCharCode((31&o)<<6|63&t[r+1]),r+=2;else n+=String.fromCharCode((15&o)<<12|(63&t[r+1])<<6|63&t[r+2]),r+=3}return n}}}}`,
        raw: true,
        test: /\.js$/,
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
