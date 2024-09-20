import { BackendSetting, IBackendVariantDescriptor } from '../IBackendVariant';
import { AssemblyDescriptor, AssemblyPathLocation } from './IBackendParametersOutlook';
import { IBackendVariantOutlookParameters } from './IBackendVariantOutlookParameters';
import { Ok, Result } from 'oxide.ts';

export class BackendVariantOutlook15PlusDescriptor implements IBackendVariantDescriptor<BackendVariantOutlook15Plus> {
  getName(): string {
    return 'Outlook 15+';
  }

  createInstance(): BackendVariantOutlook15Plus {
    return new BackendVariantOutlook15Plus();
  }
}

export class BackendVariantOutlook15Plus implements IBackendVariantOutlookParameters {
  type: 'IBackendVariantOutlookParameters' = 'IBackendVariantOutlookParameters';

  /**
   * Path to the GAC_MSIL folder where Office interop assemblies are installed.
   */
  public static readonly GAC_MSIL_PATH = 'C:\\Windows\\assembly\\GAC_MSIL';

  /**
   * Path to the .NET shared framework.
   * TODO: This should be dynamically detected based on the installed .NET runtime version.
   */
  public static readonly DOTNET_SHARED_FRAMEWORK_PATH =
    'C:\\Program Files\\dotnet\\shared\\Microsoft.NETCore.App\\8.0.22';

  private officeDllDescriptor: AssemblyDescriptor = {
    name: 'MicrosoftOfficeCore',
    path: 'office',
    filePath: 'OFFICE.DLL',
    pathLocationType: AssemblyPathLocation.GAC,
    assemblyVersion: '15.0.0.0',
    fileVersion: '15.0.0.0',
    publicKeyToken: '71e9bce111e9429c',
    // Name: "office",
    // Version: "15.0.0.0",
    // Culture: "neutral",
    // PublicKeyToken: "71e9bce111e9429c",
    // Path: "C:\\Windows\\assembly\\GAC_MSIL\\office\\15.0.0.0__71e9bce111e9429c\\OFFICE.DLL"
  };

  private outlookInteropDllDescriptor: AssemblyDescriptor = {
    name: 'Microsoft.Office.Interop.Outlook',
    path: 'Microsoft.Office.Interop.Outlook',
    pathLocationType: AssemblyPathLocation.GAC,
    filePath: 'Microsoft.Office.Interop.Outlook.dll',
    assemblyVersion: '15.0.0.0',
    fileVersion: '15.0.0.0',
    publicKeyToken: '71e9bce111e9429c',
    // Name: "Microsoft.Office.Interop.Outlook",
    // Version: "15.0.0.0",
    // Culture: "neutral",
    // PublicKeyToken: "71e9bce111e9429c",
    // Path: "C:\\Windows\\assembly\\GAC_MSIL\\Microsoft.Office.Interop.Outlook\\15.0.0.0__71e9bce111e9429c\\Microsoft.Office.Interop.Outlook.dll"
  };

  static getName(): string {
    return 'Office15+';
  }

  getSettings(): BackendSetting<any>[] {
    return [];
  }

  getOfficeDllDescriptor(): AssemblyDescriptor {
    return this.officeDllDescriptor;
  }

  getOfficeInteropDllDescriptor(): AssemblyDescriptor {
    return this.outlookInteropDllDescriptor;
  }

  onSelectVariant(): Result<void, string> {
    return Ok(undefined);
  }
}
