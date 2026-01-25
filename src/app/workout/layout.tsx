import { Metadata, Viewport } from 'next';
import { WorkoutUserProvider } from '@/context/WorkoutUserContext';
import './workout.css';

export const metadata: Metadata = {
  title: 'Workout Tracker',
  description: 'Personal workout tracking app',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function WorkoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="workout-app" style={{ direction: 'ltr' }}>
      <WorkoutUserProvider>
        {children}
      </WorkoutUserProvider>
    </div>
  );
}
