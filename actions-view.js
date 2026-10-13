/* Viewer: 2 owns its scene; moves never modify Viewer: 1 or the built-in example. */
(function () {
  "use strict";
  const get=id=>document.getElementById(id), C=MovementScoring;
  let session,selected,sourceLabel,loadVersion=0;
  const format=value=>Math.abs(value)<0.0000005?"0":Number(value.toFixed(6)).toString();
  const signed=value=>(value>0.0000005?"+":"")+format(value);
  function html(tag,text) {
    const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;
  }
  function shape(tag,attrs,parent) {
    const node=document.createElementNS("http://www.w3.org/2000/svg",tag);
    for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);
    if(parent)parent.appendChild(node);return node;
  }
  function fail(message) {get("actions-error").textContent=message;get("actions-error").hidden=false;}
  function load(data,label) {
    GraphObservations.validateScene(data);
    if(!data.nodes.some(n=>n.type==="road"))throw new Error("Choose an environment containing road nodes.");
    const next=new C.Session(data);
    GraphObservations.validateScene(next.scene);
    session=next;sourceLabel=label;
    selected=session.scene.nodes.find(n=>n.type==="road").id;
    get("actions-node").replaceChildren(...session.scene.nodes.filter(n=>n.type==="road").map(n=>{
      const option=html("option",`Node ${n.id}`);option.value=String(n.id);return option;
    }));
    get("actions-error").hidden=true;
    render("Select a road node and move it with the arrow controls.");
  }
  function select(id) {selected=id;render();}
  function move(direction) {
    try {
      const action=session.move(selected,direction);
      get("actions-error").hidden=true;
      render(`Node ${action.nodeId} moved ${direction}: ${format(action.beforeScore)} to ${format(action.afterScore)}. Reward ${signed(action.reward)}.`);
    } catch(error) {fail(error.message);}
  }
  function render(message) {
    const scene=session.scene,result=session.current,node=scene.nodes.find(n=>n.id===selected);
    get("actions-summary").textContent=`${sourceLabel} \u00b7 ${scene.nodes.filter(n=>n.type==="road").length} road nodes \u00b7 ${scene.roads.length} roads \u00b7 ${scene.buildings.length} buildings`;
    get("actions-node").value=String(selected);
    get("actions-node-title").textContent=`Node ${selected}`;
    get("actions-coordinates").replaceChildren(html("dt","x"),html("dd",format(node.x)),html("dt","y"),html("dd",format(node.y)));
    get("actions-score").textContent=format(result.score);
    get("actions-intersection").textContent=format(result.intersectionLength);
    get("actions-offsite").textContent=format(result.offsiteLength);
    const last=session.history[session.history.length-1];
    const reward=get("actions-reward");reward.textContent=last?signed(last.reward):"\u2014";
    reward.className=last?(last.reward>0.0000005?"improved":last.reward<-.0000005?"worsened":""):"";
    get("actions-steps").textContent=session.history.length;
    get("actions-start").textContent=format(session.initialScore);
    get("actions-undo").disabled=!session.history.length;
    get("actions-reset").disabled=!session.history.length;
    if(message)get("actions-change").textContent=message;
    get("actions-formula").textContent=`Current calculation: -(0.4 \u00d7 ${format(result.intersectionPenaltyLength)} + 0.6 \u00d7 ${format(result.offsitePenaltyLength)}) = ${format(result.score)}.`;
    get("actions-hit-count").textContent=`(${result.intersections.length})`;
    get("actions-no-hits").hidden=result.intersections.length>0;
    get("actions-hits").replaceChildren();
    const roadMap=new Map(scene.roads.map(r=>[r.id,r]));
    for(const hit of result.intersections) {
      const road=roadMap.get(hit.roadId),row=html("tr");
      for(const text of [hit.roadId,`${road.source} \u2013 ${road.target}`,hit.buildingId,hit.length===0?"0 (contact)":format(hit.length)])row.append(html("td",text));
      get("actions-hits").append(row);
    }
    draw();
  }
  function draw() {
    const canvas=get("actions-canvas");canvas.replaceChildren();
    const scene=session.scene,result=session.current,nodes=new Map(scene.nodes.map(n=>[n.id,n])),s=scene.site;
    // Include displaced nodes even after they move outside the site.
    const minX=Math.min(s.min_x,...scene.nodes.map(n=>n.x)),maxX=Math.max(s.max_x,...scene.nodes.map(n=>n.x));
    const minY=Math.min(s.min_y,...scene.nodes.map(n=>n.y)),maxY=Math.max(s.max_y,...scene.nodes.map(n=>n.y));
    const scale=Math.min(700/(maxX-minX),520/(maxY-minY));
    const point=n=>({x:400+(n.x-(minX+maxX)/2)*scale,y:310-(n.y-(minY+maxY)/2)*scale});
    const top=point({x:s.min_x,y:s.max_y});
    shape("rect",{x:top.x,y:top.y,width:(s.max_x-s.min_x)*scale,height:(s.max_y-s.min_y)*scale,fill:"white",stroke:"#91a8b9","stroke-dasharray":"6 5"},canvas);
    const affected=new Set(result.intersections.map(h=>h.buildingId));
    for(const b of scene.buildings) {
      const points=b.corners.map(id=>{const p=point(nodes.get(id));return `${p.x},${p.y}`;}).join(" ");
      shape("polygon",{points,fill:affected.has(b.id)?"#fae8e4":"#e5ebef",stroke:affected.has(b.id)?"#d9a19a":"#c3d0d9","stroke-width":1.2},canvas);
    }
    function segment(a,b,colour,width,dashed=false) {
      const start=point(a),end=point(b);
      const attrs={x1:start.x,y1:start.y,x2:end.x,y2:end.y,stroke:colour,"stroke-width":width,"stroke-linecap":"round"};
      if(dashed)attrs["stroke-dasharray"]="6 3";
      return shape("line",attrs,canvas);
    }
    for(const road of scene.roads)segment(nodes.get(road.source),nodes.get(road.target),"#7e9ebc",2);
    for(const part of result.offsiteSegments)segment(part.start,part.end,"#b16a12",4,true);
    for(const hit of result.intersections) {
      const line=segment(hit.start,hit.end,"#ba3e36",5);
      shape("title",{},line).textContent=`Road ${hit.roadId}, building ${hit.buildingId}: ${format(hit.length)} units`;
      for(const endpoint of [hit.start,hit.end]) {
        const p=point(endpoint);shape("circle",{cx:p.x,cy:p.y,r:3,fill:"#ba3e36",stroke:"white","stroke-width":.8},canvas);
      }
    }
    for(const n of scene.nodes.filter(n=>n.type==="road")) {
      const p=point(n),active=n.id===selected;
      const group=shape("g",{class:"action-node",role:"button",tabindex:0,"aria-label":`Select road node ${n.id}`,"aria-pressed":String(active)},canvas);
      shape("circle",{cx:p.x,cy:p.y,r:13,fill:active?"#c7efeb":"transparent"},group);
      shape("circle",{cx:p.x,cy:p.y,r:6,fill:active?"#087f8c":"#2563eb",stroke:"white","stroke-width":1.5},group);
      shape("text",{x:p.x+10,y:p.y+16,class:"node-label"},group).textContent=n.id;
      function pick(){select(n.id);canvas.focus({preventScroll:true});}
      group.addEventListener("click",pick);
      group.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();pick();}});
    }
  }
  for(const direction of Object.keys(C.DIRECTIONS))get(`move-${direction}`).addEventListener("click",()=>move(direction));
  get("actions-node").addEventListener("change",()=>select(Number(get("actions-node").value)));
  get("actions-undo").addEventListener("click",()=>{
    const action=session.undo();if(!action)return;selected=action.nodeId;
    get("actions-error").hidden=true;render(`Undid node ${action.nodeId}'s ${action.direction} move. Score restored to ${format(session.current.score)}.`);
  });
  get("actions-reset").addEventListener("click",()=>{
    session.reset();get("actions-error").hidden=true;render("Restored the loaded layout. Move history cleared.");
  });
  document.addEventListener("keydown",event=>{
    const keys={ArrowUp:"up",ArrowDown:"down",ArrowLeft:"left",ArrowRight:"right"};
    if(get("viewer-actions").hidden || !Object.hasOwn(keys,event.key) || event.ctrlKey || event.metaKey || event.altKey)return;
    if(get("neighbourhood-dialog").open)return;
    // Preserve arrow-key behaviour inside native form controls and editable text.
    if(event.target?.closest?.("input,select,textarea,[contenteditable='true']"))return;
    event.preventDefault();move(keys[event.key]);
  });
  get("actions-example").addEventListener("click",()=>{loadVersion++;get("actions-file").value="";load(exampleEnvironment,"Example \u00b7 seed 42 \u00b7 jitter 6");});
  get("actions-file").addEventListener("change",async()=>{
    const file=get("actions-file").files[0],version=++loadVersion;if(!file)return;
    try {
      if(file.size>5*1024*1024)throw new Error("Choose an individual environment JSON smaller than 5 MB.");
      const text=await file.text();if(version!==loadVersion)return;
      let data;try {data=JSON.parse(text.replace(/^\uFEFF/,""));}catch {throw new Error("Choose an individual environment JSON, not a ZIP or invalid JSON file.");}
      load(data,file.name);
    } catch(error) {if(version===loadVersion)fail(error.message);}
    finally {if(version===loadVersion)get("actions-file").value="";}
  });
  load(exampleEnvironment,"Example \u00b7 seed 42 \u00b7 jitter 6");
})();
