// ─── Sons & musique (expo-audio, successeur officiel d'expo-av) ────────────
// Les bruitages sont de petits fichiers WAV générés sur mesure (pop, glissement,
// jingle de victoire, boucle musicale douce). Tout est protégé par try/catch :
// le jeu démarre et reste jouable même si l'audio est indisponible.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

type SoundName = 'pop' | 'slide' | 'click' | 'win' | 'error';

const SOURCES: Record<SoundName | 'music', number> = {
  pop: require('../../assets/sounds/pop.wav'),
  slide: require('../../assets/sounds/slide.wav'),
  click: require('../../assets/sounds/click.wav'),
  win: require('../../assets/sounds/win.wav'),
  error: require('../../assets/sounds/error.wav'),
  music: require('../../assets/sounds/music.wav'),
};

class SoundManager {
  private players = new Map<string, AudioPlayer>();
  private musicPlayer: AudioPlayer | null = null;
  soundEnabled = true;
  musicEnabled = true;
  private initialized = false;

  private async init() {
    if (this.initialized) return;
    this.initialized = true;
    try {
      await setAudioModeAsync({ playsInSilentMode: true });
    } catch { /* ignore */ }
  }

  private player(name: SoundName): AudioPlayer | null {
    try {
      let p = this.players.get(name);
      if (!p) {
        p = createAudioPlayer(SOURCES[name]);
        p.volume = name === 'slide' ? 0.5 : 0.9;
        this.players.set(name, p);
      }
      return p;
    } catch {
      return null;
    }
  }

  play(name: SoundName) {
    if (!this.soundEnabled) return;
    void this.init();
    try {
      const p = this.player(name);
      if (!p) return;
      void p.seekTo(0);
      p.play();
    } catch { /* ignore */ }
  }

  /** Démarre / arrête la musique de fond en boucle selon le réglage. */
  syncMusic() {
    void this.init();
    try {
      if (this.musicEnabled) {
        if (!this.musicPlayer) {
          this.musicPlayer = createAudioPlayer(SOURCES.music);
          this.musicPlayer.loop = true;
          this.musicPlayer.volume = 0.35;
        }
        this.musicPlayer.play();
      } else {
        this.musicPlayer?.pause();
      }
    } catch { /* ignore */ }
  }
}

export const sound = new SoundManager();
