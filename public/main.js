// public/main.js
const socket = io();
let roomId;
let localStream;
let peers = {};

const joinRoomBtn = document.getElementById('joinRoomBtn');
const sendBtn = document.getElementById('sendBtn');
const messageInput = document.getElementById('messageInput');
const messages = document.getElementById('messages');
const localVideo = document.getElementById('localVideo');

joinRoomBtn.addEventListener('click', () => {
    roomId = document.getElementById('roomId').value;
    if (roomId) {
        socket.emit('joinRoom', roomId);
        initLocalStream();
    }
});

sendBtn.addEventListener('click', () => {
    const message = messageInput.value;
    socket.emit('sendMessage', { roomId, message });
    addMessage(`You: ${message}`);
    messageInput.value = '';
});

socket.on('receiveMessage', ({ message, sender }) => {
    addMessage(`${sender}: ${message}`);
});

socket.on('allUsers', (users) => {
    users.forEach(userId => createPeerConnection(userId, true));
});

socket.on('userJoined', (userId) => {
    createPeerConnection(userId, false);
});

socket.on('receiveOffer', async ({ offer, from }) => {
    const peerConnection = createPeerConnection(from, false);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', { roomId, answer, to: from });
});

socket.on('receiveAnswer', async ({ answer, from }) => {
    const peerConnection = peers[from];
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('receiveCandidate', async ({ candidate, from }) => {
    const peerConnection = peers[from];
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});

socket.on('userLeft', (userId) => {
    if (peers[userId]) {
        peers[userId].close();
        delete peers[userId];
    }
});

function addMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    messages.appendChild(messageElement);
}

async function initLocalStream() {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
}

function createPeerConnection(userId, isInitiator) {
    const peerConnection = new RTCPeerConnection();

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', { roomId, candidate: event.candidate, to: userId });
        }
    };

    peerConnection.ontrack = (event) => {
        const remoteVideo = document.createElement('video');
        remoteVideo.srcObject = event.streams[0];
        remoteVideo.autoplay = true;
        document.getElementById('videos').appendChild(remoteVideo);
    };

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    if (isInitiator) {
        peerConnection.createOffer()
            .then(offer => peerConnection.setLocalDescription(offer))
            .then(() => socket.emit('offer', { roomId, offer: peerConnection.localDescription, to: userId }));
    }

    peers[userId] = peerConnection;
    return peerConnection;
}
