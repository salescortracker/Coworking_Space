import { DatePipe, DecimalPipe, NgTemplateOutlet, TitleCasePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from './components/icon/icon.component';
import {
  AvatarComponent,
  BreadcrumbComponent,
  PageHeaderComponent,
  StatCardComponent,
  StatusBadgeComponent,
} from './components/basics/basics.component';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  LoadingStateComponent,
  SuccessStateComponent,
} from './components/states/states.component';
import { DrawerComponent, ModalComponent } from './components/overlay/overlay.component';
import { CellDefDirective, DataTableComponent, PaginationComponent } from './components/table/data-table.component';
import {
  DateStripComponent,
  FieldErrorComponent,
  FileUploadComponent,
  OtpInputComponent,
  TimeSlotsComponent,
} from './components/forms/form-controls.component';
import { DropdownComponent, TabsComponent } from './components/nav/nav.component';
import { CHART_COMPONENTS } from './components/charts/charts.component';
import {
  QrCardComponent,
  QrCodeComponent,
  TimelineComponent,
  WorkspaceImageComponent,
} from './components/visuals/visuals.component';
import { FORMAT_PIPES } from './pipes/format.pipes';
import { BusyButtonDirective } from './components/spinner/busy-button.directive';

export * from './components/icon/icon.component';
export * from './components/basics/basics.component';
export * from './components/states/states.component';
export * from './components/overlay/overlay.component';
export * from './components/table/data-table.component';
export * from './components/forms/form-controls.component';
export * from './components/nav/nav.component';
export * from './components/charts/charts.component';
export * from './components/visuals/visuals.component';
export * from './pipes/format.pipes';
export * from './components/spinner/busy-button.directive';
export * from './utils/loader';
export * from './utils/status';
export * from './utils/export';
export * from './utils/validators';
export * from './utils/dates';

/** Common imports for feature pages. */
export const SHARED = [
  DatePipe,
  DecimalPipe,
  TitleCasePipe,
  NgTemplateOutlet,
  FormsModule,
  ReactiveFormsModule,
  RouterLink,
  RouterLinkActive,
  IconComponent,
  AvatarComponent,
  BreadcrumbComponent,
  PageHeaderComponent,
  StatCardComponent,
  StatusBadgeComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  LoadingStateComponent,
  SuccessStateComponent,
  ModalComponent,
  DrawerComponent,
  DataTableComponent,
  CellDefDirective,
  PaginationComponent,
  FieldErrorComponent,
  OtpInputComponent,
  FileUploadComponent,
  TimeSlotsComponent,
  DateStripComponent,
  TabsComponent,
  DropdownComponent,
  QrCodeComponent,
  QrCardComponent,
  WorkspaceImageComponent,
  TimelineComponent,
  BusyButtonDirective,
  ...CHART_COMPONENTS,
  ...FORMAT_PIPES,
] as const;
