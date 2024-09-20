import {
  DepsJsonStructure,
  RuntimeConfigStructure,
  BackendOutlookDepsJsonGenerator,
} from '../src/pimbackend/outlook/BackendOutlookDepsJsonGenerator';
import {
  AssemblyDescriptor,
  AssemblyPathLocation,
} from '../src/pimbackend/outlook/IBackendParametersOutlook';
import { EdgeJsVersionReader } from '../src/pimbackend/NativeExecutorEdgeJsVersionReader';
import { DEFAULT_DOTNET_PATH } from '../src/settings';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Test fixture directories relative to this test file.
 */
const TEST_FIXTURES_DIR = path.resolve(__dirname, 'BackendOutlookDepsJsonGenerator');
const TEMPLATE_DIR = path.join(TEST_FIXTURES_DIR, 'template');
const EXPECTED_DIR = path.join(TEST_FIXTURES_DIR, 'expected');

/**
 * Path to mock electron-edge-js package for testing EdgeJsVersionReader.
 */
const MOCK_ELECTRON_EDGE_PATH = path.join(TEMPLATE_DIR, 'electron-edge-js');

/**
 * Office DLL assembly descriptor for testing.
 */
const OFFICE_DLL_DESCRIPTOR: AssemblyDescriptor = {
  name: 'MicrosoftOfficeCore',
  path: 'office',
  filePath: 'OFFICE.DLL',
  pathLocationType: AssemblyPathLocation.GAC,
  assemblyVersion: '15.0.0.0',
  fileVersion: '15.0.0.0',
  publicKeyToken: '71e9bce111e9429c',
};

/**
 * Outlook Interop DLL assembly descriptor for testing.
 */
const OUTLOOK_INTEROP_DESCRIPTOR: AssemblyDescriptor = {
  name: 'Microsoft.Office.Interop.Outlook',
  path: 'Microsoft.Office.Interop.Outlook',
  filePath: 'Microsoft.Office.Interop.Outlook.dll',
  pathLocationType: AssemblyPathLocation.GAC,
  assemblyVersion: '15.0.0.0',
  fileVersion: '15.0.0.0',
  publicKeyToken: '71e9bce111e9429c',
};

/**
 * Helper to get EdgeJs descriptor using the EdgeJsVersionReader utility.
 */
function getEdgeJsDescriptor(): AssemblyDescriptor {
  const result = EdgeJsVersionReader.readEdgeJsDescriptor(MOCK_ELECTRON_EDGE_PATH);
  if (result.isErr()) {
    throw new Error(`Failed to read EdgeJs descriptor: ${result.unwrapErr()}`);
  }
  return result.unwrap();
}

/**
 * Helper to get all assembly descriptors for testing.
 */
function getAllAssemblyDescriptors(): AssemblyDescriptor[] {
  return [getEdgeJsDescriptor(), OFFICE_DLL_DESCRIPTOR, OUTLOOK_INTEROP_DESCRIPTOR];
}

/**
 * Helper to create a temporary directory for test output.
 */
function createTempOutputDir(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deps-json-generator-test-'));
  return tempDir;
}

/**
 * Helper to clean up a temporary directory.
 */
function cleanupTempDir(tempDir: string): void {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Helper to normalize JSON for comparison.
 * Parses and re-stringifies to ensure consistent formatting.
 */
function normalizeJson(jsonString: string): string {
  return JSON.stringify(JSON.parse(jsonString), null, 2);
}

/**
 * Helper to load and parse a JSON file.
 */
function loadJsonFile<T>(filePath: string): T {
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content) as T;
}

/**
 * Helper to detect the latest .NET 8.x shared framework path.
 * Mirrors the logic in BackendOutlookDepsJsonGenerator.detectSharedFrameworkPath().
 */
function detectDotNetSharedFrameworkPath(dotnetPath: string): string | null {
  const sharedFrameworkBase = path.join(dotnetPath, 'shared', 'Microsoft.NETCore.App');

  if (!fs.existsSync(sharedFrameworkBase)) {
    return null;
  }

  try {
    const versions = fs
      .readdirSync(sharedFrameworkBase)
      .filter((v) => v.startsWith('8.'))
      .sort((a, b) => {
        const partsA = a.split('.').map(Number);
        const partsB = b.split('.').map(Number);
        for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
          const numA = partsA[i] || 0;
          const numB = partsB[i] || 0;
          if (numA !== numB) return numB - numA;
        }
        return 0;
      });

    if (versions.length > 0) {
      return path.join(sharedFrameworkBase, versions[0]);
    }
    return null;
  } catch {
    return null;
  }
}

describe('BackendOutlookDepsJsonGenerator', () => {
  let tempOutputDir: string;

  describe('generate()', () => {
    beforeEach(() => {
      tempOutputDir = createTempOutputDir();
    });

    afterEach(() => {
      cleanupTempDir(tempOutputDir);
    });

    test('should return error when template deps.json does not exist', () => {
      // Arrange
      const nonExistentTemplateDir = path.join(tempOutputDir, 'non-existent-template');
      const generator = new BackendOutlookDepsJsonGenerator(
        tempOutputDir,
        nonExistentTemplateDir,
        'OutlookComBridge.deps.json',
        'OutlookComBridge.runtimeconfig.json',
        getAllAssemblyDescriptors(),
        DEFAULT_DOTNET_PATH
      );

      // Act
      const result = generator.generate();

      // Assert
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('Failed to read template deps.json');

      cleanupTempDir(tempOutputDir);
    });

    test('should generate deps.json with correct structure', () => {
      // Arrange
      const generator = new BackendOutlookDepsJsonGenerator(
        tempOutputDir,
        TEMPLATE_DIR,
        'OutlookComBridge.deps.json',
        'OutlookComBridge.runtimeconfig.json',
        getAllAssemblyDescriptors(),
        DEFAULT_DOTNET_PATH
      );

      // Act
      const result = generator.generate();

      // Assert
      expect(result.isOk()).toBe(true);

      // Verify deps.json was created
      const depsJsonPath = path.join(tempOutputDir, 'OutlookComBridge.deps.json');
      expect(fs.existsSync(depsJsonPath)).toBe(true);

      // Load and verify the generated deps.json
      const generatedDepsJson = loadJsonFile<DepsJsonStructure>(depsJsonPath);
      const expectedDepsJson = loadJsonFile<DepsJsonStructure>(
        path.join(EXPECTED_DIR, 'OutlookComBridge.deps.json')
      );

      expect(expectedDepsJson as unknown as DepsJsonStructure).toBeDefined();
      expect(generatedDepsJson as unknown as DepsJsonStructure).toBeDefined();

      // Verify critical structure
      expect(generatedDepsJson.runtimeTarget).toEqual(expectedDepsJson.runtimeTarget);

      // Verify runtimeconfig.json was created
      const runtimeConfigPath = path.join(tempOutputDir, 'OutlookComBridge.runtimeconfig.json');
      expect(fs.existsSync(runtimeConfigPath)).toBe(true);
    });
  });

  describe('generate()', () => {
    let generatedDepsJson: DepsJsonStructure;
    let expectedDepsJson: DepsJsonStructure;
    let generatedRuntimeConfig: RuntimeConfigStructure;

    beforeAll(() => {
      tempOutputDir = createTempOutputDir();
      // Arrange
      const generator = new BackendOutlookDepsJsonGenerator(
        tempOutputDir,
        TEMPLATE_DIR,
        'OutlookComBridge.deps.json',
        'OutlookComBridge.runtimeconfig.json',
        getAllAssemblyDescriptors(),
        DEFAULT_DOTNET_PATH
      );

      const result = generator.generate();
      if (result.isErr()) {
        throw new Error(`Deps.json generation failed: ${result.unwrapErr()}`);
      }
      const depsJsonPath = path.join(tempOutputDir, 'OutlookComBridge.deps.json');
      generatedDepsJson = loadJsonFile<DepsJsonStructure>(depsJsonPath);
      expectedDepsJson = loadJsonFile<DepsJsonStructure>(
        path.join(EXPECTED_DIR, 'OutlookComBridge.deps.json')
      );

      const runtimeConfigPath = path.join(tempOutputDir, 'OutlookComBridge.runtimeconfig.json');
      generatedRuntimeConfig = loadJsonFile<RuntimeConfigStructure>(runtimeConfigPath);
    });

    afterAll(() => {
      cleanupTempDir(tempOutputDir);
    });

    test('should generate runtimeconfig.json with correct structure', () => {
      // Verify runtimeOptions structure exists
      expect(generatedRuntimeConfig.runtimeOptions).toBeDefined();
      expect(generatedRuntimeConfig.runtimeOptions?.additionalProbingPaths).toBeDefined();
      expect(Array.isArray(generatedRuntimeConfig.runtimeOptions?.additionalProbingPaths)).toBe(
        true
      );
    });

    test('should include additionalProbingPaths in runtimeconfig.json', () => {
      const probingPaths = generatedRuntimeConfig.runtimeOptions?.additionalProbingPaths;
      expect(probingPaths).toBeDefined();
      expect(probingPaths?.length).toBe(3);

      // First path should be the resolved bin path
      expect(probingPaths?.[0]).toBe(path.resolve(tempOutputDir));

      // Second path should be GAC_MSIL
      expect(probingPaths?.[1]).toBe('C:\\Windows\\assembly\\GAC_MSIL');

      // Third path should be .NET shared framework (dynamically detected)
      const expectedFrameworkPath = detectDotNetSharedFrameworkPath(DEFAULT_DOTNET_PATH);
      expect(expectedFrameworkPath).not.toBeNull();
      expect(probingPaths?.[2]).toBe(expectedFrameworkPath);
    });

    test('should add EdgeJs entry to deps.json', () => {
      // Verify EdgeJs entry in targets (uses unified format: EdgeJs/version)
      const targetSection = generatedDepsJson.targets?.['.NETCoreApp,Version=v8.0'];
      expect(targetSection).toBeDefined();
      expect(targetSection?.['electron-edge-js/lib/bootstrap']).toBeDefined();
      // Runtime paths are normalized to just the filename (no path prefix)
      expect(
        targetSection?.['electron-edge-js/lib/bootstrap']?.['runtime']?.['EdgeJs.dll']
      ).toBeDefined();

      expect(
        targetSection?.['electron-edge-js/lib/bootstrap']?.['runtime']?.['EdgeJs.dll']?.[
          'assemblyVersion'
        ]
      ).toBe('9.3.0.0');
      expect(
        targetSection?.['electron-edge-js/lib/bootstrap']?.['runtime']?.['EdgeJs.dll']?.[
          'fileVersion'
        ]
      ).toBe('9.3.0.0');
      // Verify EdgeJs entry in libraries
      expect(generatedDepsJson.libraries?.['electron-edge-js/lib/bootstrap']).toBeDefined();
    });

    test('should update Office interop assembly entries in deps.json', () => {
      const targetSection = generatedDepsJson.targets?.['.NETCoreApp,Version=v8.0'];
      const mainProjectSection = targetSection?.['OutlookComBridge/1.0.0'];

      // Verify old template entries are removed (entries matching descriptor.name prefix)
      expect(targetSection?.['Microsoft.Office.Interop.Outlook/15.0.4797.1004']).toBeUndefined();
      // Note: MicrosoftOfficeCore entries remain because our mock uses 'office' as name,
      // which doesn't match 'MicrosoftOfficeCore/' prefix. This is expected behavior.

      // Verify new GAC-compatible entries are added
      expect(
        targetSection?.['Microsoft.Office.Interop.Outlook/15.0.0.0__71e9bce111e9429c']
      ).toBeDefined();
      expect(targetSection?.['office/15.0.0.0__71e9bce111e9429c']).toBeDefined();

      // Verify libraries section is updated
      expect(
        generatedDepsJson.libraries?.['Microsoft.Office.Interop.Outlook/15.0.0.0__71e9bce111e9429c']
      ).toBeDefined();
      expect(generatedDepsJson.libraries?.['office/15.0.0.0__71e9bce111e9429c']).toBeDefined();

      // Verify old library entries matching descriptor name are removed
      expect(generatedDepsJson.libraries?.['MicrosoftOfficeCore/15.0.4797.1004']).toBeUndefined();
      expect(mainProjectSection?.['dependencies']?.['MicrosoftOfficeCore']).toBeUndefined();
    });

    test('should add EdgeJs dependency to main project', () => {
      const targetSection = generatedDepsJson.targets?.['.NETCoreApp,Version=v8.0'];
      const mainProjectEntry = targetSection?.['OutlookComBridge/1.0.0'];

      expect(mainProjectEntry?.['dependencies']?.['electron-edge-js/lib/bootstrap']).toBeDefined();
      expect(mainProjectEntry?.['dependencies']?.['electron-edge-js/lib/bootstrap']).toBe('9.3.0');
    });

    test('should preserve non-modified entries from template', () => {
      // Verify that unmodified entries are preserved
      const targetSection = generatedDepsJson.targets?.['.NETCoreApp,Version=v8.0'];
      expect(targetSection?.['Microsoft.Extensions.DependencyModel/8.0.2']).toBeDefined();
      expect(targetSection?.['Mono.Options/6.12.0.148']).toBeDefined();
      expect(targetSection?.['System.Text.Encoding.CodePages/8.0.0']).toBeDefined();

      expect(
        generatedDepsJson.libraries?.['Microsoft.Extensions.DependencyModel/8.0.2']
      ).toBeDefined();
      expect(generatedDepsJson.libraries?.['Mono.Options/6.12.0.148']).toBeDefined();
    });

    test('should set correct library path format for GAC assemblies', () => {
      // Verify library entries exist for GAC assemblies
      // Note: library paths are cleared to empty string so CoreCLR uses probing paths directly
      const outlookLibrary =
        generatedDepsJson.libraries?.[
          'Microsoft.Office.Interop.Outlook/15.0.0.0__71e9bce111e9429c'
        ];
      expect(outlookLibrary).toBeDefined();
      expect(outlookLibrary?.path).toBe('');

      const officeLibrary = generatedDepsJson.libraries?.['office/15.0.0.0__71e9bce111e9429c'];
      expect(officeLibrary).toBeDefined();
      expect(officeLibrary?.path).toBe('');

      // Veryify that the old MicrosoftOfficeCore entry is removed
      const oldOfficeCoreLibrary =
        generatedDepsJson.libraries?.['MicrosoftOfficeCore/15.0.4797.1004'];
      expect(oldOfficeCoreLibrary).toBeUndefined();
    });

    test('should generate deps.json matching expected output structure', () => {
      // Compare runtimeTarget
      expect(generatedDepsJson.runtimeTarget).toEqual(expectedDepsJson.runtimeTarget);

      // Compare compilationOptions
      expect(generatedDepsJson.compilationOptions).toEqual(expectedDepsJson.compilationOptions);
    });

    test('should generate runtimeconfig.json with expected structure (excluding dynamic paths)', () => {
      // Verify static structure (tfm and framework don't change)
      expect(generatedRuntimeConfig.runtimeOptions?.tfm).toBe('net8.0');
      expect(generatedRuntimeConfig.runtimeOptions?.framework).toEqual({
        name: 'Microsoft.NETCore.App',
        version: '8.0.0',
      });

      // Verify configProperties are preserved
      expect(generatedRuntimeConfig.runtimeOptions?.configProperties).toEqual({
        'System.Reflection.Metadata.MetadataUpdater.IsSupported': false,
        'System.Runtime.Serialization.EnableUnsafeBinaryFormatterSerialization': false,
      });
    });
  });
});

describe('EdgeJsVersionReader', () => {
  describe('readEdgeJsDescriptor()', () => {
    test('should read EdgeJs descriptor from bootstrap.deps.json', () => {
      // Arrange & Act
      const result = EdgeJsVersionReader.readEdgeJsDescriptor(MOCK_ELECTRON_EDGE_PATH);

      // Assert
      expect(result.isOk()).toBe(true);
      const descriptor = result.unwrap();
      expect(descriptor.name).toBe('EdgeJs');
      expect(descriptor.filePath).toBe('bin/Release/EdgeJs.dll');
      expect(descriptor.path).toBe('electron-edge-js/lib/bootstrap');
    });

    test('should normalize version to 4-part format', () => {
      // Arrange & Act
      const result = EdgeJsVersionReader.readEdgeJsDescriptor(MOCK_ELECTRON_EDGE_PATH);

      // Assert
      expect(result.isOk()).toBe(true);
      const descriptor = result.unwrap();
      // 9.3.0 from bootstrap.deps.json should be normalized to 9.3.0.0
      expect(descriptor.assemblyVersion).toBe('9.3.0.0');
      expect(descriptor.fileVersion).toBe('9.3.0.0');
    });

    test('should return error for non-existent path', () => {
      // Arrange
      const nonExistentPath = path.join(TEMPLATE_DIR, 'non-existent');

      // Act
      const result = EdgeJsVersionReader.readEdgeJsDescriptor(nonExistentPath);

      // Assert
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toContain('Failed to read bootstrap.deps.json');
    });
  });
});
