let io;

export function setIO(socketInstance) {
  io = socketInstance;
}

export function getIO() {
  return io;
}
