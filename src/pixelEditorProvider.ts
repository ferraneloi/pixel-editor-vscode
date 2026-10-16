import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface WebviewMessage {
  type: 'ready' | 'save' | 'error';
  data?: number[];
  message?: string;
}

export class PixelEditorProvider implements vscode.CustomEditorProvider<vscode.CustomDocument> {
  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<vscode.CustomDocument>>();
  readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  openCustomDocument(uri: vscode.Uri, _ctx: vscode.CustomDocumentOpenContext, _token: vscode.CancellationToken): vscode.CustomDocument {
    return { uri, dispose: () => {} };
  }

  async saveCustomDocument(document: vscode.CustomDocument, _cancellation: vscode.CancellationToken): Promise<void> {
    // Save is handled via webview messages; no-op here.
  }

  async saveCustomDocumentAs(document: vscode.CustomDocument, destination: vscode.Uri, _cancellation: vscode.CancellationToken): Promise<void> {
    const data = await vscode.workspace.fs.readFile(document.uri);
    await vscode.workspace.fs.writeFile(destination, data);
  }

  async revertCustomDocument(_document: vscode.CustomDocument, _cancellation: vscode.CancellationToken): Promise<void> {
    // No dirty tracking needed.
  }

  async backupCustomDocument(document: vscode.CustomDocument, context: vscode.CustomDocumentBackupContext, _cancellation: vscode.CancellationToken): Promise<vscode.CustomDocumentBackup> {
    const data = await vscode.workspace.fs.readFile(document.uri);
    await vscode.workspace.fs.writeFile(context.destination, data);
    return { id: context.destination.toString(), delete: async () => { try { await vscode.workspace.fs.delete(context.destination); } catch {} } };
  }

  async resolveCustomEditor(document: vscode.CustomDocument, webviewPanel: vscode.WebviewPanel, _token: vscode.CancellationToken): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'src')],
    };
    webviewPanel.webview.html = fs.readFileSync(path.join(this.context.extensionPath, 'src', 'editor.html'), 'utf8');

    const sendFile = async (): Promise<void> => {
      try {
        const data = await vscode.workspace.fs.readFile(document.uri);
        await webviewPanel.webview.postMessage({ type: 'load', data: Array.from(data), fileName: path.basename(document.uri.fsPath) });
      } catch (err) {
        vscode.window.showErrorMessage(`Pixel Editor: ${err instanceof Error ? err.message : String(err)}`);
      }
    };

    webviewPanel.webview.onDidReceiveMessage(async (msg: WebviewMessage) => {
      switch (msg.type) {
        case 'ready': await sendFile(); break;
        case 'save':
          if (!msg.data) break;
          await vscode.workspace.fs.writeFile(document.uri, new Uint8Array(msg.data));
          vscode.window.showInformationMessage(`${path.extname(document.uri.fsPath).toUpperCase().slice(1)} saved!`);
          break;
        case 'error':
          vscode.window.showErrorMessage(`Pixel Editor: ${msg.message ?? 'Unknown error'}`);
          break;
      }
    });
  }
}

