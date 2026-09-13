import {execFileSync,spawnSync} from 'node:child_process';
const output=execFileSync('supabase',['status','-o','env'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const local={};for(const line of output.split('\n')){const m=line.match(/^(\w+)="(.*)"$/);if(m)local[m[1]]=m[2];}
const env={...process.env,SUPABASE_URL:local.API_URL,SUPABASE_ANON_KEY:local.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:local.SERVICE_ROLE_KEY};
if(!env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Local Supabase credentials unavailable');
const result=spawnSync(process.execPath,['--test','integration/db.test.mjs'],{env,stdio:'inherit'});
process.exit(result.status??1);
