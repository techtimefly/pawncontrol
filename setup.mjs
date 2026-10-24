import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=dirname(fileURLToPath(import.meta.url)), path=join(root,'.env');
if(existsSync(path)) { console.error('.env already exists; leaving it unchanged. Edit it directly to change configuration.');process.exitCode=1; }
else {
  const password=randomBytes(18).toString('base64url'), token=randomBytes(32).toString('hex');
  writeFileSync(path,`HOST=127.0.0.1\nPORT=3000\nAUTH_REQUIRED=true\nCONTROL_PASSWORD=${password}\nOVERLAY_TOKEN=${token}\nCHESS_USERNAME=your_chess_username\nDATA_DIR=./data\nCOOKIE_SECURE=false\nCHESS_USER_AGENT=PawnControl/1.0\n`,{mode:0o600,flag:'wx'});
  console.log('Created .env. A control-panel password was generated and stored in CONTROL_PASSWORD in .env. Keep that file private. Set CHESS_USERNAME in .env before first startup. For LXC, also edit HOST=0.0.0.0 and DATA_DIR=/var/lib/pawn-control before starting the service.');
}
