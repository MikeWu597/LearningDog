import { useRef, useState, useCallback, useEffect } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function useWebRTC({ socket, localStream, roomId, uuid, username }) {
  const peersRef = useRef({});
  const [remoteStreams, setRemoteStreams] = useState({});

  const createPeerConnection = useCallback((remoteSocketId, remoteUuid, remoteUsername) => {
    if (peersRef.current[remoteSocketId]) return peersRef.current[remoteSocketId].pc;

    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.current?.emit('ice-candidate', {
          to: remoteSocketId,
          candidate: e.candidate,
        });
      }
    };

    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (stream) {
        peersRef.current[remoteSocketId] = {
          ...peersRef.current[remoteSocketId],
          stream,
        };
        setRemoteStreams(prev => ({
          ...prev,
          [remoteSocketId]: { stream, uuid: remoteUuid, username: remoteUsername },
        }));
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        removePeer(remoteSocketId);
      }
    };

    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    peersRef.current[remoteSocketId] = { pc, uuid: remoteUuid, username: remoteUsername };
    return pc;
  }, [socket, localStream]);

  const removePeer = useCallback((socketId) => {
    if (peersRef.current[socketId]) {
      peersRef.current[socketId].pc?.close();
      delete peersRef.current[socketId];
    }
    setRemoteStreams(prev => {
      const next = { ...prev };
      delete next[socketId];
      return next;
    });
  }, []);

  useEffect(() => {
    if (!socket.current) return;
    const s = socket.current;

    const handleRoomUsers = async (users) => {
      for (const user of users) {
        if (user.socketId === s.id) continue;
        const pc = createPeerConnection(user.socketId, user.uuid, user.username);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        s.emit('offer', { to: user.socketId, offer });
      }
    };

    const handleUserJoined = ({ socketId, uuid: remoteUuid, username: remoteUsername }) => {
      createPeerConnection(socketId, remoteUuid, remoteUsername);
    };

    const handleOffer = async ({ from, offer }) => {
      const peer = peersRef.current[from];
      const pc = peer?.pc || createPeerConnection(from, peer?.uuid, peer?.username);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      s.emit('answer', { to: from, answer });
    };

    const handleAnswer = async ({ from, answer }) => {
      const peer = peersRef.current[from];
      if (peer?.pc) {
        await peer.pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    };

    const handleIceCandidate = async ({ from, candidate }) => {
      const peer = peersRef.current[from];
      if (peer?.pc) {
        await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    };

    const handleUserLeft = ({ socketId }) => {
      removePeer(socketId);
    };

    s.on('room-users', handleRoomUsers);
    s.on('user-joined', handleUserJoined);
    s.on('offer', handleOffer);
    s.on('answer', handleAnswer);
    s.on('ice-candidate', handleIceCandidate);
    s.on('user-left', handleUserLeft);

    return () => {
      s.off('room-users', handleRoomUsers);
      s.off('user-joined', handleUserJoined);
      s.off('offer', handleOffer);
      s.off('answer', handleAnswer);
      s.off('ice-candidate', handleIceCandidate);
      s.off('user-left', handleUserLeft);
    };
  }, [socket, createPeerConnection, removePeer]);

  useEffect(() => {
    if (!localStream) return;
    Object.values(peersRef.current).forEach(({ pc }) => {
      const senders = pc.getSenders();
      localStream.getTracks().forEach(track => {
        const sender = senders.find(s => s.track?.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track);
        } else {
          pc.addTrack(track, localStream);
        }
      });
    });
  }, [localStream]);

  const closeAll = useCallback(() => {
    Object.keys(peersRef.current).forEach(removePeer);
  }, [removePeer]);

  return { remoteStreams, closeAll };
}
