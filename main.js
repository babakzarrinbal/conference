// import { resolve } from "dns";

const drone = new ScaleDrone("Og1GaGRRhJCNdfKd");
const roomName = "observable-" + "babakConference";
const configuration = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302"
    }
  ]
};
let pcs = {};
let roomMems;
let stream;
let videos = [];
const onError = (...m) => console.error(...m);
const onSuccess = () => {};

(async () => {
  stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });
  localVideo.srcObject = stream;
  let room = await getRoom();
  room.on("data", async (data, meta) => {
    if (meta.id == drone.clientId || data.target != drone.clientId) return;
    let pc = await getPC(meta.id);
    if (data.sdp) {
      pc.setRemoteDescription(
        new RTCSessionDescription(data.sdp),
        async () => {
          while (!((pc || {}).remoteDescription || {}).type)
            await new Promise(r => setTimeout(() => r, 500));
          if (pc.remoteDescription.type === "offer") {
            pc.createAnswer()
              .then(desc => {
                pc.setLocalDescription(
                  desc,
                  () =>
                    sendMessage({ target: meta.id, sdp: pc.localDescription }),
                  e => onError("setLocalDescription: ", e)
                );
              })
              .catch(e => onError("createAnswer: ", e));
          }
        },
        e => onError("setRemoteDescription: ", e)
      );
    } else if (data.candidate) {
      while (!((pc || {}).remoteDescription || {}).type)
        await new Promise(r => setTimeout(() => r, 500));
      pc.addIceCandidate(new RTCIceCandidate(data.candidate), onSuccess, e =>
        onError("addIceCandidate: ", e)
      );
    }
  });
  members = roomMems.slice(1);
  for (let m of members) {
    let pc = await getPC(m.id);
    pc.onnegotiationneeded = () => {
      pc.createOffer()
        .then(desc => {
          pc.setLocalDescription(
            desc,
            () => sendMessage({ target: m.id, sdp: pc.localDescription }),
            onError
          );
        })
        .catch(onError);
    };
  }
})();

async function getRoom() {
  r = drone.subscribe(roomName);
  r.on("members", m => (roomMems = Array.isArray(m) ? m : [m]));
  return await new Promise(resolve => {
    r.on("open", error => {
      if (error) throw new Error(error);
      resolve(r);
    });
  });
}

async function getPC(id) {
  let pc = pcs[id];
  if (pc) return pc;
  pc = new RTCPeerConnection(configuration);
  while (!pc) await new Promise(r => setTimeout(r, 500));
  stream.getTracks().forEach(track => {
    pc.addTrack(track, stream);
  });
  pc.onconnectionstatechange= (...args)=>console.log("connection changed: ",...args);
  pc.onicecandidate = event => {
    if (event.candidate)
      sendMessage({ target: id, candidate: event.candidate });
  };
  pc.ontrack = async event => {
    window.remotetrack = [...(window.remotetrack || []), event];
    const stream = event.streams[0];
    if (videos.includes(stream.id)) return;
    video = document.createElement("video");
    video.autoplay = true;
    video.controls = true;
    video.srcObject = stream;
    videos.push(stream.id);
    remoteVideos.appendChild(video);
  };
  pcs[id] = pc;
  return pc;
}

function sendMessage(message) {
  drone.publish({
    room: roomName,
    message
  });
}
