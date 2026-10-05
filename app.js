const socket = typeof io === "function" ? io() : null;
const join = document.querySelector("#join");
const classroom = document.querySelector("#classroom");
const nameInput = document.querySelector("#name");
const roomInput = document.querySelector("#room");
const joinBtn = document.querySelector("#joinBtn");
const leaveBtn = document.querySelector("#leaveBtn");
const roomLabel = document.querySelector("#roomLabel");
const statusEl = document.querySelector("#status");
const localVideo = document.querySelector("#localVideo");
const micBtn = document.querySelector("#micBtn");
const camBtn = document.querySelector("#camBtn");
const screenBtn = document.querySelector("#screenBtn");
const messages = document.querySelector("#messages");
const messageInput = document.querySelector("#message");
const sendBtn = document.querySelector("#sendBtn");
let localStream=null, screenStream=null, room="", myName="";
const peers = new Map();

function setStatus(t){statusEl.textContent=t}
function addMessage(name,text){
  const d=document.createElement("div"); d.className="msg";
  d.innerHTML=`<b>${escapeHtml(name)}:</b> ${escapeHtml(text)}`;
  messages.appendChild(d); messages.scrollTop=messages.scrollHeight;
}
function escapeHtml(s){return s.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}

async function startMedia(){
  localStream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});
  localVideo.srcObject=localStream;
}
function addRemote(id,name,stream){
  let box=document.getElementById("peer-"+id);
  if(!box){
    box=document.createElement("div"); box.className="video-card"; box.id="peer-"+id;
    box.innerHTML=`<video autoplay playsinline></video><span class="tag">${escapeHtml(name||"کاربر")}</span>`;
    document.querySelector("#videos").appendChild(box);
  }
  box.querySelector("video").srcObject=stream;
}
function removePeer(id){document.getElementById("peer-"+id)?.remove(); const p=peers.get(id); if(p)p.close(); peers.delete(id)}

async function createPeer(id, name, initiator){
  const pc=new RTCPeerConnection({
    iceServers:[{urls:"stun:stun.l.google.com:19302"}]
  });
  peers.set(id,pc);
  localStream.getTracks().forEach(t=>pc.addTrack(t,localStream));
  pc.ontrack=e=>addRemote(id,name,e.streams[0]);
  pc.onicecandidate=e=>{if(e.candidate && socket) socket.emit("ice-candidate",{to:id,candidate:e.candidate})};
  pc.onconnectionstatechange=()=>{if(["failed","closed","disconnected"].includes(pc.connectionState)) removePeer(id)};
  if(initiator){
    const offer=await pc.createOffer(); await pc.setLocalDescription(offer);
    socket.emit("offer",{to:id,offer});
  }
  return pc;
}

joinBtn.onclick=async()=>{
  myName=nameInput.value.trim()||"کاربر";
  room=roomInput.value.trim()||"کلاس-1";
  try{
    await startMedia();
    join.classList.add("hidden"); classroom.classList.remove("hidden");
    roomLabel.textContent=room; setStatus("متصل");
    if(socket) socket.emit("join-room",{room,name:myName});
    else setStatus("حالت آزمایشی");
  }catch(e){alert("دسترسی دوربین یا میکروفون داده نشد.")}
};
leaveBtn.onclick=()=>location.reload();

micBtn.onclick=()=>{
  const t=localStream?.getAudioTracks()[0]; if(!t)return;
  t.enabled=!t.enabled; micBtn.textContent=t.enabled?"🎙️ میکروفون":"🔇 میکروفون خاموش";
};
camBtn.onclick=()=>{
  const t=localStream?.getVideoTracks()[0]; if(!t)return;
  t.enabled=!t.enabled; camBtn.textContent=t.enabled?"📷 دوربین":"🚫 دوربین خاموش";
};
screenBtn.onclick=async()=>{
  try{
    screenStream=await navigator.mediaDevices.getDisplayMedia({video:true});
    const track=screenStream.getVideoTracks()[0];
    localVideo.srcObject=screenStream;
    peers.forEach(pc=>{const sender=pc.getSenders().find(s=>s.track?.kind==="video"); if(sender)sender.replaceTrack(track)});
    track.onended=()=>{localVideo.srcObject=localStream; const cam=localStream.getVideoTracks()[0]; peers.forEach(pc=>{const sender=pc.getSenders().find(s=>s.track?.kind==="video"); if(sender)sender.replaceTrack(cam)})};
  }catch(e){}
};

sendBtn.onclick=sendMessage;
messageInput.onkeydown=e=>{if(e.key==="Enter")sendMessage()};
function sendMessage(){
  const t=messageInput.value.trim(); if(!t)return;
  if(socket) socket.emit("chat",{room,name:myName,text:t});
  addMessage(myName,t); messageInput.value="";
}

if(socket){
 socket.on("existing-users",async users=>{
   for(const u of users) await createPeer(u.id,u.name,true);
 });
 socket.on("user-joined",u=>addMessage("سیستم",`${u.name} وارد کلاس شد.`));
 socket.on("offer",async d=>{
   let pc=peers.get(d.from); if(!pc) pc=await createPeer(d.from,d.name,false);
   await pc.setRemoteDescription(d.offer);
   const ans=await pc.createAnswer(); await pc.setLocalDescription(ans);
   socket.emit("answer",{to:d.from,answer:ans});
 });
 socket.on("answer",async d=>{const pc=peers.get(d.from); if(pc) await pc.setRemoteDescription(d.answer)});
 socket.on("ice-candidate",async d=>{const pc=peers.get(d.from); if(pc) try{await pc.addIceCandidate(d.candidate)}catch(e){}});
 socket.on("user-left",d=>{removePeer(d.id); addMessage("سیستم",`${d.name||"کاربر"} از کلاس خارج شد.`)});
 socket.on("chat",d=>{if(d.name!==myName || d.id!==socket.id) addMessage(d.name,d.text)});
}
