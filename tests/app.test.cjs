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
}
const html=fs.readFileSync(path.join(root,"index.html"),"utf8"),elements={};
for(const match of html.matchAll(/<([a-z0-9]+)\b[^>]*\bid="([^"]+)"[^>]*>/g)){
  const e=new Element(match[1]);e.id=match[2];e.hidden=/\bhidden\b/.test(match[0]);e.checked=/\bchecked\b/.test(match[0]);elements[e.id]=e;
}
elements["viewer-select"].value="observations";elements["road-direction"].value="both";
const scope={console,GraphObservations:require("../graph.js"),location:{hash:""},window:{},document:{
  getElementById:id=>{assert(elements[id],`Missing HTML id ${id}`);return elements[id];},
  querySelectorAll:()=>["viewer-observations","viewer-actions"].map(id=>elements[id]),
  createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag),createDocumentFragment:()=>new Element("fragment")
}};
vm.createContext(scope);vm.runInContext(fs.readFileSync(path.join(root,"example.js"),"utf8"),scope);scope.exampleEnvironment=scope.window.exampleEnvironment;
vm.runInContext(fs.readFileSync(path.join(root,"app.js"),"utf8"),scope);
(async()=>{
  assert.equal(elements["viewer-observations"].hidden,false);
  assert(!elements["viewer-environments"]);
  assert.equal(elements["node-select"].children.length,12);
  const countBefore=elements["incoming-count"].textContent;
  elements["self-enabled"].checked=false;await elements["self-enabled"].fire("change");
  assert.equal(elements["incoming-count"].textContent,countBefore-1);
  assert(!elements["context-enabled"]);
  const renderedNodes=elements["graph-canvas"].children.filter(n=>n.attrs.class==="graph-node");
  assert.equal(renderedNodes.length,12);
  assert(renderedNodes.every(n=>n.attrs["aria-label"].includes("road node")));
  assert.equal(elements["graph-canvas"].children.filter(n=>n.tag==="polygon").length,9);
  await elements["open-neighbourhood"].fire("click");
  assert.equal(elements["neighbourhood-dialog"].open,true);
  assert(elements["dialog-neighbours"].children.every(row=>row.children[1].textContent==="road" && row.children[4].textContent==="Road"));
  await elements["close-dialog"].fire("click");assert.equal(elements["neighbourhood-dialog"].open,false);
  // A road node with only outgoing messages has an empty incoming neighbourhood.
  elements["road-direction"].value="stored";await elements["road-direction"].fire("change");
  elements["node-select"].value="11";await elements["node-select"].fire("change");
  assert.equal(elements["incoming-count"].textContent,0);
  await elements["open-neighbourhood"].fire("click");assert.equal(elements["dialog-empty"].hidden,false);
  await elements["close-dialog"].fire("click");
  // Invalid input preserves the previously valid scene.
  const summary=elements["scene-summary"].textContent;
  elements["scene-file"].files=[{name:"bad.json",size:10,text:async()=>"not JSON"}];
  await elements["scene-file"].fire("change");assert.equal(elements["load-error"].hidden,false);assert.equal(elements["scene-summary"].textContent,summary);
  const noRoads=JSON.parse(JSON.stringify(scope.exampleEnvironment));
  noRoads.nodes=noRoads.nodes.filter(n=>n.type==="building");noRoads.roads=[];
  elements["scene-file"].files=[{name:"no-roads.json",size:100,text:async()=>JSON.stringify(noRoads)}];
  await elements["scene-file"].fire("change");assert.match(elements["load-error"].textContent,/at least one road node/);
  assert.equal(elements["scene-summary"].textContent,summary);
  // Valid input with sparse IDs must use IDs, never array positions.
  const sparse=JSON.parse(JSON.stringify(scope.exampleEnvironment));
  sparse.nodes.forEach(n=>n.id+=1000);sparse.roads.forEach(r=>{r.source+=1000;r.target+=1000;});sparse.buildings.forEach(b=>b.corners=b.corners.map(i=>i+1000));
  elements["scene-file"].files=[{name:"sparse.json",size:100,text:async()=>JSON.stringify(sparse)}];
  await elements["scene-file"].fire("change");assert.equal(elements["load-error"].hidden,true);assert.equal(elements["node-select"].value,"1000");
  elements["road-direction"].value="stored";await elements["road-direction"].fire("change");assert.match(elements["direction-note"].textContent,/arbitrary storage order/);
  await elements["load-example"].fire("click");assert.equal(elements["node-select"].value,"0");
  elements["viewer-select"].value="actions";await elements["viewer-select"].fire("change");assert.equal(elements["viewer-actions"].hidden,false);assert.equal(elements["viewer-observations"].hidden,true);
  console.log("PASS: Road-only nodes and messages, building footprints, controls, modal, empty neighbourhood, invalid import recovery, sparse-ID import, example reset and viewer switching (DOM test double).");
})().catch(error=>{console.error(error);process.exitCode=1;});

