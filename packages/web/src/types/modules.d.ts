// Type declarations for modules without TypeScript support

declare module 'three' {
  const THREE: unknown;
  export = THREE;
  export default THREE;
}

declare module 'vanta/dist/vanta.net.min' {
  interface VantaNetOptions {
    el: HTMLElement;
    THREE: unknown;
    mouseControls?: boolean;
    touchControls?: boolean;
    gyroControls?: boolean;
    minHeight?: number;
    minWidth?: number;
    scale?: number;
    scaleMobile?: number;
    color?: number;
    backgroundColor?: number;
    points?: number;
    maxDistance?: number;
    spacing?: number;
    showDots?: boolean;
  }

  interface VantaEffect {
    destroy: () => void;
  }

  export default function (options: VantaNetOptions): VantaEffect;
}

declare module '@met4citizen/talkinghead' {
  export interface TalkingHeadOptions {
    ttsEndpoint?: string;
    lipsyncModules?: string[];
    cameraView?: 'full' | 'upper' | 'head';
    avatarMood?: string;
  }

  export interface AvatarSpec {
    url: string;
    body?: 'M' | 'F';
    avatarMood?: string;
    lipsyncLang?: string;
  }

  export interface SpeakAudioInput {
    audio: AudioBuffer | Int16Array[];
    words?: string[];
    wtimes?: number[];
    wdurations?: number[];
    visemes?: string[];
    vtimes?: number[];
    vdurations?: number[];
  }

  export class TalkingHead {
    constructor(node: HTMLElement, opt?: TalkingHeadOptions);
    showAvatar(avatar: AvatarSpec, onprogress?: (event: unknown) => void): Promise<void>;
    start(): void;
    stop(): void;
    dispose(): void;
    speakAudio(
      input: SpeakAudioInput,
      opt?: Record<string, unknown>,
      onsubtitles?: ((text: string) => void) | null,
    ): void;
  }
}

declare module 'vanta/dist/vanta.topology.min' {
  interface VantaTopologyOptions {
    el: HTMLElement;
    p5: unknown;
    mouseControls?: boolean;
    touchControls?: boolean;
    gyroControls?: boolean;
    minHeight?: number;
    minWidth?: number;
    scale?: number;
    scaleMobile?: number;
    color?: number;
    backgroundColor?: number;
  }

  interface VantaEffect {
    destroy: () => void;
  }

  export default function (options: VantaTopologyOptions): VantaEffect;
}
