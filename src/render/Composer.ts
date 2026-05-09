import { Vector2 } from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { SanityPass } from "../sanity/postfx/SanityPass";
import type { Renderer } from "./Renderer";

export class Composer {
  readonly composer: EffectComposer;
  readonly sanityPass: SanityPass;
  readonly bloom: UnrealBloomPass;

  constructor(r: Renderer) {
    this.composer = new EffectComposer(r.renderer);
    this.composer.setSize(window.innerWidth, window.innerHeight);

    this.composer.addPass(new RenderPass(r.scene, r.camera));

    this.bloom = new UnrealBloomPass(
      new Vector2(window.innerWidth, window.innerHeight),
      0.45,
      0.55,
      0.85
    );
    this.composer.addPass(this.bloom);

    this.sanityPass = new SanityPass();
    this.sanityPass.setResolution(window.innerWidth, window.innerHeight);
    this.composer.addPass(this.sanityPass);

    this.composer.addPass(new OutputPass());

    window.addEventListener("resize", this.onResize);
  }

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.composer.setSize(w, h);
    this.sanityPass.setResolution(w, h);
    this.bloom.setSize(w, h);
  };

  render(elapsed: number, sanity: number): void {
    this.sanityPass.setTime(elapsed);
    this.sanityPass.setSanity(sanity);
    this.composer.render();
  }
}
