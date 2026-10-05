const express=require("express");
const http=require("http");
const {Server}=require("socket.io");
const path=require("path");
const app=express();
const server=http.createServer(app);
const io=new Server(server);
app.use(express.static(path.join(__dirname)));
const rooms=new Map();

io.on("connection",socket=>{
  socket.on("join-room",({room,name})=>{
    socket.room=room; socket.name=name||"کاربر";
    const users=rooms.get(room)||[];
    socket.emit("existing-users",users);
    users.push({id:socket.id,name:socket.name});
    rooms.set(room,users);
    socket.join(room);
    socket.to(room).emit("user-joined",{id:socket.id,name:socket.name});
  });

  socket.on("offer",d=>io.to(d.to).emit("offer",{from:socket.id,name:socket.name,offer:d.offer}));
  socket.on("answer",d=>io.to(d.to).emit("answer",{from:socket.id,answer:d.answer}));
  socket.on("ice-candidate",d=>io.to(d.to).emit("ice-candidate",{from:socket.id,candidate:d.candidate}));
  socket.on("chat",d=>io.to(d.room).emit("chat",{id:socket.id,name:d.name,text:d.text}));

  socket.on("disconnect",()=>{
    if(!socket.room)return;
    const users=rooms.get(socket.room)||[];
    rooms.set(socket.room,users.filter(u=>u.id!==socket.id));
    socket.to(socket.room).emit("user-left",{id:socket.id,name:socket.name});
  });
});
server.listen(process.env.PORT||3000,()=>console.log("Hoosh Bartar server: http://localhost:3000"));
