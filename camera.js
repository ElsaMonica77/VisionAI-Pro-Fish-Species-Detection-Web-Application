// Mengelola akses kamera dan deteksi objek real-time

// Fungsi utilitas untuk retry dengan delay
async function delayedRetry(
  fn,
  retries = 3,
  delay = 1000,
  finalErrorHandler = null
) {
  let lastError;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      console.warn(`Attempt ${attempt + 1}/${retries} failed:`, err);
      lastError = err;
      if (attempt < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  if (finalErrorHandler) return finalErrorHandler(lastError);
  else throw lastError;
}

// Fungsi untuk menangkap frame dari video dan mengirim ke API
function captureFrame(video) {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0);

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve(blob);
      },
      "image/jpeg",
      0.8
    );
  });
}

document.addEventListener("DOMContentLoaded", async function () {
  const video = document.getElementById("camera");
  const overlayCanvas = document.getElementById("overlayCanvas");

  if (!video || !overlayCanvas) {
    console.error("Video atau canvas element tidak ditemukan!");
    return;
  }

  const ctx = overlayCanvas.getContext("2d");

  // Gunakan API key dan konfigurasi yang sama dengan script.js
  const ROBOFLOW_PROJECT_ID = "dataset-6nff1";
  const ROBOFLOW_VERSION_ID = "4";
  const ROBOFLOW_API_KEY = "UL8nLpCiEBGbxYqRq0nY";
  const ROBOFLOW_API_URL = `https://detect.roboflow.com/${ROBOFLOW_PROJECT_ID}/${ROBOFLOW_VERSION_ID}?api_key=${ROBOFLOW_API_KEY}&format=json&confidence=40`;

  let modelReady = false;
  let lastDetectionTime = 0;
  const DETECTION_INTERVAL = 1000; // Deteksi setiap 1 detik untuk menghindari rate limiting

  // Fungsi untuk mengirim frame ke Roboflow API
  async function detectObjects(imageBlob) {
    try {
      const formData = new FormData();
      formData.append("file", imageBlob);

      const response = await delayedRetry(
        async () => {
          const resp = await fetch(ROBOFLOW_API_URL, {
            method: "POST",
            body: formData,
          });

          if (!resp.ok) {
            const errorBody = await resp.text();
            console.error("Roboflow API Error:", errorBody);
            throw new Error(`HTTP error ${resp.status}: ${resp.statusText}`);
          }

          return resp;
        },
        2, // retries
        1000, // delay
        (err) => {
          console.warn(
            "API detection failed, continuing without detection:",
            err
          );
          return null;
        }
      );

      if (!response) return [];

      const result = await response.json();
      return result.predictions || [];
    } catch (error) {
      console.error("Error dalam deteksi objek:", error);
      return [];
    }
  }

  function drawDetections(predictions) {
    if (!ctx || !overlayCanvas) return;

    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    ctx.strokeStyle = "lime";
    ctx.lineWidth = 2;
    ctx.font = "16px Arial";
    ctx.fillStyle = "lime";

    predictions.forEach((pred) => {
      if (
        pred.x !== undefined &&
        pred.y !== undefined &&
        pred.width !== undefined &&
        pred.height !== undefined
      ) {
        // Roboflow API memberikan koordinat dalam format berbeda
        const x = pred.x - pred.width / 2;
        const y = pred.y - pred.height / 2;
        const width = pred.width;
        const height = pred.height;

        ctx.strokeRect(x, y, width, height);
        let label = `${pred.class} (${Math.round(pred.confidence * 100)}%)`;
        ctx.fillText(label, x, y > 10 ? y - 5 : 10);
      }
    });
  }

  async function detectionLoop() {
    if (!video || !overlayCanvas || !ctx) {
      requestAnimationFrame(detectionLoop);
      return;
    }

    const currentTime = Date.now();

    if (
      modelReady &&
      video.readyState >= video.HAVE_ENOUGH_DATA &&
      video.videoWidth > 0 &&
      currentTime - lastDetectionTime >= DETECTION_INTERVAL
    ) {
      // Resize overlay canvas untuk mencocokkan video
      if (typeof resizeOverlayCanvas === "function") {
        resizeOverlayCanvas();
      } else {
        // Fallback jika fungsi global tidak tersedia
        if (
          overlayCanvas.width !== video.videoWidth ||
          overlayCanvas.height !== video.videoHeight
        ) {
          overlayCanvas.width = video.videoWidth;
          overlayCanvas.height = video.videoHeight;
        }
      }

      try {
        const imageBlob = await captureFrame(video);
        const predictions = await detectObjects(imageBlob);

        if (predictions && predictions.length > 0) {
          console.log(`Detected ${predictions.length} objects:`, predictions);
          drawDetections(predictions);
        } else {
          // Clear canvas jika tidak ada deteksi
          ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        }

        lastDetectionTime = currentTime;
      } catch (error) {
        console.error("Error saat deteksi:", error);
      }
    }

    requestAnimationFrame(detectionLoop);
  }

  // Setup kamera
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      console.log("Meminta akses kamera...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
        },
      });

      console.log("Akses kamera berhasil!");
      video.srcObject = stream;

      video.onloadedmetadata = function () {
        console.log("Video metadata loaded, memulai playback...");
        // Resize canvas setelah video dimuat
        if (overlayCanvas) {
          overlayCanvas.width = video.videoWidth;
          overlayCanvas.height = video.videoHeight;
        }

        video
          .play()
          .then(() => {
            console.log("Video playback dimulai!");
            modelReady = true;
            detectionLoop();
          })
          .catch((error) => {
            console.error("Error saat memulai video:", error);
            alert("Error saat memulai video. Periksa permission kamera.");
          });
      };

      video.onerror = function (error) {
        console.error("Video error:", error);
        alert("Error pada video stream. Coba refresh halaman.");
      };
    } catch (error) {
      console.error("Akses kamera ditolak atau error:", error);

      let errorMessage = "Akses kamera ditolak. ";
      if (error.name === "NotAllowedError") {
        errorMessage += "Silakan izinkan akses kamera dan refresh halaman.";
      } else if (error.name === "NotFoundError") {
        errorMessage += "Kamera tidak ditemukan. Pastikan kamera terhubung.";
      } else if (error.name === "NotSupportedError") {
        errorMessage += "Browser tidak mendukung akses kamera.";
      } else {
        errorMessage += "Error: " + error.message;
      }

      alert(errorMessage);
    }
  } else {
    console.error("getUserMedia tidak didukung di browser ini");
    alert(
      "Kamera tidak didukung pada browser ini. Gunakan browser modern seperti Chrome atau Firefox."
    );
  }
});
