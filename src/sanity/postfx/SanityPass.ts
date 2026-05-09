import { ShaderMaterial, UniformsUtils, Vector2 } from "three";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

const SanityShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uSanity: { value: 1.0 },
    uResolution: { value: new Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uSanity;
    uniform vec2 uResolution;
    varying vec2 vUv;

    // hash for noise
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
      float decay = clamp(1.0 - uSanity, 0.0, 1.0);

      // Barrel distortion that grows with low sanity
      vec2 centered = vUv - 0.5;
      float r2 = dot(centered, centered);
      float barrel = 1.0 + decay * 0.18 * r2;
      vec2 uv = centered * barrel + 0.5;

      // Chromatic aberration
      float caStrength = 0.0015 + decay * 0.012;
      vec2 caDir = normalize(centered + 1e-5);
      vec2 uvR = uv + caDir * caStrength;
      vec2 uvB = uv - caDir * caStrength;

      float r = texture2D(tDiffuse, uvR).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uvB).b;
      vec3 col = vec3(r, g, b);

      // Pulsing vignette
      float pulse = 0.5 + 0.5 * sin(uTime * (0.4 + decay * 1.2));
      float vig = smoothstep(0.95, 0.35 - decay * 0.18, length(centered));
      col *= mix(1.0, vig, 0.55 + decay * 0.35 * pulse);

      // Film grain
      float grain = (hash(vUv * uResolution + uTime) - 0.5) * (0.04 + decay * 0.12);
      col += grain;

      // Slight desaturation as sanity drops
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, vec3(lum), decay * 0.25);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export class SanityPass extends ShaderPass {
  constructor() {
    super(
      new ShaderMaterial({
        uniforms: UniformsUtils.clone(SanityShader.uniforms),
        vertexShader: SanityShader.vertexShader,
        fragmentShader: SanityShader.fragmentShader,
      })
    );
  }

  setSanity(value: number): void {
    this.uniforms.uSanity.value = value;
  }

  setTime(t: number): void {
    this.uniforms.uTime.value = t;
  }

  setResolution(w: number, h: number): void {
    this.uniforms.uResolution.value.set(w, h);
  }
}
