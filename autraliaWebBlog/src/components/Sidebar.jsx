import React from 'react';
import { Navigation, Car, Plane, Bus, Ship } from 'lucide-react';
import StopCard from './StopCard';

export default function Sidebar({ activeId, onSelectStop, trip }) {
    if (!trip) return null;

    return (
        <aside className="w-full md:w-96 flex flex-col border-r border-orange-100 bg-white shrink-0 h-full">
            <div className="p-6 shrink-0">
                <h1 className="text-3xl font-black text-slate-900">{trip.title}</h1>
                <p className="text-slate-400 mt-2 text-sm flex items-center gap-2">
                    <Navigation size={14} className="text-orange-500" />
                    Australien Roadtrip 2025
                </p>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
                {trip.points.map((point) => (
                    <StopCard
                        key={point.id}
                        point={point}
                        isActive={activeId === point.id}
                        onClick={() => onSelectStop(point.id)}
                    />
                ))}

                <div className="p-4 bg-slate-50 rounded-2xl flex flex-wrap gap-4 items-center mt-4">
                    <TransportLabel Icon={Car} label="Auto" color="text-orange-500" />
                    <TransportLabel Icon={Plane} label="Flugzeug" color="text-green-500" />
                    <TransportLabel Icon={Bus} label="Bus" color="text-purple-500" />
                    <TransportLabel Icon={Ship} label="Boot" color="text-blue-500" />
                </div>
            </div>
        </aside>
    );
}

const TransportLabel = ({Icon, label, color }) => (
    <div className="flex items-center gap-2 text-xs text-slate-600">
        <Icon size={14} className={color} /> {label}
    </div>
);