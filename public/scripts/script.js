document.addEventListener('DOMContentLoaded', function() {
    // Example of loading images dynamically (encrypted images from a server or directory)
    fetch('/path/to/encrypted-images')
        .then(response => response.json())
        .then(images => {
            const gallery = document.getElementById('image-gallery');
            images.forEach(image => {
                const img = document.createElement('img');
                img.src = `/images/${image.filename}`;
                img.alt = image.filename;
                gallery.appendChild(img);
            });
        })
        .catch(error => console.error('Error loading images:', error));
});
