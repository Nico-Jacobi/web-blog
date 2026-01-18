import React, { useEffect, useState } from 'react';
import { apiService } from '../controller/apiService.js';

const SecureImage = ({ src, alt, className }) => {
    const [imageBlob, setImageBlob] = useState(null);

    useEffect(() => {
        if (!src) return;

        apiService.fetchImageBlob(src)
            .then(url => setImageBlob(url))
            .catch(err => console.error("Image load error:", err));

        // Cleanup memory when component closes
        return () => {
            if (imageBlob) URL.revokeObjectURL(imageBlob);
        };
    }, [src]);

    if (!imageBlob) return <div className="loading-spinner">...</div>;

    return <img src={imageBlob} alt={alt} className={className} />;
};

export default SecureImage;