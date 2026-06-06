class PitchCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._frameSize = 2048;
    this._buf = new Float32Array(this._frameSize);
    this._n = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i++) {
      this._buf[this._n++] = channel[i];
      if (this._n >= this._frameSize) {
        this.port.postMessage(this._buf.slice(0));
        this._n = 0;
      }
    }
    return true;
  }
}

registerProcessor("pitch-capture", PitchCaptureProcessor);
