/**
 * Serial audio queue: fetches TTS for each sentence and plays them in order.
 * Subsequent sentences' TTS requests fire in parallel (browser cache / server
 * handles progressive download), but playback is strictly sequential.
 */
export class AudioQueue {
  private chain: Promise<void> = Promise.resolve();
  private elements: HTMLAudioElement[] = [];
  private stopped = false;

  enqueue(text: string): void {
    if (this.stopped) return;
    // Pre-warm the TTS fetch immediately (browser-initiated request)
    const url = `/api/tts?text=${encodeURIComponent(text)}`;
    const audio = new Audio(url);
    audio.preload = "auto";
    this.elements.push(audio);
    this.chain = this.chain.then(() => this.play(audio));
  }

  private play(audio: HTMLAudioElement): Promise<void> {
    if (this.stopped) return Promise.resolve();
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      audio.onended = finish;
      audio.onerror = finish;
      audio.play().catch(finish);
    });
  }

  async waitForComplete(): Promise<void> {
    await this.chain;
  }

  stop(): void {
    this.stopped = true;
    for (const a of this.elements) {
      try {
        a.pause();
        a.src = "";
      } catch {}
    }
    this.elements = [];
    this.chain = Promise.resolve();
  }
}
