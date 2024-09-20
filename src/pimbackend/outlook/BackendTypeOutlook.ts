import { Err, Ok, Result } from 'oxide.ts';
import { IContactImporterBackend } from '../../contacts/IContactImporterBackend';
import { IBackendType, IBackendTypeDescriptor } from '../IBackendType';
import { ContactImporterBackendOutlook } from './ContactImporterBackendOutlook';
import { BackendVariantOutlook15PlusDescriptor } from './BackendVariantOutlook15Plus';
import { BackendVariantOutlookCustomDescriptor } from './BackendVariantOutlookCustom';
import { IBackendVariantOutlookParameters } from './IBackendVariantOutlookParameters';
import { IBackendVariant, IBackendVariantDescriptor } from '../IBackendVariant';
import { TypeScriptUtils } from '../../utils/typeScriptUtils';
import { IContactBackend } from '../IContactBackend';
import { BackendOutlookDepsJsonGenerator } from './BackendOutlookDepsJsonGenerator';
import { EdgeJsVersionReader } from '../NativeExecutorEdgeJsVersionReader';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Default .NET installation path (duplicated here to avoid circular dependency with settings.ts).
 */
const DEFAULT_DOTNET_PATH_INTERNAL = 'C:\\Program Files\\dotnet';

export class BackendTypeOutlookDescriptor implements IBackendTypeDescriptor<IBackendVariantOutlookParameters> {
  getName(): string {
    return 'Outlook';
  }

  createInstance(pluginDir: string): BackendTypeOutlook {
    return new BackendTypeOutlook(pluginDir);
  }
}

export class BackendTypeOutlook
  implements IBackendType<IBackendVariantOutlookParameters>, IContactBackend
{
  private static readonly OUTLOOK_COM_BRIDGE_DIR = 'outlookcombridge';
  private static readonly DEPS_JSON_FILENAME = 'OutlookComBridge.deps.json';
  private static readonly RUNTIME_CONFIG_FILENAME = 'OutlookComBridge.runtimeconfig.json';

  private readonly pluginDir: string;
  private readonly outlookcombridgeDir: string;
  private dotnetPath: string = DEFAULT_DOTNET_PATH_INTERNAL;

  private selectedVariant: IBackendVariantOutlookParameters | null = null;

  constructor(pluginDir: string) {
    this.pluginDir = pluginDir;
    this.outlookcombridgeDir = pluginDir + path.sep + BackendTypeOutlook.OUTLOOK_COM_BRIDGE_DIR;
  }

  /**
   * Set the .NET runtime path for CoreCLR integration.
   * @param dotnetPath Path to the .NET runtime installation directory
   */
  setDotnetPath(dotnetPath: string): void {
    this.dotnetPath = dotnetPath || DEFAULT_DOTNET_PATH_INTERNAL;
    console.log(`[BackendTypeOutlook] .NET path set to: ${this.dotnetPath}`);
  }

  /**
   * Get the configured .NET runtime path.
   */
  getDotnetPath(): string {
    return this.dotnetPath;
  }

  getVariants(): IBackendVariantDescriptor<IBackendVariantOutlookParameters>[] {
    return [
      new BackendVariantOutlook15PlusDescriptor(),
      new BackendVariantOutlookCustomDescriptor(),
    ];
  }

  createImporter(): Result<IContactImporterBackend, string> {
    try {
      if (!this.selectedVariant) {
        return Err(
          'No backend variant selected. Please select a variant before creating an importer.'
        );
      }
      // Use CLI mode by default for reliability
      return Ok(
        new ContactImporterBackendOutlook(
          this.pluginDir,
          this.outlookcombridgeDir,
          'cli',
          false, // useJsonForCli
          this.dotnetPath
        )
      );
    } catch (error) {
      return Err(`Failed to create Contact Importer Backend: ${String(error)}`);
    }
  }

  onSelectBackendType(
    variant: IBackendVariantOutlookParameters,
    skipGeneration: boolean = false
  ): Promise<Result<void, string>> {
    const promise = new Promise<Result<void, string>>((resolve, reject) => {
      // Skip file generation during initial plugin load (when settings are being restored)
      if (skipGeneration) {
        console.log('Skipping deps.json generation during initial settings load');
        variant.onSelectVariant();
        resolve(Ok(undefined));
        return;
      }

      // Read EdgeJs descriptor from electron-edge-js package
      const edgeJsDir = fs.existsSync(this.outlookcombridgeDir + path.sep + 'electron-edge-js')
        ? 'electron-edge-js'
        : 'edge-js';
      if (!fs.existsSync(this.outlookcombridgeDir + path.sep + edgeJsDir)) {
        reject(
          Err(
            `Neither 'electron-edge-js' nor 'edge-js' directory found in ${this.outlookcombridgeDir}.`
          )
        );
        return;
      }
      const electronEdgePath = this.outlookcombridgeDir + path.sep + edgeJsDir;
      const edgeJsDescriptorResult = EdgeJsVersionReader.readEdgeJsDescriptor(electronEdgePath);
      if (edgeJsDescriptorResult.isErr()) {
        reject(Err(edgeJsDescriptorResult.unwrapErr()));
        return;
      }

      // Collect all assembly descriptors
      const assemblyDescriptors = [
        edgeJsDescriptorResult.unwrap(),
        variant.getOfficeDllDescriptor(),
        variant.getOfficeInteropDllDescriptor(),
      ];

      // Create the generator with all assembly descriptors
      const binPath = this.pluginDir + path.sep + BackendTypeOutlook.OUTLOOK_COM_BRIDGE_DIR;
      const templatePath = binPath + path.sep + 'templates';
      const depsJsonGenerator = new BackendOutlookDepsJsonGenerator(
        binPath,
        templatePath,
        BackendTypeOutlook.DEPS_JSON_FILENAME,
        BackendTypeOutlook.RUNTIME_CONFIG_FILENAME,
        assemblyDescriptors,
        this.dotnetPath
      );

      // Generate the deps.json for CoreCLR assembly resolution
      const depsResult = depsJsonGenerator.generate();
      if (depsResult.isErr()) {
        reject(Err(depsResult.unwrapErr()));
        return;
      }

      variant.onSelectVariant();
      resolve(Ok(undefined));
    });
    return Promise.resolve(promise);
  }

  selectBackendVariant(
    backendVariantDescriptor: IBackendVariantDescriptor<IBackendVariantOutlookParameters>
  ): Result<IBackendVariantOutlookParameters, string> {
    try {
      const variant = backendVariantDescriptor.createInstance();
      if (
        !TypeScriptUtils.checkTypeInList<
          IBackendVariantOutlookParameters,
          IBackendVariantOutlookParameters
        >(
          variant,
          this.getVariants().map((v) => v.createInstance())
        )
      ) {
        return Err(
          'Selected backend variant is not included in the supported variants for Outlook backend type.'
        );
      }

      this.selectedVariant = variant;
      return Ok(this.selectedVariant);
    } catch (error) {
      return Err(`Failed to select backend variant: ${error}`);
    }
  }

  getSelectedBackendVariant(): Result<IBackendVariant, string> {
    if (this.selectedVariant) {
      return Ok(this.selectedVariant);
    } else {
      return Err('No backend variant selected.');
    }
  }
}
