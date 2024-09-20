import { IBackendVariant } from '../IBackendVariant';
import { AssemblyDescriptor, IBackendParametersOutlook } from './IBackendParametersOutlook';

export interface IBackendVariantOutlookParameters
  extends IBackendVariant, IBackendParametersOutlook {
  getOfficeDllDescriptor(): AssemblyDescriptor;

  getOfficeInteropDllDescriptor(): AssemblyDescriptor;
}
