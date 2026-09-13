import {readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
for (const dir of ['src','api','tests','scripts','integration']) {
 for (const file of readdirSync(dir).filter(x=>x.endsWith('.mjs'))) execFileSync(process.execPath,['--check',`${dir}/${file}`]);
}
console.log('All JavaScript syntax checks passed');
