/*
 * Shared image helper (sign up + my profile). Requires js/shared/session.js.
 *
 *   NovaPS.imageToDataUrl(file, maxSize) -> Promise<string>
 *
 * Shrinks the picture so it fits in localStorage during this demo.
 */
NovaPS.imageToDataUrl = function (file, maxSize) {
  return new Promise(function (resolve, reject) {
    var url = URL.createObjectURL(file);
    var img = new Image();

    img.onload = function () {
      var scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      var canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };

    img.onerror = function () {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read the image."));
    };

    img.src = url;
  });
};
