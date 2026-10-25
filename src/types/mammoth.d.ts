declare module 'mammoth' {
  export interface RawTextResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }

  export function extractRawText(input: { arrayBuffer: ArrayBuffer } | { buffer: Buffer } | { path: string }): Promise<RawTextResult>;
}
