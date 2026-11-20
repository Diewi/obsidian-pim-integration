import esbuild from 'esbuild';
import copy from 'esbuild-plugin-copy';
import process from 'process';
import builtins from 'builtin-modules';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read banner from separate file for better maintainability
const banner = fs.readFileSync(path.join(__dirname, 'src', 'banner.js'), 'utf8');

const prod = process.argv[2] === 'production';
// `--edge` builds the in-process edge mode (electron-edge-js) instead of the default CLI mode
// (OutlookComBridge.exe). Edge mode does not work in the Obsidian renderer yet; see
// OutlookNativeExecutorFactory.detectBestMode().
const edge = process.argv.includes('--edge');

// The part of electron-edge-js that edge mode needs: Windows x64, CoreCLR, precompiled DLL
// (assemblyFile). Not needed: other platforms, edge_nativeclr (.NET Framework), bootstrap refs/
// (only for compiling C# source), *.pdb, bootstrap obj/ and csproj, install-time tools.
const EDGE_SRC = path.join(__dirname, 'node_modules', 'electron-edge-js');
const EDGE_DEST = path.join(__dirname, 'dist', 'outlookcombridge', 'electron-edge-js');
const EDGE_FILES = [
  'lib/edge.js',
  'lib/electronPath.js',
  'tools/checkMono.js', // required unconditionally by lib/edge.js
  'lib/bootstrap/bin/Release/EdgeJs.dll',
  'lib/bootstrap/bin/Release/bootstrap.dll', // edge.js sets EDGE_BOOTSTRAP_DIR only if it exists
  'lib/bootstrap/bin/Release/bootstrap.deps.json', // read by EdgeJsVersionReader
];
// Per Electron major: lib/native/win32/x64/<major>/. edge.js picks the folder from
// process.versions.electron, so every major the installed electron-edge-js ships is copied.
const EDGE_NATIVE_DIR = 'lib/native/win32/x64';
const EDGE_NATIVE_FILES = [
  'edge_coreclr.node',
  // VC++ runtime, loaded from the folder of the .node module
  'msvcp140.dll',
  'vcruntime140.dll',
  'concrt140.dll',
  'vccorlib140.dll',
];

/**
 * Replace dist/outlookcombridge/electron-edge-js with the files edge mode needs, or remove it for
 * a CLI build (dist/ is never cleaned, so an older full copy would otherwise stay).
 */
function syncElectronEdge() {
  fs.rmSync(EDGE_DEST, { recursive: true, force: true });
  if (!edge) {
    return;
  }
  const copyFile = (relPath) => {
    const from = path.join(EDGE_SRC, relPath);
    if (!fs.existsSync(from)) {
      throw new Error(`electron-edge-js file not found: ${from}`);
    }
    const to = path.join(EDGE_DEST, relPath);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  };
  EDGE_FILES.forEach(copyFile);
  const majors = fs
    .readdirSync(path.join(EDGE_SRC, EDGE_NATIVE_DIR), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  if (majors.length === 0) {
    throw new Error(`No Electron versions found in ${path.join(EDGE_SRC, EDGE_NATIVE_DIR)}`);
  }
  for (const major of majors) {
    EDGE_NATIVE_FILES.forEach((file) => copyFile(`${EDGE_NATIVE_DIR}/${major}/${file}`));
  }
  console.log(`Copied electron-edge-js for Electron ${majors.join(', ')} (win32 x64)`);
}

syncElectronEdge();

const context = await esbuild.context({
  banner: {
    js: banner,
  },
  entryPoints: {
    main: 'src/main.ts',
  },
  define: {
    __PIM_EDGE_MODE__: JSON.stringify(edge),
  },
  bundle: true,
  external: [
    'obsidian',
    'electron',
    'edge-js',
    'edge-cs',
    'electron-edge-js',
    '@codemirror/autocomplete',
    '@codemirror/collab',
    '@codemirror/commands',
    '@codemirror/language',
    '@codemirror/lint',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/view',
    '@lezer/common',
    '@lezer/highlight',
    '@lezer/lr',
    ...builtins,
  ],
  format: 'cjs',
  target: 'es2018',
  logLevel: 'info',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  outdir: 'dist',
  minify: prod,
  plugins: [
    copy({
      resolveFrom: 'cwd',
      assets: {
        from: ['./LICENSE', './LICENSE-3rdparty'],
        to: ['./dist/'],
      },
      watch: true,
    }),
    copy({
      resolveFrom: 'cwd',
      assets: {
        from: ['./manifest.json'],
        // A file name is required: for a directory target, esbuild-plugin-copy derives the
        // name by splitting the source path on its directory ('.'), which produced dist/manifest.
        to: ['./dist/manifest.json'],
      },
      watch: true,
    }),
    copy({
      resolveFrom: 'cwd',
      assets: {
        from: [
          './dist_outlookcombridge/OutlookComBridge.exe',
          './dist_outlookcombridge/Google.Protobuf.dll',
          './dist_outlookcombridge/OutlookComBridge.dll',
          './dist_outlookcombridge/Mono.Options.dll',
          './dist_outlookcombridge/Microsoft.Extensions.DependencyModel.dll',
        ],
        to: ['./dist/outlookcombridge/'],
      },
      watch: true,
    }),
    copy({
      resolveFrom: 'cwd',
      assets: {
        from: [
          './dist_outlookcombridge/OutlookComBridge.deps.json',
          './dist_outlookcombridge/OutlookComBridge.runtimeconfig.json',
        ],
        to: ['./dist/outlookcombridge/templates/'],
      },
      watch: true,
    }),
    copy({
      resolveFrom: 'cwd',
      assets: {
        from: ['./docs/**'],
        to: ['./dist/docs/'],
      },
      watch: true,
    }),
  ],
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
