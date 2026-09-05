import { Routes } from '@angular/router';

import { Landing } from './landing/landing';

export const routes: Routes = [
  { path: '', component: Landing, title: 'SPÜLBOY® — NU® Portable, NU® Built-in & Neptun T2000 glass washers in 3D' },
  { path: '**', redirectTo: '' },
];
