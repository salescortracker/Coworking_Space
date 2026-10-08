import { Routes } from '@angular/router';
import { authGuard, guestGuard } from '../../core/guards/auth.guards';

export const AUTH_ROUTES: Routes = [
  { path: 'login', canMatch: [guestGuard], title: 'Sign in · Officera', loadComponent: () => import('./login.component').then((m) => m.LoginComponent) },
  { path: 'register', canMatch: [guestGuard], title: 'Create account · Officera', loadComponent: () => import('./register.component').then((m) => m.RegisterComponent) },
  { path: 'verify-otp', title: 'Verify OTP · Officera', loadComponent: () => import('./verify-otp.component').then((m) => m.VerifyOtpComponent) },
  { path: 'forgot-password', title: 'Forgot password · Officera', loadComponent: () => import('./password.component').then((m) => m.ForgotPasswordComponent) },
  { path: 'reset-password', title: 'Reset password · Officera', loadComponent: () => import('./password.component').then((m) => m.ResetPasswordComponent) },
  { path: 'complete-profile', canMatch: [authGuard], title: 'Complete profile · Officera', loadComponent: () => import('./complete-profile.component').then((m) => m.CompleteProfileComponent) },
];
