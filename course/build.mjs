import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {compileLecture} from '/Users/mgao/Documents/Parallight/parallight-lab/src/lib/compile-lecture.mjs';
const root=new URL('./',import.meta.url);const boards=JSON.parse(readFileSync(new URL('boards-content.json',root)));
const compiled=compileLecture(readFileSync(new URL('lecture.md',root),'utf8'),{lectureId:'supportops-modern-stack'});
let html=compiled.html;
// Local preview uses the existing runtime; make assets accessible to the static server.
writeFileSync(new URL('slides.html',root),html);
let serial=0;
const base=(type,x,y,w,h)=>({id:`sops${String(++serial).padStart(8,'0')}`,type,x,y,width:w,height:h,angle:0,strokeColor:'#182b36',backgroundColor:'transparent',fillStyle:'solid',strokeWidth:1,strokeStyle:'solid',roughness:0,opacity:100,groupIds:[],frameId:null,roundness:null,seed:serial,version:1,versionNonce:serial,isDeleted:false,boundElements:null,updated:1,link:null,locked:false});
const wrap=(s,n=34)=>s.split('\n').flatMap(line=>{const a=[];while(line.length>n){a.push(line.slice(0,n));line=line.slice(n);}a.push(line);return a;}).join('\n');
function text(s,x,y,w=700,size=22,color='#182b36') {const value=wrap(s,Math.floor(w/size));return {...base('text',x,y,w,value.split('\n').length*size*1.45),text:value,originalText:value,fontSize:size,fontFamily:2,textAlign:'left',verticalAlign:'top',containerId:null,autoResize:false,lineHeight:1.45,strokeColor:color};}
function box(label,x,y,w,h,fill='#eef2f5') {return [{...base('rectangle',x,y,w,h),backgroundColor:fill},text(label,x+20,y+16,w-40,21)];}
const projects=boards.map((b,i)=>{
 const elements=[text(b.name,50,35,1300,38),text(b.time,50,110,1200,18,'#51636d'),text(b.body,50,160,1220,23)];
 const nodes=b.flow.split(' → ');let x=50;const width=Math.min(240,1250/nodes.length-30);
 for(let j=0;j<nodes.length;j++){elements.push(...box(nodes[j],x,330,width,125));if(j<nodes.length-1){elements.push({...base('arrow',x+width,390,30,0),points:[[0,0],[30,0]],lastCommittedPoint:null,startBinding:null,endBinding:null,startArrowhead:null,endArrowhead:'arrow',elbowed:false});}x+=width+30;}
 elements.push(text('操作与验证',50,500,600,28));elements.push(text(b.steps.map((s,j)=>`${j+1}. ${s}`).join('\n\n'),50,555,610,21));
 elements.push(...box('给 Code Agent 的任务\n\n'+b.prompt,740,505,570,220,'#e8eefb'));
 elements.push(...box('验收证据\n\n'+b.check,740,755,570,190));
 elements.push(text(b.code,50,900,630,18));elements.push(text('讨论：'+b.limit,50,1100,1250,21));
 return {id:`b${String(i+1).padStart(7,'0')}`,name:b.name,scene:{elements,appState:{viewBackgroundColor:'#ffffff'},files:{}}};
});
const payload={project:{id:'sops2026',name:'SupportOps · 现代 Agent 技术栈'},boards:projects,layout:'scoped',exportedAt:Date.now()};
writeFileSync(new URL('whiteboard.project.json',root),JSON.stringify(payload,null,2));
writeFileSync(new URL('build-board.js',root),`// Creates a NEW project; never deletes existing teaching boards.\n(async()=>{const data=${JSON.stringify(payload)};const tb=window.teachboard;if(!tb?.workspace)throw Error('Open teachboard editor first');const pause=()=>new Promise(r=>setTimeout(r,100));tb.workspace.createProject();await pause();let state=tb.workspace.getState();let project=state.projects.find(p=>p.boards.some(b=>b.id===state.activeBoardId));if(!project)throw Error('New project unavailable');tb.workspace.renameProject(project.id,data.project.name);await pause();for(let i=0;i<data.boards.length;i++){if(i){tb.workspace.createBoard(project.id);await pause();}state=tb.workspace.getState();const id=state.activeBoardId;tb.workspace.renameBoard(id,data.boards[i].name);await pause();tb.getApi().updateScene({elements:data.boards[i].scene.elements,appState:data.boards[i].scene.appState});await tb.sceneStore.set(id,JSON.stringify(data.boards[i].scene));await pause();}await tb.sceneStore.flush();console.log('SUPPORTOPS_BOARDS_READY',data.boards.length);})();`);
console.log(JSON.stringify({slides:(html.match(/data-slide-index=/g)||[]).length,boards:projects.length,unknownWidgets:compiled.unknownWidgets}));
