import { Metadata, Viewport } from 'next';
import { WorkoutUserProvider } from '@/context/WorkoutUserContext';
import { WorkoutLanguageProvider } from '@/context/WorkoutLanguageContext';
import WorkoutShell from '@/components/workout/WorkoutShell';
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
    <WorkoutLanguageProvider>
      <WorkoutShell>
        <WorkoutUserProvider>
          {children}
        </WorkoutUserProvider>
      </WorkoutShell>
    </WorkoutLanguageProvider>
  );
}
