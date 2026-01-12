import React from 'react';

export default function PointDetail({ stop }) {
    if (!stop) return null;

    return (
        <div className="w-full bg-white border-t border-orange-100 p-6">
            <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                    <h2 className="text-3xl font-black text-slate-900 mb-2">{stop.title}</h2>
                    {stop.date && (
                        <p className="text-slate-500 text-sm">{stop.date}</p>
                    )}
                </div>

                {/* Title Image */}
                <div className="mb-6">
                    <img
                        src={stop.image}
                        alt={stop.title}
                        className="w-full h-96 object-cover rounded-2xl shadow-lg"
                        onError={(e) => {
                            console.error('Failed to load image:', stop.image);
                            e.target.style.display = 'none';
                        }}
                    />
                </div>

                {/* Description */}
                <div className="prose prose-slate max-w-none mb-8">
                    <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {stop.description}
                    </p>
                </div>

                {/* Other Images */}
                {stop.otherImages && stop.otherImages.length > 0 && (
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 mb-4">Weitere Bilder</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {stop.otherImages.map((img, idx) => (
                                <img
                                    key={idx}
                                    src={img}
                                    alt={`${stop.title} - Bild ${idx + 1}`}
                                    className="w-full h-48 object-cover rounded-xl shadow hover:shadow-lg transition"
                                    onError={(e) => {
                                        console.error('Failed to load image:', img);
                                        e.target.style.display = 'none';
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}