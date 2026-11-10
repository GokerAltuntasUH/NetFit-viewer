// DOM controls, not a substitute for a browser layout check.
"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),assert=require("node:assert/strict");
const root=path.join(__dirname,"..");
class Element {
  constructor(tag="div") {this.tag=tag;this.children=[];this.events={};this.attrs={};this.hidden=false;this.value="";this.checked=false;this.files=[];this.open=false;this.textContent="";}
  setAttribute(key,value){this.attrs[key]=String(value);}
  appendChild(child){this.children.push(child);return child;}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=[...children];this.textContent="";}
  addEventListener(name,callback){(this.events[name]??=[]).push(callback);}
  fire(name,event={}){for(const callback of this.events[name]??[])callback(event);}
  showModal(){this.open=true;}close(){this.open=false;this.fire("close");}focus(){}
  closest(){return ["input","select","textarea","button"].includes(this.tag)?this:null;}
}
const markup=fs.readFileSync(path.join(root,"index.html"),"utf8"),elements={};
for(const match of markup.matchAll(/<([a-z0-9]+)\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
  const el=new Element(match[1]);el.id=match[2];el.hidden=/\bhidden\b/.test(match[0]);el.checked=/\bchecked\b/.test(match[0]);elements[el.id]=el;
}
elements["viewer-select"].value="observations";elements["road-direction"].value="both";
const scope={console,GraphObservations:require("../graph.js"),MovementScoring:require("../actions-core.js"),MazeLearning:require("../maze-core.js"),location:{hash:"#maze"},window:{},document:{events:{},
  addEventListener(name,cb){(this.events[name]??=[]).push(cb);},
  fire(name,event){for(const cb of this.events[name]??[])cb(event);},
  getElementById:id=>{assert(elements[id],`Missing element ${id}`);return elements[id];},
  querySelectorAll:()=>["viewer-observations","viewer-actions","viewer-ghosts","viewer-maze"].map(id=>elements[id]),
  createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag),createDocumentFragment:()=>new Element("fragment")}};
vm.createContext(scope);
vm.runInContext(fs.readFileSync(path.join(root,"example.js"),"utf8"),scope);scope.exampleScenario=scope.window.exampleScenario;
for(const file of ["app.js","actions-view.js","maze-view.js"])vm.runInContext(fs.readFileSync(path.join(root,file),"utf8"),scope);
const get=id=>elements[id],click=id=>get(id).fire("click");
const text=el=>el.textContent+el.children.map(text).join("");
assert.equal(get("viewer-select").value,"maze");assert.equal(get("viewer-maze").hidden,false);assert.equal(get("viewer-actions").hidden,true);
const roadScore=get("actions-score").textContent,ghostScore=get("ghosts-score").textContent;
click("maze-right");assert.equal(get("maze-steps").textContent,"1 / 100");assert(text(get("maze-numeric")).includes("-0.1 ="));
assert(get("maze-canvas").children.some(e=>e.attrs["data-cell"]==="0:0:3"&&e.attrs["aria-label"].includes("updated")));
get("maze-initial-q").value="-1";get("maze-initial-q").fire("input");assert.equal(get("maze-pending").hidden,false);
click("maze-apply");click("maze-right");assert(text(get("maze-numeric")).includes("-1.09 ="));
get("maze-initial-q").value="";click("maze-apply");assert.equal(get("maze-error").hidden,false);assert.equal(get("maze-steps").textContent,"1 / 100");
get("maze-initial-q").value="0";get("maze-goal-reward").value="12.5";click("maze-apply");
for(const direction of ["right","right","down","down","right","right","down","down"])click(`maze-${direction}`);
assert.equal(get("maze-agent").disabled,true);assert(text(get("maze-numeric")).includes("1.25 ="));
assert.equal(get("maze-new-episode").disabled,false);click("maze-new-episode");assert.equal(get("maze-episode").textContent,2);
const keyboard=(key,target=get("maze-canvas"))=>{let prevented=false;scope.document.fire("keydown",{key,target,preventDefault(){prevented=true;}});return prevented;};
assert.equal(keyboard("ArrowUp",get("maze-initial-q")),false);
assert.equal(keyboard("ArrowRight"),true);assert.equal(get("maze-steps").textContent,"1 / 100");
get("viewer-select").value="observations";get("viewer-select").fire("change");
assert.equal(keyboard("ArrowRight"),false);assert.equal(get("maze-steps").textContent,"1 / 100");
get("viewer-select").value="maze";get("viewer-select").fire("change");assert.equal(get("maze-steps").textContent,"1 / 100");
click("maze-apply");click("maze-agent");const first=text(get("maze-numeric"));click("maze-apply");click("maze-agent");assert.equal(text(get("maze-numeric")),first);
assert.equal(get("actions-score").textContent,roadScore);assert.equal(get("ghosts-score").textContent,ghostScore);
assert.equal(get("node-select").value,"0");
console.log("PASS: fourth-view deep link, manual/agent moves, decimal settings, validation, terminal controls, equations, keyboard scope, seeded reset and viewer isolation.");
