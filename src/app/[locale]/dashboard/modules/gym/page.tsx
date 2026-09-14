import React from 'react';
import { GymCheckInView } from '@/modules/gym/components/GymCheckInView';

export default async function GymModulePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <GymCheckInView />
    </div>
  );
}