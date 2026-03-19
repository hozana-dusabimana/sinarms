let ioInstance = null;

function setIO(io) {
  ioInstance = io;
}

function emit(eventName, payload) {
  if (ioInstance) {
    ioInstance.emit(eventName, payload);
  }
}

module.exports = {
  emit,
  setIO,
};
