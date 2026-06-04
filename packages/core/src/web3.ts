export interface WalletAdapter {
  connect(): Promise<string>;
  signMessage(msg: Uint8Array): Promise<Uint8Array>;
  disconnect(): Promise<void>;
}

export interface ChainAdapter {
  wallet: WalletAdapter;
  submitRose(content: string, color: string): Promise<string>;
}
