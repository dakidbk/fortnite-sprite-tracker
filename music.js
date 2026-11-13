const beat = 60 / 82;
const chords = [
  [45,57,60,64,67], [41,53,57,60,64], [48,55,59,64,67], [43,55,59,62,65],
  [45,57,60,64,71], [41,53,57,60,67], [50,57,60,65,69], [43,55,59,62,67]
];
const melodies = [
  [[.5,76],[1.5,72],[2.5,69]], [[0,72],[1.75,69],[3,67]],
  [[.5,74],[1.5,76],[2.75,79]], [[.25,77],[1.25,74],[3,71]],
  [[.5,76],[1.5,79],[2.5,81]], [[0,76],[1.25,72],[2.75,69]],
  [[.5,77],[1.75,74],[3,72]], [[.5,74],[1.75,71],[3,67]]
];

function note(context, destination, midi, start, duration, volume, type, attack=.03) {
  const oscillator = context.createOscillator(), envelope = context.createGain();
  oscillator.type = type;
  oscillator.frequency.value = 440 * 2 ** ((midi-69)/12);
  envelope.gain.setValueAtTime(.0001,start);
  envelope.gain.exponentialRampToValueAtTime(volume,start+attack);
  envelope.gain.exponentialRampToValueAtTime(.0001,start+duration);
  oscillator.connect(envelope).connect(destination);
  oscillator.start(start);
  oscillator.stop(start+duration);
}

export function createMusic(getAudio) {
  let mix, timer, bar = 0, nextBar = 0;

  function schedule(context) {
    if (nextBar < context.currentTime) nextBar = context.currentTime+.05;
    if (nextBar > context.currentTime+.31) return;
    const [bass,...chord] = chords[bar];
    chord.forEach((pitch,i) => {
      note(context,mix,pitch,nextBar+i*.035,beat*3.35,.105,'triangle',.09);
      note(context,mix,pitch,nextBar+beat*(2+i*.17),beat*.87,.046,'sine');
    });
    note(context,mix,bass,nextBar,beat*1.65,.27,'sine');
    note(context,mix,bass+7,nextBar+beat*2.5,beat*.81,.16,'sine');
    for (const [offset,pitch] of melodies[bar]) {
      const start = nextBar+offset*beat;
      note(context,mix,pitch,start,beat*.90,.13,'sine');
      note(context,mix,pitch+12,start,beat*.43,.026,'sine',.014);
    }
    nextBar += beat*4;
    bar = (bar+1)%chords.length;
  }

  return {
    async start() {
      if (mix) return;
      let output;
      try {
        const context = getAudio();
        output = context.createGain();
        output.gain.value = .19;
        mix = output;
        output.connect(context.destination);
        if (context.state !== 'running') await context.resume();
        if (mix !== output) return;
        nextBar = context.currentTime+.10;
        schedule(context);
        timer = setInterval(() => schedule(context),120);
      } catch {
        if (mix === output) this.stop();
      }
    },
    stop() {
      clearInterval(timer);
      mix?.disconnect();
      mix = null;
    }
  };
}
