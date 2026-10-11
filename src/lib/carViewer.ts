// Config shared between the landing page and the WebGL viewer. Kept free of
// three.js imports so the page can use it during SSR.

export type ViewMode = "exterior" | "interior";

export interface PaintOption {
  id: string;
  name: string;
  color: string;
}

export const PAINTS: PaintOption[] = [
  { id: "portimao", name: "Portimao Blue", color: "#1b4a8c" },
  { id: "sapphire", name: "Black Sapphire", color: "#0c0e12" },
  { id: "brooklyn", name: "Brooklyn Grey", color: "#7d848b" },
  { id: "alpine", name: "Alpine White", color: "#e9eae6" },
  { id: "isle", name: "Isle of Man Green", color: "#1d4a3a" },
];

// A click on the page's +/- buttons. Scroll-wheel zoom is off in both viewers
// so the wheel always scrolls the page; `nonce` makes repeated clicks in the
// same direction register as new requests.
export interface ZoomRequest {
  step: 1 | -1; // 1 = zoom in, -1 = zoom out
  nonce: number;
}
