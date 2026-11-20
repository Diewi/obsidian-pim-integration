import { Ok, Result } from 'oxide.ts';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BackendTypeOutlook } from '../src/pimbackend/outlook/BackendTypeOutlook';
import { OutlookNativeExecutorFactory } from '../src/pimbackend/outlook/BackendOutlookNativeExecutorFactory';
import { IBackendVariantOutlookParameters } from '../src/pimbackend/outlook/IBackendVariantOutlookParameters';
import { AssemblyPathLocation } from '../src/pimbackend/outlook/IBackendParametersOutlook';

const TEMPLATE_DIR = path.resolve(__dirname, 'BackendOutlookDepsJsonGenerator', 'template');

const variant: IBackendVariantOutlookParameters = {
  getSettings: () => [],
  onSelectVariant: () => Ok(undefined),
  getOfficeDllDescriptor: () => ({
    name: 'MicrosoftOfficeCore',
    path: 'office',
    filePath: 'OFFICE.DLL',
    pathLocationType: AssemblyPathLocation.GAC,
    assemblyVersion: '15.0.0.0',
    fileVersion: '15.0.0.0',
    publicKeyToken: '71e9bce111e9429c',
  }),
  getOfficeInteropDllDescriptor: () => ({
    name: 'Microsoft.Office.Interop.Outlook',
    path: 'Microsoft.Office.Interop.Outlook',
    filePath: 'Microsoft.Office.Interop.Outlook.dll',
    pathLocationType: AssemblyPathLocation.GAC,
    assemblyVersion: '15.0.0.0',
    fileVersion: '15.0.0.0',
    publicKeyToken: '71e9bce111e9429c',
  }),
};

/** Plugin dir with deps.json/runtimeconfig templates, optionally with the electron-edge-js files. */
function createPluginDir(withElectronEdge: boolean): string {
  const pluginDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backend-type-outlook-test-'));
  const bridgeDir = path.join(pluginDir, 'outlookcombridge');
  fs.mkdirSync(path.join(bridgeDir, 'templates'), { recursive: true });
  for (const file of ['OutlookComBridge.deps.json', 'OutlookComBridge.runtimeconfig.json']) {
    fs.copyFileSync(path.join(TEMPLATE_DIR, file), path.join(bridgeDir, 'templates', file));
  }
  if (withElectronEdge) {
    fs.cpSync(path.join(TEMPLATE_DIR, 'electron-edge-js'), path.join(bridgeDir, 'electron-edge-js'), {
      recursive: true,
    });
  }
  return pluginDir;
}

function readGeneratedDepsJson(pluginDir: string): string {
  return fs.readFileSync(path.join(pluginDir, 'outlookcombridge', 'OutlookComBridge.deps.json'), 'utf8');
}

describe('BackendTypeOutlook execution mode', () => {
  const pluginDirs: string[] = [];
  const makePluginDir = (withElectronEdge: boolean) => {
    const dir = createPluginDir(withElectronEdge);
    pluginDirs.push(dir);
    return dir;
  };

  afterAll(() => {
    pluginDirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
  });

  test('defaults to cli mode outside an edge build', () => {
    expect(OutlookNativeExecutorFactory.detectBestMode()).toBe('cli');
  });

  test('cli mode generates deps.json without electron-edge-js and without EdgeJs', async () => {
    const pluginDir = makePluginDir(false);
    const backend = new BackendTypeOutlook(pluginDir);

    const result = await backend.onSelectBackendType(variant);

    expect(result.isOk()).toBe(true);
    const depsJson = readGeneratedDepsJson(pluginDir);
    expect(depsJson).not.toContain('electron-edge-js');
    expect(depsJson).not.toContain('EdgeJs');
    expect(depsJson).toContain('Microsoft.Office.Interop.Outlook');
  });

  test('edge mode adds EdgeJs to deps.json', async () => {
    const pluginDir = makePluginDir(true);
    const backend = new BackendTypeOutlook(pluginDir, 'edge');

    const result = await backend.onSelectBackendType(variant);

    expect(result.isOk()).toBe(true);
    expect(readGeneratedDepsJson(pluginDir)).toContain('electron-edge-js/lib/bootstrap');
  });

  test('edge mode fails without the electron-edge-js files', async () => {
    const pluginDir = makePluginDir(false);
    const backend = new BackendTypeOutlook(pluginDir, 'edge');

    // onSelectBackendType rejects with an Err instead of resolving to one.
    const error = await backend.onSelectBackendType(variant).then(
      () => undefined,
      (rejection: Result<void, string>) => rejection.unwrapErr()
    );
    expect(error).toContain('Edge mode needs a plugin build made with --edge');
  });
});
