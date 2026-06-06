/** 微信小程序 WXWebAssembly 全局类型声明 */
declare namespace WXWebAssembly {
  function instantiate(
    source: string | ArrayBuffer,
    imports?: Record<string, unknown>
  ): Promise<{ instance: { exports: Record<string, unknown> } }>;

  class Instance {
    readonly exports: Record<string, unknown>;
    constructor(module: Module, imports?: Record<string, unknown>);
  }

  class Module {
    constructor(bytes: ArrayBuffer);
  }
}

declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
