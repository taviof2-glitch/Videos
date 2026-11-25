// BarcodeDetector existe en Chrome/Edge para Android y en algunos escritorios; no en Safari ni Firefox.
// Donde no existe, el código se escribe a mano o con un lector USB/Bluetooth (que teclea en el campo).
export type Detector = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> }
type DetectorCtor = new (opts?: { formats?: string[] }) => Detector
export const BarcodeDetectorApi = (globalThis as { BarcodeDetector?: DetectorCtor }).BarcodeDetector

export const canScan = Boolean(BarcodeDetectorApi && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia)
