// Builds the personal APK and, with --install, puts it on the phone over USB.
//   npm run apk            -> android/app/build/outputs/apk/debug/app-debug.apk
//   npm run apk:install    -> same, then installs it (USB debugging on)
// Needs JDK 21 (Gradle 8.14 does not run on newer Java) and the Android SDK.
// Defaults: JDK in D:/tools/jdk-21 (override with MORRIGAN_JDK), SDK in %LOCALAPPDATA%/Android/Sdk.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const JDK = process.env.MORRIGAN_JDK || 'D:/tools/jdk-21';
const SDK = process.env.ANDROID_HOME || join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
const win = process.platform === 'win32';

if (!existsSync(join(JDK, 'bin', win ? 'java.exe' : 'java'))) { console.error(`JDK 21 not found in ${JDK} (set MORRIGAN_JDK).`); process.exit(1); }
if (!existsSync(SDK)) { console.error(`Android SDK not found in ${SDK} (set ANDROID_HOME).`); process.exit(1); }

const env = { ...process.env, JAVA_HOME: JDK, ANDROID_HOME: SDK };
const run = (cmd, cwd = ROOT) => execSync(cmd, { cwd, env, stdio: 'inherit' });

run('node build.mjs');
run('npx cap sync android');
run(win ? '.\\gradlew.bat assembleDebug' : './gradlew assembleDebug', join(ROOT, 'android'));
const apk = join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
console.log('APK:', apk);

if (process.argv.includes('--install')) {
  run(`"${join(SDK, 'platform-tools', win ? 'adb.exe' : 'adb')}" install -r "${apk}"`);
  console.log('Installed. Open Morrigan on the phone.');
}
