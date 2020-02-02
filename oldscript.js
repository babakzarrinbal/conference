// TODO: Replace with your own channel ID
const drone = new ScaleDrone("u7oAvsl3CaxdZdVR");
// Room name needs to be prefixed with 'observable-'
const roomName = "observable-" + "babakVideo";
const configuration = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302"
    }
  ]
};
let room;
let pc;
let stream;

function onSuccess() {}
function onError(error) {
  console.error(error);
}

drone.on("open", error => {
  if (error) {
    return console.error(error);
  }
  room = drone.subscribe(roomName);
  room.on("open", error => {
    if (error) {
      onError(error);
    }
  });
  // We're connected to the room and received an array of 'members'
  // connected to the room (including us). Signaling server is ready.
  room.on("members", members => {
    console.log("MEMBERS", members);
    if (members.length >= 3) {
      return alert('The room is full');
    }
    // If we are the second user to connect to the room we will be creating the offer
    const isOfferer = members.length >= 2;
    startWebRTC(isOfferer);
    
  });
});

// Send signaling data via Scaledrone
function sendMessage(message) {
  drone.publish({
    room: roomName,
    message
  });
}

function startWebRTC(isOfferer) {
  let pc = new RTCPeerConnection(configuration);

  // 'onicecandidate' notifies us whenever an ICE agent needs to deliver a
  // message to the other peer through the signaling server
  pc.onicecandidate = event => {
    console.log('onicecandidate',event.candidate)
    if (event.candidate) {
      sendMessage({ candidate: event.candidate });
    }
  };

  // If user is offerer let the 'negotiationneeded' event create the offer
  if (isOfferer) {
    pc.onnegotiationneeded = () => {
      pc.createOffer()
        .then(desc => {
          pc.setLocalDescription(
            desc,
            () => sendMessage({ sdp: pc.localDescription }),
            onError
          );
        })
        .catch(onError);
    };
  }

  // When a remote stream arrives display it in the #remoteVideo element
  pc.ontrack = event => {
    const stream = event.streams[0];
    if (!remoteVideo.srcObject || remoteVideo.srcObject.id !== stream.id) {
      remoteVideo.srcObject = stream;
    }
  };

  stream.getTracks().forEach(track => pc.addTrack(track, stream));

  // Listen to signaling data from Scaledrone
  room.on("data", (message, client) => {
    // Message was sent by us
    if (client.id === drone.clientId) {
      return;
    }
    if (message.sdp) {
      // This is called after receiving an offer or answer from another peer
      pc.setRemoteDescription(
        new RTCSessionDescription(message.sdp),
        () => {
          // When receiving an offer lets answer it
          if (pc.remoteDescription.type === "offer") {
            pc.createAnswer()
              .then(desc => {
                pc.setLocalDescription(
                  desc,
                  () => sendMessage({ sdp: pc.localDescription }),
                  onError
                );
              })
              .catch(onError);
          }
        },
        onError
      );
    } else if (message.candidate) {
      // Add the new ICE candidate to our connections remote description
      pc.addIceCandidate(
        new RTCIceCandidate(message.candidate),
        onSuccess,
        onError
      );
    }
  });
}

navigator.mediaDevices
    .getUserMedia({
      audio: true,
      video: true
    })
    .then(stre => {
      // Display your local video in #localVideo element
      localVideo.srcObject = stre;
      stream = stre;
      // Add your stream to be sent to the conneting peer
      
    }, onError);