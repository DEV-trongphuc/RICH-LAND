export const compressToWebP = (file: File, quality = 0.8): Promise<File> => {
  return new Promise((resolve) => {
    // Only process image files
    if (!file.type.startsWith('image/')) {
      return resolve(file);
    }
    
    // Skip if it's already a compressed webp or if we can't process it (e.g. svg, gif might lose animations, but standard raster images like png/jpg are fine)
    if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Resize if the image is extremely large (e.g. max width/height 1920px) to save space
        const MAX_SIZE = 1920;
        if (width > MAX_SIZE || height > MAX_SIZE) {
          if (width > height) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          } else {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(file);
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve(file);
            }
            // Create a new File from the blob with .webp extension
            const webpName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
            const webpFile = new File([blob], webpName, {
              type: 'image/webp',
              lastModified: Date.now()
            });
            resolve(webpFile);
          },
          'image/webp',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = event.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
};
