import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { dataTransformer } from '../utils/dataTransformer';

export function useAppData() {
    const [stops, setStops] = useState([]);
    const [routes, setRoutes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);

                const [points, trips] = await Promise.all([
                    apiService.fetchPoints(),
                    apiService.fetchTrips()
                ]);

                // Transform and sort points by tripOrder
                const transformedStops = points
                    .map(point => dataTransformer.pointToStop(point))
                    .sort((a, b) => (a.tripOrder || 0) - (b.tripOrder || 0));

                // Transform trips to routes
                const transformedRoutes = trips.map(trip => dataTransformer.tripToRoute(trip));

                setStops(transformedStops);
                setRoutes(transformedRoutes);
                setError(null);
            } catch (err) {
                console.error('Error fetching data:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    return { stops, routes, loading, error };
}