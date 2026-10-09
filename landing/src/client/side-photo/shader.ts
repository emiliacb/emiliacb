/**
 * WGSL for the side photo on the services page, run by vgpu as a fullscreen
 * effect over the photo's canvas.
 *
 * - Parallax: a depth map baked offline (Depth Anything V2) lets the subject
 *   slide over the background as `pointer` moves.
 * - Depth of field: when the photo is turned on the Y axis (compact screens),
 *   each pixel's distance combines how far its side of the card has rotated
 *   away and how deep it sits in the scene. Behind the focus it blurs.
 * - Blob outline: the edge radius breathes with time and bulges toward the
 *   pointer, instead of a hard circle.
 */
export const SIDE_PHOTO_WGSL = /* wgsl */ `
struct Params {
  resolution: vec2f,
  pointer: vec2f,
  hover: f32,
  time: f32,
  farBlur: f32,
}
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var photo: texture_2d<f32>;
@group(0) @binding(2) var depth: texture_2d<f32>;
@group(0) @binding(3) var linear: sampler;

const GOLDEN_ANGLE: f32 = 2.39996323;
const BLUR_TAPS: i32 = 48;
const PARALLAX_STEPS: i32 = 48;

fn distanceFromViewer(p: vec2f, sceneDepth: f32) -> f32 {
  // The left edge recedes when the card is turned.
  let cardFar = clamp((-p.x + 1.0) * 0.5, 0.0, 1.0);
  // The backdrop sits far behind; within the subject the depth map still
  // separates the hands (nearest) from the face and hair.
  let backdrop = 1.0 - smoothstep(0.06, 0.3, sceneDepth);
  let sceneFar = 0.75 * backdrop + 0.25 * (1.0 - sceneDepth);
  return 0.5 * cardFar + 0.5 * sceneFar;
}

fn defocus(uv: vec2f, p: vec2f) -> vec3f {
  let centerDepth = textureSampleLevel(depth, linear, uv, 0.0).r;
  let focus = 0.34;
  let z = distanceFromViewer(p, centerDepth);
  let radius = params.farBlur * max(0.0, z - focus) / (1.0 - focus) * 0.05;
  if (radius < 0.0005) {
    return textureSampleLevel(photo, linear, uv, 0.0).rgb;
  }
  var sum = vec3f(0.0);
  var weight = 0.0;
  for (var i = 0; i < BLUR_TAPS; i = i + 1) {
    let fi = f32(i) + 0.5;
    let rr = sqrt(fi / f32(BLUR_TAPS)) * radius;
    let a = fi * GOLDEN_ANGLE;
    let tapUv = uv + vec2f(cos(a), sin(a)) * rr;
    // Skip taps clearly in front of this pixel, so the sharp subject does
    // not smear a halo into the blurred background behind it.
    let tapDepth = textureSampleLevel(depth, linear, tapUv, 0.0).r;
    let w = 1.0 - smoothstep(centerDepth + 0.05, centerDepth + 0.15, tapDepth);
    sum += textureSampleLevel(photo, linear, tapUv, 0.0).rgb * w;
    weight += w;
  }
  return sum / max(weight, 1e-3);
}

fn blobMask(p: vec2f) -> f32 {
  let a = atan2(p.y, p.x);
  let t = params.time;
  var edge = 0.86;
  edge += 0.045 * sin(2.0 * a + t * 0.55);
  edge += 0.035 * sin(3.0 * a - t * 0.8 + 1.7);
  edge += 0.022 * sin(5.0 * a + t * 1.1 + 0.4);
  edge += 0.012 * sin(7.0 * a - t * 1.4 + 2.9);
  let toward = dot(normalize(p + vec2f(1e-5)), params.pointer) * 0.5;
  edge += 0.04 * params.hover * max(0.0, toward);
  edge = min(edge, 0.985);
  let feather = 0.025;
  return 1.0 - smoothstep(edge - feather, edge, length(p));
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let p = uv * 2.0 - 1.0;
  let mask = blobMask(p);
  if (mask <= 0.0) {
    return vec4f(0.0);
  }
  // Zoomed in so the displacement never samples outside the photo.
  let base = (uv - 0.5) * 0.84 + 0.5;
  let shift = params.pointer * 0.13;
  // Steep parallax with a binary refinement, so the silhouette stays crisp
  // at large offsets.
  var prevLayer = 1.0;
  var hitLayer = 0.0;
  var hitUv = base - shift * 0.5;
  for (var i = 0; i < PARALLAX_STEPS; i = i + 1) {
    let layer = 1.0 - f32(i) / f32(PARALLAX_STEPS - 1);
    let layerUv = base + shift * (layer - 0.5);
    let d = textureSampleLevel(depth, linear, layerUv, 0.0).r;
    if (d >= layer) { hitLayer = layer; hitUv = layerUv; break; }
    prevLayer = layer;
  }
  for (var j = 0; j < 6; j = j + 1) {
    let midLayer = 0.5 * (prevLayer + hitLayer);
    let midUv = base + shift * (midLayer - 0.5);
    let d = textureSampleLevel(depth, linear, midUv, 0.0).r;
    if (d >= midLayer) { hitLayer = midLayer; hitUv = midUv; } else { prevLayer = midLayer; }
  }
  let color = defocus(hitUv, p);
  return vec4f(color * mask, mask);
}
`;
