import { build,type BuildConfig } from 'bun';
import { join } from 'path';
// Build for multiple platforms
const platforms = [
  { target: "bun-windows-x64", outfile: "app-windows.exe" },
  { target: "bun-linux-x64", outfile: "app-linux" },
  { target: "bun-darwin-arm64", outfile: "app-macos" },
];
const defaultconfig:BuildConfig = {
    entrypoints:[join(__dirname,'../src/index.ts')],
    outdir:'./dist',
    minify: true,
    compile:{
        target:'bun-windows-x64',
        outfile:'./windows/build',
        windows: {
        title: "TTSapi",
        hideConsole: true, // Set to true for GUI applications
        },
    }
}
async function buildAPP() {
    for (const platform of platforms) {
        const config = {
            ...defaultconfig,
            compile: {
                target: platform.target,
                outfile: platform.outfile,
            },
        };
        const result = await build(config);
        console.log(`build success ${platform.target}`, result);
    }
}
buildAPP()