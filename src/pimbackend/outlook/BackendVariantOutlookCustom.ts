import { Ok, Result } from 'oxide.ts';
import { BackendSetting, IBackendVariant, IBackendVariantDescriptor } from '../IBackendVariant';
import {
  AssemblyDescriptor,
  AssemblyPathLocation,
  IBackendParametersOutlook,
} from './IBackendParametersOutlook';
import path from 'path';

export class BackendVariantOutlookCustomDescriptor implements IBackendVariantDescriptor<BackendVariantOutlookCustom> {
  getName(): string {
    return 'Custom Outlook Settings';
  }

  createInstance(): BackendVariantOutlookCustom {
    return new BackendVariantOutlookCustom();
  }
}

export class BackendVariantOutlookCustom implements IBackendVariant, IBackendParametersOutlook {
  // TODO: Also allow sub maps to group multiple attributes in UI sections.
  private officeDllVersion: BackendSetting<string> = {
    key: 'Microsoft.Office.Core: Version',
    value: 'MS Office Version',
  };

  private officeDllPath: BackendSetting<string> = {
    key: 'Microsoft.Office.Core: DLL Path',
    value: 'MS Office DLL Path (OFFICE.DLL)',
  };

  private officeDllPublicKeyToken: BackendSetting<string> = {
    key: 'Microsoft.Office.Core: PublicKeyToken',
    value: 'Public Key Token',
  };

  private outlookInteropDllVersion: BackendSetting<string> = {
    key: 'Microsoft.Office.Interop.Outlook: Version',
    value: 'Outlook Interop Version',
  };
  private outlookInteropDllPath: BackendSetting<string> = {
    key: 'Microsoft.Office.Interop.Outlook: DLL Path',
    value: 'Outlook Interop DLL Path',
  };

  private outlookInteropDllPublicKeyToken: BackendSetting<string> = {
    key: 'Microsoft.Office.Interop.Outlook: PublicKeyToken',
    value: 'Public Key Token',
  };

  static getName(): string {
    return 'Custom';
  }

  getSettings(): BackendSetting<any>[] {
    return [
      this.officeDllVersion,
      this.officeDllPath,
      this.officeDllPublicKeyToken,
      this.outlookInteropDllVersion,
      this.outlookInteropDllPath,
      this.outlookInteropDllPublicKeyToken,
    ];
  }

  getOfficeDllDescriptor(): AssemblyDescriptor {
    return {
      name: 'Microsoft.Office.Core',
      path: path.parse(this.officeDllPath.value).dir,
      filePath: path.parse(this.officeDllPath.value).base,
      pathLocationType: AssemblyPathLocation.Absolute,
      assemblyVersion: this.officeDllVersion.value,
      fileVersion: this.officeDllVersion.value,
      publicKeyToken: this.officeDllPublicKeyToken.value,
    };
  }

  getOfficeInteropDllDescriptor(): AssemblyDescriptor {
    return {
      name: 'Microsoft.Office.Interop.Outlook',
      path: path.parse(this.outlookInteropDllPath.value).dir,
      filePath: path.parse(this.outlookInteropDllPath.value).base,
      pathLocationType: AssemblyPathLocation.Absolute,
      assemblyVersion: this.outlookInteropDllVersion.value,
      fileVersion: this.outlookInteropDllVersion.value,
      publicKeyToken: this.outlookInteropDllPublicKeyToken.value,
    };
  }

  onSelectVariant(): Result<void, string> {
    return Ok(undefined);
  }
}
