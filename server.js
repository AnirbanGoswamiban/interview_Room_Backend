// server.js
require('dotenv').config()
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require("cors")

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ["http://localhost:3000", "https://interview-room-frontend.vercel.app"],
        methods: ["GET", "POST"],
    },
});

app.use(cors())
// app.use(express.static('public'));

const rooms = {};
const offerRooms = {}

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Create or join room
    socket.on('joinRoom', (data,res) => { 
        let {roomId,name,type} = data

        if (!roomId || !name) {
            return res({
                success: false,
                message: 'Invalid room ID or name',
            });
        }
        if(type === "join"){
            if(!rooms[roomId]){
                return res({
                    success: false,
                    message: 'Invalid room ID',
                });
            }
        }

            let usersArray = rooms[roomId] || []
            let flag = false
            usersArray.forEach(element => {
                if(element.socketId === socket.id){
                    flag = true
                }
            });
            if(flag){
                return res({
                    success: true,
                    message: 'Already in a room',
                });
            }
        
        // if roomId is not present create one
        if (!rooms[roomId]) {
            rooms[roomId] = [];
        }
        rooms[roomId].push({name:name,socketId:socket.id});
        socket.join(roomId);
        console.log(`User ${socket.id} joined room ${roomId}`);

        socket.to(roomId).emit('userJoined', {name:name,socketId:socket.id});
        socket.emit('allUsers', rooms[roomId].filter(id => id.socketId !== socket.id));
        return res({
            success: true,
            message: `Successfully joined room`,
            roomUsers: rooms[roomId].filter(user => user.socketId !== socket.id),
            roomId:roomId,
            name:name
        });
    });

    // Text message handling
    socket.on('sendMessage', ({ roomId, message },res) => {
        // console.log(roomId,message)
        socket.to(roomId).emit('receiveMessage', { message:message, sender: socket.id });
        return res({
            success:true
        })
    });

      // Listen for code changes
  socket.on('codeChange', ({roomId,data},callback) => {
    // console.log(roomId,data)
    socket.to(roomId).emit('codeUpdate', data);
    if (callback) {
        callback({
          success: true,
        });
      }
  });

  socket.on('languageChange', ({roomId,data},callback) => {
    // console.log(roomId,data)
    socket.to(roomId).emit('languageUpdate', data);
    if (callback) {
        callback({
          success: true,
        });
      }
  });


 // Listen for an offer
 socket.on('offer', ({ offer, roomId, targetSocketId, name }) => {
        if (targetSocketId) {
            socket.to(targetSocketId).emit('offer', { offer, from: socket.id, name: name });
            console.log(`Offer sent to socket: ${targetSocketId} from ${socket.id}`);
        } else {
            console.warn(`No target socketId provided for room: ${roomId}`);
        }
});
    


socket.on('answer', ({ answer, to }) => {
    console.log('answer from ',socket.id)
    socket.to(to).emit('receiveAnswer', { answer, from: socket.id });
});

socket.on('ice-candidate', ({candidate, to }) => { 
    console.log(candidate,to)
    socket.to(to).emit('ice-candidate', { candidate, from: socket.id });
});


socket.on('streamOffer', ({ offer, to }) => {
    if (to) {
        socket.to(to).emit('streamOffer', { offer, from: socket.id });
        console.log(`Offer sent to socket: ${to} from ${socket.id}`);
    } else {
        console.warn(`No target socketId provided for room: ${to}`);
    }
});

socket.on('streamAnswer', ({ answer, to }) => {
    console.log('answer from ',socket.id)
    socket.to(to).emit('streamAnswer', { answer, from: socket.id });
});
    

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        for (const roomId in rooms) {
            rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
            socket.to(roomId).emit('userLeft', socket.id);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
