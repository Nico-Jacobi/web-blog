import React from 'react';
import { Navigation, Camera, Bus, Car, Ship, Plane } from 'lucide-react';
import StopCard from './StopCard';

export default function Sidebar({ activeId, onSelectStop, stops, loading }) {
    return (
        <aside className="w-full md:w-96 flex flex-col border-r border-orange-100 bg-white shrink-0">
            <div className="p-6 shrink-0">
                <h1 className="text-3xl font-black text-slate-900">Australien Roadtrip</h1>
                <p className="text-slate-400 mt-2 text-sm flex items-center gap-2">
                    <Navigation size={14} className="text-orange-500" />
                    5.400 km • Okt - Nov 2025
                </p>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <>
                        {stops.map((stop) => (
                            <StopCard
                                key={stop.id}
                                stop={stop}
                                isActive={activeId === stop.id}
                                onClick={() => onSelectStop(stop.id)}
                            />
                        ))}

                        <div className="p-6 bg-slate-900 rounded-2xl text-white mt-4">
                            <Camera className="mb-3 text-orange-400" size={24}/>
                            <h4 className="font-bold">Neue Erinnerung?</h4>
                            <p className="text-slate-400 text-xs mt-1 mb-4">
                                Lade deine Fotos direkt an den Ort auf der Karte hoch.
                            </p>
                            <button
                                className="w-full py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-semibold transition">
                                Foto wählen
                            </button>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-2xl flex flex-wrap gap-4 items-center">
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                                <Car size={14} className="text-orange-500" /> Auto
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                                <Plane size={14} className="text-green-500" /> Flugzeug
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                                <Bus size={14} className="text-purple-500" /> Bus
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                                <Ship size={14} className="text-blue-500" /> Boot
                            </div>
                        </div>
                    </>
                )}
            </div>
        </aside>
    );
}