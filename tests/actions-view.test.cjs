// Isolated DOM test double: verifies event wiring, not browser rendering.
"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict");
const root=path.join(__dirname,"..");
class Element {
  constructor(tag="div") { this.tag=tag;this.children=[];this.events={};this.attrs={};this.hidden=false;this.value="";this.checked=false;this.files=[];this.open=false; }
  setAttribute(key,value){this.attrs[key]=String(value);}
  appendChild(child){this.children.push(child);return child;}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=[...children];}
  addEventListener(name,callback){(this.events[name]??=[]).push(callback);}
  async fire(name,event={}){for(const callback of this.events[name]??[])await callback(event);}
  showModal(){this.open=true;}
  close(){this.open=false;this.fire("close");}
  focus(){this.focused=true;}
  closest(){return ["input","select","textarea"].includes(this.tag)?this:null;}
}
const html=fs.readFileSync(path.join(root,"index.html"),"utf8"),elements={};
for(const match of html.matchAll(/<([a-z0-9]+)\b[^>]*\bid="([^"]+)"[^>]*>/g)){
  const e=new Element(match[1]);e.id=match[2];e.hidden=/\bhidden\b/.test(match[0]);e.checked=/\bchecked\b/.test(match[0]);elements[e.id]=e;
}
elements["viewer-select"].value="observations";elements["road-direction"].value="both";
const scope={console,GraphObservations:require("../graph.js"),location:{hash:"#actions"},window:{},document:{events:{},
  addEventListener(name,cb){(this.events[name]??=[]).push(cb);},
  async fire(name,event){for(const cb of this.events[name]??[])await cb(event);},
  getElementById:id=>{assert(elements[id],`Missing HTML id ${id}`);return elements[id];},
  querySelectorAll:()=>["viewer-observations","viewer-actions","viewer-ghosts"].map(id=>elements[id]),
  createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag),createDocumentFragment:()=>new Element("fragment")
}};
vm.createContext(scope);vm.runInContext(fs.readFileSync(path.join(root,"example.js"),"utf8"),scope);scope.exampleScenario=scope.window.exampleScenario;
vm.runInContext(fs.readFileSync(path.join(root,"app.js"),"utf8"),scope);

scope.MovementScoring=require("../actions-core.js");
vm.runInContext(fs.readFileSync(path.join(root,"actions-view.js"),"utf8"),scope);
(async()=>{
  const get=id=>elements[id];
  const sampleBefore=JSON.stringify(scope.exampleScenario);
  const value=()=>Number(get("actions-score").textContent);
  const starting=value();
  const reference=new scope.MovementScoring.Session(scope.exampleScenario);
  const keyboard=async(key,target=get("actions-canvas"),extra={})=>{
    let prevented=false;await scope.document.fire("keydown",{key,target,preventDefault(){prevented=true;},...extra});return prevented;
  };
  assert.equal(get("viewer-actions").hidden,false);assert.equal(get("actions-node").children.length,12);
  assert.equal(get("actions-steps").textContent,0);assert(get("actions-undo").disabled);
  const first=Number(get("actions-node").value);
  const expected=reference.move(first,"right");
  await get("move-right").fire("click");
  assert(Math.abs(value()-expected.afterScore)<1e-6);
  assert(Math.abs(Number(get("actions-reward").textContent)-expected.reward)<1e-6);
  assert.equal(get("actions-steps").textContent,1);
  assert.equal(JSON.stringify(scope.exampleScenario),sampleBefore);
  assert.equal(get("node-select").value,"0"); // Viewer 2 remains independent.
  assert(await keyboard("ArrowUp"));assert.equal(get("actions-steps").textContent,2);
  const scoreAfterUp=value();
  assert.equal(await keyboard("ArrowUp",get("actions-node")),false);assert.equal(value(),scoreAfterUp);
  assert.equal(await keyboard("ArrowRight",get("actions-canvas"),{ctrlKey:true}),false);
  get("viewer-select").value="observations";await get("viewer-select").fire("change");
  assert.equal(await keyboard("ArrowLeft"),false);assert.equal(value(),scoreAfterUp);
  get("viewer-select").value="actions";await get("viewer-select").fire("change");
  await get("actions-undo").fire("click");assert.equal(get("actions-steps").textContent,1);
  assert(Math.abs(value()-expected.afterScore)<1e-6);
  await get("actions-reset").fire("click");assert.equal(value(),starting);assert.equal(get("actions-steps").textContent,0);
  assert.equal(get("actions-reward").textContent,"—");
  get("actions-file").files=[{name:"bad.json",size:10,text:async()=>"bad"}];await get("actions-file").fire("change");assert.equal(get("actions-error").hidden,false);assert.equal(value(),starting);
  const sparse=JSON.parse(sampleBefore);sparse.nodes.forEach(n=>n.id+=1000);sparse.roads.forEach(r=>{r.source+=1000;r.target+=1000;});sparse.buildings.forEach(b=>b.corners=b.corners.map(id=>id+1000));
  get("actions-file").files=[{name:"sparse.json",size:100,text:async()=>JSON.stringify(sparse)}];await get("actions-file").fire("change");
  assert.equal(get("actions-error").hidden,true);assert.equal(get("actions-node").value,"1000");
  const nodeGroups=get("actions-canvas").children.filter(e=>e.attrs.class==="action-node");
  assert.equal(nodeGroups.length,12);assert(nodeGroups.every(e=>e.attrs["aria-label"].includes("road")));
  await nodeGroups[1].fire("click");assert.equal(get("actions-node").value,"1001");assert.equal(get("neighbourhood-dialog").open,false);
  await get("move-left").fire("click");assert.equal(get("actions-steps").textContent,1);
  await get("actions-example").fire("click");assert.equal(get("actions-node").value,"0");assert.equal(value(),starting);assert.equal(get("actions-steps").textContent,0);
  assert(get("actions-canvas").children.some(n=>n.tag==="line" && n.attrs.stroke==="#ba3e36"));
  assert.equal(get("actions-canvas").children.filter(n=>n.tag==="defs" || n.tag==="marker").length,0);
  // Viewer 3 shares movement/scoring behavior but owns a separate scene and links.
  const ghostLines=()=>get("ghosts-canvas").children.filter(e=>e.attrs.class==="ghost-edge");
  const pairs=()=>ghostLines().map(e=>`${e.attrs["data-source"]}:${e.attrs["data-target"]}`).sort();
  const expectedPairs=scene=>scope.GraphObservations.contextEdges(scene).edges.map(e=>`${e.source}:${e.target}`).sort();
  const normalized=scope.MovementScoring.normalizeScene(scope.exampleScenario);
  assert.equal(ghostLines().length,0); // Context links are not calculated in Viewer 1 or 2.
  assert.equal(get("viewer-ghosts").hidden,true);
  assert(!get("actions-canvas").children.some(e=>e.attrs.class==="ghost-edge"));
  get("viewer-select").value="ghosts";await get("viewer-select").fire("change");
  assert.equal(get("viewer-ghosts").hidden,false);assert.equal(get("viewer-actions").hidden,true);
  assert.deepEqual(pairs(),expectedPairs(normalized));
  const ghostStart=Number(get("ghosts-score").textContent),actionSteps=get("actions-steps").textContent;
  await get("ghosts-move-right").fire("click");
  assert(Math.abs(Number(get("ghosts-score").textContent)-expected.afterScore)<1e-6);
  assert.equal(get("ghosts-steps").textContent,1);assert.equal(get("actions-steps").textContent,actionSteps);
  assert(await keyboard("ArrowUp",get("ghosts-canvas")));
  assert.equal(get("ghosts-steps").textContent,2);assert.equal(get("actions-steps").textContent,actionSteps);
  assert.equal(await keyboard("ArrowUp",get("ghosts-node")),false);
  await get("ghosts-undo").fire("click");assert.equal(get("ghosts-steps").textContent,1);
  await get("ghosts-reset").fire("click");assert.equal(Number(get("ghosts-score").textContent),ghostStart);
  assert.deepEqual(pairs(),expectedPairs(normalized));
  get("ghosts-enabled").checked=false;await get("ghosts-enabled").fire("change");
  assert.equal(ghostLines().length,0);assert.equal(Number(get("ghosts-score").textContent),ghostStart);
  get("ghosts-enabled").checked=true;await get("ghosts-enabled").fire("change");
  assert.deepEqual(pairs(),expectedPairs(normalized));
  // Sparse IDs, shared endpoints, boundary contacts, and removal after clearing a building.
  const fixture={format:"graph-workshop-scenario",schema_version:1,site:{min_x:-5,max_x:5,min_y:-5,max_y:5},
    nodes:[{id:10,type:"road",x:0,y:0},{id:20,type:"road",x:4,y:0},{id:30,type:"road",x:0,y:0.5},
      {id:101,type:"building",x:1,y:-1},{id:102,type:"building",x:2,y:-1},
      {id:103,type:"building",x:2,y:1},{id:104,type:"building",x:1,y:1}],
    roads:[{id:50,source:10,target:20},{id:60,source:20,target:30}],buildings:[{id:90,corners:[101,102,103,104]}]};
  async function loadGhost(scene,name="ghost.json") {
    get("ghosts-file").files=[{name,size:100,text:async()=>JSON.stringify(scene)}];await get("ghosts-file").fire("change");
  }
  await loadGhost(fixture);assert.equal(get("ghosts-error").hidden,true);
  assert.equal(ghostLines().length,12);assert.deepEqual(pairs(),expectedPairs(fixture));
  assert(ghostLines().every(e=>e.attrs["marker-end"]==="url(#ghosts-arrow)" && e.attrs["stroke-dasharray"]));
  assert.equal(get("ghosts-canvas").children.filter(e=>e.attrs.class==="action-node").length,3);
  const single=JSON.parse(JSON.stringify(fixture));single.roads.pop();
  await loadGhost(single);assert.equal(ghostLines().length,8);
  const ghostRef=new scope.MovementScoring.Session(single);
  for(const id of [10,20]) {
    get("ghosts-node").value=String(id);await get("ghosts-node").fire("change");
    for(let i=0;i<2;i++) {
      await get("ghosts-move-up").fire("click");ghostRef.move(id,"up");
      assert.deepEqual(pairs(),expectedPairs(ghostRef.scene));
      assert(Math.abs(Number(get("ghosts-score").textContent)-ghostRef.current.score)<1e-6);
    }
  }
  assert.equal(ghostLines().length,0);assert.match(get("ghosts-count").textContent,/0 obstacle-context links/);
  await get("ghosts-undo").fire("click");assert.equal(ghostLines().length,0);
  await get("ghosts-undo").fire("click");assert.equal(ghostLines().length,8); // Boundary contact still links.
  await get("ghosts-reset").fire("click");assert.equal(ghostLines().length,8);assert.equal(get("ghosts-steps").textContent,0);
  const beforeBad=pairs();get("ghosts-file").files=[{name:"bad.json",size:10,text:async()=>"bad"}];
  await get("ghosts-file").fire("change");assert.equal(get("ghosts-error").hidden,false);assert.deepEqual(pairs(),beforeBad);
  await get("ghosts-example").fire("click");assert.equal(get("ghosts-node").value,"0");assert.deepEqual(pairs(),expectedPairs(normalized));
  assert.equal(JSON.stringify(scope.exampleScenario),sampleBefore);
  assert.equal(value(),starting);assert.equal(get("node-select").value,"0");
  console.log("PASS: Viewer 3 directed ghost links, deduplication, live geometry, contact/clearance, toggle, controls, scoring, undo/reset, imports and scene isolation (DOM test double).");
  console.log("PASS: movement buttons, keyboard scoping, form protection, selected node, score/reward updates, undo/reset, file loading, sparse IDs, highlights and Viewer 1 isolation (DOM test double).");
})().catch(error=>{console.error(error);process.exitCode=1;});
