export interface IBackendParametersOutlook {
  getOfficeDllDescriptor(): AssemblyDescriptor;

  getOfficeInteropDllDescriptor(): AssemblyDescriptor;
}

export type AssemblyDescriptor = {
  name: string;
  path: string;
  filePath: string;
  pathLocationType: AssemblyPathLocation;
  assemblyVersion?: string;
  fileVersion?: string;
  publicKeyToken?: string;
};

export enum AssemblyPathLocation {
  Absolute = 'Absolute',
  Plugin = 'Plugin',
  GAC = 'GAC',
}
