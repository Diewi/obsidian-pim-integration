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

const context = await esbuild.context({
  banner: {
    js: banner,
  },
  entryPoints: {
    main: 'src/main.ts',
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
        to: ['./dist'],
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
        from: ['./node_modules/electron-edge-js/lib/**/*'],
        to: ['./dist/outlookcombridge/electron-edge-js/lib/'],
      },
      watch: true,
    }),
    copy({
      resolveFrom: 'cwd',
      assets: {
        from: ['./node_modules/electron-edge-js/tools/**/*'],
        to: ['./dist/outlookcombridge/electron-edge-js/tools/'],
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
