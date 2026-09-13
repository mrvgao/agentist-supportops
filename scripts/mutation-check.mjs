import {mkdtempSync,readFileSync,writeFileSync,cpSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const temp=mkdtempSync(join(tmpdir(),'supportops-mutation-'));
try {
 cpSync('src',join(temp,'src'),{recursive:true});cpSync('tests',join(temp,'tests'),{recursive:true});
 const file=join(temp,'src/agent.mjs');const original=readFileSync(file,'utf8');
 const mutant=original.replace("if (value.action === 'draft_reply' && citations.length === 0) throw new Error('missing_evidence');",'// MUTANT: evidence gate removed');
 if(mutant===original)throw Error('Mutation target missing');writeFileSync(file,mutant);
 const run=spawnSync(process.execPath,['--test',join(temp,'tests/agent.test.mjs')],{encoding:'utf8'});
 if(run.status!==1 || !run.stdout.includes('missing evidence cannot become a confident draft')) throw Error('Mutation was not caught by the expected regression test');
 console.log('Mutation killed: removing evidence gate fails the independent missing-evidence assertion.');
} finally {rmSync(temp,{recursive:true,force:true});}
