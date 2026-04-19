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
 *
 * Defensive measures:
 * - ctx.resume() before every play (in case tab/screen-off paused it)
 * - skip empty/failed decodes
 * - watchdog timeout in case onended never fires
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
    const bufferPromise = fetch(url, { credentials: "same-origin" })
      .then((res) => {
        if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buf) => this.ctx.decodeAudioData(buf));
    this.chain = this.chain.then(() => this.playOne(bufferPromise, text));
  }

  private async playOne(
    bufferPromise: Promise<AudioBuffer>,
    text: string,
  ): Promise<void> {
    if (this.stopped) return;
    try {
      const buffer = await bufferPromise;
      if (this.stopped) return;
      if (!buffer || buffer.length === 0) {
        console.warn("[AudioQueue] empty audio buffer for:", text.slice(0, 40));
        return;
      }

      // Resume context if it drifted into suspended/interrupted.
      if (this.ctx.state !== "running") {
        try {
          await this.ctx.resume();
        } catch (err) {
          console.warn("[AudioQueue] resume failed:", err);
        }
      }

      await new Promise<void>((resolve) => {
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.ctx.destination);
        this.activeSources.push(source);

        let done = false;
        const timeoutMs = Math.max(
          1500,
          Math.ceil(buffer.duration * 1000) + 1500,
        );
        let timer: ReturnType<typeof setTimeout> | null = null;

        const finish = () => {
          if (done) return;
          done = true;
          if (timer !== null) clearTimeout(timer);
          this.activeSources = this.activeSources.filter((s) => s !== source);
          resolve();
        };

        source.onended = finish;
        // Watchdog: if onended never fires, unblock the chain anyway
        timer = setTimeout(finish, timeoutMs);

        try {
          source.start(0);
        } catch (err) {
          console.warn("[AudioQueue] source.start failed:", err);
          finish();
        }
      });
    } catch (err) {
      console.warn(
        "[AudioQueue] play failed for:",
        text.slice(0, 40),
        err,
      );
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
