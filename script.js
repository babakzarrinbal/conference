// TODO: Replace with your own channel ID
const drone = new ScaleDrone("Og1GaGRRhJCNdfKd");
// Room name needs to be prefixed with 'observable-'
const roomName = "observable-" + "babakConference";
const configuration = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302"
    }
  ]
};
let videos = [],
  pcs = {};
let roomRs, roomRj;
let room = new Promise((res, rej) => {
  roomRs = res;
  roomRj = rej;
});

let strRs, strRj;
let stream;

function onSuccess() {}
function onError(...args) {
  console.error(...args);
}

async function getPC(id) {
  let pc = (pcs[id] || {}).connection;
  if (!pc) {
    pc = new RTCPeerConnection(configuration);
    while (!pc) {
      await new Promise(r => setTimeout(r, 500));
    }
    pc.onconnectionstatechange = console.log;
    pc.onicecandidate = event => {
      if (event.candidate) sendMessage({ candidate: event.candidate });
    };

    // stream
    //   .then(s => {
    // localVideo.srcObject = stream;
    while (!stream) {
      await new Promise(r => setTimeout(r, 500));
    }
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });
    // })
    // .catch(onError);
    pc.ontrack = async event => {
      console.log("ontrack");
      const stream = event.streams[0];
      remoteVideo.srcObject = stream;
      return;
      let video = videos.find(v => v.srcObject.id == stream.id);
      if (!video) {
        video = document.createElement("video");
        video.autoplay = true;
        videos.push(video);
        remoteVideos.appendChild(video);
      }

      video.srcObject = stream;
      console.log("remote stream", video.srcObject);
    };
    pcs[id] = pc;
  }
  
  return pc;
}
drone.on("open", error => {
  
  if (error) return roomRj(error);
  r = drone.subscribe(roomName);
  r.on("open", error => {
    if (error) return roomRj(error);
    return roomRs(r);
  });
  r.on("data", async (data, meta) => {
    if (meta.id == drone.clientId) return;
    console.log(meta.id, drone.clientId);
    let pc = await getPC(meta.id);
    if (data.sdp) {
      // This is called after receiving an offer or answer from another peer
      pc.setRemoteDescription(
        new RTCSessionDescription(data.sdp),
        async () => {
          // When receiving an offer lets answer it
          while (!((pc || {}).remoteDescription || {}).type)
            await new Promise(r => setTimeout(() => r, 500));
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
    } else if (data.candidate) {
      // Add the new ICE candidate to our connections remote description
      while (!((pc || {}).remoteDescription || {}).type)
        await new Promise(r => setTimeout(() => r, 500));
      pc.addIceCandidate(
        new RTCIceCandidate(data.candidate),
        onSuccess,
        error => onError(error, "here")
      );
    }
  });
  r.on("members", async members => {
    console.log("members", members);
    members.shift();
    for (let m of members) {
      let pc = await getPC(m.id);
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
  });
});

// Send signaling data via Scaledrone
function sendMessage(message) {
  console.log("sending message: ", message);
  drone.publish({
    room: roomName,
    message
  });
}

navigator.mediaDevices
  .getUserMedia({
    audio: true,
    video: true
  })
  .then(str => {
    stream = str;
    localVideo.srcObject = str;
  }, strRj);
