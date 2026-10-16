import * as vscode from 'vscode';
import { PixelEditorProvider } from './pixelEditorProvider';

export function activate(context: vscode.ExtensionContext): void {
  const provider = new PixelEditorProvider(context);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider('pixelEditor.icoFile', provider, {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: false,
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('pixelEditor.newFile', async () => {
      const uri = await vscode.window.showSaveDialog({
        filters: { 'ICO': ['ico'], 'CUR': ['cur'], 'GIF': ['gif'], 'PNG': ['png'], 'WebP': ['webp'] },
        title: 'Create New Pixel File',
      });
      if (uri) {
        await vscode.workspace.fs.writeFile(uri, createBlankIco());
        await vscode.commands.executeCommand('vscode.openWith', uri, 'pixelEditor.icoFile');
      }
    })
  );
}

function createBlankIco(): Uint8Array {
  const w = 16, h = 16, dib = 40, pxSz = w * h * 4;
  const andRow = Math.ceil(w / 32) * 4;
  const imgSz = dib + pxSz + andRow * h;
  const buf = new Uint8Array(6 + 16 + imgSz);
  const v = new DataView(buf.buffer);
  v.setUint16(2,1,true); v.setUint16(4,1,true);
  v.setUint8(6,w); v.setUint8(7,h);
  v.setUint16(10,1,true); v.setUint16(12,32,true);
  v.setUint32(14,imgSz,true); v.setUint32(18,22,true);
  const o=22;
  v.setUint32(o,dib,true); v.setInt32(o+4,w,true); v.setInt32(o+8,h*2,true);
  v.setUint16(o+12,1,true); v.setUint16(o+14,32,true); v.setUint32(o+20,pxSz,true);
  return buf;
}

export function deactivate(): void {}
