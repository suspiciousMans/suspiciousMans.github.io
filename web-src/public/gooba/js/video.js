// Extracts a capped set of frames from a video file by seeking through it
// and sampling into a canvas. Uses only native browser APIs.

function seekTo(video, time) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      video.removeEventListener('seeked', onSeeked);
      // Double rAF: give the compositor a couple of ticks to actually paint
      // the seeked-to frame before we sample it into a canvas.
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    };
    const onSeeked = () => finish();
    video.addEventListener('seeked', onSeeked);
    video.currentTime = time;
    setTimeout(finish, 1500); // safety net in case 'seeked' never fires
  });
}

export function extractVideoFrames(file, { maxFrames = 120, targetFps = 12, maxDimension = 480 } = {}) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = url;

    const cleanup = () => URL.revokeObjectURL(url);

    video.addEventListener('error', () => {
      cleanup();
      reject(new Error('Could not load video file'));
    });

    video.addEventListener('loadedmetadata', async () => {
      try {
        const duration = video.duration;
        if (!isFinite(duration) || duration <= 0) {
          throw new Error('Video has no readable duration');
        }

        try {
          await video.play();
          video.pause();
        } catch {
          // Autoplay may be blocked in some contexts; seeking usually still works.
        }

        const scale = Math.min(1, maxDimension / Math.max(video.videoWidth, video.videoHeight));
        const width = Math.max(1, Math.round(video.videoWidth * scale));
        const height = Math.max(1, Math.round(video.videoHeight * scale));

        const frameCount = Math.min(maxFrames, Math.max(1, Math.round(duration * targetFps)));
        const fps = frameCount / duration;
        const delay = 1000 / fps;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        const frames = [];
        for (let i = 0; i < frameCount; i++) {
          const t = Math.min(Math.max(0, duration - 0.02), (i / fps));
          await seekTo(video, t);
          ctx.drawImage(video, 0, 0, width, height);
          frames.push({ imageData: ctx.getImageData(0, 0, width, height), delay });
        }

        cleanup();
        resolve({ width, height, frames, fps });
      } catch (err) {
        cleanup();
        reject(err);
      }
    }, { once: true });
  });
}
