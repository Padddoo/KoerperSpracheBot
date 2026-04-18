/**
 * Serial audio queue using Web Audio API (AudioContext + BufferSource).
 *
 * Why not HTMLAudioElement: on iOS Safari a newly-constructed <audio>
 * element outside a user gesture is blocked — after turn 1, subsequent
 * TTS playback silently fails. AudioContext remains "unlocked" for the
 * lifetime of the tab once it has been resumed inside a user gesture.
 *
 * Each sentence's MP3 is fetched + decoded in parallel (pre-warm),
 * but playback happens strictly sequentially via the internal chain.
 */
export class AudioQueue {
  private chain: Promise<void> = Promise.resolve();
  private stopped = false;
  private activeSources: AudioBufferSourceNode[] = [];

  constructor(private ctx: AudioContext) {}

  enqueue(text: string): void {
    if (this.stopped) return;
    const url = `/api/tts?text=${encodeURIComponent(text)}`;
    // Fetch + decode kick off immediately (parallel pre-warm)
    const bufferPromise = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buf) => this.ctx.decodeAudioData(buf));
    this.chain = this.chain.then(() => this.playOne(bufferPromise));
  }

  private async playOne(
    bufferPromise: Promise<AudioBuffer>,
  ): Promise<void> {
    if (this.stopped) return;
    try {
      const buffer = await bufferPromise;
      if (this.stopped) return;
      await new Promise<void>((resolve) => {
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.ctx.destination);
        this.activeSources.push(source);
        const finish = () => {
          this.activeSources = this.activeSources.filter((s) => s !== source);
          resolve();
        };
        source.onended = finish;
        source.start(0);
      });
    } catch (err) {
      console.warn("TTS decode/play failed:", err);
    }
  }

  async waitForComplete(): Promise<void> {
    await this.chain;
  }

  stop(): void {
    this.stopped = true;
    for (const s of this.activeSources) {
      try {
        s.stop();
      } catch {}
    }
    this.activeSources = [];
    this.chain = Promise.resolve();
  }
}
