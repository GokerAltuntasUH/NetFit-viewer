"use strict";
const $ = id => document.getElementById(id);
const selector=$("viewer-select"), panels=Array.from(document.querySelectorAll(".viewer-panel"));
const G=GraphObservations;
let scene,nodes,roadNodes,selected,loadVersion=0;
const colours={road:"#2563eb",self:"#087f8c"};
const names={road:"Road",self:"Self-message"};
function selectViewer() {
  panels.forEach(p=>{p.hidden=p.id!==`viewer-${selector.value}`;});
  $("view-status").textContent="Interactive viewer";
}
selector.addEventListener("change",selectViewer);
if (["#observations","#actions","#ghosts"].includes(location.hash)) selector.value=location.hash.slice(1);
selectViewer();
function el(tag,text,className) {
  const node=document.createElement(tag);
  if(text!==undefined) node.textContent=text;
  if(className) node.className=className;
  return node;
}
function svg(tag,attrs,parent) {
  const node=document.createElementNS("http://www.w3.org/2000/svg",tag);
  for(const [key,value] of Object.entries(attrs)) node.setAttribute(key,value);
  if(parent) parent.appendChild(node);
  return node;
}
function options(){return {bidirectional:$("road-direction").value==="both",self:$("self-enabled").checked};}
function incoming(){return G.messageEdges({nodes:roadNodes,roads:scene.roads},[],options()).filter(edge=>edge.target===selected);}
function loadScene(data,label){
  const validated=G.validateScene(data);
  const roadsOnly=validated.nodes.filter(n=>n.type==="road");
  if(!roadsOnly.length) throw new Error("Choose a scenario containing at least one road node.");
  // Preserve the current scene on parse or validation errors.
  if($("neighbourhood-dialog").open) $("neighbourhood-dialog").close();
  scene=validated;roadNodes=roadsOnly;nodes=new Map(scene.nodes.map(n=>[n.id,n]));
  selected=roadNodes[0].id;
  $("node-select").replaceChildren(...roadNodes.map(n=>{const opt=el("option",`Node ${n.id} \u00b7 ${n.type}`);opt.value=String(n.id);return opt;}));
  $("load-error").hidden=true;
  $("scene-summary").textContent=`${label} \u00b7 ${roadNodes.length} road nodes \u00b7 ${scene.roads.length} roads \u00b7 ${scene.buildings.length} buildings`;
  refresh();
}
function refresh(){
  $("node-select").value=String(selected);
  $("direction-note").textContent=options().bidirectional
    ?"A physical road carries messages both ways. Arrowheads highlight messages entering the selected node."
    :"Teaching experiment: road messages follow the JSON source \u2192 target order. This arbitrary storage order is not a real road direction or a learned policy.";
  renderGraph();renderInspector();
}
function renderGraph(){
  const canvas=$("graph-canvas");canvas.replaceChildren();
  const defs=svg("defs",{},canvas);
  for(const [type,colour] of Object.entries(colours)){
    const marker=svg("marker",{id:`arrow-${type}`,viewBox:"0 0 10 10",refX:9,refY:5,markerWidth:7,markerHeight:7,orient:"auto"},defs);
    svg("path",{d:"M 0 0 L 10 5 L 0 10 z",fill:colour},marker);
  }
  const all=scene.nodes,s=scene.site;
  const minX=Math.min(s.min_x,...all.map(n=>n.x)),maxX=Math.max(s.max_x,...all.map(n=>n.x));
  const minY=Math.min(s.min_y,...all.map(n=>n.y)),maxY=Math.max(s.max_y,...all.map(n=>n.y));
  const scale=Math.min(700/(maxX-minX),520/(maxY-minY));
  const point=n=>({x:400+(n.x-(minX+maxX)/2)*scale,y:310-(n.y-(minY+maxY)/2)*scale});
  const top=point({x:s.min_x,y:s.max_y});
  svg("rect",{x:top.x,y:top.y,width:(s.max_x-s.min_x)*scale,height:(s.max_y-s.min_y)*scale,fill:"white",stroke:"#aabcc9","stroke-dasharray":"6 5"},canvas);
  for(const b of scene.buildings){
    const points=b.corners.map(id=>{const p=point(nodes.get(id));return `${p.x},${p.y}`;}).join(" ");
    svg("polygon",{points,fill:"#e5ebef",stroke:"#c3d0d9","stroke-width":1.2},canvas);
  }
  function line(edge,colour,width,dashed,arrow){
    let start=point(nodes.get(edge.source)),end=point(nodes.get(edge.target));
    const dx=end.x-start.x,dy=end.y-start.y,length=Math.hypot(dx,dy);
    if(arrow&&length>16){start={x:start.x+dx/length*7,y:start.y+dy/length*7};end={x:end.x-dx/length*10,y:end.y-dy/length*10};}
    const attrs={x1:start.x,y1:start.y,x2:end.x,y2:end.y,stroke:colour,"stroke-width":width};
    if(dashed) attrs["stroke-dasharray"]="5 4";
    if(arrow) attrs["marker-end"]=`url(#arrow-${edge.type})`;
    svg("line",attrs,canvas);
  }
  scene.roads.forEach(edge=>line(edge,"#97b5d5",1.6,false,false));
  const messages=incoming(), neighbours=new Set(messages.map(e=>e.source));
  for(const edge of messages){
    if(edge.type==="self"){
      const p=point(nodes.get(selected));
      svg("path",{d:`M ${p.x-5} ${p.y-7} C ${p.x-35} ${p.y-48}, ${p.x+35} ${p.y-48}, ${p.x+7} ${p.y-7}`,fill:"none",stroke:colours.self,"stroke-width":2.5,"marker-end":"url(#arrow-self)"},canvas);
    }else line(edge,colours[edge.type],2.8,false,true);
  }
  for(const n of roadNodes){
    const p=point(n),active=n.id===selected;
    const group=svg("g",{class:"graph-node",tabindex:0,role:"button","aria-label":`Inspect ${n.type} node ${n.id}`,"aria-pressed":String(active)},canvas);
    svg("circle",{cx:p.x,cy:p.y,r:13,fill:"transparent"},group);
    if(active||neighbours.has(n.id)) svg("circle",{cx:p.x,cy:p.y,r:active?12:10,fill:active?"#c7efeb":"#e9d7b3",opacity:.85},group);
    svg("circle",{cx:p.x,cy:p.y,r:5.5,fill:active?"#087f8c":"#2563eb",stroke:"white","stroke-width":1.3},group);
    if($("show-labels").checked) svg("text",{x:p.x+9,y:p.y+15,class:"node-label"},group).textContent=n.id;
    const inspect=()=>{selected=n.id;refresh();};
    group.addEventListener("click",inspect);
    group.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();inspect();}});
  }
}
const number=value=>Number(value.toFixed(3)).toString();
function renderInspector(){
  const n=nodes.get(selected),messages=incoming();
  $("node-title").textContent=`Node ${n.id}`;$("node-features").replaceChildren();
  for(const [label,value] of [["Type",n.type],["x",number(n.x)],["y",number(n.y)]]) $("node-features").append(el("dt",label),el("dd",value));
  $("incoming-count").textContent=messages.length;
  const external=messages.filter(e=>e.source!==selected),self=messages.some(e=>e.type==="self");
  $("incoming-summary").textContent=`${new Set(external.map(e=>e.source)).size} neighbouring nodes${self?" + this node\u2019s own message":" \u00b7 self-messages excluded"}.`;
  $("neighbour-list").replaceChildren();
  const fragment=document.createDocumentFragment();
  for(const edge of messages){
    const row=el("div",undefined,"neighbour-row");row.append(el("span",`${edge.source} \u2192 ${selected}`),el("span",names[edge.type],`edge-badge ${edge.type}`));fragment.append(row);
  }
  if(!messages.length) fragment.append(el("p","No incoming messages with these settings.","muted"));
  $("neighbour-list").append(fragment);
}
function openDialog(){
  const n=nodes.get(selected),messages=incoming();
  $("dialog-title").textContent=`Node ${selected} \u00b7 ${n.type}`;
  $("dialog-description").textContent=`Features: x = ${number(n.x)}, y = ${number(n.y)}. Arrows point from the sender to this node.`;
  $("dialog-neighbours").replaceChildren();
  for(const edge of messages){
    const sender=nodes.get(edge.source),row=el("tr");
    for(const text of [sender.id,sender.type,number(sender.x),number(sender.y),names[edge.type],`\u2192 ${selected}`]) row.append(el("td",text));
    $("dialog-neighbours").append(row);
  }
  $("dialog-empty").hidden=messages.length>0;$("neighbourhood-dialog").showModal();
}
$("node-select").addEventListener("change",()=>{selected=Number($("node-select").value);refresh();});
for(const id of ["road-direction","self-enabled","show-labels"]) $(id).addEventListener("change",refresh);
$("open-neighbourhood").addEventListener("click",openDialog);
$("close-dialog").addEventListener("click",()=>$("neighbourhood-dialog").close());
$("neighbourhood-dialog").addEventListener("close",()=>$("open-neighbourhood").focus());
$("load-example").addEventListener("click",()=>{loadVersion++;$("scene-file").value="";loadScene(exampleScenario,"Example \u00b7 seed 42 \u00b7 jitter 6");});
$("scene-file").addEventListener("change",async()=>{
  const file=$("scene-file").files[0],version=++loadVersion;if(!file)return;
  try{
    if(file.size>5*1024*1024)throw new Error("Choose an individual JSON scenario smaller than 5 MB.");
    const text=await file.text();if(version!==loadVersion)return;
    let data;try{data=JSON.parse(text.replace(/^\uFEFF/,""));}catch{throw new Error("This file is not valid JSON. Choose an individual scenario .json, not a ZIP archive.");}
    loadScene(data,file.name);
  }catch(error){if(version!==loadVersion)return;$("load-error").textContent=error.message;$("load-error").hidden=false;}
  finally{if(version===loadVersion)$("scene-file").value="";}
});
loadScene(exampleScenario,"Example \u00b7 seed 42 \u00b7 jitter 6");
