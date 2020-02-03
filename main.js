// import { resolve } from "dns";
window.location.hash = window.location.hash.slice(1).replace(/\//g, "");
let conferencehash = window.location.hash;
const drone = new ScaleDrone("Og1GaGRRhJCNdfKd");
const roomName =
  "observable-" + (conferencehash ? conferencehash : "babakConference");
const configuration = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302"
    }
  ]
};
let pcs = [];
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
  room.on("data", messageHandeler);
  members = roomMems.slice(1);
  for (let m of members) {
    let pc = await getPC(m.id);
    pc.onnegotiationneeded = () =>
      pc
        .createOffer()
        .then(desc =>
          pc.setLocalDescription(
            desc,
            () => sendMessage({ target: m.id, sdp: pc.localDescription }),
            onError
          )
        )
        .catch(onError);
  }
})();

async function messageHandeler(data, meta) {
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
}
async function getRoom() {
  r = drone.subscribe(roomName);
  r.on(
    "members",
    m => (console.log(m), (roomMems = Array.isArray(m) ? m : [m]))
  );

  return await new Promise(resolve => {
    r.on("open", error => {
      if (error) throw new Error(error);
      resolve(r);
    });
  });
}

async function getPC(id) {
  let pcCon = pcs.find(p => p.id == id) || {};

  if (pcCon.connection) return pcCon.connection;
  pcCon = { id, connection: new RTCPeerConnection(configuration) };
  pc = pcCon.connection;
  while (!pc) await new Promise(r => setTimeout(r, 500));
  stream.getTracks().some(track => {
    if (track.kind == "audio") track.enabled = false;
    pcCon[track.kind] = pc.addTrack(track, stream);
  });
  pc.onicecandidate = event => {
    if (event.candidate)
      sendMessage({ target: id, candidate: event.candidate });
  };

  pc.ontrack = async event => {
    window.remotetrack = [...(window.remotetrack || []), event];
    const stream = event.streams[0];
    if (videos.includes(stream.id)) return;
    video = document.createElement("video");
    video.id =id;
    video.ondblclick = e => {
      let st = e.target.style;
      if (!e.target.fullscreened) {
        e.target.position = { x: 0, y: 0 };
        st.transform = "";
        st.zIndex = 5;
        st.position = "fixed";
        st.width = "100%";
        st.maxWidth = "100%";
        st.maxHeight = "100%";
        st.height = "100%";
        window.localVideo.style.zIndex = 6;
        e.target.fullscreened = true;
      } else {
        st.maxWidth = "50%";
        st.maxHeight = "50%";
        st.position = "relative";
        st.zIndex = 2;
        window.localVideo.style.zIndex = 3;
        e.target.fullscreened = false;
      }
    };
    video.autoplay = true;
    // video.controls = true;
    video.classList.add("draggable");
    video.srcObject = stream;
    videos.push(stream.id);
    videosContainer.appendChild(video);
    draggables();
  };
  pc.oniceconnectionstatechange = function(ev) {
    if(pc.iceConnectionState == 'disconnected') {
        window.videosContainer.removeChild(window[id]);
        pc = pcs.find(p=>p.id == id);
        pc = null;
        pcs.filter(p=>p);
        console.log('Disconnected',id);
    }
}
  pcCon.channel = pc.createDataChannel("chat", { negotiated: true, id: 0 });
  pcCon.channel.onmessage = function(event) {
    console.log(event.data);
  };

  pcs.push(pcCon);
  return pc;
}

function sendMessage(message) {
  drone.publish({
    room: roomName,
    message
  });
}

function draggables() {
  interact(".draggable").draggable({
    listeners: {
      start(event) {
        Array.from(document.querySelectorAll(".draggable")).forEach(e => {
          e.style.zIndex = 1;
        });
        event.target.style.zIndex = 3;
        event.target.position = event.target.position || { x: 0, y: 0 };
      },
      move(event) {
        let position = event.target.position;
        position.x += event.dx;
        position.y += event.dy;

        event.target.style.transform = `translate(${position.x}px, ${position.y}px)`;
      }
    }
  });
}

draggables();
document.onclick = event => {
  if (event.target.classList.contains("draggable")) {
    Array.from(document.querySelectorAll(".draggable")).forEach(e => {
      e.style.zIndex = 1;
    });
    event.target.style.zIndex = 3;
  }
  if (event.target.id == "muteVideo") {
    stream.getTracks().some(t => {
      if (t.kind != "video") return false;
      t.enabled = !t.enabled;
      if (t.enabled) {
        muteVideo.classList.remove("disabled");
      } else {
        muteVideo.classList.add("disabled");
      }
    });
  }
  if (event.target.id == "muteAudio") {
    stream.getTracks().some(t => {
      if (t.kind != "audio") return false;
      t.enabled = !t.enabled;
      if (t.enabled) {
        muteAudio.classList.remove("disabled");
      } else {
        muteAudio.classList.add("disabled");
      }
    });
  }
};
