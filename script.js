document.addEventListener("DOMContentLoaded", function () {
  const imageInput = document.getElementById("imageUpload");
  const uploadedImage = document.getElementById("uploadedImage");
  let currentObjectUrl = null;

  const ROBOFLOW_PROJECT_ID = "dataset-6nff1";
  const ROBOFLOW_VERSION_ID = "4";
  const ROBOFLOW_API_KEY = "UL8nLpCiEBGbxYqRq0nY";
  const ROBOFLOW_API_URL = `https://detect.roboflow.com/${ROBOFLOW_PROJECT_ID}/${ROBOFLOW_VERSION_ID}?api_key=${ROBOFLOW_API_KEY}&format=image&labels=on&stroke=3&confidence=40`;

  imageInput.addEventListener("change", function () {
    const file = this.files[0];
    if (file && file.type.startsWith("image/")) {
      sendToRoboflowAPI(file);
    } else {
      uploadedImage.style.display = "none";
      if (file) {
        alert("Silakan pilih file gambar yang valid (contoh: JPG, PNG).");
      }
    }
  });

  async function sendToRoboflowAPI(imageFile) {
    const formData = new FormData();
    formData.append("file", imageFile);

    console.log("Sending image to Roboflow (expecting processed image)...");
    uploadedImage.src = "";
    uploadedImage.style.display = "none";

    try {
      const response = await fetch(ROBOFLOW_API_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("Roboflow API Error Response:", errorBody);
        throw new Error(
          `HTTP error ${response.status}: ${response.statusText}. Server says: ${errorBody}`
        );
      }

      const imageBlob = await response.blob();

      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
      }
      currentObjectUrl = URL.createObjectURL(imageBlob);

      uploadedImage.src = currentObjectUrl;
      uploadedImage.style.display = "block";
      console.log("Processed image received from Roboflow and displayed.");
    } catch (err) {
      console.error(
        "Gagal mengirim ke Roboflow API atau memproses respons gambar:",
        err
      );
      alert(
        "Gagal mendapatkan gambar hasil deteksi dari server. Cek konsol untuk detail."
      );
      uploadedImage.style.display = "none";
    }
  }
});
