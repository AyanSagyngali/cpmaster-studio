// Where finished videos live. On the phone: a file in Documents/CPMaster (Capacitor Filesystem), shared with the Share sheet.
// In a desktop browser: a Blob in IndexedDB and a normal download.
import { blobs } from './store.js';

const Cap = globalThis.Capacitor;
const FS = Cap?.Plugins?.Filesystem, SH = Cap?.Plugins?.Share;
export const native = !!(Cap?.isNativePlatform?.() && FS);

const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };

// -> a reference to keep in the video record
export async function put(id, bytes, onProgress) {
  if (!native) { await blobs.put(id, new Blob([bytes], { type: 'video/mp4' })); return { kind: 'idb', id }; }
  const path = `CPMaster/${id}.mp4`, CH = 3 * 1024 * 1024;                 // in pieces: a whole video in one base64 string would not fit the phone's memory
  for (let i = 0; i < bytes.length; i += CH) {
    const data = b64(bytes.subarray(i, i + CH));
    if (i === 0) await FS.writeFile({ path, data, directory: 'DOCUMENTS', recursive: true });
    else await FS.appendFile({ path, data, directory: 'DOCUMENTS' });
    onProgress?.(Math.min(1, (i + CH) / bytes.length));
  }
  const { uri } = await FS.getUri({ path, directory: 'DOCUMENTS' });
  return { kind: 'file', path, uri };
}

export async function url(ref) {
  if (ref.kind === 'file') return Cap.convertFileSrc(ref.uri);
  const b = await blobs.get(ref.id);
  return b ? URL.createObjectURL(b) : '';
}

// «Скачать»: on the phone the file is already in Documents/CPMaster; the share sheet also offers «Save to gallery»
export async function download(ref, name) {
  if (ref.kind === 'file') { await share(ref, name); return 'Видео лежит в Документы/CPMaster'; }
  const a = document.createElement('a'); a.href = await url(ref); a.download = `${name}.mp4`; a.click();
  return 'Скачивается';
}
export async function share(ref, title) {
  if (ref.kind === 'file' && SH) return SH.share({ title, files: [ref.uri] });
  const b = await blobs.get(ref.id);
  if (navigator.canShare?.({ files: [new File([b], 'video.mp4', { type: 'video/mp4' })] })) return navigator.share({ title, files: [new File([b], `${title}.mp4`, { type: 'video/mp4' })] });
  return download(ref, title);
}
export async function remove(ref) {
  if (ref.kind === 'file') { try { await FS.deleteFile({ path: ref.path, directory: 'DOCUMENTS' }); } catch { /* already gone */ } }
  else await blobs.del(ref.id);
}
