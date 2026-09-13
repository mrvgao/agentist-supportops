import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
if(!process.env.PARALLIGHT_ROOT)throw Error('Set PARALLIGHT_ROOT to the teaching platform checkout');
const {chromium}=await import(pathToFileURL(resolve(process.env.PARALLIGHT_ROOT,'teachboard/node_modules/playwright-core/index.mjs')));
import {readFileSync,writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
try {
 await page.goto('http://127.0.0.1:8765/course/slides.html');await page.waitForTimeout(1200);
 await page.screenshot({path:'course/qa/slides.png'});
 console.log('slide sections',await page.locator('[data-slide-index]').count());
 await page.goto('http://127.0.0.1:5178/');await page.waitForFunction(()=>!!window.teachboard?.workspace,{timeout:60000});
 await page.evaluate(readFileSync('course/build-board.js','utf8'));
 const result=await page.evaluate(async()=>{const tb=window.teachboard;await tb.sceneStore.flush();const p=tb.workspace.getState().projects.find(p=>p.name==='SupportOps · 现代 Agent 技术栈');return {boards:p.boards.length,scenes:p.boards.map(b=>({name:b.name,elements:JSON.parse(tb.sceneStore.get(b.id)||'{}').elements?.length||0}))};});
 if(result.boards!==12||result.scenes.some(s=>!s.elements))throw Error('Missing board content');
 const first=await page.evaluate(()=>{const tb=window.teachboard;return tb.workspace.getState().projects.find(p=>p.name==='SupportOps · 现代 Agent 技术栈').boards[0].id;});
 await page.evaluate(id=>window.teachboard.workspace.switchBoard(id),first);await page.waitForTimeout(700);
 await page.evaluate(()=>{const api=window.teachboard.getApi();api.scrollToContent(undefined,{fitToViewport:true});const s=api.getAppState();api.updateScene({appState:{zoom:{value:0.7},scrollX:170,scrollY:90}});});await page.waitForTimeout(500);
 await page.screenshot({path:'course/qa/whiteboard.png'});
 await page.reload();await page.waitForFunction(()=>!!window.teachboard?.sceneStore);await page.waitForTimeout(1000);
 const persisted=await page.evaluate(id=>JSON.parse(window.teachboard.sceneStore.get(id)||'{}').elements?.length,first);
 if(!persisted)throw Error('Board did not survive reload');
 writeFileSync('course/whiteboard-verification.json',JSON.stringify({...result,persisted:true},null,2));console.log(JSON.stringify(result));
} finally {await browser.close();}
