#!/usr/bin/env node
// `npm run dev:local [-- -p 3100]` — the app on localhost with no Google
// sign-in: every gated page signs you in as an owner automatically.
//
// It deliberately IGNORES the MONGODB_URI in .env.local, so local mode can't
// write to the production Atlas cluster by accident. Data comes from
// LOCAL_MONGODB_URI, default the Docker Mongo the shopping ingest is tested
// against (see CLAUDE.md § Shopping price comparison):
//   docker run -d --name hatom-shopping-mongo -p 127.0.0.1:27018:27017 mongo:7
// Sign in as someone else (to check their permissions) with
// LOCAL_DEV_LOGIN_EMAIL=<email>.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');

const env = {
  ...process.env,
  LOCAL_DEV_LOGIN: '1',
  MONGODB_URI: process.env.LOCAL_MONGODB_URI || 'mongodb://127.0.0.1:27018/hatom-shopping-test',
  // A fresh secret per run: old cookies stop decrypting, and the middleware
  // simply signs you in again.
  AUTH_SECRET: process.env.LOCAL_AUTH_SECRET || randomBytes(32).toString('base64'),
  AUTH_TRUST_HOST: 'true',
};

console.log(`[dev:local] no-login mode, Mongo = ${env.MONGODB_URI.replace(/\/\/[^@/]*@/, '//***@')}`);
const child = spawn(process.execPath, [nextBin, 'dev', ...process.argv.slice(2)], { stdio: 'inherit', env });
child.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
