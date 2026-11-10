/* Viewer 4 owns its Q-table and RNG; no state is shared with the graph viewers. */
(function () {
  "use strict";
  const get=id=>document.getElementById(id), M=MazeLearning;
  const fieldKeys={"maze-step-reward":"stepReward","maze-goal-reward":"goalReward",
    "maze-wall-reward":"wallReward","maze-initial-q":"initialQ","maze-seed":"seed"};
  const arrows=["\u2191","\u2193","\u2190","\u2192"];
  const format=value=>Number(value.toPrecision(6)).toString();
  let session=new M.Session();
  function node(tag,text,className) {
    const item=document.createElement(tag);
    if(text!==undefined)item.textContent=text;
    if(className)item.className=className;
    return item;
  }
  function shape(tag,attrs,parent) {
    const item=document.createElementNS("http://www.w3.org/2000/svg",tag);
    Object.entries(attrs).forEach(([key,value])=>item.setAttribute(key,value));
    if(parent)parent.appendChild(item);return item;
  }
  function fail(message) {get("maze-error").textContent=message;get("maze-error").hidden=false;}
  function act(callback) {try {callback();get("maze-error").hidden=true;render();}catch(error){fail(error.message);}}
  function pending() {
    return Object.entries(fieldKeys).some(([id,key])=>get(id).value.trim()==="" || Number(get(id).value)!==session.config[key]);
  }
  function changed() {
    get("maze-pending").hidden=!pending();
  }
  function apply() {
    try {
      const config={};
      for(const [id,key] of Object.entries(fieldKeys)) {
        if(get(id).value.trim()==="")throw new Error("Fill in every setting before applying.");
        config[key]=Number(get(id).value);
      }
      const next=new M.Session(config); // Validate before replacing the existing session.
      session=next;get("maze-error").hidden=true;render();changed();
    }catch(error){fail(error.message);}
  }
  function equations() {
    const last=session.last,links=session.links();
    const symbolic=get("maze-symbolic"),numeric=get("maze-numeric");
    symbolic.replaceChildren();numeric.replaceChildren();
    function q(parent,sub,coordinates,role="") {
      const part=node("span",undefined,role?`maze-${role}`:"");
      part.append(node("span","Q"),node("sub",sub),node("span",coordinates));parent.append(part);
    }
    q(symbolic,"new","(s, a)",last?"updated":"");
    symbolic.append(node("span"," = "));q(symbolic,"old","(s, a)");
    symbolic.append(node("span"," + \u03b1 [ r + \u03b3 "));
    if(last&&last.done)symbolic.append(node("span","0"));
    else {
      const future=node("span",undefined,links.role?`maze-${links.role}`:"");
      future.append(node("span","max"),node("sub","a\u2032"),node("span"," "));
      q(future,"old","(s\u2032, a\u2032)");symbolic.append(future);
    }
    symbolic.append(node("span"," \u2212 "));q(symbolic,"old","(s, a)");symbolic.append(node("span"," ]"));
    if(!last) {
      numeric.textContent="Take one move to substitute its numbers.";
      get("maze-equation-note").textContent="";return;
    }
    numeric.append(node("span",format(last.newValue),"maze-updated"),
      node("span",` = ${format(last.old)} + ${format(last.alpha)} [ ${format(last.reward)} + ${format(last.gamma)} \u00d7 `),
      node("span",`(${format(last.future)})`,links.role?`maze-${links.role}`:""),
      node("span",` \u2212 (${format(last.old)}) ]`));
    let note="Gold: the updated Q-value. The overwritten old value stays neutral. ";
    note+=last.done?"The goal has no future reward: the future term is zero.":
      links.role==="future"?"Purple: the next-state maximum used, including surviving ties.":
      links.role==="updated"?"The same unchanged gold entry also supplies the future value.":
      "The future value used was overwritten, so it has no table color.";
    get("maze-equation-note").textContent=note;
  }
  function draw() {
    const canvas=get("maze-canvas"),links=session.links(),last=session.last;
    canvas.replaceChildren();
    shape("title",{},canvas).textContent="Q-values for each maze position and direction";
    shape("desc",{},canvas).textContent=`Agent at row ${session.state[0]}, column ${session.state[1]}. Gold shows the updated action; purple shows the future estimate.`;
    const size=104,offset=42;
    const triangles=[[[0,0],[1,0],[.5,.5]],[[0,1],[1,1],[.5,.5]],[[0,0],[0,1],[.5,.5]],[[1,0],[1,1],[.5,.5]]];
    const positions=[[.5,.18],[.5,.82],[.19,.5],[.81,.5]];
    for(let row=0;row<5;row++)for(let col=0;col<5;col++) {
      const x=offset+col*size,y=offset+row*size;
      if(session.maze[row][col]) {
        shape("rect",{x,y,width:size,height:size,fill:"#e5ebef"},canvas);
        shape("text",{x:x+size/2,y:y+size/2+4,class:"maze-wall-label","text-anchor":"middle"},canvas).textContent="WALL";
        continue;
      }
      for(let action=0;action<4;action++) {
        const value=session.q[row][col][action];
        const updated=last&&last.origin[0]===row&&last.origin[1]===col&&last.action===action;
        const source=links.keys.has(`${row}:${col}:${action}`),role=updated?"updated":source?links.role:"";
        const group=shape("g",{"data-cell":`${row}:${col}:${action}`,role:"img",
          "aria-label":`Row ${row}, column ${col}, ${M.NAMES[action]}: ${format(value)}${updated?", updated":""}${source?", future estimate":""}`},canvas);
        shape("title",{},group).textContent=`Q[${row}, ${col}, ${M.NAMES[action]}] = ${value}`;
        shape("polygon",{points:triangles[action].map(([a,b])=>`${x+a*size},${y+b*size}`).join(" "),
          class:`maze-triangle ${role?`maze-${role}-fill`:value>0?"maze-positive":""}`},group);
        const [px,py]=positions[action],tx=x+px*size,ty=y+py*size;
        const text=shape("text",{x:tx,y:ty-4,"text-anchor":"middle",
          class:`maze-value${role?` maze-${role}`:session.visits[row][col][action]?"":" maze-untried"}`},group);
        shape("tspan",{x:tx,dy:0},text).textContent=arrows[action];
        const printed=Math.abs(value)<100?value.toFixed(2):value.toExponential(1);
        shape("tspan",{x:tx,dy:13,"font-size":printed.length>6?9:11},text).textContent=printed;
      }
      const agent=session.state[0]===row&&session.state[1]===col;
      const label=agent?"A":row===4&&col===4?"G":row===0&&col===0?"S":"";
      if(label) {
        shape("circle",{cx:x+size/2,cy:y+size/2,r:11,fill:agent?"#2563eb":label==="G"?"#18834d":"#536775"},canvas);
        shape("text",{x:x+size/2,y:y+size/2+4,"text-anchor":"middle",class:"maze-marker"},canvas).textContent=label;
      }
    }
    for(let i=0;i<=5;i++) {
      shape("line",{x1:offset,y1:offset+i*size,x2:offset+5*size,y2:offset+i*size,class:"maze-grid-line"},canvas);
      shape("line",{x1:offset+i*size,y1:offset,x2:offset+i*size,y2:offset+5*size,class:"maze-grid-line"},canvas);
      if(i<5) {
        shape("text",{x:offset+(i+.5)*size,y:29,"text-anchor":"middle",class:"maze-axis"},canvas).textContent=i;
        shape("text",{x:25,y:offset+(i+.5)*size+4,"text-anchor":"middle",class:"maze-axis"},canvas).textContent=i;
      }
    }
    shape("rect",{x:offset+session.state[1]*size+2,y:offset+session.state[0]*size+2,
      width:size-4,height:size-4,fill:"none",stroke:"#2563eb","stroke-width":3},canvas);
  }
  function render() {
    get("maze-episode").textContent=session.episode;
    get("maze-steps").textContent=`${session.steps} / ${session.config.maxSteps}`;
    get("maze-return").textContent=format(session.totalReward);
    get("maze-epsilon").textContent=session.epsilon.toFixed(4);
    for(const direction of ["up","down","left","right","agent"])get(`maze-${direction}`).disabled=session.finished;
    get("maze-new-episode").disabled=!session.steps;
    get("maze-progress").textContent=session.finished?
      (session.last.done?"Exit reached. Start a new episode to keep learning.":"Step limit reached. Start a new episode."):
      `Position (${session.state.join(", ")})`;
    draw();equations();
  }
  ["up","down","left","right"].forEach((direction,action)=>get(`maze-${direction}`).addEventListener("click",()=>act(()=>session.step(action))));
  get("maze-agent").addEventListener("click",()=>act(()=>session.agentStep()));
  get("maze-new-episode").addEventListener("click",()=>act(()=>session.newEpisode()));
  get("maze-apply").addEventListener("click",apply);
  for(const [id,key] of Object.entries(fieldKeys)) {
    get(id).value=String(session.config[key]);get(id).addEventListener("input",changed);
  }
  document.addEventListener("keydown",event=>{
    if(get("viewer-select").value!=="maze"||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
    if(event.target&&event.target.closest&&event.target.closest("input,select,textarea,button,[contenteditable]"))return;
    const action={ArrowUp:0,ArrowDown:1,ArrowLeft:2,ArrowRight:3}[event.key];
    if(action===undefined)return;
    event.preventDefault();act(()=>session.step(action));
  });
  render();
})();
