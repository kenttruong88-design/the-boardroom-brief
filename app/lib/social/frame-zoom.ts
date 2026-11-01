import sharp from "sharp";
import { locateFace } from "./frame-identity-review";

// Full-body 9:16 start frames leave her face ~130px wide in the 1080x1920
// avatar video, too small for Hedra to animate expressions or hold her eye
// colour (Priya's India–Spain clips, 11-01: grey eyes turned brown mid-clip in
// three of four). Cropping in toward the face before animating gives the
// model a much larger face to work from.

/** Output size: the avatar video's own resolution. */
const OUT_W = 1080, OUT_H = 1920;

export interface ZoomOptions {
  /** Crop bottom, in face heights below the top of her face: ~5 = mid-thigh, ~6 = knees, ~7.5 = full body. */
  facesBelow?: number;
  /** Headroom above the face (hair), in face heights. */
  headroom?:   number;
  /** Horizontal placement of the face in the crop, 0 = left edge, 0.5 = centred. */
  faceX?:      number;
}

export async function zoomStartFrame(frame: Buffer, opts: ZoomOptions = {}): Promise<Buffer> {
  const { facesBelow = 6, headroom = 0.9, faceX = 0.5 } = opts;
  const { width = 0, height = 0 } = await sharp(frame).metadata();
  const box = await locateFace(frame);
  if (!box) throw new Error("Could not locate her face to zoom on");

  const faceH  = (box.y1 - box.y0) * height;
  const faceCx = ((box.x0 + box.x1) / 2) * width;
  let top      = box.y0 * height - headroom * faceH;
  let cropH    = (headroom + facesBelow) * faceH;
  let cropW    = (cropH * OUT_W) / OUT_H;
  if (cropW > width) { cropW = width; cropH = (cropW * OUT_H) / OUT_W; }
  if (cropH > height) { cropH = height; cropW = (cropH * OUT_W) / OUT_H; }
  top = Math.min(Math.max(top, 0), height - cropH);
  const left = Math.min(Math.max(faceCx - faceX * cropW, 0), width - cropW);

  return sharp(frame)
    .extract({ left: Math.round(left), top: Math.round(top), width: Math.round(cropW), height: Math.round(cropH) })
    // Upscaling a ~800px crop to 1080 wide; lanczos keeps it closest to the
    // source without inventing detail (a generative upscale would redraw her face).
    .resize(OUT_W, OUT_H, { fit: "fill", kernel: "lanczos3" })
    .png()
    .toBuffer();
}
