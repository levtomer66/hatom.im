import { Metadata, Viewport } from 'next';
import { WorkoutUserProvider } from '@/context/WorkoutUserContext';
import { WorkoutLanguageProvider } from '@/context/WorkoutLanguageContext';
import { WorkoutUnitProvider } from '@/context/WorkoutUnitContext';
import { WorkoutTimerProvider } from '@/context/WorkoutTimerContext';
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
  // WorkoutUserProvider is now above WorkoutShell so that anything rendered
  // by the shell itself (e.g. the help FAB) can read the current user.
  return (
    <WorkoutLanguageProvider>
      <WorkoutUnitProvider>
        <WorkoutTimerProvider>
          <WorkoutUserProvider>
            <WorkoutShell>
              {children}
            </WorkoutShell>
          </WorkoutUserProvider>
        </WorkoutTimerProvider>
      </WorkoutUnitProvider>
    </WorkoutLanguageProvider>
  );
}
