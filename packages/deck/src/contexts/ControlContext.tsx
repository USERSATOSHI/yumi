import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface ControlState {
	selectedDevice: string | 'all';
	volume: number;
	brightness: number;
}

interface ControlContextType {
	state: ControlState;
	setSelectedDevice: (device: string | 'all') => void;
	setVolume: (volume: number) => void;
	setBrightness: (brightness: number) => void;
}

const defaultState: ControlState = {
	selectedDevice: 'all',
	volume: 50,
	brightness: 50,
};

const ControlContext = createContext<ControlContextType | null>(null);

export function ControlProvider({ children }: { children: ReactNode }) {
	const [state, setState] = useState<ControlState>(defaultState);

	const setSelectedDevice = useCallback((device: string | 'all') => {
		setState((prev) => ({ ...prev, selectedDevice: device }));
	}, []);

	const setVolume = useCallback((volume: number) => {
		setState((prev) => ({ ...prev, volume }));
	}, []);

	const setBrightness = useCallback((brightness: number) => {
		setState((prev) => ({ ...prev, brightness }));
	}, []);

	return (
		<ControlContext.Provider value={{ state, setSelectedDevice, setVolume, setBrightness }}>
			{children}
		</ControlContext.Provider>
	);
}

export function useControlState() {
	const context = useContext(ControlContext);
	if (!context) {
		throw new Error('useControlState must be used within a ControlProvider');
	}
	return context;
}
