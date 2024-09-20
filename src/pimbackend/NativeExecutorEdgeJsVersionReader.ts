import { Err, Ok, Result } from 'oxide.ts';
import * as fs from 'fs';
import * as path from 'path';
import { AssemblyDescriptor, AssemblyPathLocation } from './outlook/IBackendParametersOutlook';

/**
 * Structure for the bootstrap.deps.json file format.
 */
interface BootstrapDepsJson {
  targets: {
    [runtimeTarget: string]: {
      [packageKey: string]: {
        runtime?: {
          [dllName: string]: {
            assemblyVersion?: string;
            fileVersion?: string;
          };
        };
      };
    };
  };
}

/**
 * Reads EdgeJs.dll version information from the bootstrap.deps.json file
 * distributed with the electron-edge-js package.
 */
export class EdgeJsVersionReader {
  /**
   * Relative path from the electron-edge-js package root to the bootstrap.deps.json file.
   */
  private static readonly BOOTSTRAP_DEPS_PATH = 'lib/bootstrap/bin/Release/bootstrap.deps.json';

  /**
   * Relative path to EdgeJs.dll within the electron-edge-js folder structure.
   */
  private static readonly EDGE_JS_RELATIVE_PATH = 'electron-edge-js/lib/bootstrap';

  private static readonly EDGE_JS_DLL_FILE_NAME = 'EdgeJs.dll';

  private static readonly EDGE_JS_DLL_PATH =
    'bin/Release/' + EdgeJsVersionReader.EDGE_JS_DLL_FILE_NAME;

  /**
   * Reads the EdgeJs.dll version from the bootstrap.deps.json file and creates
   * an AssemblyDescriptor for use with BackendOutlookDepsJsonGenerator.
   *
   * @param electronEdgePath The path to the electron-edge-js package directory
   * @returns Result containing the EdgeJs AssemblyDescriptor or an error message
   */
  public static readEdgeJsDescriptor(electronEdgePath: string): Result<AssemblyDescriptor, string> {
    const bootstrapDepsPath = path.join(electronEdgePath, EdgeJsVersionReader.BOOTSTRAP_DEPS_PATH);

    // Read and parse bootstrap.deps.json
    let bootstrapDeps: BootstrapDepsJson;
    try {
      const content = fs.readFileSync(bootstrapDepsPath, 'utf8');
      bootstrapDeps = JSON.parse(content) as BootstrapDepsJson;
    } catch (error) {
      const errorMessage = `Failed to read bootstrap.deps.json: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMessage);
      return Err(errorMessage);
    }

    // Find the EdgeJs entry in the targets section
    const runtimeTarget = Object.keys(bootstrapDeps.targets)[0];
    if (!runtimeTarget) {
      return Err('No runtime target found in bootstrap.deps.json');
    }

    const targetSection = bootstrapDeps.targets[runtimeTarget];

    // Find the Edge.js package entry (format: "Edge.js/9.3.0")
    const edgeJsKey = Object.keys(targetSection).find((key) => key.startsWith('Edge.js/'));
    if (!edgeJsKey) {
      return Err('Edge.js entry not found in bootstrap.deps.json targets');
    }

    const edgeJsEntry = targetSection[edgeJsKey];
    if (!edgeJsEntry?.runtime?.[EdgeJsVersionReader.EDGE_JS_DLL_FILE_NAME]) {
      return Err('EdgeJs.dll runtime entry not found in bootstrap.deps.json');
    }

    const runtimeEntry = edgeJsEntry.runtime[EdgeJsVersionReader.EDGE_JS_DLL_FILE_NAME];
    const assemblyVersion = runtimeEntry.assemblyVersion;

    if (!assemblyVersion) {
      return Err('EdgeJs.dll assemblyVersion not found in bootstrap.deps.json');
    }

    // Normalize version to 4-part format (e.g., "9.3.0" -> "9.3.0.0")
    const normalizedVersion = EdgeJsVersionReader.normalizeVersion(assemblyVersion);

    // Create the AssemblyDescriptor
    const descriptor: AssemblyDescriptor = {
      name: 'EdgeJs',
      path: EdgeJsVersionReader.EDGE_JS_RELATIVE_PATH,
      filePath: EdgeJsVersionReader.EDGE_JS_DLL_PATH,
      pathLocationType: AssemblyPathLocation.Plugin,
      assemblyVersion: normalizedVersion,
      fileVersion: normalizedVersion,
    };

    return Ok(descriptor);
  }

  /**
   * Normalizes a version string to 4-part format.
   * CoreCLR expects versions in format "major.minor.build.revision".
   *
   * @param version The version string to normalize (e.g., "9.3.0")
   * @returns The normalized 4-part version string (e.g., "9.3.0.0")
   */
  private static normalizeVersion(version: string): string {
    const parts = version.split('.');
    while (parts.length < 4) {
      parts.push('0');
    }
    return parts.slice(0, 4).join('.');
  }
}
